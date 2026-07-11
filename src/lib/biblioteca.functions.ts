import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { logAnthropicUsage } from "./uso-ia.server";

const Input = z.object({
  base64: z.string().min(1),
  media_type: z.string().min(1),
  nome_arquivo: z.string().min(1),
  url_storage: z.string().min(1),
  tipo: z.enum(["foto_real", "render"]),
  linha: z.string().min(1),
  ambiente: z.string().optional(),
  projeto_id: z.string().uuid().nullable().optional(),
});

const RegenInput = z.object({
  id: z.string().uuid(),
});

export type AnaliseImagem = {
  descricao_tecnica: string;
  tags: string[];
  ambiente_detectado?: string;
  copies: {
    feed: string;
    stories: string;
    reels: string;
    email: string;
  };
  conteudos: {
    roteiro_reels: string;
    pauta_carrossel: string;
    texto_blog: string;
    sugestoes_valorizacao: string[];
  };
};

const SYSTEM = `Você é o curador visual da NL Arquitetos, escritório de arquitetura e interiores em São José dos Campos, SP.
Lema: "A arquitetura como decisão."

Analise a imagem recebida e entregue uma análise técnica completa mais todos os conteúdos prontos para publicação.

VOCABULÁRIO TÉCNICO NL (usar obrigatoriamente):
- Materialidade (não "materiais usados")
- Partido arquitetônico (não "estilo")
- Iluminação natural zenital / lateral / difusa
- Integração de ambientes / fluidez espacial
- Conforto visual / conforto térmico
- Decisão técnica antes da forma
- Rigor construtivo
- Permanência do material

REGRAS DE COPY (aplicar em todos os formatos):
- Sem emoji
- Sem superlativo vazio
- CTA sempre de baixo atrito
- Tom técnico com empatia
- Nunca prometer preço

FORMATOS A GERAR:
1. descricao_tecnica: análise técnica da imagem em 3-4 frases. Descrever materialidade, iluminação, decisões de projeto visíveis, partido. Em vocabulário NL.
2. tags: array de 6-10 tags semânticas descrevendo o que aparece.
3. copies.feed: legenda para Instagram Feed. Abertura com observação técnica sobre a imagem. 3-4 parágrafos. CTA de baixo atrito.
4. copies.stories: 3 telas separadas por "---". Cada tela máximo 80 caracteres. Baseadas no que aparece na imagem.
5. copies.reels: legenda para Reels com abertura nos primeiros 125 caracteres.
6. copies.email: "ASSUNTO: ...\\nCORPO: ..." baseado na imagem.
7. conteudos.roteiro_reels: roteiro de 30-90 segundos baseado na imagem. Descrever: gancho visual, o que mostrar, narração sugerida, CTA final.
8. conteudos.pauta_carrossel: pauta de carrossel de 5-8 slides. Slide 1: capa (título). Slides 2-N: cada um com título + texto curto. Último slide: CTA.
9. conteudos.texto_blog: texto longo de 400-600 palavras sobre o projeto ou conceito que a imagem representa. Estrutura: abertura técnica → partido → decisões → resultado → convite.
10. conteudos.sugestoes_valorizacao: array de 5 sugestões de como valorizar esse conteúdo além do post padrão.

Responda EXCLUSIVAMENTE com JSON puro, sem markdown, começando com { e terminando com }:
{
  "descricao_tecnica": "...",
  "tags": ["tag1","tag2"],
  "ambiente_detectado": "fachada|sala|cozinha|etc",
  "copies": {
    "feed": "...",
    "stories": "Tela 1\\n---\\nTela 2\\n---\\nTela 3",
    "reels": "...",
    "email": "ASSUNTO: ...\\nCORPO: ..."
  },
  "conteudos": {
    "roteiro_reels": "...",
    "pauta_carrossel": "Slide 1: ...\\nSlide 2: ...",
    "texto_blog": "...",
    "sugestoes_valorizacao": ["...","...","...","...","..."]
  }
}`;

function serverSb() {
  return createClient(
    "https://krzuroijejfozljhchok.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyenVyb2lqZWpmb3psamhjaG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5Mjg4MjEsImV4cCI6MjA5MzUwNDgyMX0.mFMFfY8TdviFVzHvfKYUrZENpcT4wdyW-52-CUNqsOo",
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

async function callVision(
  base64: string,
  media_type: string,
  tipo: string,
  linha: string,
  ambiente: string | undefined,
): Promise<{ analise: AnaliseImagem; usage: { input: number; output: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      "A chave da Anthropic (ANTHROPIC_API_KEY) não foi configurada. Adicione o secret no backend antes de analisar imagens.",
    );
  }

  const userText = [
    "Analise esta imagem de projeto da NL Arquitetos.",
    `Tipo: ${tipo} (foto real ou render)`,
    `Linha de negócio: ${linha}`,
    ambiente ? `Ambiente: ${ambiente}` : "Ambiente: (detectar da imagem)",
    "",
    "Gere a análise técnica completa e todos os conteúdos conforme instruído. Responda apenas com JSON puro.",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: detectMediaType(base64), data: base64 } },
            { type: "text", text: userText },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados.");
    throw new Error(`Falha na IA (${res.status}): ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const content: string = json?.content?.[0]?.text ?? "";
  const stopReason: string = json?.stop_reason ?? "";
  if (stopReason === "max_tokens") {
    throw new Error("Resposta da IA cortada por limite de tokens. Tente uma imagem menor.");
  }

  let parsed: AnaliseImagem;
  try {
    parsed = JSON.parse(content);
  } catch {
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Resposta da IA não estava em JSON válido.");
    }
    let candidate = cleaned.slice(start, end + 1);
    try {
      parsed = JSON.parse(candidate);
    } catch {
      candidate = candidate
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/[\x00-\x1F\x7F]/g, " ");
      parsed = JSON.parse(candidate);
    }
  }

  return {
    analise: parsed,
    usage: {
      input: json?.usage?.input_tokens ?? 0,
      output: json?.usage?.output_tokens ?? 0,
    },
  };
}

export const analisarImagem = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { analise, usage } = await callVision(
      data.base64,
      data.media_type,
      data.tipo,
      data.linha,
      data.ambiente,
    );

    const ambienteFinal = data.ambiente || analise.ambiente_detectado || null;

    const sb = serverSb();
    const { data: row, error } = await sb
      .from("mkt_biblioteca_imagens")
      .insert({
        projeto_id: data.projeto_id ?? null,
        nome_arquivo: data.nome_arquivo,
        url_storage: data.url_storage,
        tipo: data.tipo,
        linha: data.linha,
        ambiente: ambienteFinal,
        descricao_tecnica: analise.descricao_tecnica,
        tags: analise.tags ?? [],
        copies: analise.copies as never,
        conteudos_gerados: analise.conteudos as never,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Falha ao salvar imagem: ${error.message}`);

    await logAnthropicUsage({
      modulo: "biblioteca",
      operacao: "analise_imagem",
      tokens_input: usage.input,
      tokens_output: usage.output,
      detalhes: {
        projeto_id: data.projeto_id ?? null,
        tipo: data.tipo,
        linha: data.linha,
        ambiente: ambienteFinal,
      },
    });

    return row;
  });

export const regenerarConteudos = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RegenInput.parse(input))
  .handler(async ({ data }) => {
    const sb = serverSb();
    const { data: row, error } = await sb
      .from("mkt_biblioteca_imagens")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Imagem não encontrada.");

    // baixar do storage para reanalisar
    const { data: file, error: dlErr } = await sb.storage
      .from("mkt-biblioteca-visual")
      .download(row.url_storage);
    if (dlErr || !file) throw new Error("Falha ao baixar imagem do storage.");

    const buf = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const base64 = btoa(binary);
    const mediaType = file.type || "image/jpeg";

    const { analise, usage } = await callVision(
      base64,
      mediaType,
      row.tipo,
      row.linha,
      row.ambiente ?? undefined,
    );

    const { data: updated, error: upErr } = await sb
      .from("mkt_biblioteca_imagens")
      .update({
        descricao_tecnica: analise.descricao_tecnica,
        tags: analise.tags ?? [],
        copies: analise.copies as never,
        conteudos_gerados: analise.conteudos as never,
        ambiente: row.ambiente || analise.ambiente_detectado || null,
      })
      .eq("id", data.id)
      .select("*")
      .single();

    if (upErr) throw new Error(`Falha ao atualizar: ${upErr.message}`);

    await logAnthropicUsage({
      modulo: "biblioteca",
      operacao: "regenerar_conteudos",
      tokens_input: usage.input,
      tokens_output: usage.output,
      detalhes: { id: data.id },
    });

    return updated;
  });