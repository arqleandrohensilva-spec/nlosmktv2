import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { logAnthropicUsage } from "./uso-ia.server";

const GerarInput = z.object({
  nome: z.string().min(1),
  linha: z.string().min(1),
  ambiente: z.string().optional(),
  projeto_id: z.string().uuid().nullable().optional(),
  imagem_antes_id: z.string().uuid(),
  imagem_depois_id: z.string().uuid(),
  antes_base64: z.string().min(1),
  antes_media_type: z.string().min(1),
  depois_base64: z.string().min(1),
  depois_media_type: z.string().min(1),
});

const RegenInput = z.object({ id: z.string().uuid() });

const NarrativaInput = z.object({
  projeto_id: z.string().uuid(),
});

const SYSTEM_AD = `Você é o curador visual da NL Arquitetos.
Recebe DUAS imagens: a primeira é o ANTES, a segunda é o DEPOIS de uma intervenção de arquitetura ou interiores.

Analise a transformação e gere conteúdos que narrem a decisão técnica por trás da mudança — não apenas a diferença visual.

FOCO: o que foi decidido tecnicamente que causou essa transformação? Não descrever "ficou mais bonito" — descrever qual problema foi resolvido e qual decisão resolveu.

REGRAS NL (aplicar em todos os formatos):
- Sem emoji
- Sem superlativo vazio ("incrível", "lindo", "perfeito")
- CTA de baixo atrito
- Tom técnico com empatia
- Nunca prometer preço

Responda EXCLUSIVAMENTE com JSON puro, sem markdown:
{
  "descricao_transformacao": "análise em 3-4 frases técnicas: o que existia, qual decisão foi tomada, qual problema foi resolvido, qual resultado técnico",
  "conteudos": {
    "feed": "legenda Instagram Feed narrando a transformação. Abertura com a decisão técnica. 3-4 parágrafos. CTA de baixo atrito.",
    "stories": "3 telas separadas por ---.\\nTela 1: estado anterior em 1 frase\\nTela 2: decisão técnica que mudou tudo\\nTela 3: resultado + CTA",
    "reels": "legenda Reels. Abertura nos primeiros 125 chars mostrando o contraste. Desenvolvimento técnico. CTA.",
    "roteiro_reels": "roteiro de 45-90s. GANCHO (0-3s): depois primeiro, corta para o antes. DESENVOLVIMENTO: decisão técnica alternando imagens. FECHAMENTO: volta ao depois com argumento completo. CTA.",
    "carrossel": "pauta 6-8 slides.\\nSlide 1: CAPA com título da transformação\\nSlide 2: foto ANTES com legenda técnica do que existia\\nSlide 3: a decisão — o que foi planejado e por quê\\nSlides 4-6: detalhes do depois com argumento técnico\\nSlide 7: o que mudou além do visual (conforto, função)\\nSlide 8: CTA",
    "blog": "texto 400-600 palavras. Estrutura: situação inicial → diagnóstico técnico → decisões tomadas → resultado mensurável → convite.",
    "email": "ASSUNTO: linha de assunto (máx 50 chars)\\nCORPO: 3 parágrafos narrando a transformação + CTA de conversa sem compromisso"
  }
}`;

const SYSTEM_NARRATIVA = `Você é o narrador de projetos da NL Arquitetos.
Recebe múltiplas imagens e descrições de um mesmo projeto e gera uma narrativa completa que conta a história do projeto como sequência de decisões técnicas.

Não é um portfólio — é um argumento. Cada imagem é uma decisão. A narrativa conecta as decisões.

REGRAS NL: sem emoji, sem superlativo, CTA baixo atrito, tom técnico com empatia.

Responda EXCLUSIVAMENTE com JSON puro, sem markdown:
{
  "titulo_projeto": "título editorial (não o nome técnico — um título que comunica o partido)",
  "partido_central": "1-2 frases descrevendo o partido arquitetônico central",
  "sequencia_narrativa": [
    { "imagem_ambiente": "ambiente desta etapa", "titulo": "título do momento narrativo", "texto": "2-3 frases narrando a decisão técnica" }
  ],
  "estudo_de_caso": {
    "problema": "qual era o desafio técnico",
    "partido": "qual foi a abordagem adotada",
    "solucoes": ["decisão 1", "decisão 2", "decisão 3"],
    "resultado": "o que o projeto entregou além do visual"
  },
  "conteudos": {
    "carrossel_projeto": "pauta completa. Slide 1: capa com título editorial. Slides 2-N: uma imagem por slide com texto técnico. Último: CTA.",
    "roteiro_reels_90s": "roteiro Reels 90s com sequência de planos, narração e CTA.",
    "texto_site": "texto completo para página do projeto no site. 600-800 palavras. Estrutura editorial. Vocabulário NL.",
    "email_apresentacao": "ASSUNTO + CORPO. Tom técnico, sem venda direta."
  }
}`;

function serverSb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

function detectMediaType(base64: string): string {
  const header = base64.substring(0, 20);
  if (header.startsWith("/9j/")) return "image/jpeg";
  if (header.startsWith("iVBORw0KGgo")) return "image/png";
  if (header.startsWith("R0lGOD")) return "image/gif";
  if (header.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

function parseJson<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Resposta da IA não estava em JSON válido.");
    let cand = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(cand) as T;
    } catch {
      cand = cand.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " ");
      return JSON.parse(cand) as T;
    }
  }
}

async function callAnthropic(
  system: string,
  userContent: Array<Record<string, unknown>>,
  maxTokens = 6000,
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("A chave da Anthropic (ANTHROPIC_API_KEY) não foi configurada.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados.");
    throw new Error(`Falha na IA (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const text: string = json?.content?.[0]?.text ?? "";
  if (json?.stop_reason === "max_tokens") {
    throw new Error("Resposta cortada por limite de tokens. Tente novamente ou use imagens menores.");
  }
  return {
    text,
    usage: { input: json?.usage?.input_tokens ?? 0, output: json?.usage?.output_tokens ?? 0 },
  };
}

type AntesDepoisResultado = {
  descricao_transformacao: string;
  conteudos: {
    feed: string;
    stories: string;
    reels: string;
    roteiro_reels: string;
    carrossel: string;
    blog: string;
    email: string;
  };
};

async function gerarConteudoAD(
  antesB64: string,
  antesMt: string,
  depoisB64: string,
  depoisMt: string,
  linha: string,
  ambiente: string | undefined,
) {
  const userText = `Linha: ${linha}. Ambiente: ${ambiente ?? "(a detectar)"}. Analise a transformação entre as duas imagens (a primeira é o ANTES, a segunda é o DEPOIS) e gere todos os conteúdos conforme instruído. Responda apenas com JSON puro.`;
  const { text, usage } = await callAnthropic(SYSTEM_AD, [
    { type: "image", source: { type: "base64", media_type: detectMediaType(antesB64), data: antesB64 } },
    { type: "image", source: { type: "base64", media_type: detectMediaType(depoisB64), data: depoisB64 } },
    { type: "text", text: userText },
  ]);
  return { parsed: parseJson<AntesDepoisResultado>(text), usage };
}

export const gerarAntesDepois = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GerarInput.parse(input))
  .handler(async ({ data }) => {
    const { parsed, usage } = await gerarConteudoAD(
      data.antes_base64,
      data.antes_media_type,
      data.depois_base64,
      data.depois_media_type,
      data.linha,
      data.ambiente,
    );

    const sb = serverSb();
    const { data: row, error } = await sb
      .from("mkt_antes_depois")
      .insert({
        nome: data.nome,
        linha: data.linha,
        ambiente: data.ambiente ?? null,
        projeto_id: data.projeto_id ?? null,
        imagem_antes_id: data.imagem_antes_id,
        imagem_depois_id: data.imagem_depois_id,
        descricao_transformacao: parsed.descricao_transformacao,
        conteudos: parsed.conteudos as never,
      })
      .select("*")
      .single();
    if (error) throw new Error(`Falha ao salvar comparativo: ${error.message}`);

    await logAnthropicUsage({
      modulo: "biblioteca",
      operacao: "antes_depois",
      tokens_input: usage.input,
      tokens_output: usage.output,
      detalhes: { projeto_id: data.projeto_id ?? null, linha: data.linha, ambiente: data.ambiente ?? null },
    });

    return row;
  });

async function baixarComoBase64(sb: ReturnType<typeof serverSb>, path: string) {
  const { data: file, error } = await sb.storage.from("mkt-biblioteca-visual").download(path);
  if (error || !file) throw new Error(`Falha ao baixar ${path}`);
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return { base64: btoa(binary), media_type: file.type || "image/jpeg" };
}

export const regenerarAntesDepois = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RegenInput.parse(input))
  .handler(async ({ data }) => {
    const sb = serverSb();
    const { data: row, error } = await sb
      .from("mkt_antes_depois")
      .select("*, antes:biblioteca_imagens!antes_depois_imagem_antes_id_fkey(url_storage), depois:biblioteca_imagens!antes_depois_imagem_depois_id_fkey(url_storage)")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Comparativo não encontrado.");

    const antesPath = (row as any).antes?.url_storage;
    const depoisPath = (row as any).depois?.url_storage;
    if (!antesPath || !depoisPath) throw new Error("Imagens não encontradas.");

    const antes = await baixarComoBase64(sb, antesPath);
    const depois = await baixarComoBase64(sb, depoisPath);

    const { parsed, usage } = await gerarConteudoAD(
      antes.base64,
      antes.media_type,
      depois.base64,
      depois.media_type,
      row.linha,
      row.ambiente ?? undefined,
    );

    const { data: updated, error: upErr } = await sb
      .from("mkt_antes_depois")
      .update({
        descricao_transformacao: parsed.descricao_transformacao,
        conteudos: parsed.conteudos as never,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (upErr) throw new Error(`Falha ao atualizar: ${upErr.message}`);

    await logAnthropicUsage({
      modulo: "biblioteca",
      operacao: "antes_depois",
      tokens_input: usage.input,
      tokens_output: usage.output,
      detalhes: { id: data.id, regenerar: true },
    });
    return updated;
  });

export const gerarNarrativaProjeto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => NarrativaInput.parse(input))
  .handler(async ({ data }) => {
    const sb = serverSb();
    const { data: projeto, error: pErr } = await sb
      .from("mkt_projetos")
      .select("*")
      .eq("id", data.projeto_id)
      .single();
    if (pErr || !projeto) throw new Error("Projeto não encontrado.");

    const { data: imagens, error: iErr } = await sb
      .from("mkt_biblioteca_imagens")
      .select("id, ambiente, descricao_tecnica, tags, tipo")
      .eq("projeto_id", data.projeto_id)
      .order("created_at", { ascending: true });
    if (iErr) throw new Error(iErr.message);
    if (!imagens || imagens.length < 3) {
      throw new Error("O projeto precisa ter pelo menos 3 imagens catalogadas.");
    }

    const dossie = imagens
      .map(
        (im: any, i: number) =>
          `IMAGEM ${i + 1}\nAmbiente: ${im.ambiente ?? "—"}\nTipo: ${im.tipo}\nTags: ${(im.tags ?? []).join(", ")}\nDescrição técnica: ${im.descricao_tecnica ?? "—"}`,
      )
      .join("\n\n");

    const userText = `Projeto: ${projeto.nome}\nLinha: ${projeto.linha}\nDescrição do projeto: ${projeto.descricao ?? "—"}\n\nAs ${imagens.length} imagens catalogadas deste projeto são:\n\n${dossie}\n\nGere a narrativa completa conforme instruído. Responda apenas com JSON puro.`;

    const { text, usage } = await callAnthropic(SYSTEM_NARRATIVA, [{ type: "text", text: userText }], 8000);
    type Narrativa = {
      titulo_projeto: string;
      partido_central: string;
      sequencia_narrativa: Array<{ imagem_ambiente: string; titulo: string; texto: string }>;
      estudo_de_caso: { problema: string; partido: string; solucoes: string[]; resultado: string };
      conteudos: { carrossel_projeto: string; roteiro_reels_90s: string; texto_site: string; email_apresentacao: string };
    };
    const parsed = parseJson<Narrativa>(text);

    await logAnthropicUsage({
      modulo: "biblioteca",
      operacao: "narrativa_projeto",
      tokens_input: usage.input,
      tokens_output: usage.output,
      detalhes: { projeto_id: data.projeto_id, n_imagens: imagens.length },
    });

    return { narrativa: parsed, imagens };
  });