import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withExternalAuth, sb } from "./marca-config.functions";
import { readMarcaConfig } from "./marca-cerebro.server";
import { logGeminiUsage } from "./uso-ia.server";

// "Agente de imagem": para CADA post, redige um prompt de geração de imagem
// detalhado e específico, combinando o contexto do post + instruções que o
// usuário deu para AQUELA imagem + as diretrizes fixas da marca.

const Input = z.object({
  linha: z.string().optional(),
  dor_titulo: z.string().optional(),
  briefing_visual: z.string().optional(),
  legenda: z.string().optional(),
  instrucoes: z.string().optional(), // instruções específicas para ESTA imagem
});

type IaResult = { text: string; inTok: number; outTok: number };

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

async function chamarGeminiTexto(key: string, system: string, prompt: string): Promise<IaResult> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 1200 },
  });

  const MAX_TENTATIVAS = 4;
  let ultimoStatus = 0;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
      },
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
    ultimoStatus = res.status;
    const errBody = await res.text();
    if ((res.status === 503 || res.status === 429) && tentativa < MAX_TENTATIVAS) {
      await new Promise((r) => setTimeout(r, 1500 * tentativa));
      continue;
    }
    if (res.status === 400 || res.status === 403) {
      throw new Error(`Chave do Gemini inválida ou sem permissão (${res.status}).`);
    }
    if (res.status !== 503 && res.status !== 429) {
      throw new Error(`Falha na IA Gemini (${res.status}): ${errBody.slice(0, 200)}`);
    }
  }
  if (ultimoStatus === 429) {
    throw new Error("Limite de requisições do Gemini atingido. Tente novamente em instantes.");
  }
  throw new Error("O Gemini está sobrecarregado agora. Tente novamente em alguns segundos.");
}

export const gerarPromptImagem = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<{ prompt: string }> => {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new Error("Configure GEMINI_API_KEY (grátis, Google AI Studio) para gerar o prompt de imagem.");
    }

    const cfg = await readMarcaConfig(sb(context.accessToken));

    const system =
      "Você é o diretor de arte da NL Arquitetos. Sua tarefa é escrever UM único prompt de geração de imagem, em português, detalhado e pronto para colar no Google Flow / Imagen, para o post descrito pelo usuário. O prompt deve descrever: assunto/cena, ambiente, composição e enquadramento (vertical 4:5 para feed do Instagram), iluminação, clima/atmosfera, estilo (fotografia arquitetônica editorial, realista e sofisticada) e a paleta NL (tons grafite, bronze mineral, bege areia, neutros quentes — nunca preto puro), com materiais e acabamentos nobres. Respeite fielmente as instruções específicas que o usuário deu para ESTA imagem. Termine sempre com: sem texto, sem palavras, sem logotipos. Responda APENAS com o texto do prompt — sem aspas, sem títulos, sem explicações.";

    const userPrompt = [
      "Contexto do post:",
      data.linha ? `- Linha de negócio: ${data.linha}` : "",
      data.dor_titulo ? `- Tema/dor: ${data.dor_titulo}` : "",
      data.briefing_visual ? `- Briefing visual da copy: ${data.briefing_visual}` : "",
      data.legenda ? `- Legenda do post: ${data.legenda}` : "",
      cfg.imagem ? `\nDiretrizes fixas de imagem da marca (sempre valem):\n${cfg.imagem}` : "",
      data.instrucoes
        ? `\nInstruções ESPECÍFICAS para esta imagem (prioridade máxima):\n${data.instrucoes}`
        : "",
      "",
      "Escreva agora o prompt da imagem para este post.",
    ]
      .filter(Boolean)
      .join("\n");

    const r = await chamarGeminiTexto(key, system, userPrompt);

    await logGeminiUsage({
      modulo: "imagem",
      operacao: "gerar_prompt_imagem",
      tokens_input: r.inTok,
      tokens_output: r.outTok,
      detalhes: { linha: data.linha, dor: data.dor_titulo, com_instrucoes: !!data.instrucoes },
    });

    return { prompt: r.text };
  });
