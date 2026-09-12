import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withExternalAuth, sb } from "./marca-config.functions";
import { getEffectiveSystemPrompt } from "./marca-cerebro.server";
import { logGeminiUsage } from "./uso-ia.server";

// #4 Planejamento mensal: gera um plano de conteúdo equilibrado (pilares × linhas ×
// dores) distribuído nas 4 semanas, cada item pronto pra virar copy.

const Input = z.object({ quantidade: z.number().min(4).max(16).optional() });

export type PlanoItem = {
  semana: number;
  linha: "A" | "B" | "AB" | "C";
  formato: "reels" | "estatico" | "carrossel" | "stories";
  pilar: string;
  dor_id: string | null;
  dor_titulo: string;
  tema: string;
  gancho: string;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
const LINHAS = ["A", "B", "AB", "C"];
const FORMATOS = ["reels", "estatico", "carrossel", "stories"];

async function chamarGeminiJson(key: string, system: string, prompt: string): Promise<{ text: string; inTok: number; outTok: number }> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 3500, responseMimeType: "application/json" },
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

function parseJson<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s === -1 || e === -1) throw new Error("Resposta da IA não estava em JSON válido.");
    return JSON.parse(cleaned.slice(s, e + 1)) as T;
  }
}

export const gerarPlanoMensal = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<PlanoItem[]> => {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new Error("Configure GEMINI_API_KEY (grátis) para gerar o plano do mês.");
    const client = sb(context.accessToken);

    const { data: dores } = await client
      .from("mkt_dores")
      .select("id, titulo, categoria, ultima_vez_usada")
      .order("ultima_vez_usada", { ascending: true, nullsFirst: true });
    const doresArr: any[] = dores ?? [];
    const idsValidos = new Map<string, string>(doresArr.map((d) => [String(d.id), d.titulo]));
    const listaDores =
      doresArr
        .map((d) => `- [${d.id}] ${d.titulo} (${d.categoria}${d.ultima_vez_usada ? "" : " · nunca usada"})`)
        .join("\n") || "(nenhuma dor cadastrada)";

    const qtd = data.quantidade ?? 8;
    const base = await getEffectiveSystemPrompt(client);

    const system =
      base +
      "\n\n--- TAREFA: PLANO DE CONTEÚDO DO MÊS ---\n" +
      "Monte um plano de conteúdo equilibrando os 4 PILARES (posicionamento, oferta, marketing, vendas), as LINHAS (A=arquitetura, B=interiores, AB=integrado, C=comercial) e as DORES da persona. Priorize dores marcadas como 'nunca usada' e varie as categorias. Distribua os posts nas 4 semanas do mês. Responda SOMENTE com JSON, sem markdown.";

    const prompt = [
      `Gere ${qtd} posts para o mês, distribuídos nas 4 semanas.`,
      `Dores disponíveis (use o id EXATO da lista):\n${listaDores}`,
      "",
      'Responda EXCLUSIVAMENTE com este JSON: {"itens":[{"semana":1,"linha":"A|B|AB|C","formato":"reels|estatico|carrossel|stories","pilar":"posicionamento|oferta|marketing|vendas","dor_id":"<id exato da lista>","dor_titulo":"<titulo da dor>","tema":"tema/assunto do post","gancho":"gancho ou ângulo de abertura"}]}',
    ].join("\n");

    const r = await chamarGeminiJson(key, system, prompt);
    await logGeminiUsage({
      modulo: "plano",
      operacao: "plano_mensal",
      tokens_input: r.inTok,
      tokens_output: r.outTok,
      detalhes: { quantidade: qtd },
    });

    const parsed = parseJson<{ itens?: any[] }>(r.text);
    const itens = Array.isArray(parsed.itens) ? parsed.itens : [];
    return itens.map((it): PlanoItem => {
      const dorId = typeof it.dor_id === "string" && idsValidos.has(it.dor_id) ? it.dor_id : null;
      return {
        semana: [1, 2, 3, 4].includes(Number(it.semana)) ? Number(it.semana) : 1,
        linha: LINHAS.includes(it.linha) ? it.linha : "A",
        formato: FORMATOS.includes(it.formato) ? it.formato : "reels",
        pilar: String(it.pilar ?? "posicionamento"),
        dor_id: dorId,
        dor_titulo: dorId ? (idsValidos.get(dorId) as string) : String(it.dor_titulo ?? "").trim(),
        tema: String(it.tema ?? "").trim(),
        gancho: String(it.gancho ?? "").trim(),
      };
    });
  });
