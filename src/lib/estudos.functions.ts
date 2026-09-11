import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withExternalAuth, sb } from "./marca-config.functions";
import { logAnthropicUsage, logGeminiUsage } from "./uso-ia.server";

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

// Chamada ao Gemini (tier gratuito) com saída JSON e retry em 429/503.
async function chamarGeminiJson(
  key: string,
  system: string,
  prompt: string,
  maxOutputTokens = 8000,
): Promise<{ text: string; inTok: number; outTok: number }> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens, responseMimeType: "application/json" },
  });
  const MAX = 4;
  let ultimo = 0;
  for (let t = 1; t <= MAX; t++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body },
    );
    if (res.ok) {
      const json = await res.json();
      const parts: Array<{ text?: string }> = json?.candidates?.[0]?.content?.parts ?? [];
      return {
        text: parts.map((p) => p?.text ?? "").join("").trim(),
        inTok: json?.usageMetadata?.promptTokenCount ?? 0,
        outTok: json?.usageMetadata?.candidatesTokenCount ?? 0,
      };
    }
    ultimo = res.status;
    const err = await res.text();
    if ((res.status === 429 || res.status === 503) && t < MAX) {
      await new Promise((r) => setTimeout(r, 1500 * t));
      continue;
    }
    if (res.status === 400 || res.status === 403) throw new Error(`Chave do Gemini inválida ou sem permissão (${res.status}).`);
    if (res.status !== 429 && res.status !== 503) throw new Error(`Falha na IA Gemini (${res.status}): ${err.slice(0, 200)}`);
  }
  throw new Error(ultimo === 429 ? "Limite de requisições do Gemini atingido. Tente de novo em instantes." : "O Gemini está sobrecarregado. Tente novamente em alguns segundos.");
}

// Parser robusto de JSON vindo da IA.
function parseJsonIa<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("Resposta da IA não estava em JSON válido.");
    let cand = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(cand) as T;
    } catch {
      cand = cand.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " ");
      return JSON.parse(cand) as T;
    }
  }
}

const Input = z.object({
  nome_projeto: z.string().min(1),
  linha: z.string().min(1),
  cidade: z.string().optional().nullable(),
  problema: z.string().min(1),
  restricoes: z.string().optional().nullable(),
  partido: z.string().min(1),
  solucoes: z.array(z.string().min(1)).min(1),
  resultado: z.string().min(1),
  detalhe_tecnico: z.string().optional().nullable(),
});

export type EstudoCasoOutput = {
  carrossel: {
    titulo_capa: string;
    slides: Array<{ numero: number; titulo: string; texto: string }>;
  };
  roteiro_reels: string;
  blog: string;
  email: string;
  linkedin: string;
};

const SYSTEM = `Você é o narrador de projetos da NL Arquitetos, escritório de arquitetura em São José dos Campos, SP.
Lema: "A arquitetura como decisão."

Recebe os dados de um projeto entregue e gera um ecossistema completo de conteúdo de autoridade.

O estudo de caso NL não é portfólio — é argumento. Cada decisão técnica é uma prova de competência.
O leitor não deve pensar "que projeto bonito" — deve pensar "eu quero esse nível de decisão no meu projeto."

REGRAS NL (aplicar em todos os formatos):
- Sem emoji
- Sem superlativo vazio
- CTA sempre de baixo atrito
- Tom técnico com empatia
- Nunca prometer preço
- Vocabulário: partido, materialidade, compatibilização, viabilidade, rigor construtivo, decisão técnica

Responda EXCLUSIVAMENTE com JSON puro, sem markdown:
{
  "carrossel": {
    "titulo_capa": "título editorial do projeto",
    "slides": [
      { "numero": 1, "titulo": "título do slide", "texto": "texto do slide (2-3 frases)" }
    ]
  },
  "roteiro_reels": "roteiro completo de 90s com marcações: GANCHO (0-5s), DESENVOLVIMENTO (5-70s) com cortes descritos, FECHAMENTO (70-85s), CTA (85-90s)",
  "blog": "texto completo 600-900 palavras. Estrutura: título editorial → situação inicial → diagnóstico → partido → soluções (cada uma em parágrafo) → resultado → convite técnico.",
  "email": "ASSUNTO: linha (máx 50 chars)\\nCORPO: texto em 3 parágrafos + CTA",
  "linkedin": "versão formal para LinkedIn. Abertura com dado ou provocação técnica. Desenvolvimento do raciocínio. Máximo 3 hashtags."
}

O carrossel deve ter entre 8 e 10 slides.`;

export const gerarEstudoCaso = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<EstudoCasoOutput> => {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!geminiKey && !anthropicKey) {
      throw new Error(
        "Nenhuma chave de IA configurada. Adicione GEMINI_API_KEY (grátis, Google AI Studio) ou ANTHROPIC_API_KEY nos secrets do backend.",
      );
    }

    const userPrompt = [
      `Projeto: ${data.nome_projeto}`,
      `Linha: ${data.linha}`,
      data.cidade ? `Cidade: ${data.cidade}` : "",
      "",
      "PROBLEMA / SITUAÇÃO INICIAL:",
      data.problema,
      "",
      "RESTRIÇÕES TÉCNICAS:",
      data.restricoes || "—",
      "",
      "PARTIDO ARQUITETÔNICO:",
      data.partido,
      "",
      "SOLUÇÕES ADOTADAS:",
      data.solucoes.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      "",
      "RESULTADO MENSURÁVEL:",
      data.resultado,
      "",
      "DETALHE TÉCNICO DE DESTAQUE:",
      data.detalhe_tecnico || "—",
      "",
      "Gere o estudo de caso completo nos formatos solicitados. Responda EXCLUSIVAMENTE com o objeto JSON.",
    ]
      .filter((l) => l !== undefined && l !== null)
      .join("\n");

    let content: string;
    if (geminiKey) {
      const r = await chamarGeminiJson(geminiKey, SYSTEM, userPrompt, 8000);
      content = r.text;
      await logGeminiUsage({
        modulo: "estudos-caso",
        operacao: "gerar_estudo",
        tokens_input: r.inTok,
        tokens_output: r.outTok,
        detalhes: { projeto: data.nome_projeto, linha: data.linha },
      });
    } else {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          system: SYSTEM,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
        if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
        throw new Error(`Falha na IA (${res.status}): ${body.slice(0, 200)}`);
      }
      const json = await res.json();
      if (json?.stop_reason === "max_tokens") {
        throw new Error("A resposta da IA foi cortada por limite de tokens. Tente novamente reduzindo os textos.");
      }
      content = json?.content?.[0]?.text ?? "";
      await logAnthropicUsage({
        modulo: "estudos-caso",
        operacao: "gerar_estudo",
        tokens_input: json?.usage?.input_tokens ?? 0,
        tokens_output: json?.usage?.output_tokens ?? 0,
        detalhes: { projeto: data.nome_projeto, linha: data.linha },
      });
    }
    return parseJsonIa<EstudoCasoOutput>(content);
  });

// ---------------------------------------------------------------------------
// Estudo de caso AUTOMÁTICO: rascunha os campos a partir de um projeto do NL OS
// (lê o briefing do cliente pela ponte contexto_marketing_ativo -> projeto_id).
// ---------------------------------------------------------------------------

export type RascunhoEstudo = {
  nome_projeto: string;
  cidade: string | null;
  linha: string;
  problema: string;
  restricoes: string | null;
  partido: string;
  solucoes: string[];
  resultado: string;
  detalhe_tecnico: string | null;
};

const RASCUNHO_SYSTEM = `Você é arquiteto e redator técnico da NL Arquitetos (São José dos Campos). A partir do briefing de um projeto entregue, rascunhe os campos de um ESTUDO DE CASO técnico. Seja específico, use vocabulário de arquitetura (partido, materialidade, viabilidade, compatibilização). Onde faltar dado concreto, faça inferências plausíveis e conservadoras — NUNCA invente números ou resultados quantitativos que não estejam no briefing. Responda SOMENTE com JSON, sem markdown.`;

const RascunhoInput = z.object({ projeto_id: z.string().min(1) });

export const rascunhoEstudoDoProjeto = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => RascunhoInput.parse(input))
  .handler(async ({ data, context }): Promise<RascunhoEstudo> => {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      throw new Error("Configure GEMINI_API_KEY (grátis) para rascunhar o estudo a partir do NL OS.");
    }
    const client = sb(context.accessToken);

    const { data: ctx } = await client
      .from("contexto_marketing_ativo")
      .select("cliente, tipo")
      .eq("projeto_id", data.projeto_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const c: any = ctx?.[0];

    const { data: briefs } = await client
      .from("briefings_completos")
      .select("respostas")
      .eq("projeto_id", data.projeto_id)
      .order("criado_em", { ascending: false })
      .limit(1);
    const respostas = briefs?.[0]?.respostas;
    const briefingTexto = respostas
      ? (typeof respostas === "string" ? respostas : JSON.stringify(respostas)).slice(0, 6000)
      : "";

    const prompt = [
      c?.cliente ? `Cliente: ${c.cliente}` : "",
      c?.tipo ? `Tipo de projeto: ${c.tipo}` : "",
      briefingTexto ? `Briefing do cliente:\n${briefingTexto}` : "Sem briefing detalhado — infira pelo tipo.",
      "",
      'Responda EXCLUSIVAMENTE com este JSON: {"nome_projeto":"...","cidade":"... ou null","linha":"A|B|AB|C","problema":"situação inicial e desafio","restricoes":"... ou null","partido":"abordagem central do projeto","solucoes":["solução 1","solução 2"],"resultado":"o que o projeto entregou","detalhe_tecnico":"... ou null"}. Inclua ao menos 2 soluções. linha: A=arquitetura, B=interiores, AB=integrado, C=comercial.',
    ]
      .filter(Boolean)
      .join("\n");

    const gerado = await chamarGeminiJson(geminiKey, RASCUNHO_SYSTEM, prompt, 2000);

    await logGeminiUsage({
      modulo: "estudos-caso",
      operacao: "rascunho_projeto",
      tokens_input: gerado.inTok,
      tokens_output: gerado.outTok,
      detalhes: { projeto_id: data.projeto_id },
    });

    const raw = parseJsonIa<Partial<RascunhoEstudo>>(gerado.text);
    const linhasValidas = ["A", "B", "AB", "C"];
    return {
      nome_projeto: String(raw.nome_projeto ?? c?.cliente ?? "Projeto").trim(),
      cidade: raw.cidade ? String(raw.cidade).trim() : null,
      linha: linhasValidas.includes(String(raw.linha)) ? String(raw.linha) : "A",
      problema: String(raw.problema ?? "").trim(),
      restricoes: raw.restricoes ? String(raw.restricoes).trim() : null,
      partido: String(raw.partido ?? "").trim(),
      solucoes: Array.isArray(raw.solucoes) ? raw.solucoes.map((s) => String(s).trim()).filter(Boolean) : [],
      resultado: String(raw.resultado ?? "").trim(),
      detalhe_tecnico: raw.detalhe_tecnico ? String(raw.detalhe_tecnico).trim() : null,
    };
  });