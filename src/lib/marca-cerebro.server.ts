// Cérebro da marca (configurável pelo time em /configuracoes).
// Guardado na tabela genérica mkt_configuracoes (chave/valor), como JSON,
// e injetado no system prompt da IA de copy. Se vazio, cai no SYSTEM_PROMPT padrão.
// As funções recebem um SupabaseClient já autenticado (ver sb() em marca-config.functions),
// pois as políticas RLS de mkt_configuracoes exigem o papel "authenticated".
import type { SupabaseClient } from "@supabase/supabase-js";
import { SYSTEM_PROMPT } from "./nl-brand";

const CONFIG_KEY = "marca_cerebro";

export type MarcaConfig = {
  publico: string;
  dores: string;
  objecoes: string;
  tom: string;
  frases: string;
  regras: string;
  extra: string;
  imagem: string; // instruções/referências para o agente que gera as imagens
  exemplos: string; // "posts de ouro": posts reais que funcionaram, usados como few-shot
};

export const MARCA_CONFIG_VAZIA: MarcaConfig = {
  publico: "",
  dores: "",
  objecoes: "",
  tom: "",
  frases: "",
  regras: "",
  extra: "",
  imagem: "",
  exemplos: "",
};

export async function readMarcaConfig(sb: SupabaseClient): Promise<MarcaConfig> {
  try {
    const { data } = await sb
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

export async function saveMarcaConfig(sb: SupabaseClient, config: MarcaConfig): Promise<void> {
  const valor = JSON.stringify(config);
  const { data: existente } = await sb
    .from("mkt_configuracoes")
    .select("id")
    .eq("chave", CONFIG_KEY)
    .maybeSingle();
  if (existente?.id) {
    const { error } = await sb
      .from("mkt_configuracoes")
      .update({ valor, updated_at: new Date().toISOString() })
      .eq("id", existente.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb
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
export async function getEffectiveSystemPrompt(sb: SupabaseClient): Promise<string> {
  const c = await readMarcaConfig(sb);
  const ajustes = [
    bloco("Público-alvo", c.publico),
    bloco("Dores da persona", c.dores),
    bloco("Objeções comuns", c.objecoes),
    bloco("Tom de voz", c.tom),
    bloco("Frases validadas", c.frases),
    bloco("Regras — nunca fazer", c.regras),
    bloco("Conhecimento adicional da marca", c.extra),
    bloco("Instruções para o agente de imagem (use no campo prompt_imagem)", c.imagem),
  ].join("");

  // "Posts de ouro": exemplos reais injetados como few-shot para a IA imitar o
  // estilo comprovado da marca (voz, ritmo, estrutura) — não copiar o conteúdo.
  const fewShot = (c.exemplos ?? "").trim()
    ? `\n\n--- POSTS DE OURO (posts reais da NL que já funcionaram) ---\nEscreva no MESMO padrão de voz, ritmo, estrutura e sofisticação destes exemplos. Capture o ESTILO — NÃO copie o conteúdo nem os temas.\n\n${c.exemplos.trim()}`
    : "";

  if (!ajustes.trim() && !fewShot) return SYSTEM_PROMPT;
  const ajustesBloco = ajustes.trim()
    ? `\n\n--- AJUSTES DA MARCA (configurados pelo time — PRIORIZE estes sobre o padrão acima) ---${ajustes}`
    : "";
  return `${SYSTEM_PROMPT}${ajustesBloco}${fewShot}`;
}
