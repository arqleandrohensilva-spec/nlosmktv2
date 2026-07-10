import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logAnthropicUsage } from "./uso-ia.server";

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

export const validarPeca = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ValidarOutput> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        "A chave da Anthropic (ANTHROPIC_API_KEY) não foi configurada. Adicione o secret no backend antes de validar peças.",
      );
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
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
    const content: string = json?.content?.[0]?.text ?? "";
    await logAnthropicUsage({
      modulo: "validar",
      operacao: "validar_peca",
      tokens_input: json?.usage?.input_tokens ?? 0,
      tokens_output: json?.usage?.output_tokens ?? 0,
      detalhes: { tamanho_texto: data.texto.length },
    });
    let parsed: ValidarOutput;
    try {
      parsed = JSON.parse(content);
    } catch {
      const cleaned = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("Resposta da IA não estava em JSON válido.");
        parsed = JSON.parse(match[0]);
      }
    }
    return parsed;
  });