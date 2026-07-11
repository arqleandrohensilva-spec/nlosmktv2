import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseExternal } from "@/lib/supabaseExternal";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Autenticando…");

  useEffect(() => {
    (async () => {
      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const params = new URLSearchParams(hash || window.location.search);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (!access_token || !refresh_token) {
          setMsg("Tokens ausentes.");
          navigate({ to: "/login", replace: true });
          return;
        }
        const { error } = await supabaseExternal.auth.setSession({ access_token, refresh_token });
        window.history.replaceState({}, "", "/auth/callback");
        if (error) {
          setMsg(error.message);
          navigate({ to: "/login", replace: true });
          return;
        }
        navigate({ to: "/", replace: true });
      } catch (e: any) {
        setMsg(e?.message ?? "Falha no callback.");
        navigate({ to: "/login", replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#E8E4DF" }}>
      <div className="font-mono text-xs tracking-widest text-[#8B7355]">{msg}</div>
    </div>
  );
}
