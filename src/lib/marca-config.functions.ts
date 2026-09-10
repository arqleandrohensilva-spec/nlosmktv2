import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseExternal } from "@/lib/supabaseExternal";
import { NL_OS_SUPABASE_ANON_KEY, NL_OS_SUPABASE_URL } from "./supabase-config";
import { readMarcaConfig, saveMarcaConfig, type MarcaConfig } from "./marca-cerebro.server";

// Encaminha o token da sessão (Supabase externo) para o servidor via sendContext,
// para que as chamadas ao banco rodem como "authenticated" e passem no RLS.
export const withExternalAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { data } = await supabaseExternal.auth.getSession();
    const token = data.session?.access_token ?? null;
    return next({ sendContext: { accessToken: token } });
  })
  .server(async ({ next, context }) => next({ context }));

export function sb(accessToken?: string | null) {
  let authHeader: string | undefined = accessToken ? `Bearer ${accessToken}` : undefined;
  if (!authHeader) {
    try {
      authHeader = getRequest()?.headers.get("authorization") ?? undefined;
    } catch {}
  }
  return createClient(NL_OS_SUPABASE_URL, NL_OS_SUPABASE_ANON_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

export const getMarcaConfig = createServerFn({ method: "GET" })
  .middleware([withExternalAuth])
  .handler(async ({ context }): Promise<MarcaConfig> => {
    return await readMarcaConfig(sb(context.accessToken));
  });

const Input = z.object({
  publico: z.string().max(8000).optional(),
  dores: z.string().max(8000).optional(),
  objecoes: z.string().max(8000).optional(),
  tom: z.string().max(8000).optional(),
  frases: z.string().max(8000).optional(),
  regras: z.string().max(8000).optional(),
  extra: z.string().max(20000).optional(),
});

export const salvarMarcaConfig = createServerFn({ method: "POST" })
  .middleware([withExternalAuth])
  .inputValidator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const config: MarcaConfig = {
      publico: (data.publico ?? "").toString(),
      dores: (data.dores ?? "").toString(),
      objecoes: (data.objecoes ?? "").toString(),
      tom: (data.tom ?? "").toString(),
      frases: (data.frases ?? "").toString(),
      regras: (data.regras ?? "").toString(),
      extra: (data.extra ?? "").toString(),
    };
    await saveMarcaConfig(sb(context.accessToken), config);
    return { ok: true };
  });
