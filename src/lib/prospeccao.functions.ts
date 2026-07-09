import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logAnthropicUsage } from "./uso-ia.server";

const Input = z.object({
  mensagem: z.string().min(1),
  linha: z.string().optional(),
  contexto: z.string().optional(),
});

const SYSTEM = `Você é o reescritor de abordagem de prospecção da NL Arquitetos, escritório de arquitetura e interiores em São José dos Campos, SP.
Lema: "A arquitetura como decisão."

Reescreva a mensagem de abordagem seguindo o tom NL:
- Sem emoji
- Sem superlativo vazio
- Sem urgência artificial
- CTA de baixo atrito (uma conversa, uma reunião curta, um estudo de viabilidade)
- Tom técnico com empatia
- Direto, respeitoso, sem parecer script

Devolva APENAS o texto reescrito da mensagem, sem preâmbulo, sem aspas, sem markdown.`;

export const reescreverMensagemProspeccao = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<{ mensagem: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw new Error("A chave ANTHROPIC_API_KEY não foi configurada.");
    }

    const userPrompt = [
      data.linha ? `Linha de interesse do contato: ${data.linha}` : "",
      data.contexto ? `Contexto: ${data.contexto}` : "",
      "Mensagem original:",
      data.mensagem,
      "",
      "Reescreva agora, respondendo apenas com o texto final.",
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
        max_tokens: 1500,
        system: SYSTEM,
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
    const texto: string = (json?.content?.[0]?.text ?? "").trim();
    await logAnthropicUsage({
      modulo: "prospeccao",
      operacao: "reescrita_abordagem",
      tokens_input: json?.usage?.input_tokens ?? 0,
      tokens_output: json?.usage?.output_tokens ?? 0,
      detalhes: { linha: data.linha ?? null, chars: data.mensagem.length },
    });
    return { mensagem: texto };
  });