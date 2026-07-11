import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseExternal } from "@/lib/supabaseExternal";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    supabaseExternal.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabaseExternal.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Falha ao entrar.");
      return;
    }
    navigate({ to: "/", replace: true });
  }

  async function onReset() {
    if (!email.trim()) {
      toast.error("Informe o e-mail para receber o link de redefinição.");
      return;
    }
    setResetting(true);
    const { error } = await supabaseExternal.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setResetting(false);
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link de redefinição para seu e-mail.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#E8E4DF" }}>
      <div className="w-full max-w-md bg-white border border-[color:var(--divisoria)] rounded-lg p-8 shadow-sm">
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-widest text-[#8B7355]">NL OS MKT</div>
          <h1 className="font-serif text-3xl text-[#3A3A3A] mt-2">Entrar</h1>
          <p className="text-sm text-[color:var(--muted-foreground)] mt-2">
            Acesse com o mesmo login do NL OS.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <div className="font-mono text-[10px] tracking-widest text-[#8B7355] mb-2">E-MAIL</div>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[#8B7355]"
            />
          </label>
          <label className="block">
            <div className="font-mono text-[10px] tracking-widest text-[#8B7355] mb-2">SENHA</div>
            <input
              type="password"
              autoComplete="current-password"
              required
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
            Entrar
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onReset}
            disabled={resetting}
            className="text-xs text-[#8B7355] hover:underline disabled:opacity-40"
          >
            {resetting ? "Enviando…" : "Esqueci minha senha"}
          </button>
        </div>
      </div>
    </div>
  );
}
