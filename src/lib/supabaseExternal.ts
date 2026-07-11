// External Supabase (shared with NL OS / NL OS HUB) — connected via URL + anon key only.
// No OAuth/management integration. Table names in this database use the "mkt_" prefix.
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_EXTERNAL_URL = "https://krzuroijejfozljhchok.supabase.co";
export const SUPABASE_EXTERNAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyenVyb2lqZWpmb3psamhjaG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5Mjg4MjEsImV4cCI6MjA5MzUwNDgyMX0.mFMFfY8TdviFVzHvfKYUrZENpcT4wdyW-52-CUNqsOo";

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

// Backwards-compat alias so existing code that imported `supabase` keeps working
// after switching the import path from "@/integrations/supabase/client".
export const supabase = supabaseExternal;