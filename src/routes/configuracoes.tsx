import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { salvarWebhookMake, statusWebhookMake, testarWebhookMake } from "@/lib/make.functions";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Webhook } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const testar = useServerFn(testarWebhookMake);
  const salvar = useServerFn(salvarWebhookMake);
  const status = useServerFn(statusWebhookMake);
  const [url, setUrl] = useState("");

  const st = useQuery({
    queryKey: ["make-webhook-status"],
    queryFn: () => status(),
    staleTime: 30_000,
  });

  const testMut = useMutation({
    mutationFn: async () => testar({ data: url ? { url } : {} }),
    onSuccess: (r) => {
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao testar webhook"),
  });

  const saveMut = useMutation({
    mutationFn: async () => salvar({ data: { url } }),
    onSuccess: () => {
      toast.success("Webhook do Make salvo.");
      setUrl("");
      st.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar webhook"),
  });

  const configurado = !!st.data?.configured;

  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Integrações"
        description="Conecte serviços externos ao NL OS MKT. As credenciais são armazenadas com segurança no backend."
      />

      <div className="px-4 md:px-10 py-8 space-y-8 max-w-3xl">
        <section className="border border-[color:var(--divisoria)] rounded-lg bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-[color:var(--bronze)]" />
              <div className="font-serif text-lg text-[color:var(--graphite)]">Make (webhook)</div>
            </div>
            {st.isLoading ? (
              <span className="text-xs text-[color:var(--muted-foreground)] inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> verificando…
              </span>
            ) : configurado ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-700">
                <CheckCircle2 className="h-4 w-4" /> Webhook configurado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-red-600">
                <XCircle className="h-4 w-4" /> Não configurado
              </span>
            )}
          </div>

          <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
            Crie um cenário no{" "}
            <a href="https://make.com" target="_blank" rel="noreferrer" className="underline text-[color:var(--bronze)]">
              Make
            </a>{" "}
            iniciado por um módulo <em>Webhooks · Custom webhook</em> e cole a URL abaixo. O NL OS MKT envia
            <span className="font-mono text-xs"> {"{ texto, data_hora, canal, conteudo_tipo, origem }"} </span>
            no corpo da requisição.
          </p>

          <label className="block">
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
              MAKE WEBHOOK URL
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hook.make.com/..."
              className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
              autoComplete="off"
            />
            {st.data?.url_preview && !url && (
              <div className="text-[10px] font-mono text-[color:var(--muted-foreground)] mt-1">
                Atual: {st.data.url_preview}
              </div>
            )}
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              disabled={testMut.isPending}
              onClick={() => testMut.mutate()}
              className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)] disabled:opacity-40"
            >
              {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Testar webhook
            </button>
            <button
              disabled={!url.trim() || saveMut.isPending}
              onClick={() => saveMut.mutate()}
              className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white hover:bg-[color:var(--bronze)] disabled:opacity-40"
            >
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar webhook
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
