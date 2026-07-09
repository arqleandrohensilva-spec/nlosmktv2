import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logAnthropicUsage } from "./uso-ia.server";

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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        "A chave da Anthropic (ANTHROPIC_API_KEY) não foi configurada. Adicione o secret no backend antes de gerar o estudo de caso.",
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

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
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
    const content: string = json?.content?.[0]?.text ?? "";
    const stopReason: string = json?.stop_reason ?? "";
    await logAnthropicUsage({
      modulo: "estudos-caso",
      operacao: "gerar_estudo",
      tokens_input: json?.usage?.input_tokens ?? 0,
      tokens_output: json?.usage?.output_tokens ?? 0,
      detalhes: { projeto: data.nome_projeto, linha: data.linha },
    });
    if (stopReason === "max_tokens") {
      throw new Error("A resposta da IA foi cortada por limite de tokens. Tente novamente reduzindo os textos.");
    }
    let parsed: EstudoCasoOutput;
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
    return parsed;
  });