import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withExternalAuth, sb } from "./marca-config.functions";
import { getEffectiveSystemPrompt } from "./marca-cerebro.server";
import { logGeminiUsage } from "./uso-ia.server";

// #4 Planejamento de conteúdo: gera um plano equilibrado (pilares × linhas × dores)
// para o período escolhido (1 semana, 15 dias ou 1 mês), conectando parte dos posts
// ao MOMENTO dos projetos ativos vindos do NL OS (contexto_marketing_ativo + briefing).

const Input = z.object({
  periodo: z.enum(["semana", "quinzena", "mes"]).optional(),
  quantidade: z.number().min(2).max(20).optional(),
});

export type PlanoItem = {
  semana: number;
  linha: "A" | "B" | "AB" | "C";
  formato: "reels" | "estatico" | "carrossel" | "stories";
  pilar: string;
  dor_id: string | null;
  dor_titulo: string;
  tema: string;
  gancho: string;
  origem: "projeto" | "dor" | "sazonal";
  projeto_id: string | null; // projeto do NL OS (quando o post é conectado a um projeto)
  contexto_id: string | null; // id da linha em contexto_marketing_ativo (pra pré-preencher o copy)
  cliente: string | null;
};

export type PlanoPeriodo = "semana" | "quinzena" | "mes";

const PERIODOS: Record<PlanoPeriodo, { semanas: number; qtd: number; label: string }> = {
  semana: { semanas: 1, qtd: 3, label: "1 semana" },
  quinzena: { semanas: 2, qtd: 6, label: "15 dias" },
  mes: { semanas: 4, qtd: 10, label: "1 mês" },
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

// Resume o briefing (jsonb) em texto curto, com teto de tamanho.
function resumoBriefing(respostas: unknown, teto = 500): string {
  if (!respostas) return "";
  try {
    if (typeof respostas === "string") return respostas.slice(0, teto);
    const obj = respostas as Record<string, unknown>;
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join("; ")
      .slice(0, teto);
  } catch {
    return "";
  }
}

export const gerarPlanoMensal = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<PlanoItem[]> => {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new Error("Configure GEMINI_API_KEY (grátis) para gerar o plano.");
    const client = sb(context.accessToken);

    const periodo: PlanoPeriodo = data.periodo ?? "mes";
    const cfg = PERIODOS[periodo];
    const qtd = data.quantidade ?? cfg.qtd;

    // 1) Dores da persona (prioriza as nunca usadas / mais antigas).
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

    // 2) Projetos ativos vindos do NL OS (contexto_marketing_ativo) + briefing de cada um.
    const { data: contextos } = await client
      .from("contexto_marketing_ativo")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);
    const contextosArr: any[] = (contextos ?? []).filter((c) => c?.cliente);
    const projIds = contextosArr.map((c) => c.projeto_id).filter((v): v is string => typeof v === "string" && v.length > 0);

    const briefingPorProjeto = new Map<string, string>();
    if (projIds.length) {
      const { data: briefs } = await client
        .from("briefings_completos")
        .select("projeto_id, respostas, criado_em")
        .in("projeto_id", projIds)
        .order("criado_em", { ascending: false });
      for (const b of (briefs ?? []) as any[]) {
        if (b?.projeto_id && !briefingPorProjeto.has(b.projeto_id)) {
          briefingPorProjeto.set(b.projeto_id, resumoBriefing(b.respostas));
        }
      }
    }

    // Mapa contexto_id válido -> {projeto_id, cliente} pra validar a resposta da IA.
    const contextoValido = new Map<string, { projeto_id: string | null; cliente: string }>();
    const listaProjetos =
      contextosArr
        .map((c) => {
          contextoValido.set(String(c.id), { projeto_id: c.projeto_id ?? null, cliente: c.cliente });
          const brief = c.projeto_id ? briefingPorProjeto.get(c.projeto_id) : "";
          const partes = [
            `[contexto:${c.id}]`,
            `Cliente: ${c.cliente}`,
            c.tipo ? `Tipo: ${c.tipo}` : "",
            c.etapa_atual ? `Etapa: ${c.etapa_atual}` : "",
            c.status ? `Status: ${c.status}` : "",
            c.proxima_entrega ? `Próxima entrega: ${c.proxima_entrega}` : "",
            brief ? `Briefing: ${brief}` : "",
          ].filter(Boolean);
          return "- " + partes.join(" · ");
        })
        .join("\n") || "(nenhum projeto ativo enviado do NL OS)";

    const base = await getEffectiveSystemPrompt(client);

    const system =
      base +
      "\n\n--- TAREFA: PLANO DE CONTEÚDO ---\n" +
      `Monte um plano de conteúdo para ${cfg.label} (${cfg.semanas} semana(s)), com aproximadamente ${qtd} posts, ` +
      "equilibrando os 4 PILARES (posicionamento, oferta, marketing, vendas), as LINHAS (A=arquitetura, B=interiores, AB=integrado, C=comercial) e as DORES da persona. " +
      "Quando houver PROJETOS ATIVOS do NL OS, dedique parte dos posts ao MOMENTO de cada projeto (fase de projeto, execução, entrega, bastidor), conectando o tema ao contexto/briefing do cliente e referenciando o contexto pelo id — esses itens têm origem 'projeto'. " +
      "Os demais posts atacam as DORES da persona (priorize as marcadas como 'nunca usada' e varie as categorias) — origem 'dor'. " +
      `Distribua os posts ao longo das ${cfg.semanas} semana(s). Responda SOMENTE com JSON, sem markdown.`;

    const prompt = [
      `Período: ${cfg.label}. Gere ~${qtd} posts distribuídos em ${cfg.semanas} semana(s) (numeradas de 1 a ${cfg.semanas}).`,
      "",
      `Projetos ativos do NL OS (use o id do contexto EXATO quando o post for conectado a um projeto):\n${listaProjetos}`,
      "",
      `Dores disponíveis (use o id EXATO da lista):\n${listaDores}`,
      "",
      'Responda EXCLUSIVAMENTE com este JSON: {"itens":[{"semana":1,"origem":"projeto|dor|sazonal","contexto_id":"<id do contexto quando origem=projeto, senão null>","linha":"A|B|AB|C","formato":"reels|estatico|carrossel|stories","pilar":"posicionamento|oferta|marketing|vendas","dor_id":"<id exato da dor, ou null>","dor_titulo":"<titulo da dor, ou vazio>","tema":"tema/assunto do post","gancho":"gancho ou ângulo de abertura"}]}',
    ].join("\n");

    const r = await chamarGeminiJson(key, system, prompt);
    await logGeminiUsage({
      modulo: "plano",
      operacao: "plano_conteudo",
      tokens_input: r.inTok,
      tokens_output: r.outTok,
      detalhes: { periodo, quantidade: qtd, projetos: contextosArr.length },
    });

    const parsed = parseJson<{ itens?: any[] }>(r.text);
    const itens = Array.isArray(parsed.itens) ? parsed.itens : [];
    return itens.map((it): PlanoItem => {
      const dorId = typeof it.dor_id === "string" && idsValidos.has(it.dor_id) ? it.dor_id : null;
      const ctxId = typeof it.contexto_id === "string" && contextoValido.has(it.contexto_id) ? it.contexto_id : null;
      const ctx = ctxId ? contextoValido.get(ctxId)! : null;
      const origem: PlanoItem["origem"] =
        ctx ? "projeto" : it.origem === "sazonal" ? "sazonal" : "dor";
      const semanaNum = Number(it.semana);
      return {
        semana: semanaNum >= 1 && semanaNum <= cfg.semanas ? semanaNum : 1,
        linha: LINHAS.includes(it.linha) ? it.linha : "A",
        formato: FORMATOS.includes(it.formato) ? it.formato : "reels",
        pilar: String(it.pilar ?? "posicionamento"),
        dor_id: dorId,
        dor_titulo: dorId ? (idsValidos.get(dorId) as string) : String(it.dor_titulo ?? "").trim(),
        tema: String(it.tema ?? "").trim(),
        gancho: String(it.gancho ?? "").trim(),
        origem,
        projeto_id: ctx?.projeto_id ?? null,
        contexto_id: ctxId,
        cliente: ctx?.cliente ?? null,
      };
    });
  });
