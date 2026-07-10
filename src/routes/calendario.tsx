import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { LINHAS, FORMATOS, STATUS, LINHA_BADGE } from "@/lib/nl-brand";
import { useState, useMemo } from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
import { signBibliotecaUrls } from "@/components/biblioteca-picker";
import { toast } from "sonner";

export const Route = createFileRoute("/calendario")({
  component: Calendario,
});

function Calendario() {
  const [filterLinha, setFilterLinha] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [selected, setSelected] = useState<any | null>(null);
  const qc = useQueryClient();

  const { data: posts } = useQuery({
    queryKey: ["posts", filterLinha, filterStatus],
    queryFn: async () => {
      let q = supabase.from("posts").select("*, dores(titulo)").order("created_at", { ascending: false });
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
      const { error } = await supabase.from("posts").update(patch).eq("id", id);
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
          <Link
            to="/copy"
            className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors"
          >
            <Plus className="h-4 w-4" /> Novo post
          </Link>
        }
      />

      <div className="px-4 md:px-10 py-8">
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
              <Section label="Legenda"><p className="whitespace-pre-wrap">{selected.copy_legenda}</p></Section>
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