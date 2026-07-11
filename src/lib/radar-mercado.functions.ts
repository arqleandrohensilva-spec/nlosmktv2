import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { logAnthropicUsage } from "./uso-ia.server";

function sb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
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

export const buscarLancamentos = createServerFn({ method: "POST" }).handler(async () => {
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
      system: SYSTEM_PROMPT_BUSCA,
      messages: [{ role: "user", content: USER_PROMPT_BUSCA }],
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
  const finalText = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();

  const parsed = extractJson<{ lancamentos: LancamentoBruto[]; resumo: string }>(finalText);
  const lista = Array.isArray(parsed.lancamentos) ? parsed.lancamentos : [];

  const client = sb();
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
    const { error } = await client.from("mkt_lancamentos").insert({
      nome: l.nome,
      tipo,
      cidade: l.cidade,
      construtora: l.construtora,
      bairro: l.bairro,
      faixa_preco: l.faixa_preco,
      descricao: l.descricao,
      url_fonte: l.url_fonte,
      data_lancamento: l.data_lancamento,
      status: "novo",
    });
    if (!error) novos++;
  }

  await client.from("mkt_radar_buscas").insert({
    resultados_encontrados: lista.length,
    novos_lancamentos: novos,
    resumo: parsed.resumo ?? null,
  });

  await logAnthropicUsage({
    modulo: "radar-mercado",
    operacao: "busca_lancamentos",
    tokens_input: json?.usage?.input_tokens ?? 0,
    tokens_output: json?.usage?.output_tokens ?? 0,
    detalhes: { encontrados: lista.length, novos },
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
  .inputValidator((input: unknown) => ConteudoInput.parse(input))
  .handler(async ({ data }) => {
    const client = sb();
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
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data }) => {
    const client = sb();
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
  .inputValidator((input: unknown) => ManualInput.parse(input))
  .handler(async ({ data }) => {
    const userPrompt = `Pesquise na web tudo que existir sobre o empreendimento imobiliário chamado '${data.nome}', preferencialmente na região de São José dos Campos, Jacareí ou Caçapava no interior de São Paulo. Retorne todas as informações encontradas no formato solicitado.`;

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
        system: SYSTEM_PROMPT_MANUAL,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Limite de requisições atingido.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha na IA (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const blocks: Array<{ type: string; text?: string }> = json?.content ?? [];
    const finalText = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
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
    }>(finalText);

    const tipo = ["loteamento", "condominio", "apartamento", "comercial"].includes(parsed.tipo)
      ? parsed.tipo
      : "loteamento";

    const client = sb();
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
        url_fonte: parsed.url_fonte,
        data_lancamento: parsed.data_lancamento,
        status: "novo",
        notas: "Adicionado manualmente",
      })
      .select("*")
      .single();

    if (error) throw new Error(`Falha ao salvar lançamento: ${error.message}`);

    await logAnthropicUsage({
      modulo: "radar-mercado",
      operacao: "adicao_manual",
      tokens_input: json?.usage?.input_tokens ?? 0,
      tokens_output: json?.usage?.output_tokens ?? 0,
      detalhes: { nome: data.nome },
    });

    return inserted;
  });