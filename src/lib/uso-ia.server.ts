import { createClient } from "@supabase/supabase-js";

// Preços claude-sonnet-4-6: $3 / 1M input, $15 / 1M output
const PRICE_INPUT = 3 / 1_000_000;
const PRICE_OUTPUT = 15 / 1_000_000;
// Cotação fixa temporária
export const USD_BRL = 5.78;

function serverClient() {
  return createClient(
    "https://krzuroijejfozljhchok.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyenVyb2lqZWpmb3psamhjaG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5Mjg4MjEsImV4cCI6MjA5MzUwNDgyMX0.mFMFfY8TdviFVzHvfKYUrZENpcT4wdyW-52-CUNqsOo",
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type LogAnthropicInput = {
  modulo: string;
  operacao: string;
  tokens_input: number;
  tokens_output: number;
  modelo?: string;
  detalhes?: Record<string, unknown>;
};

export async function logAnthropicUsage(input: LogAnthropicInput) {
  const { tokens_input, tokens_output } = input;
  const custo_usd = tokens_input * PRICE_INPUT + tokens_output * PRICE_OUTPUT;
  const custo_brl = custo_usd * USD_BRL;
  try {
    await serverClient().from("mkt_uso_ia").insert({
      modulo: input.modulo,
      operacao: input.operacao,
      tokens_input,
      tokens_output,
      custo_usd,
      custo_brl,
      modelo: input.modelo ?? "claude-sonnet-4-6",
      detalhes: input.detalhes ?? null,
    });
  } catch (e) {
    console.error("Falha ao registrar uso_ia (anthropic):", e);
  }
}

export async function logFixedUsage(input: {
  modulo: string;
  operacao: string;
  custo_usd: number;
  modelo: string;
  detalhes?: Record<string, unknown>;
}) {
  try {
    await serverClient().from("mkt_uso_ia").insert({
      modulo: input.modulo,
      operacao: input.operacao,
      tokens_input: 0,
      tokens_output: 0,
      custo_usd: input.custo_usd,
      custo_brl: input.custo_usd * USD_BRL,
      modelo: input.modelo,
      detalhes: input.detalhes ?? null,
    });
  } catch (e) {
    console.error("Falha ao registrar uso_ia (fixo):", e);
  }
}