// Cérebro da marca (configurável pelo time em /configuracoes).
// Guardado na tabela genérica mkt_configuracoes (chave/valor), como JSON,
// e injetado no system prompt da IA de copy. Se vazio, cai no SYSTEM_PROMPT padrão.
import { createClient } from "@supabase/supabase-js";
import { SYSTEM_PROMPT } from "./nl-brand";
import { NL_OS_SUPABASE_ANON_KEY, NL_OS_SUPABASE_URL } from "./supabase-config";

const CONFIG_KEY = "marca_cerebro";

export type MarcaConfig = {
  publico: string;
  dores: string;
  objecoes: string;
  tom: string;
  frases: string;
  regras: string;
  extra: string;
};

export const MARCA_CONFIG_VAZIA: MarcaConfig = {
  publico: "",
  dores: "",
  objecoes: "",
  tom: "",
  frases: "",
  regras: "",
  extra: "",
};

function serverClient() {
  return createClient(NL_OS_SUPABASE_URL, NL_OS_SUPABASE_ANON_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function readMarcaConfig(): Promise<MarcaConfig> {
  try {
    const { data } = await serverClient()
      .from("mkt_configuracoes")
      .select("valor")
      .eq("chave", CONFIG_KEY)
      .maybeSingle();
    if (!data?.valor) return { ...MARCA_CONFIG_VAZIA };
    const parsed = JSON.parse(data.valor) as Partial<MarcaConfig>;
    return { ...MARCA_CONFIG_VAZIA, ...parsed };
  } catch {
    return { ...MARCA_CONFIG_VAZIA };
  }
}

export async function saveMarcaConfig(config: MarcaConfig): Promise<void> {
  const s = serverClient();
  const valor = JSON.stringify(config);
  const { data: existente } = await s
    .from("mkt_configuracoes")
    .select("id")
    .eq("chave", CONFIG_KEY)
    .maybeSingle();
  if (existente?.id) {
    const { error } = await s
      .from("mkt_configuracoes")
      .update({ valor, updated_at: new Date().toISOString() })
      .eq("id", existente.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await s
      .from("mkt_configuracoes")
      .insert({ chave: CONFIG_KEY, valor });
    if (error) throw new Error(error.message);
  }
}

function bloco(label: string, valor: string): string {
  const v = (valor ?? "").trim();
  return v ? `\n${label}:\n${v}\n` : "";
}

// Monta o system prompt efetivo: base sólida + ajustes da marca configurados pelo time.
export async function getEffectiveSystemPrompt(): Promise<string> {
  const c = await readMarcaConfig();
  const ajustes = [
    bloco("Público-alvo", c.publico),
    bloco("Dores da persona", c.dores),
    bloco("Objeções comuns", c.objecoes),
    bloco("Tom de voz", c.tom),
    bloco("Frases validadas", c.frases),
    bloco("Regras — nunca fazer", c.regras),
    bloco("Conhecimento adicional da marca", c.extra),
  ].join("");
  if (!ajustes.trim()) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\n--- AJUSTES DA MARCA (configurados pelo time — PRIORIZE estes sobre o padrão acima) ---${ajustes}`;
}
