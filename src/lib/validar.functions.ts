import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logAnthropicUsage, logGeminiUsage } from "./uso-ia.server";

const Input = z.object({
  texto: z.string().min(1),
});

export type ValidarProblema = {
  regra: string;
  trecho: string | null;
  sugestao: string;
};

export type ValidarOutput = {
  score: number;
  aprovado: boolean;
  problemas: ValidarProblema[];
  acertos: string[];
  resumo: string;
};

const SYSTEM_PROMPT = `Você é o validador de identidade de marca da NL Arquitetos.
Analise o texto recebido e verifique cada uma destas regras:

REGRAS QUE NUNCA PODEM SER VIOLADAS (cada violação desconta 15 pontos):
1. Presença de emoji (qualquer emoji é violação)
2. Preto puro mencionado ou sugerido (#000000 ou "preto" sem qualificação)
3. CTA de alta pressão ("contrate agora", "últimas vagas", "corra", "não perca")
4. Superlativos vazios ("melhor do mercado", "incomparável", "único no mundo")
5. Urgência artificial ("por tempo limitado", "só hoje", "oferta relâmpago")
6. Promessa de preço ou valor sem qualificar o projeto

REGRAS DE TOM (cada violação desconta 8 pontos):
7. Linguagem excessivamente informal ou gírias
8. Exclamações excessivas (mais de 1 por texto)
9. Segunda pessoa no imperativo agressivo ("Compre!", "Contrate!")
10. Texto em caixa alta decorativa (não é label técnico)

BOAS PRÁTICAS (cada item presente adiciona 5 pontos ao bônus):
- CTA de baixo atrito presente ("fala com a gente", "manda mensagem", "conversa sem compromisso")
- Tom técnico com empatia
- Ausência de promessas vagas
- Foco em clareza e processo, não em resultado garantido

Responda EXCLUSIVAMENTE com JSON puro, sem markdown:
{
  "score": número de 0 a 100,
  "aprovado": true ou false (true se score >= 80),
  "problemas": [
    {
      "regra": "nome da regra violada",
      "trecho": "trecho exato do texto que viola (ou null se não houver trecho específico)",
      "sugestao": "como corrigir em uma frase"
    }
  ],
  "acertos": ["lista de boas práticas encontradas no texto"],
  "resumo": "uma frase resumindo o resultado"
}`;

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

async function chamarGeminiJson(key: string, system: string, prompt: string): Promise<{ text: string; inTok: number; outTok: number }> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2000, responseMimeType: "application/json" },
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

function parseValidar(content: string): ValidarOutput {
  try {
    return JSON.parse(content) as ValidarOutput;
  } catch {
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Resposta da IA não estava em JSON válido.");
    return JSON.parse(match[0]) as ValidarOutput;
  }
}

export const validarPeca = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ValidarOutput> => {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!geminiKey && !anthropicKey) {
      throw new Error(
        "Nenhuma chave de IA configurada. Adicione GEMINI_API_KEY (grátis, Google AI Studio) ou ANTHROPIC_API_KEY nos secrets do backend.",
      );
    }

    let content: string;
    if (geminiKey) {
      const r = await chamarGeminiJson(geminiKey, SYSTEM_PROMPT, data.texto);
      content = r.text;
      await logGeminiUsage({
        modulo: "validar",
        operacao: "validar_peca",
        tokens_input: r.inTok,
        tokens_output: r.outTok,
        detalhes: { tamanho_texto: data.texto.length },
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
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: data.texto }],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
        if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
        throw new Error(`Falha na IA (${res.status}): ${body.slice(0, 200)}`);
      }
      const json = await res.json();
      content = json?.content?.[0]?.text ?? "";
      await logAnthropicUsage({
        modulo: "validar",
        operacao: "validar_peca",
        tokens_input: json?.usage?.input_tokens ?? 0,
        tokens_output: json?.usage?.output_tokens ?? 0,
        detalhes: { tamanho_texto: data.texto.length },
      });
    }
    return parseValidar(content);
  });
