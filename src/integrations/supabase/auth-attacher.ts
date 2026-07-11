// Overridden to attach the SESSION from the external Supabase project
// (shared with NL OS / NL OS HUB), not the Lovable Cloud instance.
import { createMiddleware } from '@tanstack/react-start'
import { supabaseExternal as supabase } from '@/lib/supabaseExternal'

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
