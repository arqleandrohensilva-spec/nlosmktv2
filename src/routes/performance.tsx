import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { PageHeader } from "@/components/page-header";
import { FORMATOS, LINHAS, LINHA_BADGE } from "@/lib/nl-brand";
import { useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/performance")({
  component: Performance,
});

function Performance() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["performance-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkt_posts")
        .select("id, linha, formato, dor_id, data_publicacao, created_at, dores(titulo), performance(views, curtidas, comentarios, salvamentos, compartilhamentos)")
        .eq("status", "publicado")
        .order("data_publicacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rankingFormatos = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    (rows ?? []).forEach((p: any) => {
      const perf = p.performance?.[0];
      if (!perf) return;
      const eng = (perf.curtidas ?? 0) + (perf.comentarios ?? 0) + (perf.salvamentos ?? 0);
      map[p.formato] ??= { total: 0, count: 0 };
      map[p.formato].total += eng;
      map[p.formato].count += 1;
    });
    return FORMATOS.map((f) => ({
      formato: f.label,
      value: f.value,
      media: map[f.value] ? Math.round(map[f.value].total / map[f.value].count) : 0,
    })).sort((a, b) => b.media - a.media);
  }, [rows]);

  const rankingLinhas = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    (rows ?? []).forEach((p: any) => {
      const perf = p.performance?.[0];
      if (!perf) return;
      const eng = (perf.curtidas ?? 0) + (perf.comentarios ?? 0) + (perf.salvamentos ?? 0);
      map[p.linha] ??= { total: 0, count: 0 };
      map[p.linha].total += eng;
      map[p.linha].count += 1;
    });
    return LINHAS.map((l) => ({
      linha: l.value,
      label: l.label.split(" — ")[1],
      media: map[l.value] ? Math.round(map[l.value].total / map[l.value].count) : 0,
    })).sort((a, b) => b.media - a.media);
  }, [rows]);

  const rankingDores = useMemo(() => {
    const map: Record<string, { total: number; count: number; titulo: string }> = {};
    (rows ?? []).forEach((p: any) => {
      const perf = p.performance?.[0];
      if (!perf || !p.dor_id || !p.dores?.titulo) return;
      const eng = (perf.curtidas ?? 0) + (perf.comentarios ?? 0) + (perf.salvamentos ?? 0);
      map[p.dor_id] ??= { total: 0, count: 0, titulo: p.dores.titulo };
      map[p.dor_id].total += eng;
      map[p.dor_id].count += 1;
    });
    return Object.entries(map)
      .map(([id, v]) => ({ id, titulo: v.titulo, media: Math.round(v.total / v.count) }))
      .sort((a, b) => b.media - a.media);
  }, [rows]);

  const alertaCampeao = useMemo(() => {
    const reels = (rows ?? []).find((p: any) => p.formato === "reels");
    if (!reels) return "Nenhum Reels com fundador publicado ainda. Formato campeão inexplorado.";
    const dias = Math.floor(
      (Date.now() - new Date(reels.data_publicacao ?? reels.created_at).getTime()) / (1000 * 60 * 60 * 24),
    );
    return dias > 7 ? `Formato campeão (Reels) parado há ${dias} dias.` : null;
  }, [rows]);

  const grafico = useMemo(() => {
    const byWeek: Record<string, number> = {};
    (rows ?? []).forEach((p: any) => {
      const perf = p.performance?.[0];
      if (!perf || !p.data_publicacao) return;
      const d = new Date(p.data_publicacao);
      const wk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-S${Math.ceil(d.getDate() / 7)}`;
      byWeek[wk] = (byWeek[wk] ?? 0) + (perf.views ?? 0);
    });
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semana, views]) => ({ semana, views }));
  }, [rows]);

  return (
    <>
      <PageHeader
        eyebrow="Inteligência de performance"
        title="O que funcionou de fato"
        description="Dados inseridos manualmente. A verdade importa mais que a métrica de vaidade."
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white hover:bg-[color:var(--bronze)]"
          >
            Registrar performance
          </button>
        }
      />

      <div className="px-4 md:px-10 py-8 space-y-8">
        {alertaCampeao && (
          <div className="border border-[color:var(--bronze)] bg-[color:var(--bege)] rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-[color:var(--bronze)]" />
            <div className="text-sm">{alertaCampeao}</div>
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RankingCard title="Formatos por engajamento médio">
            {rankingFormatos.map((r, i) => (
              <RankRow key={r.value} rank={i + 1} label={r.formato} value={r.media} />
            ))}
          </RankingCard>
          <RankingCard title="Linhas por engajamento médio">
            {rankingLinhas.map((r, i) => (
              <RankRow key={r.linha} rank={i + 1} label={`Linha ${r.linha} — ${r.label}`} value={r.media} />
            ))}
          </RankingCard>
        </section>

        <section>
          <RankingCard title="Dores por engajamento médio">
            {rankingDores.length === 0 ? (
              <div className="text-sm text-[color:var(--muted-foreground)]">
                Registre performance de posts publicados para ver quais dores geram mais engajamento.
              </div>
            ) : (
              rankingDores.map((r, i) => (
                <RankRow key={r.id} rank={i + 1} label={r.titulo} value={r.media} />
              ))
            )}
          </RankingCard>
        </section>

        <section className="border border-[color:var(--divisoria)] rounded-lg bg-white p-5">
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-4">
            EVOLUÇÃO DE VIEWS POR SEMANA
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={grafico}>
                <CartesianGrid stroke="#D1D1D1" strokeDasharray="2 4" />
                <XAxis dataKey="semana" stroke="#3A3A3A" fontSize={11} />
                <YAxis stroke="#3A3A3A" fontSize={11} />
                <Tooltip contentStyle={{ fontFamily: "Inter", fontSize: 12 }} />
                <Line type="monotone" dataKey="views" stroke="#8B7355" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-3">
            POSTS PUBLICADOS
          </div>
          <div className="overflow-x-auto border border-[color:var(--divisoria)] rounded-lg">
            <table className="w-full text-sm bg-white">
              <thead className="bg-[color:var(--gelo)]">
                <tr>
                  <Th>Data</Th><Th>Linha</Th><Th>Dor</Th><Th>Formato</Th><Th>Views</Th><Th>Engajamento</Th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((p: any) => {
                  const perf = p.performance?.[0];
                  const eng = perf ? (perf.curtidas ?? 0) + (perf.comentarios ?? 0) + (perf.salvamentos ?? 0) : 0;
                  const dorTitulo = p.dores?.titulo
                    ? p.dores.titulo.length > 20
                      ? `${p.dores.titulo.slice(0, 20)}…`
                      : p.dores.titulo
                    : "—";
                  return (
                    <tr key={p.id} className="border-t border-[color:var(--divisoria)]">
                      <Td className="font-mono text-xs">{p.data_publicacao ?? "—"}</Td>
                      <Td>
                        <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-mono ${LINHA_BADGE[p.linha]}`}>
                          {p.linha}
                        </span>
                      </Td>
                      <Td className="text-xs" >{dorTitulo}</Td>
                      <Td>{FORMATOS.find((f) => f.value === p.formato)?.label}</Td>
                      <Td className="font-mono">{perf?.views ?? "—"}</Td>
                      <Td className="font-mono">{perf ? eng : "—"}</Td>
                    </tr>
                  );
                })}
                {rows?.length === 0 && (
                  <tr><Td colSpan={6} className="text-center py-8 text-[color:var(--muted-foreground)]">Nenhum post publicado ainda.</Td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalOpen && (
        <RegistrarModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            qc.invalidateQueries({ queryKey: ["performance-list"] });
          }}
        />
      )}
    </>
  );
}

function RankingCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-5">
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-4">
        {title.toUpperCase()}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RankRow({ rank, label, value }: { rank: number; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--divisoria)] pb-2 last:border-0">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] w-4">
          {String(rank).padStart(2, "0")}
        </span>
        <span className="text-[color:var(--graphite)]">{label}</span>
      </div>
      <span className="font-mono text-sm text-[color:var(--graphite)]">{value}</span>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2 font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
      {children?.toString().toUpperCase()}
    </th>
  );
}
function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td className={`px-4 py-2 text-[color:var(--graphite)] ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}

function RegistrarModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [postId, setPostId] = useState("");
  const [views, setViews] = useState("");
  const [curtidas, setCurtidas] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [salvamentos, setSalvamentos] = useState("");
  const [compartilhamentos, setCompartilhamentos] = useState("");

  const { data: posts } = useQuery({
    queryKey: ["posts-for-perf"],
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_posts")
        .select("id, linha, formato, copy_legenda, status")
        .in("status", ["pronto", "publicado"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!postId) throw new Error("Selecione um post");
      const { error: e1 } = await supabase.from("mkt_performance").insert({
        post_id: postId,
        views: Number(views) || 0,
        curtidas: Number(curtidas) || 0,
        comentarios: Number(comentarios) || 0,
        salvamentos: Number(salvamentos) || 0,
        compartilhamentos: Number(compartilhamentos) || 0,
      });
      if (e1) throw e1;
      await supabase
        .from("mkt_posts")
        .update({ status: "publicado", data_publicacao: new Date().toISOString().slice(0, 10) })
        .eq("id", postId);
    },
    onSuccess: () => {
      toast.success("Performance registrada.");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg bg-white rounded-lg border border-[color:var(--divisoria)]">
        <div className="px-5 py-4 border-b border-[color:var(--divisoria)] flex items-center justify-between">
          <h2 className="font-serif text-lg">Registrar performance</h2>
          <button onClick={onClose} className="text-[color:var(--muted-foreground)]" aria-label="Fechar">✕</button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">POST</div>
            <select
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm"
            >
              <option value="">Selecione…</option>
              {(posts ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  Linha {p.linha} · {p.formato} · {p.copy_legenda?.slice(0, 40) ?? "post"}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Views" value={views} onChange={setViews} />
            <NumberInput label="Curtidas" value={curtidas} onChange={setCurtidas} />
            <NumberInput label="Comentários" value={comentarios} onChange={setComentarios} />
            <NumberInput label="Salvamentos" value={salvamentos} onChange={setSalvamentos} />
            <NumberInput label="Compartilhamentos" value={compartilhamentos} onChange={setCompartilhamentos} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[color:var(--divisoria)] flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[4px] border border-[color:var(--divisoria)] px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-[4px] bg-[color:var(--graphite)] text-white px-4 py-2 text-sm hover:bg-[color:var(--bronze)]"
          >
            {save.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">{label.toUpperCase()}</div>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm"
      />
    </label>
  );
}