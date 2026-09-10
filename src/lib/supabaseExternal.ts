// Cliente único do app: aponta para o Supabase de produção do NL OS
// (gwmifubdcjfyyrypenah) — mesmo login e mesmos dados do NL OS.
// Tabelas de marketing usam o prefixo "mkt_".
import { createClient } from "@supabase/supabase-js";
import { NL_OS_SUPABASE_ANON_KEY, NL_OS_SUPABASE_URL } from "./supabase-config";

export const SUPABASE_EXTERNAL_URL = NL_OS_SUPABASE_URL;
export const SUPABASE_EXTERNAL_ANON_KEY = NL_OS_SUPABASE_ANON_KEY;

export const supabaseExternal = createClient(
  SUPABASE_EXTERNAL_URL,
  SUPABASE_EXTERNAL_ANON_KEY,
  {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

// Backwards-compat alias so existing code that imported `supabase` keeps working.
export const supabase = supabaseExternal;
