import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { LINHAS, FORMATOS, STATUS, LINHA_BADGE } from "@/lib/nl-brand";
import { useState, useMemo } from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
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
      return data ?? [];
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(posts ?? []).map((p: any) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="text-left border border-[color:var(--divisoria)] rounded-lg bg-white p-4 hover:border-[color:var(--bronze)] transition-colors"
              >
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