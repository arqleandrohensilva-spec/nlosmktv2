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
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurado");

    const userPrompt = [
      `Linha de negócio: ${data.linha}`,
      `Formato: ${data.formato}`,
      `Dor da persona: ${data.dor_titulo}${data.dor_descricao ? " — " + data.dor_descricao : ""}`,
      data.observacao ? `Observação do fundador: ${data.observacao}` : "",
      data.ajuste_raciocinio ? `Ajuste solicitado no raciocínio: ${data.ajuste_raciocinio}` : "",
      "",
      "Gere um post seguindo a régua de marca da NL. Responda APENAS com o JSON no formato especificado.",
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
      // Try to extract JSON from a code block or text
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Resposta da IA não estava em JSON válido.");
      parsed = JSON.parse(match[0]);
    }
    return parsed;
  });