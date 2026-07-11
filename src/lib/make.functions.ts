import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { logFixedUsage } from "./uso-ia.server";

const CONFIG_KEY = "make_webhook_url";

function serverClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function readWebhookUrl(): Promise<string | null> {
  try {
    const { data } = await serverClient()
      .from("mkt_configuracoes")
      .select("valor")
      .eq("chave", CONFIG_KEY)
      .maybeSingle();
    const v = (data?.valor ?? "").trim();
    return v || null;
  } catch {
    return null;
  }
}

export const statusWebhookMake = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ configured: boolean; url_preview?: string }> => {
    const url = await readWebhookUrl();
    if (!url) return { configured: false };
    // Return only a short preview so the UI can confirm without leaking full URL
    const preview = url.length > 40 ? `${url.slice(0, 32)}…${url.slice(-6)}` : url;
    return { configured: true, url_preview: preview };
  },
);

export const salvarWebhookMake = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ url: z.string().url().min(8) }).parse(input),
  )
  .handler(async ({ data }) => {
    const s = serverClient();
    const { data: existente } = await s
      .from("mkt_configuracoes")
      .select("id")
      .eq("chave", CONFIG_KEY)
      .maybeSingle();
    if (existente?.id) {
      const { error } = await s
        .from("mkt_configuracoes")
        .update({ valor: data.url, updated_at: new Date().toISOString() })
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await s
        .from("mkt_configuracoes")
        .insert({ chave: CONFIG_KEY, valor: data.url });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const testarWebhookMake = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ url: z.string().url().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; status: number; message: string }> => {
    const url = data.url?.trim() || (await readWebhookUrl());
    if (!url) return { ok: false, status: 0, message: "Webhook do Make não configurado." };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teste: true,
          texto: "Teste de conexão do NL OS MKT",
          data_hora: new Date().toISOString(),
          canal: "instagram",
          conteudo_tipo: "posicionamento",
          origem: "nl_os_mkt",
        }),
      });
      if (res.status === 200) {
        return { ok: true, status: 200, message: "Webhook respondeu 200 — conectado." };
      }
      return { ok: false, status: res.status, message: `Webhook respondeu HTTP ${res.status}.` };
    } catch (e: any) {
      return { ok: false, status: 0, message: e?.message ?? "Falha ao chamar o webhook." };
    }
  });

export const agendarViaWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        texto: z.string().min(1),
        data_hora: z.string().min(1), // ISO
        canal: z.string().min(1),
        conteudo_tipo: z.string().min(1),
        origem: z.string().optional(),
        post_id: z.string().uuid().optional(),
        imagem_url: z.string().url().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const url = await readWebhookUrl();
    if (!url) throw new Error("Webhook do Make não configurado. Configure em /configuracoes.");

    const iso = new Date(data.data_hora).toISOString();
    if (!iso || iso === "Invalid Date") throw new Error("Data/hora inválida.");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texto: data.texto,
        data_hora: iso,
        canal: data.canal,
        conteudo_tipo: data.conteudo_tipo,
        origem: data.origem ?? "nl_os_mkt",
        imagem_url: data.imagem_url ?? null,
      }),
    });
    if (!res.ok) {
      throw new Error(`Falha no webhook do Make (HTTP ${res.status}).`);
    }

    await logFixedUsage({
      modulo: "make",
      operacao: "agendamento",
      custo_usd: 0,
      modelo: "make-webhook",
      detalhes: {
        origem: data.origem ?? null,
        canal: data.canal,
        conteudo_tipo: data.conteudo_tipo,
        data_hora: iso,
        chars: data.texto.length,
      },
    });

    if (data.post_id) {
      try {
        await serverClient()
          .from("mkt_posts")
          .update({ status: "agendado" })
          .eq("id", data.post_id);
      } catch {}
    }

    return { ok: true, data_hora: iso };
  });