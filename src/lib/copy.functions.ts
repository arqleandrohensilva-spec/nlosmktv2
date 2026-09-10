import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getEffectiveSystemPrompt } from "./marca-cerebro.server";
import { withExternalAuth, sb } from "./marca-config.functions";
import { logAnthropicUsage, logGeminiUsage } from "./uso-ia.server";

const Input = z.object({
  linha: z.enum(["A", "B", "AB", "C"]),
  formato: z.enum(["reels", "estatico", "carrossel", "stories"]),
  dor_titulo: z.string().min(1),
  dor_descricao: z.string().optional(),
  observacao: z.string().optional(),
  ajuste_raciocinio: z.string().optional(),
  imagem_contexto: z.string().optional(),
});

export type CopyOutput = {
  pilar: "posicionamento" | "oferta" | "marketing" | "vendas";
  justificativa_formato: string;
  raciocinio: string;
  copy_roteiro: string;
  copy_legenda: string;
  copy_cta: string;
  briefing_visual: string;
};

type IaResult = { text: string; inTok: number; outTok: number };

// Gemini (Google AI Studio) — tier gratuito. Usa header x-goog-api-key (aceita
// tanto o formato antigo "AIza..." quanto o novo "AQ...").
const GEMINI_MODEL = "gemini-2.5-flash";
async function chamarGemini(key: string, system: string, prompt: string): Promise<IaResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Limite de requisições do Gemini atingido. Tente novamente em instantes.");
    if (res.status === 400 || res.status === 403) throw new Error(`Chave do Gemini inválida ou sem permissão (${res.status}).`);
    throw new Error(`Falha na IA Gemini (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const parts: Array<{ text?: string }> = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p?.text ?? "").join("").trim();
  return {
    text,
    inTok: json?.usageMetadata?.promptTokenCount ?? 0,
    outTok: json?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function chamarClaude(key: string, system: string, prompt: string): Promise<IaResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: prompt }],
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
    throw new Error("A resposta da IA foi cortada por limite de tokens. Tente novamente.");
  }
  return {
    text: json?.content?.[0]?.text ?? "",
    inTok: json?.usage?.input_tokens ?? 0,
    outTok: json?.usage?.output_tokens ?? 0,
  };
}

function parseCopy(content: string): CopyOutput {
  try {
    return JSON.parse(content) as CopyOutput;
  } catch {
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Resposta da IA não estava em JSON válido.");
    }
    let candidate = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(candidate) as CopyOutput;
    } catch {
      candidate = candidate
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/[\x00-\x1F\x7F]/g, " ");
      return JSON.parse(candidate) as CopyOutput;
    }
  }
}

export const gerarCopy = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<CopyOutput> => {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!geminiKey && !anthropicKey) {
      throw new Error(
        "Nenhuma chave de IA configurada. Adicione GEMINI_API_KEY (grátis, Google AI Studio) ou ANTHROPIC_API_KEY nos secrets do backend para gerar copy.",
      );
    }

    const userPrompt = [
      `Linha de negócio: ${data.linha}`,
      `Formato: ${data.formato}`,
      `Dor da persona: ${data.dor_titulo}${data.dor_descricao ? " — " + data.dor_descricao : ""}`,
      data.observacao ? `Observação do fundador: ${data.observacao}` : "",
      data.ajuste_raciocinio ? `Ajuste solicitado no raciocínio: ${data.ajuste_raciocinio}` : "",
      data.imagem_contexto ? `Imagem de referência do projeto (descrição técnica): ${data.imagem_contexto}` : "",
      "",
      "Responda EXCLUSIVAMENTE com o objeto JSON. Sem texto antes, sem texto depois, sem markdown, sem blocos de código, sem explicação. Apenas o JSON puro começando com { e terminando com }.",
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt = await getEffectiveSystemPrompt(sb(context.accessToken));

    const usarGemini = !!geminiKey;
    const r = usarGemini
      ? await chamarGemini(geminiKey!, systemPrompt, userPrompt)
      : await chamarClaude(anthropicKey!, systemPrompt, userPrompt);

    await (usarGemini ? logGeminiUsage : logAnthropicUsage)({
      modulo: "copy",
      operacao: "geracao_copy",
      tokens_input: r.inTok,
      tokens_output: r.outTok,
      detalhes: { linha: data.linha, formato: data.formato, dor: data.dor_titulo, motor: usarGemini ? "gemini" : "anthropic" },
    });

    return parseCopy(r.text);
  });
