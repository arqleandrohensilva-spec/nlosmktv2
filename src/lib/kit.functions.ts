import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logAnthropicUsage, logGeminiUsage } from "./uso-ia.server";

const Input = z.object({
  conteudo: z.string().min(1),
  linha: z.string().optional(),
  tom: z.string().optional(),
  imagem_contexto: z.string().optional(),
});

export type KitOutput = {
  feed: string;
  stories: string;
  reels: string;
  linkedin: string;
  email: string;
};

const SYSTEM = `Você é o distribuidor de conteúdo da NL Arquitetos, escritório de arquitetura e interiores em São José dos Campos, SP.
Lema: "A arquitetura como decisão."

Recebe um conteúdo mestre e gera 5 variações para canais diferentes.
Cada variação mantém a essência do conteúdo mas adapta formato, tamanho e tom para o canal.

REGRAS INVIOLÁVEIS DA MARCA NL (aplicar em TODOS os canais):
- Sem emoji
- Sem superlativo vazio
- Sem urgência artificial
- Sem preto puro mencionado
- CTA sempre de baixo atrito
- Tom: técnico com empatia
- Nunca prometer preço antes de qualificar

ESPECIFICAÇÕES POR CANAL:

Instagram Feed: legenda completa, abertura com dor ou observação técnica, desenvolvimento em 3-4 parágrafos curtos, CTA conversacional. Máximo 2.200 caracteres.

Stories: exatamente 3 telas, separadas por "---". Cada tela máximo 80 caracteres. Tela 1 = gancho ou pergunta. Tela 2 = resposta/insight em 1 frase. Tela 3 = CTA direto e simples.

Reels Caption: abertura impactante nas primeiras 125 caracteres (antes do "ver mais"), seguida de desenvolvimento e CTA. Tom de conversa direta, como se o arquiteto estivesse falando.

LinkedIn: abertura com observação técnica ou dado do setor, tom mais formal e estratégico, foco em processo e metodologia, máximo 3 hashtags relevantes ao final (#arquitetura #projeto #decisaotecnica).

Email: linha de assunto (máximo 50 chars, sem clickbait) + corpo com 3 parágrafos: contexto, argumento principal, CTA. Separar assunto do corpo com "ASSUNTO:" e "CORPO:".

Responda EXCLUSIVAMENTE com JSON puro, sem markdown:
{
  "feed": "legenda completa para Instagram Feed",
  "stories": "Tela 1\n---\nTela 2\n---\nTela 3",
  "reels": "legenda para Reels",
  "linkedin": "texto para LinkedIn",
  "email": "ASSUNTO: linha do assunto\nCORPO: corpo do email"
}`;

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

async function chamarGemini(
  key: string,
  system: string,
  prompt: string,
): Promise<{ text: string; inTok: number; outTok: number }> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4000, responseMimeType: "application/json" },
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
  throw new Error(
    ultimo === 429
      ? "Limite de requisições do Gemini atingido. Tente novamente em instantes."
      : "O Gemini está sobrecarregado. Tente novamente em alguns segundos.",
  );
}

function parseKit(content: string): KitOutput {
  try {
    return JSON.parse(content) as KitOutput;
  } catch {
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Resposta da IA não estava em JSON válido.");
    }
    let candidate = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(candidate) as KitOutput;
    } catch {
      candidate = candidate.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " ");
      return JSON.parse(candidate) as KitOutput;
    }
  }
}

export const gerarKitPublicacao = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<KitOutput> => {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!geminiKey && !anthropicKey) {
      throw new Error(
        "Nenhuma chave de IA configurada. Adicione GEMINI_API_KEY (grátis, Google AI Studio) ou ANTHROPIC_API_KEY nos secrets do backend.",
      );
    }

    const userPrompt = [
      data.linha ? `Linha de negócio: ${data.linha}` : "",
      data.tom ? `Tom do conteúdo: ${data.tom}` : "",
      data.imagem_contexto ? `Imagem de referência do projeto (descrição técnica): ${data.imagem_contexto}` : "",
      "Conteúdo mestre:",
      data.conteudo,
      "",
      "IMPORTANTE: respeite RIGOROSAMENTE o formato de cada canal descrito nas especificações — Stories com exatamente 3 telas separadas por \"---\"; Reels com gancho nos primeiros 125 caracteres; LinkedIn mais formal com até 3 hashtags ao final; E-mail no formato \"ASSUNTO: ...\" e \"CORPO: ...\". Cada canal deve sair no seu próprio padrão, não repita a mesma legenda do feed.",
      "Responda EXCLUSIVAMENTE com o objeto JSON. Sem texto antes, sem texto depois, sem markdown.",
    ]
      .filter(Boolean)
      .join("\n");

    if (geminiKey) {
      const r = await chamarGemini(geminiKey, SYSTEM, userPrompt);
      await logGeminiUsage({
        modulo: "kit",
        operacao: "kit_publicacao",
        tokens_input: r.inTok,
        tokens_output: r.outTok,
        detalhes: { linha: data.linha ?? null, tom: data.tom ?? null, chars: data.conteudo.length, motor: "gemini" },
      });
      return parseKit(r.text);
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
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
      modulo: "kit",
      operacao: "kit_publicacao",
      tokens_input: json?.usage?.input_tokens ?? 0,
      tokens_output: json?.usage?.output_tokens ?? 0,
      detalhes: { linha: data.linha ?? null, tom: data.tom ?? null, chars: data.conteudo.length, motor: "anthropic" },
    });
    if (stopReason === "max_tokens") {
      throw new Error("A resposta da IA foi cortada por limite de tokens. Tente novamente com um conteúdo menor.");
    }
    return parseKit(content);
  });
