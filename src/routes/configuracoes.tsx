import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { salvarWebhookMake, statusWebhookMake, testarWebhookMake } from "@/lib/make.functions";
import { getMarcaConfig, salvarMarcaConfig } from "@/lib/marca-config.functions";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Webhook, Brain, Save } from "lucide-react";

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
        <MarcaCerebroSection />

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

type MarcaForm = {
  publico: string;
  dores: string;
  objecoes: string;
  tom: string;
  frases: string;
  regras: string;
  extra: string;
};

const MARCA_VAZIO: MarcaForm = {
  publico: "",
  dores: "",
  objecoes: "",
  tom: "",
  frases: "",
  regras: "",
  extra: "",
};

const CAMPOS_MARCA: { k: keyof MarcaForm; label: string; ph: string; big?: boolean }[] = [
  { k: "publico", label: "Público-alvo", ph: "Quem é o cliente ideal (idade, perfil, renda, momento de vida)…" },
  { k: "dores", label: "Dores da persona", ph: "As principais dores, medos e frustrações do cliente…" },
  { k: "objecoes", label: "Objeções comuns", ph: "O que trava a decisão antes de fechar (preço, tempo, confiança)…" },
  { k: "tom", label: "Tom de voz", ph: "Como a marca fala — e como NÃO fala…" },
  { k: "frases", label: "Frases validadas", ph: "Frases que funcionam (uma por linha)…" },
  { k: "regras", label: "Regras — nunca fazer", ph: "O que a marca nunca faz em uma peça (uma por linha)…" },
  { k: "extra", label: "Conhecimento extra (cole textos/PDF)", ph: "Cole aqui o conteúdo de PDFs, documentos e notas sobre a marca. A IA vai usar como referência.", big: true },
];

function MarcaCerebroSection() {
  const carregar = useServerFn(getMarcaConfig);
  const salvar = useServerFn(salvarMarcaConfig);

  const q = useQuery({
    queryKey: ["marca-config"],
    queryFn: () => carregar(),
    staleTime: 30_000,
  });

  const [form, setForm] = useState<MarcaForm>(MARCA_VAZIO);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (q.data) {
      setForm({ ...MARCA_VAZIO, ...q.data });
      setDirty(false);
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: async () => salvar({ data: form }),
    onSuccess: () => {
      toast.success("Cérebro da marca salvo. A IA de copy já vai usar essas informações.");
      setDirty(false);
      q.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const preenchido = Object.values(form).some((v) => (v ?? "").trim().length > 0);

  function upd(k: keyof MarcaForm, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  }

  return (
    <section className="border border-[color:var(--divisoria)] rounded-lg bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[color:var(--bronze)]" />
          <div className="font-serif text-lg text-[color:var(--graphite)]">Cérebro da marca</div>
        </div>
        {q.isLoading ? (
          <span className="text-xs text-[color:var(--muted-foreground)] inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> carregando…
          </span>
        ) : preenchido ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Configurado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-[color:var(--muted-foreground)]">
            Usando padrão
          </span>
        )}
      </div>

      <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
        Tudo que você preencher aqui a IA de copy passa a <strong>priorizar</strong> ao gerar conteúdo.
        Deixe em branco para usar o padrão da marca. Você pode colar o conteúdo de PDFs no campo
        "Conhecimento extra".
      </p>

      <div className="space-y-4">
        {CAMPOS_MARCA.map((c) => (
          <label key={c.k} className="block">
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
              {c.label.toUpperCase()}
            </div>
            <textarea
              value={form[c.k]}
              onChange={(e) => upd(c.k, e.target.value)}
              placeholder={c.ph}
              className={[
                "w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)] resize-y",
                c.big ? "min-h-[160px]" : "min-h-[80px]",
              ].join(" ")}
            />
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          disabled={!dirty || saveMut.isPending}
          onClick={() => saveMut.mutate()}
          className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white hover:bg-[color:var(--bronze)] disabled:opacity-40"
        >
          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar cérebro da marca
        </button>
      </div>
    </section>
  );
}
