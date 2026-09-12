import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withExternalAuth, sb } from "./marca-config.functions";
import { logGeminiUsage } from "./uso-ia.server";

const Input = z.object({
  projeto_id: z.string().optional(),
  cliente: z.string().optional(),
  tipo: z.string().optional(),
});

export type SugestaoPost = {
  dor_existente_id: string | null; // id de mkt_dores quando casa com uma dor já cadastrada
  dor_titulo: string;
  dor_nova: boolean; // true quando a IA propõe uma dor inédita
  dor_categoria: string | null;
  dor_descricao: string | null;
  linha: "A" | "B" | "AB" | "C";
  formato: "reels" | "estatico" | "carrossel" | "stories";
  gancho: string;
  justificativa: string;
};

type IaResult = { text: string; inTok: number; outTok: number };

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

async function chamarGemini(key: string, system: string, prompt: string): Promise<IaResult> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 1500,
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
  throw new Error("O Gemini está sobrecarregado agora (pico de demanda). Tente novamente em alguns segundos.");
}

// Transforma o JSON de respostas do briefing em texto legível para a IA, com teto de tamanho.
function resumoBriefing(respostas: unknown): string {
  if (!respostas) return "";
  try {
    if (typeof respostas === "string") return respostas.slice(0, 4000);
    const obj = respostas as Record<string, unknown>;
    const linhas = Object.entries(obj)
      .map(([k, v]) => {
        const val = typeof v === "object" ? JSON.stringify(v) : String(v);
        return `${k}: ${val}`;
      })
      .join("\n");
    return linhas.slice(0, 4000);
  } catch {
    return "";
  }
}

const LINHAS_VALIDAS = ["A", "B", "AB", "C"] as const;
const FORMATOS_VALIDOS = ["reels", "estatico", "carrossel", "stories"] as const;

function parseSugestao(content: string, idsValidos: Set<string>): SugestaoPost {
  let raw: any;
  try {
    raw = JSON.parse(content);
  } catch {
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("A IA não retornou um JSON válido para a sugestão.");
    }
    raw = JSON.parse(cleaned.slice(start, end + 1));
  }

  // Se a IA "inventar" um id que não existe na lista real, tratamos como dor nova.
  let dorId: string | null =
    typeof raw.dor_existente_id === "string" && idsValidos.has(raw.dor_existente_id)
      ? raw.dor_existente_id
      : null;
  const dorNova = dorId ? false : Boolean(raw.dor_nova ?? true);

  const linha = (LINHAS_VALIDAS as readonly string[]).includes(raw.linha) ? raw.linha : "A";
  const formato = (FORMATOS_VALIDOS as readonly string[]).includes(raw.formato) ? raw.formato : "reels";

  return {
    dor_existente_id: dorId,
    dor_titulo: String(raw.dor_titulo ?? "").trim() || "Dor não identificada",
    dor_nova: dorNova,
    dor_categoria: raw.dor_categoria ? String(raw.dor_categoria).trim() : null,
    dor_descricao: raw.dor_descricao ? String(raw.dor_descricao).trim() : null,
    linha: linha as SugestaoPost["linha"],
    formato: formato as SugestaoPost["formato"],
    gancho: String(raw.gancho ?? "").trim(),
    justificativa: String(raw.justificativa ?? "").trim(),
  };
}

const ObsInput = z.object({
  dor_titulo: z.string().optional(),
  dor_descricao: z.string().optional(),
  linha: z.string().optional(),
  formato: z.string().optional(),
  projeto_id: z.string().optional(),
  observacao_atual: z.string().optional(),
});

const LINHA_DESC: Record<string, string> = {
  A: "Arquitetura residencial",
  B: "Design de interiores",
  AB: "Arquitetura e interiores integrados",
  C: "Arquitetura comercial",
};

function parseObservacao(content: string): string {
  try {
    const raw = JSON.parse(content);
    if (typeof raw?.observacao === "string") return raw.observacao.trim();
  } catch {
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        const raw = JSON.parse(cleaned.slice(start, end + 1));
        if (typeof raw?.observacao === "string") return raw.observacao.trim();
      } catch {
        /* cai no fallback abaixo */
      }
    }
    return cleaned;
  }
  return content.trim();
}

// Gera uma observação/direcionamento para o Motor de Copy a partir da dor,
// formato e linha — considerando o briefing do projeto do NL OS quando escolhido.
export const gerarObservacao = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => ObsInput.parse(input))
  .handler(async ({ data, context }): Promise<{ observacao: string }> => {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new Error("Configure GEMINI_API_KEY (grátis, Google AI Studio) para gerar a observação com IA.");
    }
    const client = sb(context.accessToken);

    let briefingTexto = "";
    if (data.projeto_id) {
      const { data: briefs } = await client
        .from("briefings_completos")
        .select("respostas, tipo, criado_em")
        .eq("projeto_id", data.projeto_id)
        .order("criado_em", { ascending: false })
        .limit(1);
      const b: any = briefs?.[0];
      if (b) briefingTexto = resumoBriefing(b.respostas);
    }

    const linhaTxt = data.linha ? (LINHA_DESC[data.linha] ?? data.linha) : "";

    const system =
      "Você é o estrategista de conteúdo da NL Arquitetos. Sua tarefa é escrever uma OBSERVAÇÃO curta e prática (um direcionamento) para o motor de copy, dizendo o ângulo, a ênfase e o que destacar num post — a partir da dor da persona, do formato e da linha de negócio informados. Quando houver briefing de um projeto real, ancore a observação em detalhes concretos dele (sem inventar dados). Quando não houver projeto, ainda assim prefira SEMPRE ancorar em algo concreto e verificável (uma fase do método, um documento, um material, um número) em vez de ficar só em conceitos abstratos soltos como 'transparência' ou 'clareza'. A observação deve ter 1 a 3 frases, tom técnico e sóbrio (padrão NL: sem emoji, sem superlativo vazio, sem urgência artificial, nunca 'preto puro'). Responda SOMENTE com JSON.";

    const prompt = [
      data.dor_titulo ? `Dor da persona: ${data.dor_titulo}` : "Dor da persona: (não informada)",
      data.dor_descricao ? `Descrição da dor: ${data.dor_descricao}` : "",
      linhaTxt ? `Linha de negócio: ${linhaTxt}` : "",
      data.formato ? `Formato do post: ${data.formato}` : "",
      briefingTexto
        ? `Briefing do projeto (NL OS):\n${briefingTexto}`
        : "Sem projeto do NL OS selecionado. Ancore a observação em algo concreto mesmo assim — prefira referenciar uma das 4 fases reais do método da NL (1. Diagnóstico e diretrizes; 2. Estudo preliminar — conceito e implantação; 3. Anteprojeto — solução arquitetônica consolidada; 4. Projeto executivo — caderno técnico para obra) em vez de ficar em conceito abstrato como 'transparência' ou 'clareza' soltos.",
      data.observacao_atual ? `Observação atual do usuário (aprimore/complemente sem repetir):\n${data.observacao_atual}` : "",
      "",
      'Responda EXCLUSIVAMENTE com este JSON: {"observacao": "<direcionamento de 1 a 3 frases>"}',
    ]
      .filter(Boolean)
      .join("\n");

    const r = await chamarGemini(key, system, prompt);

    await logGeminiUsage({
      modulo: "sugestao",
      operacao: "gerar_observacao",
      tokens_input: r.inTok,
      tokens_output: r.outTok,
      detalhes: { projeto_id: data.projeto_id, linha: data.linha, formato: data.formato },
    });

    const observacao = parseObservacao(r.text);
    if (!observacao) throw new Error("A IA não retornou uma observação. Tente novamente.");
    return { observacao };
  });

export const sugerirDorEPost = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<SugestaoPost> => {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new Error("Configure GEMINI_API_KEY (grátis, Google AI Studio) para usar a sugestão automática.");
    }
    const client = sb(context.accessToken);

    // 1) Briefing do cliente (sinal da dor real), vindo do NL OS pelo projeto_id.
    let briefingTexto = "";
    if (data.projeto_id) {
      const { data: briefs } = await client
        .from("briefings_completos")
        .select("respostas, tipo, criado_em")
        .eq("projeto_id", data.projeto_id)
        .order("criado_em", { ascending: false })
        .limit(1);
      const b: any = briefs?.[0];
      if (b) briefingTexto = resumoBriefing(b.respostas);
    }

    // 2) Dores já cadastradas.
    const { data: dores } = await client
      .from("mkt_dores")
      .select("id, titulo, descricao, categoria")
      .order("titulo");
    const doresArr: any[] = dores ?? [];
    const idsValidos = new Set<string>(doresArr.map((d) => String(d.id)));
    const listaDores =
      doresArr
        .map((d) => `- [${d.id}] ${d.titulo}${d.descricao ? ": " + d.descricao : ""} (categoria: ${d.categoria})`)
        .join("\n") || "(nenhuma dor cadastrada ainda)";

    const system =
      "Você é o estrategista de conteúdo da NL Arquitetos. Recebe o contexto de um cliente/projeto real (incluindo o briefing dele) e a lista de dores de persona já cadastradas. Sua tarefa: identificar qual DOR esse cliente representa. Se casar com uma dor já cadastrada, retorne o id EXATO dela. Se não casar com nenhuma, proponha uma dor NOVA (título curto e específico, categoria e descrição). Depois sugira a linha de negócio (A=Arquitetura, B=Interiores, AB=Integrado, C=Comercial), o formato (reels, estatico, carrossel, stories) e um gancho de post que ataca essa dor. Responda SOMENTE com JSON, sem markdown.";

    const prompt = [
      data.cliente ? `Cliente: ${data.cliente}` : "",
      data.tipo ? `Tipo de projeto: ${data.tipo}` : "",
      briefingTexto ? `Briefing do cliente:\n${briefingTexto}` : "Sem briefing detalhado disponível — infira a dor pelo tipo/contexto.",
      "",
      `Dores já cadastradas:\n${listaDores}`,
      "",
      'Responda EXCLUSIVAMENTE com este JSON (sem texto antes ou depois):',
      '{"dor_existente_id": "<id exato da lista, ou null se nenhuma casar>", "dor_titulo": "<título da dor>", "dor_nova": <true se propôs dor inédita, senão false>, "dor_categoria": "<categoria se nova, senão null>", "dor_descricao": "<descrição se nova, senão null>", "linha": "A|B|AB|C", "formato": "reels|estatico|carrossel|stories", "gancho": "<ângulo/gancho do post>", "justificativa": "<por que essa dor e esse ângulo>"}',
    ]
      .filter(Boolean)
      .join("\n");

    const r = await chamarGemini(key, system, prompt);

    await logGeminiUsage({
      modulo: "sugestao",
      operacao: "sugerir_dor_post",
      tokens_input: r.inTok,
      tokens_output: r.outTok,
      detalhes: { projeto_id: data.projeto_id, cliente: data.cliente },
    });

    return parseSugestao(r.text, idsValidos);
  });
