import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseExternal } from "@/lib/supabaseExternal";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/redefinir-senha")({
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase recovery links append tokens on hash; ingest so updateUser works.
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      supabaseExternal.auth
        .setSession({ access_token, refresh_token })
        .finally(() => window.history.replaceState({}, "", "/redefinir-senha"));
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("A nova senha precisa ter ao menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await supabaseExternal.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha redefinida.");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#E8E4DF" }}>
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white border border-[color:var(--divisoria)] rounded-lg p-8 space-y-4">
        <div>
          <div className="font-mono text-[10px] tracking-widest text-[#8B7355]">NL OS MKT</div>
          <h1 className="font-serif text-3xl text-[#3A3A3A] mt-2">Redefinir senha</h1>
        </div>
        <label className="block">
          <div className="font-mono text-[10px] tracking-widest text-[#8B7355] mb-2">NOVA SENHA</div>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[#8B7355]"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-[4px] bg-[#3A3A3A] px-4 py-2.5 text-sm text-white hover:bg-[#8B7355] disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar nova senha
        </button>
      </form>
    </div>
  );
}
