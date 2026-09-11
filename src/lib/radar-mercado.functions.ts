import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseExternal } from "@/lib/supabaseExternal";
import { logAnthropicUsage, logGeminiUsage } from "./uso-ia.server";
import { NL_OS_SUPABASE_ANON_KEY, NL_OS_SUPABASE_URL } from "./supabase-config";

// Client middleware forwards the external Supabase session token via sendContext,
// so the server always has it regardless of how global middleware serializes headers.
const withExternalAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { data } = await supabaseExternal.auth.getSession();
    const token = data.session?.access_token ?? null;
    return next({ sendContext: { accessToken: token } });
  })
  .server(async ({ next, context }) => next({ context }));

function sb(accessToken?: string | null) {
  let authHeader: string | undefined = accessToken ? `Bearer ${accessToken}` : undefined;
  if (!authHeader) {
    try {
      authHeader = getRequest()?.headers.get("authorization") ?? undefined;
    } catch {}
  }
  return createClient(
    NL_OS_SUPABASE_URL,
    NL_OS_SUPABASE_ANON_KEY,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    },
  );
}

const SYSTEM_PROMPT_BUSCA = `Você é o radar de mercado imobiliário da NL Arquitetos, escritório de arquitetura em São José dos Campos, SP.

Sua função é pesquisar na web e identificar lançamentos imobiliários recentes (últimos 90 dias) em:
- São José dos Campos (SJC)
- Jacareí
- Caçapava

Buscar por:
1. Loteamentos novos (terrenos, lotes residenciais)
2. Condomínios residenciais lançados
3. Lançamentos de apartamentos
4. Empreendimentos comerciais novos

Fontes a pesquisar:
- VivaReal, ZAP Imóveis, OLX, Imovelweb
- Sites de construtoras locais
- Portais de notícias locais (A Cidade, O Vale)
- Instagram de imobiliárias e construtoras de SJC
- Prefeitura de SJC (licitações e aprovações)

Para cada lançamento encontrado, extrair: nome, tipo, cidade, construtora, bairro, faixa de preço, descrição, url_fonte, data_lancamento.

Responda EXCLUSIVAMENTE com JSON puro, sem markdown:
{
  "lancamentos": [
    {
      "nome": "...",
      "tipo": "loteamento|condominio|apartamento|comercial",
      "cidade": "SJC|Jacareí|Caçapava",
      "construtora": "... ou null",
      "bairro": "...",
      "faixa_preco": "... ou null",
      "descricao": "2-3 frases",
      "url_fonte": "... ou null",
      "data_lancamento": "mês/ano ou null"
    }
  ],
  "resumo": "1 frase"
}`;

const USER_PROMPT_BUSCA =
  "Pesquise na web por lançamentos imobiliários recentes (últimos 90 dias) em São José dos Campos, Jacareí e Caçapava. Busque loteamentos, condomínios, apartamentos e empreendimentos comerciais novos. Use as ferramentas de busca disponíveis para encontrar informações atualizadas.";

const SYSTEM_PROMPT_CONTEUDO = `Você é o estrategista de conteúdo e prospecção da NL Arquitetos.

Recebe informações sobre um lançamento imobiliário na região de SJC e gera conteúdos estratégicos para a NL se posicionar como o escritório de arquitetura de referência para quem vai comprar nesse empreendimento.

CONTEXTO NL:
- Escritório em São José dos Campos
- Serve quem comprou lote/terreno e não sabe por onde começar
- Serve quem comprou apartamento e quer projeto de interiores
- Lema: "A arquitetura como decisão"
- Tom: técnico com empatia, sem urgência, CTA de baixo atrito

LINHA MAIS RELEVANTE POR TIPO:
- Loteamento → Linha A (quem vai construir do zero)
- Condomínio fechado → Linha A ou A+B
- Apartamento → Linha B (interiores)
- Comercial → Linha C

Responda EXCLUSIVAMENTE com JSON puro, sem markdown:
{
  "oportunidade_linha": "A|B|AB|C",
  "justificativa_linha": "...",
  "por_que_agora": "...",
  "conteudos": {
    "post_feed": "legenda Instagram, sem emoji, CTA de baixo atrito, sem citar o empreendimento diretamente",
    "gancho_conteudo": "ângulo educativo",
    "script_abordagem": "script para contatar construtora/imobiliária, tom de parceria",
    "cta_prospeccao": "mensagem de primeiro contato WhatsApp/e-mail, máx 3 frases, tom NL"
  }
}`;

function extractJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {}
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const s = cleaned.indexOf("{");
  const e = cleaned.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Resposta da IA não estava em JSON válido.");
  return JSON.parse(cleaned.slice(s, e + 1)) as T;
}

function apiKey() {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) throw new Error("ANTHROPIC_API_KEY não configurada.");
  return k;
}

export type Fonte = { title: string; uri: string };

// Modelo do radar: usa o Gemini gratuito (Google AI Studio). O 2.5-pro foi
// descontinuado para novos usuários; o flash novo aceita a chave formato "AQ..."
// e suporta Google Search grounding. Configurável por env.
const GEMINI_MODEL =
  process.env.GEMINI_MODEL_RADAR?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

function geminiKey() {
  return process.env.GEMINI_API_KEY ?? null;
}

/**
 * Chama o Gemini (AI Studio) com Google Search grounding — resultados reais
 * indexados pelo Google, com as fontes citadas.
 */
async function callGeminiGrounded(system: string, prompt: string) {
  const key = geminiKey();
  if (!key) throw new Error("GEMINI_API_KEY não configurada.");

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
  });

  // 429 (limite por minuto) e 503 (sobrecarga) são transitórios no tier grátis:
  // espera e tenta de novo antes de desistir.
  const MAX_TENTATIVAS = 4;
  let res!: Response;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
      },
    );
    if (res.ok) break;
    if ((res.status === 429 || res.status === 503) && tentativa < MAX_TENTATIVAS) {
      await new Promise((r) => setTimeout(r, 2500 * tentativa));
      continue;
    }
    break;
  }

  if (!res.ok) {
    const errBody = await res.text();
    if (res.status === 429) throw new Error(`Limite do Gemini (429). Motivo do Google: ${errBody.slice(0, 400)}`);
    if (res.status === 503) throw new Error("O Gemini está sobrecarregado agora (pico de demanda). Tente novamente em alguns segundos.");
    if (res.status === 403) throw new Error("Chave do Gemini sem permissão para este modelo ou para o Google Search grounding.");
    throw new Error(`Falha na IA Gemini (${res.status}): ${errBody.slice(0, 300)}`);
  }

  const json = await res.json();
  const cand = json?.candidates?.[0];
  const parts: Array<{ text?: string }> = cand?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("\n").trim();

  const chunks: Array<{ web?: { uri?: string; title?: string } }> =
    cand?.groundingMetadata?.groundingChunks ?? [];
  const fontes: Fonte[] = [];
  for (const c of chunks) {
    const uri = c?.web?.uri;
    if (!uri || fontes.some((f) => f.uri === uri)) continue;
    fontes.push({ title: c.web?.title ?? uri, uri });
  }

  return {
    text,
    fontes,
    tokens_input: json?.usageMetadata?.promptTokenCount ?? 0,
    tokens_output: json?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/** Chamada ao Claude com web_search — usada como fallback quando não há GEMINI_API_KEY. */
async function callClaudeWebSearch(system: string, prompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados.");
    throw new Error(`Falha na IA (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const blocks: Array<{ type: string; text?: string }> = json?.content ?? [];
  return {
    text: blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim(),
    fontes: [] as Fonte[],
    tokens_input: json?.usage?.input_tokens ?? 0,
    tokens_output: json?.usage?.output_tokens ?? 0,
  };
}

/** Motor de pesquisa web do radar: Gemini + grounding quando disponível, senão Claude. */
async function pesquisarWeb(system: string, prompt: string) {
  if (geminiKey()) {
    const r = await callGeminiGrounded(system, prompt);
    return { ...r, provider: "gemini" as const };
  }
  const r = await callClaudeWebSearch(system, prompt);
  return { ...r, provider: "anthropic" as const };
}

async function logPesquisa(
  provider: "gemini" | "anthropic",
  input: { operacao: string; tokens_input: number; tokens_output: number; detalhes?: Record<string, unknown> },
) {
  const log = provider === "gemini" ? logGeminiUsage : logAnthropicUsage;
  await log({ modulo: "radar-mercado", ...input });
}

/** Salva as fontes citadas; ignora silenciosamente se a coluna `fontes` ainda não existir. */
async function salvarFontes(
  client: ReturnType<typeof sb>,
  id: string,
  fontes: Fonte[],
) {
  if (!fontes.length) return;
  const { error } = await client
    .from("mkt_lancamentos")
    .update({ fontes: fontes.slice(0, 8) as never })
    .eq("id", id);
  if (error) console.warn("Não foi possível salvar fontes:", error.message);
}

type LancamentoBruto = {
  nome: string;
  tipo: string;
  cidade: string;
  construtora: string | null;
  bairro: string | null;
  faixa_preco: string | null;
  descricao: string | null;
  url_fonte: string | null;
  data_lancamento: string | null;
};

export const buscarLancamentos = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .handler(async ({ context }) => {
  const pesquisa = await pesquisarWeb(SYSTEM_PROMPT_BUSCA, USER_PROMPT_BUSCA);
  const parsed = extractJson<{ lancamentos: LancamentoBruto[]; resumo: string }>(pesquisa.text);
  const lista = Array.isArray(parsed.lancamentos) ? parsed.lancamentos : [];

  const client = sb(context.accessToken);
  let novos = 0;
  for (const l of lista) {
    if (!l?.nome || !l?.cidade) continue;
    const { data: existing } = await client
      .from("mkt_lancamentos")
      .select("id")
      .eq("nome", l.nome)
      .eq("cidade", l.cidade)
      .maybeSingle();
    if (existing) continue;
    const tipo = ["loteamento", "condominio", "apartamento", "comercial"].includes(l.tipo)
      ? l.tipo
      : "loteamento";
    const fonteCitada = l.url_fonte ?? pesquisa.fontes[0]?.uri ?? null;
    const { data: inserido, error } = await client
      .from("mkt_lancamentos")
      .insert({
        nome: l.nome,
        tipo,
        cidade: l.cidade,
        construtora: l.construtora,
        bairro: l.bairro,
        faixa_preco: l.faixa_preco,
        descricao: l.descricao,
        url_fonte: fonteCitada,
        data_lancamento: l.data_lancamento,
        status: "novo",
      })
      .select("id")
      .maybeSingle();
    if (!error) {
      novos++;
      if (inserido?.id) await salvarFontes(client, inserido.id, pesquisa.fontes);
    }
  }

  await client.from("mkt_radar_buscas").insert({
    resultados_encontrados: lista.length,
    novos_lancamentos: novos,
    resumo: parsed.resumo ?? null,
  });

  await logPesquisa(pesquisa.provider, {
    operacao: "busca_lancamentos",
    tokens_input: pesquisa.tokens_input,
    tokens_output: pesquisa.tokens_output,
    detalhes: { encontrados: lista.length, novos, fontes: pesquisa.fontes.length },
  });

  return { total: lista.length, novos, resumo: parsed.resumo ?? "" };
});

const ConteudoInput = z.object({ id: z.string().uuid() });

type ConteudoResposta = {
  oportunidade_linha: string;
  justificativa_linha: string;
  por_que_agora: string;
  conteudos: {
    post_feed: string;
    gancho_conteudo: string;
    script_abordagem: string;
    cta_prospeccao: string;
  };
};

export const gerarConteudosLancamento = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => ConteudoInput.parse(input))
  .handler(async ({ data, context }) => {
    const client = sb(context.accessToken);
    const { data: row, error } = await client
      .from("mkt_lancamentos")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Lançamento não encontrado.");

    const userPrompt = [
      `Lançamento: ${row.nome}`,
      `Tipo: ${row.tipo}`,
      `Cidade: ${row.cidade}`,
      `Bairro: ${row.bairro ?? "-"}`,
      `Construtora: ${row.construtora ?? "-"}`,
      `Faixa de preço: ${row.faixa_preco ?? "-"}`,
      `Descrição: ${row.descricao ?? "-"}`,
      "",
      "Gere os conteúdos estratégicos para a NL Arquitetos se posicionar como referência para os compradores desse empreendimento.",
    ].join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: SYSTEM_PROMPT_CONTEUDO,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Limite de requisições atingido.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha na IA (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    const parsed = extractJson<ConteudoResposta>(text);

    const { data: updated, error: upErr } = await client
      .from("mkt_lancamentos")
      .update({
        oportunidade_linha: parsed.oportunidade_linha,
        conteudos: {
          justificativa_linha: parsed.justificativa_linha,
          por_que_agora: parsed.por_que_agora,
          ...parsed.conteudos,
        } as never,
        status: row.status === "novo" ? "conteudo_gerado" : row.status,
      })
      .eq("id", data.id)
      .select("*")
      .single();

    if (upErr) throw new Error(`Falha ao salvar conteúdos: ${upErr.message}`);

    await logAnthropicUsage({
      modulo: "radar-mercado",
      operacao: "conteudo_lancamento",
      tokens_input: json?.usage?.input_tokens ?? 0,
      tokens_output: json?.usage?.output_tokens ?? 0,
      detalhes: { id: data.id, tipo: row.tipo, cidade: row.cidade },
    });

    return updated;
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["novo", "conteudo_gerado", "prospectado", "arquivado"]).optional(),
  notas: z.string().optional(),
});

export const atualizarLancamento = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const client = sb(context.accessToken);
    const patch: Record<string, unknown> = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.notas !== undefined) patch.notas = data.notas;
    const { data: row, error } = await client
      .from("mkt_lancamentos")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const ManualInput = z.object({
  nome: z.string().min(1),
});

const SYSTEM_PROMPT_MANUAL = `Você é o radar de mercado da NL Arquitetos em São José dos Campos, SP.

Recebe apenas o nome de um empreendimento imobiliário e deve pesquisar na web tudo que existir sobre ele.

Responda EXCLUSIVAMENTE com JSON puro, sem markdown:
{
  "nome": "nome oficial do empreendimento",
  "tipo": "loteamento|condominio|apartamento|comercial",
  "cidade": "SJC|Jacareí|Caçapava|Outra",
  "construtora": "nome da construtora ou null",
  "bairro": "bairro ou região ou null",
  "faixa_preco": "faixa de preço ou null",
  "descricao": "descrição completa em 3-4 frases com tudo que encontrou",
  "url_fonte": "melhor URL encontrada ou null",
  "data_lancamento": "data aproximada ou null"
}`;

export const adicionarManual = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => ManualInput.parse(input))
  .handler(async ({ data, context }) => {
    const userPrompt = `Pesquise na web tudo que existir sobre o empreendimento imobiliário chamado '${data.nome}', preferencialmente na região de São José dos Campos, Jacareí ou Caçapava no interior de São Paulo. Retorne todas as informações encontradas no formato solicitado.`;

    const pesquisa = await pesquisarWeb(SYSTEM_PROMPT_MANUAL, userPrompt);
    const parsed = extractJson<{
      nome: string;
      tipo: string;
      cidade: string;
      construtora: string | null;
      bairro: string | null;
      faixa_preco: string | null;
      descricao: string | null;
      url_fonte: string | null;
      data_lancamento: string | null;
    }>(pesquisa.text);

    const tipo = ["loteamento", "condominio", "apartamento", "comercial"].includes(parsed.tipo)
      ? parsed.tipo
      : "loteamento";

    const client = sb(context.accessToken);
    const descricao = parsed.descricao;

    const { data: inserted, error } = await client
      .from("mkt_lancamentos")
      .insert({
        nome: parsed.nome || data.nome,
        tipo,
        cidade: parsed.cidade || "Outra",
        construtora: parsed.construtora,
        bairro: parsed.bairro,
        faixa_preco: parsed.faixa_preco,
        descricao,
        url_fonte: parsed.url_fonte ?? pesquisa.fontes[0]?.uri ?? null,
        data_lancamento: parsed.data_lancamento,
        status: "novo",
        notas: "Adicionado manualmente",
      })
      .select("*")
      .single();

    if (error) throw new Error(`Falha ao salvar lançamento: ${error.message}`);

    if (inserted?.id) await salvarFontes(client, inserted.id, pesquisa.fontes);

    await logPesquisa(pesquisa.provider, {
      operacao: "adicao_manual",
      tokens_input: pesquisa.tokens_input,
      tokens_output: pesquisa.tokens_output,
      detalhes: { nome: data.nome, fontes: pesquisa.fontes.length },
    });

    return { ...inserted, fontes: pesquisa.fontes };
  });