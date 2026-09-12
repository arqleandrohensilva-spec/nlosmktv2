import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabaseExternal";
import { PageHeader } from "@/components/page-header";
import { LINHAS, FORMATOS, STATUS, LINHA_BADGE } from "@/lib/nl-brand";
import { gerarPlanoMensal, type PlanoItem, type PlanoPeriodo } from "@/lib/plano.functions";
import { useState, useMemo } from "react";
import { Plus, X, AlertTriangle, Sparkles, Loader2, ArrowRight, Heart, MessageCircle, Send, Bookmark, ThumbsUp, Repeat2 } from "lucide-react";
import { signBibliotecaUrls } from "@/components/biblioteca-picker";
import { toast } from "sonner";

export const Route = createFileRoute("/calendario")({
  component: Calendario,
});

const PERIODO_LABEL: Record<PlanoPeriodo, string> = {
  semana: "1 semana",
  quinzena: "15 dias",
  mes: "1 mês",
};

function Calendario() {
  const [filterLinha, setFilterLinha] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [selected, setSelected] = useState<any | null>(null);
  const qc = useQueryClient();
  const gerarPlano = useServerFn(gerarPlanoMensal);
  const [plano, setPlano] = useState<PlanoItem[] | null>(null);
  const [periodo, setPeriodo] = useState<PlanoPeriodo>("mes");
  const [planoPeriodo, setPlanoPeriodo] = useState<PlanoPeriodo>("mes");

  const planoMut = useMutation({
    mutationFn: async () => gerarPlano({ data: { periodo } }),
    onSuccess: (p) => {
      setPlano(p);
      setPlanoPeriodo(periodo);
      toast.success(`Plano de ${PERIODO_LABEL[periodo]} gerado. Clique em cada item para gerar a copy.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar o plano.")
  });

  const { data: posts } = useQuery({
    queryKey: ["posts", filterLinha, filterStatus],
    queryFn: async () => {
      let q = supabase.from("mkt_posts").select("*, dores:mkt_dores(titulo)").order("created_at", { ascending: false });
      if (filterLinha) q = q.eq("linha", filterLinha);
      if (filterStatus) q = q.eq("status", filterStatus);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const paths = rows
        .map((p) => (p.raciocinio && typeof p.raciocinio === "object" ? (p.raciocinio as any).imagem_path : null))
        .filter((p): p is string => typeof p === "string" && p.length > 0);
      const urlMap = paths.length ? await signBibliotecaUrls(paths) : {};
      return rows.map((p) => ({
        ...p,
        imagem_signed_url: (p.raciocinio as any)?.imagem_path ? urlMap[(p.raciocinio as any).imagem_path] : undefined,
      }));
    },
  });

  const lacunas = useMemo(() => {
    if (!posts) return [] as string[];
    const alerts: string[] = [];
    LINHAS.forEach((l) => {
      const ultimo = posts.find((p: any) => p.linha === l.value);
      if (!ultimo) {
        alerts.push(`Linha ${l.value} sem nenhum post registrado.`);
        return;
      }
      const dias = Math.floor(
        (Date.now() - new Date(ultimo.created_at).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (dias > 14) alerts.push(`Linha ${l.value} há ${dias} dias sem post novo.`);
    });
    return alerts;
  }, [posts]);

  const semanas = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const ranges = [
      { n: 1, start: 1, end: 7 },
      { n: 2, start: 8, end: 14 },
      { n: 3, start: 15, end: 21 },
      { n: 4, start: 22, end: lastDay },
    ];
    return ranges.map((r) => {
      const postsSemana = (posts ?? []).filter((p: any) => {
        const d = new Date(p.created_at);
        if (d.getFullYear() !== year || d.getMonth() !== month) return false;
        const dia = d.getDate();
        return dia >= r.start && dia <= r.end;
      });
      const prontos = postsSemana.filter((p: any) => p.status === "pronto").length;
      const publicados = postsSemana.filter((p: any) => p.status === "publicado").length;
      const rascunhos = postsSemana.filter((p: any) => p.status === "rascunho").length;
      const atual = today >= r.start && today <= r.end;
      const label = `${String(r.start).padStart(2, "0")}-${String(r.end).padStart(2, "0")}/${meses[month]}`;
      return { ...r, postsSemana, prontos, publicados, rascunhos, atual, label };
    });
  }, [posts]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "publicado") patch.data_publicacao = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("mkt_posts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Status atualizado.");
      setSelected(null);
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Calendário editorial"
        title="Produção do mês"
        description="Cada post registrado com raciocínio, formato e status de publicação."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as PlanoPeriodo)}
              className="rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm text-[color:var(--graphite)] focus:outline-none focus:border-[color:var(--bronze)]"
              aria-label="Período do plano"
            >
              <option value="semana">1 semana</option>
              <option value="quinzena">15 dias</option>
              <option value="mes">1 mês</option>
            </select>
            <button
              onClick={() => planoMut.mutate()}
              disabled={planoMut.isPending}
              className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors disabled:opacity-40"
            >
              {planoMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar plano (IA)
            </button>
            <Link
              to="/copy"
              className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors"
            >
              <Plus className="h-4 w-4" /> Novo post
            </Link>
          </div>
        }
      />

      <div className="px-4 md:px-10 py-8">
        {plano && plano.length > 0 && (
          <div className="mb-8 border border-[color:var(--bronze)]/40 rounded-lg bg-[color:var(--bege)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                PLANO DE {PERIODO_LABEL[planoPeriodo].toUpperCase()} (IA) · {plano.length} POSTS
              </div>
              <button
                onClick={() => setPlano(null)}
                className="text-[color:var(--muted-foreground)] hover:text-[color:var(--graphite)]"
                aria-label="Fechar plano"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from(new Set(plano.map((i) => i.semana)))
                .sort((a, b) => a - b)
                .map((sem) => {
                  const itens = plano.filter((i) => i.semana === sem);
                  if (!itens.length) return null;
                  return (
                    <div key={sem} className="space-y-2">
                      <div className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
                        SEMANA {sem}
                      </div>
                      {itens.map((it, idx) => (
                        <Link
                          key={idx}
                          to="/copy"
                          search={{
                            dor: it.dor_id ?? undefined,
                            linha: it.linha,
                            formato: it.formato,
                            observacao: `${it.tema}${it.gancho ? " — " + it.gancho : ""}`,
                            projeto: it.contexto_id ?? undefined,
                          } as any}
                          className="block border border-[color:var(--divisoria)] bg-white rounded-[4px] p-3 hover:border-[color:var(--bronze)] transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-mono tracking-widest ${LINHA_BADGE[it.linha]}`}>
                              L.{it.linha}
                            </span>
                            <span className="font-mono text-[9px] tracking-widest uppercase text-[color:var(--bronze)]">
                              {it.pilar}
                            </span>
                            <span className="font-mono text-[9px] tracking-widest uppercase text-[color:var(--muted-foreground)]">
                              {FORMATOS.find((f) => f.value === it.formato)?.label ?? it.formato}
                            </span>
                            {it.origem === "projeto" && it.cliente && (
                              <span className="px-2 py-0.5 rounded-[4px] text-[9px] font-mono tracking-widest uppercase bg-[color:var(--bronze)] text-white">
                                Projeto · {it.cliente}
                              </span>
                            )}
                          </div>
                          <div className="font-serif text-sm text-[color:var(--graphite)] mt-1">{it.tema}</div>
                          {it.origem !== "projeto" && it.dor_titulo && (
                            <div className="text-xs text-[color:var(--muted-foreground)] mt-0.5">Dor: {it.dor_titulo}</div>
                          )}
                          <div className="mt-2 inline-flex items-center gap-1 text-xs text-[color:var(--bronze)]">
                            Gerar copy <ArrowRight className="h-3 w-3" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-3">
            VISÃO SEMANAL
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {semanas.map((s) => {
              const vazia = s.postsSemana.length === 0;
              return (
                <div
                  key={s.n}
                  className={`border rounded-lg p-3 ${
                    vazia
                      ? "border-dashed border-[color:var(--divisoria)]"
                      : "border-[color:var(--divisoria)]"
                  } ${s.atual ? "bg-[color:var(--bege)]" : "bg-white"}`}
                >
                  <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                    SEMANA {s.n} · {s.label}
                  </div>
                  {vazia ? (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-[color:var(--muted-foreground)]">Sem posts</span>
                      <Link
                        to="/copy"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-[4px] border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)] text-[color:var(--graphite)]"
                        aria-label="Novo post"
                      >
                        <Plus className="h-3 w-3" />
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-3 text-xs text-[color:var(--graphite)]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[color:var(--bronze)]" />
                        {s.prontos}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-600" />
                        {s.publicados}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[color:var(--divisoria)]" />
                        {s.rascunhos}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {lacunas.length > 0 && (
          <div className="mb-6 border border-[color:var(--bronze)] bg-[color:var(--bege)] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-[color:var(--bronze)]" />
              <div className="text-sm">
                <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">
                  LACUNAS DETECTADAS
                </div>
                <ul className="space-y-1">
                  {lacunas.map((l) => <li key={l}>{l}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          <FilterSelect label="Linha" value={filterLinha} onChange={setFilterLinha}>
            <option value="">Todas as linhas</option>
            {LINHAS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </FilterSelect>
          <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus}>
            <option value="">Todos os status</option>
            {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </FilterSelect>
        </div>

        {posts?.length === 0 ? (
          <div className="border border-dashed border-[color:var(--divisoria)] rounded-lg p-10 text-center">
            <p className="text-[color:var(--muted-foreground)] mb-4">Ainda sem posts. Comece pelo motor de copy.</p>
            <Link to="/copy" className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white">
              <Plus className="h-4 w-4" /> Gerar primeiro post
            </Link>
          </div>
        ) : (
          <>
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-3">
            TODOS OS POSTS
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(posts ?? []).map((p: any) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="text-left border border-[color:var(--divisoria)] rounded-lg bg-white p-4 hover:border-[color:var(--bronze)] transition-colors"
              >
                {p.imagem_signed_url && (
                  <div className="aspect-[4/3] mb-3 rounded-[4px] overflow-hidden bg-[color:var(--gelo)]">
                    <img src={p.imagem_signed_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-mono tracking-widest ${LINHA_BADGE[p.linha]}`}>
                    LINHA {p.linha}
                  </span>
                  <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
                    {STATUS.find((s) => s.value === p.status)?.label.toUpperCase()}
                  </span>
                </div>
                <div className="font-serif text-base text-[color:var(--graphite)] line-clamp-2">
                  {p.copy_legenda?.split("\n")[0] ?? p.dores?.titulo ?? "Post"}
                </div>
                <div className="mt-3 font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                  {FORMATOS.find((f) => f.value === p.formato)?.label.toUpperCase()}
                </div>
              </button>
            ))}
          </div>
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40" onClick={() => setSelected(null)} />
          <div className="w-full md:w-[560px] bg-white h-full overflow-y-auto border-l border-[color:var(--divisoria)]">
            <div className="sticky top-0 bg-white border-b border-[color:var(--divisoria)] px-5 py-4 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">POST</div>
                <div className="font-serif text-lg mt-1">Linha {selected.linha} · {FORMATOS.find((f) => f.value === selected.formato)?.label}</div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-5 space-y-5 text-sm">
              {selected.copy_roteiro && (
                <Section label="Roteiro"><p className="whitespace-pre-wrap">{selected.copy_roteiro}</p></Section>
              )}
              <LegendaComPreview key={selected.id} post={selected} />
              <Section label="CTA"><p>{selected.copy_cta}</p></Section>
              <Section label="Briefing visual"><p className="whitespace-pre-wrap">{selected.briefing_visual}</p></Section>
              {selected.raciocinio && (
                <Section label="Raciocínio">
                  <p className="whitespace-pre-wrap text-[color:var(--muted-foreground)]">
                    {selected.raciocinio.raciocinio ?? JSON.stringify(selected.raciocinio, null, 2)}
                  </p>
                </Section>
              )}
              <Section label="Status">
                <div className="flex flex-wrap gap-2">
                  {STATUS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => updateStatus.mutate({ id: selected.id, status: s.value })}
                      className={`px-3 py-1.5 text-xs rounded-[4px] border transition-colors ${
                        selected.status === s.value
                          ? "bg-[color:var(--graphite)] text-white border-[color:var(--graphite)]"
                          : "bg-white text-[color:var(--graphite)] border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">
        {label.toUpperCase()}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm"
      >
        {children}
      </select>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
        {label.toUpperCase()}
      </div>
      <div className="text-[color:var(--graphite)] leading-relaxed">{children}</div>
    </div>
  );
}

// Fonte do sistema — os mockups imitam as interfaces REAIS de cada canal
// (Instagram, LinkedIn, e-mail), não a identidade da marca NL.
const FONTE_SISTEMA =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Formato do post -> qual variante de legenda mostrar por padrão.
const LEGENDA_CHAVE_POR_FORMATO: Record<string, string> = {
  reels: "reels",
  stories: "stories",
  estatico: "feed",
  carrossel: "feed",
};

const LEGENDA_LABELS: Record<string, string> = {
  feed: "Feed",
  stories: "Stories",
  reels: "Reels",
  linkedin: "LinkedIn",
  email: "E-mail",
};

// Ordem preferida de exibição das abas de canal.
const ORDEM_CANAIS = ["feed", "stories", "reels", "linkedin", "email"];

// copy_legenda pode ser: (a) JSON string com variantes por canal
// {"feed": "...", "stories": "...", "reels": "...", "linkedin": "...", "email": "..."};
// (b) já um objeto; ou (c) uma string simples (posts antigos). Resolve os 3 casos.
function resolverLegenda(
  raw: unknown,
  formato: string,
): { variantes: Record<string, string> | null; chaveInicial: string | null; textoSimples: string } {
  const original = typeof raw === "string" ? raw : raw == null ? "" : String(raw);

  let obj: any = null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw;
  } else if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object" && !Array.isArray(p)) obj = p;
    } catch {
      /* string simples — cai no fallback */
    }
  }

  if (obj) {
    const variantes: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && v.trim()) variantes[k] = v;
    }
    if (Object.keys(variantes).length > 0) {
      const preferida = LEGENDA_CHAVE_POR_FORMATO[formato] ?? "feed";
      const chaveInicial = variantes[preferida] ? preferida : Object.keys(variantes)[0];
      return { variantes, chaveInicial, textoSimples: original };
    }
  }

  return { variantes: null, chaveInicial: null, textoSimples: original };
}

// Email do kit vem como "ASSUNTO: ...\nCORPO: ...".
function parseEmailKit(raw: string): { assunto: string; corpo: string } {
  const assunto = raw.match(/ASSUNTO:\s*([^\n]*)/i)?.[1]?.trim() ?? "";
  const corpo = raw.match(/CORPO:\s*([\s\S]*)/i)?.[1]?.trim() ?? raw;
  return { assunto, corpo };
}

// Stories vem como telas separadas por "---".
function telasStories(raw: string): string[] {
  return raw
    .split(/\n?---\n?/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function LegendaComPreview({ post }: { post: any }) {
  const { variantes, chaveInicial, textoSimples } = useMemo(
    () => resolverLegenda(post.copy_legenda, post.formato),
    [post.copy_legenda, post.formato],
  );
  const [aba, setAba] = useState<string>(chaveInicial ?? "");

  // Canal ativo: a aba escolhida quando há variantes; senão deriva do formato.
  const canal = variantes
    ? aba || chaveInicial || "feed"
    : LEGENDA_CHAVE_POR_FORMATO[post.formato] ?? "feed";

  const legendaTexto = variantes
    ? variantes[canal] ?? (chaveInicial ? variantes[chaveInicial] : "") ?? ""
    : textoSimples;

  // Abas na ordem preferida, mais quaisquer chaves extras não previstas.
  const chaves = variantes
    ? [
        ...ORDEM_CANAIS.filter((k) => variantes[k]),
        ...Object.keys(variantes).filter((k) => !ORDEM_CANAIS.includes(k)),
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Prévia visual — imita a interface real do canal ativo (fonte do sistema). */}
      <div>
        <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
          PRÉVIA — {(LEGENDA_LABELS[canal] ?? canal).toUpperCase()}
        </div>
        <PreviewCanal canal={canal} texto={legendaTexto} imagem={post.imagem_signed_url} />
      </div>

      {/* Texto no padrão do canal + seletor de variantes */}
      <div>
        <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
          LEGENDA
        </div>
        {chaves.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {chaves.map((k) => (
              <button
                key={k}
                onClick={() => setAba(k)}
                className={`px-2.5 py-1 text-[11px] rounded-[4px] border transition-colors ${
                  canal === k
                    ? "bg-[color:var(--graphite)] text-white border-[color:var(--graphite)]"
                    : "bg-white text-[color:var(--graphite)] border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                }`}
              >
                {LEGENDA_LABELS[k] ?? k}
              </button>
            ))}
          </div>
        )}
        <ConteudoCanal canal={canal} texto={legendaTexto} />
      </div>
    </div>
  );
}

// Mockup visual por canal.
function PreviewCanal({ canal, texto, imagem }: { canal: string; texto: string; imagem?: string }) {
  if (canal === "linkedin") return <PreviewLinkedIn texto={texto} imagem={imagem} />;
  if (canal === "email") return <PreviewEmail texto={texto} />;
  return <PreviewInstagram canal={canal} texto={texto} imagem={imagem} />;
}

function PreviewInstagram({ canal, texto, imagem }: { canal: string; texto: string; imagem?: string }) {
  // Stories: quadro cheio 9:16 com barras de progresso e a Tela 1 sobreposta.
  if (canal === "stories") {
    const telas = telasStories(texto);
    const primeira = telas[0] ?? texto;
    return (
      <div
        className="relative max-w-[300px] aspect-[9/16] rounded-lg overflow-hidden border border-[color:var(--divisoria)]"
        style={{ fontFamily: FONTE_SISTEMA, backgroundColor: imagem ? "#000" : "#b9b4ac" }}
      >
        {imagem && <img src={imagem} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.45))" }}
        />
        <div className="absolute top-2 left-2 right-2 flex gap-1">
          {(telas.length ? telas : [primeira]).map((_, i) => (
            <div
              key={i}
              className="h-0.5 flex-1 rounded-full"
              style={{ backgroundColor: i === 0 ? "#fff" : "rgba(255,255,255,0.4)" }}
            />
          ))}
        </div>
        <div className="absolute top-5 left-2 right-2 flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
            style={{ backgroundColor: "#8B7355", border: "2px solid #fff" }}
          >
            NL
          </div>
          <span className="text-[12px] font-semibold text-white">nlarquitetos</span>
        </div>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-5 text-center">
          <span
            className="text-white text-[15px] font-semibold leading-snug whitespace-pre-wrap"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
          >
            {primeira}
          </span>
        </div>
      </div>
    );
  }

  // Feed (1:1) e Reels (9:16) — chrome padrão do Instagram.
  const vertical = canal === "reels";
  return (
    <div
      className="max-w-[360px] rounded-lg border border-[color:var(--divisoria)] overflow-hidden bg-white"
      style={{ fontFamily: FONTE_SISTEMA }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
          style={{ backgroundColor: "#8B7355" }}
        >
          NL
        </div>
        <span className="text-[13px] font-semibold" style={{ color: "#262626" }}>
          nlarquitetos
        </span>
        {canal === "reels" && (
          <span className="ml-auto text-[11px]" style={{ color: "#8e8e8e" }}>
            Reels
          </span>
        )}
      </div>

      <div className={vertical ? "aspect-[9/16]" : "aspect-square"} style={{ backgroundColor: "#efefef" }}>
        {imagem ? <img src={imagem} alt="" className="w-full h-full object-cover" /> : null}
      </div>

      <div className="flex items-center px-3 pt-2.5">
        <div className="flex items-center gap-4">
          <Heart className="h-6 w-6" strokeWidth={1.8} style={{ color: "#262626" }} />
          <MessageCircle className="h-6 w-6" strokeWidth={1.8} style={{ color: "#262626" }} />
          <Send className="h-6 w-6" strokeWidth={1.8} style={{ color: "#262626" }} />
        </div>
        <Bookmark className="h-6 w-6 ml-auto" strokeWidth={1.8} style={{ color: "#262626" }} />
      </div>

      <div className="px-3 py-2.5 text-[13px] leading-snug line-clamp-2" style={{ color: "#262626" }}>
        <span className="font-semibold mr-1.5">nlarquitetos</span>
        <span className="whitespace-pre-wrap">{texto}</span>
      </div>
    </div>
  );
}

function PreviewLinkedIn({ texto, imagem }: { texto: string; imagem?: string }) {
  return (
    <div
      className="max-w-[400px] rounded-lg border border-[color:var(--divisoria)] overflow-hidden bg-white"
      style={{ fontFamily: FONTE_SISTEMA }}
    >
      <div className="flex items-start gap-2.5 px-3 py-3">
        <div
          className="h-11 w-11 rounded-full flex items-center justify-center text-white text-[13px] font-semibold shrink-0"
          style={{ backgroundColor: "#8B7355" }}
        >
          NL
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold" style={{ color: "rgba(0,0,0,0.9)" }}>
            NL Arquitetos
          </div>
          <div className="text-[12px]" style={{ color: "rgba(0,0,0,0.6)" }}>
            Arquitetura e Interiores · São José dos Campos
          </div>
          <div className="text-[12px]" style={{ color: "rgba(0,0,0,0.6)" }}>
            Agora · Público
          </div>
        </div>
      </div>

      <div
        className="px-3 pb-3 text-[14px] whitespace-pre-wrap leading-relaxed"
        style={{ color: "rgba(0,0,0,0.9)" }}
      >
        {texto}
      </div>

      {imagem && (
        <div className="aspect-[1.91/1]" style={{ backgroundColor: "#efefef" }}>
          <img src={imagem} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div
        className="flex items-center justify-around px-2 py-1 border-t"
        style={{ borderColor: "rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.6)" }}
      >
        {[
          { icon: <ThumbsUp className="h-4 w-4" />, label: "Gostei" },
          { icon: <MessageCircle className="h-4 w-4" />, label: "Comentar" },
          { icon: <Repeat2 className="h-4 w-4" />, label: "Compartilhar" },
          { icon: <Send className="h-4 w-4" />, label: "Enviar" },
        ].map((a) => (
          <span key={a.label} className="inline-flex items-center gap-1.5 text-[12px] py-1.5">
            {a.icon} {a.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function PreviewEmail({ texto }: { texto: string }) {
  const { assunto, corpo } = parseEmailKit(texto);
  return (
    <div
      className="max-w-[440px] rounded-lg border border-[color:var(--divisoria)] overflow-hidden bg-white"
      style={{ fontFamily: FONTE_SISTEMA }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="text-[15px] font-semibold" style={{ color: "#202124" }}>
          {assunto || "(sem assunto)"}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0"
            style={{ backgroundColor: "#8B7355" }}
          >
            NL
          </div>
          <div className="text-[12px] leading-tight" style={{ color: "#5f6368" }}>
            <span style={{ color: "#202124", fontWeight: 600 }}>NL Arquitetos</span>{" "}
            &lt;contato@nlarquitetos.com.br&gt;
            <br />
            para mim
          </div>
        </div>
      </div>
      <div className="px-4 py-3 text-[14px] whitespace-pre-wrap leading-relaxed" style={{ color: "#202124" }}>
        {corpo}
      </div>
    </div>
  );
}

// Texto completo no padrão de cada canal.
function ConteudoCanal({ canal, texto }: { canal: string; texto: string }) {
  if (canal === "stories") {
    const telas = telasStories(texto);
    return (
      <div className="space-y-2">
        {(telas.length ? telas : [texto]).map((tela, i) => (
          <div
            key={i}
            className="border border-[color:var(--divisoria)] rounded-[4px] bg-[color:var(--gelo)] px-3 py-2"
          >
            <div className="font-mono text-[9px] tracking-widest text-[color:var(--bronze)] mb-1">
              TELA {i + 1}
            </div>
            <div className="whitespace-pre-wrap text-[color:var(--graphite)]">{tela}</div>
          </div>
        ))}
      </div>
    );
  }

  if (canal === "reels") {
    return (
      <div>
        <p className="whitespace-pre-wrap text-[color:var(--graphite)] leading-relaxed">
          <span className="bg-[color:var(--bege)]">{texto.slice(0, 125)}</span>
          {texto.slice(125)}
        </p>
        <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
          As primeiras 125 caracteres (destacadas) aparecem antes do "ver mais".
        </p>
      </div>
    );
  }

  if (canal === "email") {
    const { assunto, corpo } = parseEmailKit(texto);
    return (
      <div className="space-y-3">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-[color:var(--bronze)] mb-1">ASSUNTO</div>
          <div className="text-[color:var(--graphite)]">{assunto || "—"}</div>
        </div>
        <div>
          <div className="font-mono text-[9px] tracking-widest text-[color:var(--bronze)] mb-1">CORPO</div>
          <p className="whitespace-pre-wrap text-[color:var(--graphite)] leading-relaxed">{corpo}</p>
        </div>
      </div>
    );
  }

  // feed / linkedin / fallback
  return <p className="whitespace-pre-wrap text-[color:var(--graphite)] leading-relaxed">{texto}</p>;
}