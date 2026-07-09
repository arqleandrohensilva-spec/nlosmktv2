import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { logFixedUsage } from "./uso-ia.server";

function serverClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function readToken(): Promise<string | null> {
  const env = process.env.BUFFER_ACCESS_TOKEN;
  if (env && env.trim()) return env.trim();
  try {
    const { data } = await serverClient()
      .from("configuracoes")
      .select("valor")
      .eq("chave", "buffer_access_token")
      .maybeSingle();
    const v = (data?.valor ?? "").trim();
    return v || null;
  } catch {
    return null;
  }
}

export type BufferProfile = {
  id: string;
  service: string;
  service_username?: string;
  formatted_username?: string;
  avatar?: string;
};

export const listarPerfisBuffer = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ profiles: BufferProfile[]; error?: string }> => {
    const token = await readToken();
    if (!token) return { profiles: [], error: "Token do Buffer não configurado." };
    const res = await fetch("https://api.bufferapp.com/1/profiles.json", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        const check = await fetch("https://api.bufferapp.com/1/user.json", {
          headers: { Authorization: `Bearer ${token}` },
        });
        return {
          profiles: [],
          error: check.ok
            ? "Token válido, mas sem perfis acessíveis."
            : `Token inválido (HTTP ${res.status}).`,
        };
      }
      return { profiles: [], error: `Token inválido (HTTP ${res.status}).` };
    }
    const json = (await res.json()) as any[];
    const profiles: BufferProfile[] = (json ?? []).map((p) => ({
      id: p.id,
      service: p.service,
      service_username: p.service_username,
      formatted_username: p.formatted_username,
      avatar: p.avatar,
    }));
    return { profiles };
  },
);

export const testarConexaoBuffer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(4).optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<{ ok: boolean; count: number; message: string }> => {
    const token = data.token?.trim() || (await readToken());
    if (!token) return { ok: false, count: 0, message: "Token do Buffer não configurado." };
    const res = await fetch("https://api.bufferapp.com/1/profiles.json", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        const check = await fetch("https://api.bufferapp.com/1/user.json", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (check.ok) {
          return { ok: true, count: 0, message: "Token válido — nenhum perfil conectado." };
        }
      }
      return { ok: false, count: 0, message: `Token inválido (HTTP ${res.status}).` };
    }
    const json = (await res.json()) as any[];
    return { ok: true, count: json?.length ?? 0, message: `Conectado — ${json?.length ?? 0} perfis encontrados.` };
  });

export const salvarTokenBuffer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(4) }).parse(input))
  .handler(async ({ data }) => {
    const s = serverClient();
    const { data: existente } = await s
      .from("configuracoes")
      .select("id")
      .eq("chave", "buffer_access_token")
      .maybeSingle();
    if (existente?.id) {
      const { error } = await s
        .from("configuracoes")
        .update({ valor: data.token, updated_at: new Date().toISOString() })
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await s
        .from("configuracoes")
        .insert({ chave: "buffer_access_token", valor: data.token });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const agendarBuffer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        profile_ids: z.array(z.string()).min(1),
        text: z.string().min(1),
        scheduled_at: z.string().min(1), // ISO
        origem: z.string().optional(),
        post_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const token = await readToken();
    if (!token) throw new Error("Token do Buffer não configurado. Configure em /configuracoes.");

    const unix = Math.floor(new Date(data.scheduled_at).getTime() / 1000);
    if (!Number.isFinite(unix) || unix <= 0) throw new Error("Data/hora inválida.");

    const res = await fetch("https://api.bufferapp.com/1/updates/create.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile_ids: data.profile_ids,
        text: data.text,
        scheduled_at: data.scheduled_at,
      }),
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok || json?.success === false) {
      const msg = json?.message || json?.error || `HTTP ${res.status}`;
      throw new Error(`Falha no Buffer: ${msg}`);
    }

    await logFixedUsage({
      modulo: "buffer",
      operacao: "agendamento",
      custo_usd: 0,
      modelo: "buffer-api",
      detalhes: {
        origem: data.origem ?? null,
        profile_ids: data.profile_ids,
        scheduled_at: data.scheduled_at,
        chars: data.text.length,
      },
    });

    // Se veio de um post do calendário, marcar como agendado
    if (data.post_id) {
      try {
        await serverClient()
          .from("posts")
          .update({ status: "agendado" })
          .eq("id", data.post_id);
      } catch {}
    }

    return { ok: true, buffer_ids: json?.buffer_ids ?? [], scheduled_at: data.scheduled_at };
  });
