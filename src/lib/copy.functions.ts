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
  prompt_imagem?: string;
};

type IaResult = { text: string; inTok: number; outTok: number };

// Gemini (Google AI Studio) — tier gratuito. Usa header x-goog-api-key (aceita
// tanto o formato antigo "AIza..." quanto o novo "AQ...").
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
async function chamarGemini(key: string, system: string, prompt: string): Promise<IaResult> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4000,
      responseMimeType: "application/json",
    },
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
      const text = parts.map((p) => p?.text ?? "").join("").trim();
      return {
        text,
        inTok: json?.usageMetadata?.promptTokenCount ?? 0,
        outTok: json?.usageMetadata?.candidatesTokenCount ?? 0,
      };
    }

    ultimoStatus = res.status;
    const errBody = await res.text();

    // 503 (sobrecarga) e 429 (limite) são transitórios: espera e tenta de novo.
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
  throw new Error("O Gemini está sobrecarregado agora (pico de demanda). Tente gerar novamente em alguns segundos.");
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

// Loop de performance: resume os dados reais de posts publicados para a IA
// inclinar o conteúdo ao que já funciona (formato/linha/dores com melhor
// engajamento). Só entra quando há base mínima (>=3 posts com métricas).
async function resumoPerformance(client: ReturnType<typeof sb>): Promise<string> {
  try {
    const { data } = await client
      .from("mkt_posts")
      .select("linha, formato, dores:mkt_dores(titulo), performance:mkt_performance(curtidas, comentarios, salvamentos)")
      .eq("status", "publicado");
    const posts: any[] = data ?? [];
    const eng = (p: any): number | null => {
      const pf = p.performance?.[0];
      return pf ? (pf.curtidas ?? 0) + (pf.comentarios ?? 0) + (pf.salvamentos ?? 0) : null;
    };
    const comPerf = posts.filter((p) => eng(p) !== null);
    if (comPerf.length < 3) return "";
    const ranking = (key: (p: any) => string | null) => {
      const m: Record<string, { total: number; n: number }> = {};
      for (const p of comPerf) {
        const k = key(p);
        if (!k) continue;
        m[k] ??= { total: 0, n: 0 };
        m[k].total += eng(p)!;
        m[k].n += 1;
      }
      return Object.entries(m)
        .map(([k, v]) => ({ k, avg: Math.round(v.total / v.n) }))
        .sort((a, b) => b.avg - a.avg);
    };
    const topFormato = ranking((p) => p.formato)[0];
    const topLinha = ranking((p) => p.linha)[0];
    const topDores = ranking((p) => p.dores?.titulo ?? null).slice(0, 3);
    const linhas = [
      topFormato ? `- Formato com melhor engajamento médio: ${topFormato.k}` : "",
      topLinha ? `- Linha com melhor engajamento médio: ${topLinha.k}` : "",
      topDores.length ? `- Dores que mais engajam: ${topDores.map((d) => d.k).join("; ")}` : "",
    ].filter(Boolean);
    if (!linhas.length) return "";
    return `APRENDIZADO DE PERFORMANCE (dados reais de ${comPerf.length} posts publicados — quando fizer sentido, incline o post para o que já funciona, sem forçar):\n${linhas.join("\n")}`;
  } catch {
    return "";
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

    const client = sb(context.accessToken);
    const perfResumo = await resumoPerformance(client);

    const userPrompt = [
      `Linha de negócio: ${data.linha}`,
      `Formato: ${data.formato}`,
      `Dor da persona: ${data.dor_titulo}${data.dor_descricao ? " — " + data.dor_descricao : ""}`,
      data.observacao ? `Observação do fundador: ${data.observacao}` : "",
      data.ajuste_raciocinio ? `Ajuste solicitado no raciocínio: ${data.ajuste_raciocinio}` : "",
      data.imagem_contexto ? `Imagem de referência do projeto (descrição técnica): ${data.imagem_contexto}` : "",
      perfResumo ? `\n${perfResumo}` : "",
      "",
      "OBRIGATÓRIO: inclua TODOS os campos do schema, inclusive prompt_imagem (um prompt de imagem detalhado e específico para este post, pronto para colar no Google Flow/Imagen). Nunca omita prompt_imagem.",
      "Responda EXCLUSIVAMENTE com o objeto JSON. Sem texto antes, sem texto depois, sem markdown, sem blocos de código, sem explicação. Apenas o JSON puro começando com { e terminando com }.",
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt = await getEffectiveSystemPrompt(client);

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
