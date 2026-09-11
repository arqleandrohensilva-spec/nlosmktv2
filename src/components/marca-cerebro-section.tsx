import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMarcaConfig, salvarMarcaConfig } from "@/lib/marca-config.functions";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Save } from "lucide-react";

type MarcaForm = {
  publico: string;
  dores: string;
  objecoes: string;
  tom: string;
  frases: string;
  regras: string;
  extra: string;
  imagem: string;
};

const MARCA_VAZIO: MarcaForm = {
  publico: "",
  dores: "",
  objecoes: "",
  tom: "",
  frases: "",
  regras: "",
  extra: "",
  imagem: "",
};

const CAMPOS_MARCA: { k: keyof MarcaForm; label: string; ph: string; big?: boolean }[] = [
  { k: "publico", label: "Público-alvo", ph: "Quem é o cliente ideal (idade, perfil, renda, momento de vida)…" },
  { k: "dores", label: "Dores da persona", ph: "As principais dores, medos e frustrações do cliente…" },
  { k: "objecoes", label: "Objeções comuns", ph: "O que trava a decisão antes de fechar (preço, tempo, confiança)…" },
  { k: "tom", label: "Tom de voz", ph: "Como a marca fala — e como NÃO fala…" },
  { k: "frases", label: "Frases validadas", ph: "Frases que funcionam (uma por linha)…" },
  { k: "regras", label: "Regras — nunca fazer", ph: "O que a marca nunca faz em uma peça (uma por linha)…" },
  { k: "extra", label: "Conhecimento extra (cole textos/PDF)", ph: "Cole aqui o conteúdo de PDFs, documentos e notas sobre a marca. A IA vai usar como referência.", big: true },
  { k: "imagem", label: "Instruções para o agente de imagem", ph: "Diretrizes e referências para gerar as imagens dos posts: estilo, enquadramento, o que sempre incluir/evitar, referências visuais, tipo de render/foto, etc. Entra em todo prompt de imagem.", big: true },
];

export function MarcaCerebroSection() {
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
        <div className="font-serif text-lg text-[color:var(--graphite)]">Cérebro da marca (editável)</div>
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
        Você pode colar o conteúdo de PDFs no campo "Conhecimento extra".
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
