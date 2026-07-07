import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import {
  analisarConcorrente,
  type ConcorrentesOutput,
} from "@/lib/concorrentes.functions";
import {
  ExternalLink,
  Loader2,
  Trash2,
  AlertTriangle,
  ArrowUpRight,
  Save,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/concorrentes")({
  component: ConcorrentesPage,
});

const NICHOS = [
  "Arquitetura Residencial",
  "Interiores",
  "Arquitetura + Interiores",
  "Comercial",
  "Construção Civil",
  "Outro",
];

type Analise = {
  id: string;
  created_at: string;
  handle: string;
  nicho: string | null;
  legendas_brutas: string;
  resultado: ConcorrentesOutput;
};

function sanitizeHandle(v: string) {
  return v.trim().replace(/^@+/, "").replace(/\/$/, "");
}

function ConcorrentesPage() {
  const navigate = useNavigate();
  const analisar = useServerFn(analisarConcorrente);
  const qc = useQueryClient();

  const [handle, setHandle] = useState("");
  const [legendas, setLegendas] = useState("");
  const [nicho, setNicho] = useState<string>("");
  const [output, setOutput] = useState<ConcorrentesOutput | null>(null);
  const [currentHandle, setCurrentHandle] = useState<string>("");
  const [currentNicho, setCurrentNicho] = useState<string>("");
  const [currentLegendas, setCurrentLegendas] = useState<string>("");

  const handleLimpo = useMemo(() => sanitizeHandle(handle), [handle]);
  const instagramUrl = handleLimpo
    ? `https://www.instagram.com/${handleLimpo}/`
    : "";

  const { data: analises } = useQuery({
    queryKey: ["analises_concorrentes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("analises_concorrentes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Analise[];
    },
  });

  const analisarMut = useMutation({
    mutationFn: async () => {
      const h = sanitizeHandle(handle);
      if (!h) throw new Error("Informe o @ do perfil.");
      if (legendas.trim().length < 50)
        throw new Error("Cole pelo menos algumas legendas (mínimo 50 caracteres).");
      return analisar({
        data: { handle: h, legendas, nicho: nicho || undefined },
      });
    },
    onSuccess: (data) => {
      setOutput(data);
      setCurrentHandle(sanitizeHandle(handle));
      setCurrentNicho(nicho);
      setCurrentLegendas(legendas);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const salvarMut = useMutation({
    mutationFn: async () => {
      if (!output) throw new Error("Nada para salvar.");
      const { error } = await (supabase as any)
        .from("analises_concorrentes")
        .insert({
          handle: currentHandle,
          nicho: currentNicho || null,
          legendas_brutas: currentLegendas,
          resultado: output,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Análise salva.");
      qc.invalidateQueries({ queryKey: ["analises_concorrentes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deletarMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("analises_concorrentes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analises_concorrentes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function carregarAnalise(a: Analise) {
    setOutput(a.resultado);
    setCurrentHandle(a.handle);
    setCurrentNicho(a.nicho ?? "");
    setCurrentLegendas(a.legendas_brutas);
    setHandle(a.handle);
    setNicho(a.nicho ?? "");
    setLegendas(a.legendas_brutas);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <PageHeader
        eyebrow="Radar de Concorrentes"
        title="Análise estratégica"
        description="Cole o @ e as legendas dos últimos posts. O sistema mapeia o que eles fazem — e onde a NL pode ocupar o espaço que deixaram vazio."
      />

      <div className="px-4 md:px-10 py-8 space-y-8 max-w-5xl">
        {/* Formulário */}
        <section className="border border-[color:var(--divisoria)] rounded-lg p-5 md:p-6 bg-[color:var(--bege)] space-y-5">
          <div>
            <label className="block font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase mb-2">
              Perfil analisado
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@escritorio.exemplo"
              className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2.5 text-sm focus:border-[color:var(--bronze)] outline-none"
            />
            {handleLimpo && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-xs text-[color:var(--bronze)] hover:underline"
              >
                Abrir perfil no Instagram <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase mb-2">
              Legendas dos últimos posts
            </label>
            <textarea
              value={legendas}
              onChange={(e) => setLegendas(e.target.value)}
              placeholder="Cole aqui as legendas dos últimos 10–15 posts do perfil. Separe cada post com uma linha em branco ou com ---"
              className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-3 text-sm focus:border-[color:var(--bronze)] outline-none resize-y"
              style={{ minHeight: 300 }}
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase mb-2">
              Nicho do perfil
            </label>
            <select
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2.5 text-sm focus:border-[color:var(--bronze)] outline-none"
            >
              <option value="">Selecione (opcional)</option>
              {NICHOS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => analisarMut.mutate()}
            disabled={analisarMut.isPending}
            className="inline-flex items-center gap-2 rounded-[4px] bg-[#0F0F0F] text-white px-5 py-2.5 text-sm hover:bg-[#8B7355] disabled:opacity-60 transition-colors"
          >
            {analisarMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
              </>
            ) : (
              "Analisar estratégia"
            )}
          </button>
        </section>

        {/* Histórico */}
        {analises && analises.length > 0 && (
          <section>
            <h2 className="font-serif text-lg text-[color:var(--graphite)] mb-3">
              Histórico de análises
            </h2>
            <div className="space-y-2">
              {analises.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 border border-[color:var(--divisoria)] rounded-lg bg-white px-4 py-3"
                >
                  <button
                    onClick={() => carregarAnalise(a)}
                    className="flex-1 text-left"
                  >
                    <div className="font-serif text-sm text-[color:var(--graphite)]">
                      @{a.handle}
                    </div>
                    <div className="text-xs text-[color:var(--muted-foreground)] mt-0.5">
                      {new Date(a.created_at).toLocaleDateString("pt-BR")}
                      {a.nicho ? ` · ${a.nicho}` : ""}
                    </div>
                  </button>
                  <button
                    onClick={() => deletarMut.mutate(a.id)}
                    aria-label="Deletar análise"
                    className="p-2 text-[color:var(--muted-foreground)] hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Resultado */}
        {output && (
          <ResultadoAnalise
            output={output}
            onSalvar={() => salvarMut.mutate()}
            salvando={salvarMut.isPending}
            onGerarPost={(lacuna) =>
              navigate({
                to: "/copy",
                search: {
                  observacao: `Explorar lacuna detectada na análise de concorrente: ${lacuna}`,
                },
              })
            }
          />
        )}
      </div>
    </>
  );
}

function ResultadoAnalise({
  output,
  onSalvar,
  salvando,
  onGerarPost,
}: {
  output: ConcorrentesOutput;
  onSalvar: () => void;
  salvando: boolean;
  onGerarPost: (lacuna: string) => void;
}) {
  const metricCard = (label: string, value: string) => (
    <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-4">
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase">
        {label}
      </div>
      <div className="font-serif text-xl text-[color:var(--graphite)] mt-1">
        {value}
      </div>
    </div>
  );

  const pilares = [
    { key: "posicionamento", label: "Posicionamento" },
    { key: "oferta", label: "Oferta" },
    { key: "marketing", label: "Marketing" },
    { key: "vendas", label: "Vendas" },
  ] as const;

  return (
    <section className="space-y-8">
      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        {metricCard("Posts analisados", String(output.posts_analisados))}
        {metricCard("Tom predominante", output.tom_predominante)}
        {metricCard("CTA de alta pressão", output.tem_cta_alta_pressao ? "Sim" : "Não")}
        {metricCard("Emoji presente", `${output.percentual_com_emoji}%`)}
      </div>

      {/* Pilares */}
      <div>
        <h3 className="font-serif text-lg text-[color:var(--graphite)] mb-3">
          Distribuição de pilares detectada
        </h3>
        <div className="space-y-3 border border-[color:var(--divisoria)] rounded-lg bg-white p-5">
          {pilares.map((p) => {
            const v = output.pilares[p.key] ?? 0;
            const dominante = v > 50;
            const cor = dominante ? "#B8860B" : "#8B7355";
            return (
              <div key={p.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono uppercase tracking-widest text-[color:var(--graphite)]">
                    {p.label}
                  </span>
                  <span className="font-mono text-[color:var(--muted-foreground)]">
                    {v}%{dominante && " · dominante"}
                  </span>
                </div>
                <div className="h-2 bg-[color:var(--divisoria)] rounded-sm overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${Math.min(100, v)}%`, background: cor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dores */}
      {output.dores_atacadas?.length > 0 && (
        <div>
          <h3 className="font-serif text-lg text-[color:var(--graphite)] mb-3">
            Dores que eles atacam
          </h3>
          <div className="flex flex-wrap gap-2">
            {output.dores_atacadas.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-1.5 text-xs text-[color:var(--graphite)]"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tom */}
      <div>
        <h3 className="font-serif text-lg text-[color:var(--graphite)] mb-3">
          Tom e linguagem
        </h3>
        <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-5 space-y-4">
          <p className="text-sm text-[color:var(--graphite)] leading-relaxed">
            {output.descricao_tom}
          </p>
          {output.palavras_recorrentes?.length > 0 && (
            <div>
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase mb-2">
                Palavras recorrentes
              </div>
              <div className="flex flex-wrap gap-1.5">
                {output.palavras_recorrentes.map((p, i) => (
                  <span
                    key={i}
                    className="font-mono text-xs text-[color:var(--muted-foreground)] bg-[color:var(--bege)] px-2 py-0.5 rounded"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-[color:var(--muted-foreground)] flex flex-wrap gap-4 pt-2 border-t border-[color:var(--divisoria)]">
            <span>
              Emoji: <strong>{output.percentual_com_emoji}%</strong> dos posts
            </span>
            <span>
              CTA de alta pressão:{" "}
              <strong>{output.tem_cta_alta_pressao ? "presente" : "ausente"}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Lacunas */}
      <div>
        <h3 className="font-serif text-lg text-[color:var(--graphite)] mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[color:var(--bronze)]" />
          Onde a NL pode se diferenciar
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {output.lacunas?.map((l, i) => (
            <div
              key={i}
              className="bg-[color:var(--bege)] border-l-2 p-4 rounded-r-[4px]"
              style={{ borderLeftColor: "#8B7355", borderLeftWidth: 2 }}
            >
              <div className="font-serif text-base text-[color:var(--graphite)] mb-2">
                {l.titulo}
              </div>
              <div className="text-xs text-[color:var(--muted-foreground)] mb-3 leading-relaxed">
                {l.descricao}
              </div>
              <div className="text-xs text-[color:var(--graphite)] leading-relaxed">
                <span className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase block mb-1">
                  Oportunidade NL
                </span>
                {l.oportunidade_nl}
              </div>
              <button
                onClick={() => onGerarPost(l.titulo)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-[color:var(--bronze)] hover:underline"
              >
                Gerar post <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo */}
      {output.resumo_executivo && (
        <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-5">
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase mb-2">
            Resumo executivo
          </div>
          <p className="text-sm text-[color:var(--graphite)] leading-relaxed">
            {output.resumo_executivo}
          </p>
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-3 pt-2">
        {output.lacunas?.[0] && (
          <button
            onClick={() => onGerarPost(output.lacunas[0].titulo)}
            className="inline-flex items-center gap-2 rounded-[4px] bg-[#0F0F0F] text-white px-5 py-2.5 text-sm hover:bg-[#8B7355] transition-colors"
          >
            Gerar post explorando essa lacuna <ArrowUpRight className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onSalvar}
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-5 py-2.5 text-sm hover:border-[color:var(--bronze)] disabled:opacity-60"
        >
          {salvando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar análise
        </button>
      </div>
    </section>
  );
}