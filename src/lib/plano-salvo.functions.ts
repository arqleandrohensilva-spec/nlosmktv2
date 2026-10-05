import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withExternalAuth, sb } from "./marca-config.functions";
import type { PlanoItem, PlanoPeriodo } from "./plano.functions";

// Persistência do plano editorial: guarda os itens gerados pela IA em
// mkt_plano_itens para que o calendário não "perca" o plano ao atualizar a
// página. Cada item fica como "planejado" (a produzir) até ser marcado feito.

export type PlanoItemSalvo = PlanoItem & {
  id: string;
  lote: string | null;
  periodo: PlanoPeriodo;
  status: "planejado" | "produzido" | "descartado";
  post_id: string | null;
  created_at: string;
};

const ItemInput = z.object({
  semana: z.number(),
  linha: z.string(),
  formato: z.string(),
  pilar: z.string().optional().nullable(),
  dor_id: z.string().optional().nullable(),
  dor_titulo: z.string().optional().nullable(),
  tema: z.string().optional().nullable(),
  gancho: z.string().optional().nullable(),
  origem: z.string().optional().nullable(),
  projeto_id: z.string().optional().nullable(),
  contexto_id: z.string().optional().nullable(),
  cliente: z.string().optional().nullable(),
});

const SalvarInput = z.object({
  periodo: z.enum(["semana", "quinzena", "mes"]),
  itens: z.array(ItemInput).min(1).max(40),
});

// Salva um plano inteiro (um "lote"). Retorna a quantidade salva.
export const salvarPlano = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => SalvarInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; salvos: number }> => {
    const client = sb(context.accessToken);
    const lote = (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    const rows = data.itens.map((it) => ({
      lote,
      periodo: data.periodo,
      semana: it.semana,
      linha: it.linha,
      formato: it.formato,
      pilar: it.pilar ?? null,
      dor_id: it.dor_id ?? null,
      dor_titulo: it.dor_titulo ?? null,
      tema: it.tema ?? null,
      gancho: it.gancho ?? null,
      origem: it.origem ?? null,
      projeto_id: it.projeto_id ?? null,
      contexto_id: it.contexto_id ?? null,
      cliente: it.cliente ?? null,
      status: "planejado",
    }));
    const { error } = await client.from("mkt_plano_itens").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, salvos: rows.length };
  });

// Lista os itens ainda "a produzir" (planejados), do mais recente pro mais antigo.
export const listarPlanoItens = createServerFn({ method: "GET" })
  .middleware([withExternalAuth])
  .handler(async ({ context }): Promise<PlanoItemSalvo[]> => {
    const client = sb(context.accessToken);
    const { data, error } = await client
      .from("mkt_plano_itens")
      .select("*")
      .eq("status", "planejado")
      .order("created_at", { ascending: false })
      .order("semana", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as PlanoItemSalvo[];
  });

const StatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["planejado", "produzido", "descartado"]),
});

// Marca um item como feito/produzido (sai da lista "a produzir").
export const atualizarPlanoItem = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const client = sb(context.accessToken);
    const { error } = await client
      .from("mkt_plano_itens")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const IdInput = z.object({ id: z.string().uuid() });

// Remove um item do plano de vez.
export const excluirPlanoItem = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const client = sb(context.accessToken);
    const { error } = await client.from("mkt_plano_itens").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const LimparInput = z.object({ lote: z.string().optional() });

// Limpa todos os planejados (ou só um lote). Usa status 'descartado' (não apaga histórico).
export const limparPlanejados = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => LimparInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const client = sb(context.accessToken);
    let q = client.from("mkt_plano_itens").update({ status: "descartado" }).eq("status", "planejado");
    if (data.lote) q = q.eq("lote", data.lote);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
