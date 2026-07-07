import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SYSTEM_PROMPT } from "./nl-brand";

const Input = z.object({
  linha: z.enum(["A", "B", "AB", "C"]),
  formato: z.enum(["reels", "estatico", "carrossel", "stories"]),
  dor_titulo: z.string().min(1),
  dor_descricao: z.string().optional(),
  observacao: z.string().optional(),
  ajuste_raciocinio: z.string().optional(),
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

export const gerarCopy = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<CopyOutput> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        "A chave da Anthropic (ANTHROPIC_API_KEY) não foi configurada. Adicione o secret no backend antes de gerar copy.",
      );
    }

    const userPrompt = [
      `Linha de negócio: ${data.linha}`,
      `Formato: ${data.formato}`,
      `Dor da persona: ${data.dor_titulo}${data.dor_descricao ? " — " + data.dor_descricao : ""}`,
      data.observacao ? `Observação do fundador: ${data.observacao}` : "",
      data.ajuste_raciocinio ? `Ajuste solicitado no raciocínio: ${data.ajuste_raciocinio}` : "",
      "",
      "Responda EXCLUSIVAMENTE com o objeto JSON. Sem texto antes, sem texto depois, sem markdown, sem blocos de código, sem explicação. Apenas o JSON puro começando com { e terminando com }.",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
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
    const content: string = json?.content?.[0]?.text ?? "";
    let parsed: CopyOutput;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Strip markdown code fences the model may add despite instructions.
      const cleaned = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Last resort: extract the first {...} block from the text.
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("Resposta da IA não estava em JSON válido.");
        parsed = JSON.parse(match[0]);
      }
    }
    return parsed;
  });