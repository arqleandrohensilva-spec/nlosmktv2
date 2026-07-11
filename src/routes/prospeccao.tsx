import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabaseExternal";
import { PageHeader } from "@/components/page-header";
import { reescreverMensagemProspeccao } from "@/lib/prospeccao.functions";
import {
  X,
  Plus,
  AlertTriangle,
  Loader2,
  Copy as CopyIcon,
  Sparkles,
  Archive,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prospeccao")({
  component: ProspeccaoPage,
});

type Prospeccao = {
  id: string;
  created_at: string;
  updated_at: string;
  origem: string;
  lancamento_id: string | null;
  nome_contato: string | null;
  cargo: string | null;
  empresa: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  canal_abordagem: string | null;
  data_primeiro_contato: string | null;
  mensagem_enviada: string | null;
  status: string;
  data_followup: string | null;
  notas: string | null;
  linha_interesse: string | null;
  potencial: string | null;
};

type Historico = {
  id: string;
  created_at: string;
  prospeccao_id: string;
  tipo: string;
  descricao: string;
  data_evento: string | null;
};

type Lancamento = { id: string; nome: string; cidade: string; tipo: string };

const STATUS_COLS = [
  { key: "para_contatar", label: "Para contatar" },
  { key: "contatado", label: "Contatado" },
  { key: "respondeu", label: "Respondeu" },
  { key: "reuniao_agendada", label: "Reunião agendada" },
  { key: "parceria_ativa", label: "Parceria ativa" },
  { key: "sem_interesse", label: "Sem interesse" },
] as const;

const ORIGENS = [
  { key: "radar_mercado", label: "RADAR" },
  { key: "concorrente", label: "CONCORRENTE" },
  { key: "indicacao", label: "INDICAÇÃO" },
  { key: "manual", label: "MANUAL" },
];
const CANAIS = ["whatsapp", "email", "instagram", "presencial", "outro"];
const LINHAS = ["A", "B", "AB", "C"];
const POTENCIAIS = ["alto", "medio", "baixo"];
const CARGOS = ["corretor", "construtora", "incorporadora", "outro"];

const db = supabase as unknown as {
  from: (t: string) => any;
};

function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function followupVencido(p: Prospeccao) {
  if (!p.data_followup) return false;
  if (["parceria_ativa", "sem_interesse", "arquivado"].includes(p.status)) return false;
  return p.data_followup < hoje();
}

function ProspeccaoPage() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState<Prospeccao | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);

  const { data: prospeccoes } = useQuery({
    queryKey: ["prospeccoes"],
    queryFn: async () => {
      const { data, error } = await db
        .from("mkt_prospeccoes")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Prospeccao[];
    },
  });

  const { data: lancamentos } = useQuery({
    queryKey: ["lancamentos-prospeccao"],
    queryFn: async () => {
      const { data } = await db
        .from("mkt_lancamentos")
        .select("id, nome, cidade, tipo")
        .order("created_at", { ascending: false });
      return (data ?? []) as Lancamento[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await db.from("mkt_prospeccoes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospeccoes"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar."),
  });

  const lista = prospeccoes ?? [];
  const stats = useMemo(() => {
    const total = lista.length;
    const paraContatar = lista.filter((p) => p.status === "para_contatar").length;
    const aguardando = lista.filter((p) => p.status === "contatado").length;
    const reunioes = lista.filter((p) => p.status === "reuniao_agendada").length;
    const parcerias = lista.filter((p) => p.status === "parceria_ativa").length;
    const vencidos = lista.filter(followupVencido).length;
    return { total, paraContatar, aguardando, reunioes, parcerias, vencidos };
  }, [lista]);

  const byStatus = useMemo(() => {
    const map: Record<string, Prospeccao[]> = {};
    for (const col of STATUS_COLS) map[col.key] = [];
    for (const p of lista) {
      if (map[p.status]) map[p.status].push(p);
    }
    return map;
  }, [lista]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="CRM de Prospecção"
        title="Pipeline de contatos"
        description="Cada construtora contatada, cada corretor abordado. Registro completo do que foi enviado e o que respondeu."
        actions={
          <button
            onClick={() => setNovaOpen(true)}
            className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] text-white px-4 py-2 text-sm hover:bg-black"
          >
            <Plus className="h-4 w-4" />
            Nova prospecção
          </button>
        }
      />
      <div className="px-4 md:px-10 py-8 space-y-8">
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metrica label="Total" valor={stats.total} />
          <Metrica label="Para contatar" valor={stats.paraContatar} />
          <Metrica label="Aguardando resposta" valor={stats.aguardando} />
          <Metrica label="Reuniões agendadas" valor={stats.reunioes} />
          <Metrica label="Parcerias ativas" valor={stats.parcerias} />
        </section>

        {stats.vencidos > 0 && (
          <div className="border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm rounded-[4px] flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {stats.vencidos} prospecção(ões) com follow-up vencido.
          </div>
        )}

        <section className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {STATUS_COLS.map((col) => {
              const items = byStatus[col.key] ?? [];
              return (
                <div
                  key={col.key}
                  className={`w-72 flex-shrink-0 border rounded-[4px] transition-colors ${
                    hoverCol === col.key
                      ? "border-[color:var(--bronze)] bg-[color:var(--bege)]"
                      : "border-[color:var(--divisoria)] bg-[#FAFAF9]"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setHoverCol(col.key);
                  }}
                  onDragLeave={() => setHoverCol((c) => (c === col.key ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setHoverCol(null);
                    if (dragId) {
                      updateStatus.mutate({ id: dragId, status: col.key });
                      setDragId(null);
                    }
                  }}
                >
                  <div className="px-3 py-2 border-b border-[color:var(--divisoria)] flex items-center justify-between">
                    <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                      {col.label.toUpperCase()}
                    </div>
                    <div className="text-[10px] font-mono text-[color:var(--muted-foreground)]">
                      {items.length}
                    </div>
                  </div>
                  <div className="p-2 space-y-2 min-h-[120px]">
                    {items.map((p) => (
                      <KanbanCard
                        key={p.id}
                        p={p}
                        onOpen={() => setAberto(p)}
                        onDragStart={() => setDragId(p.id)}
                        onDragEnd={() => setDragId(null)}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="text-[11px] text-[color:var(--muted-foreground)] px-2 py-4 text-center">
                        Vazio
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {aberto && (
        <ProspeccaoDrawer
          prospeccao={aberto}
          lancamentos={lancamentos ?? []}
          onClose={() => setAberto(null)}
          onChanged={async () => {
            await qc.invalidateQueries({ queryKey: ["prospeccoes"] });
            const { data } = await db.from("mkt_prospeccoes").select("*").eq("id", aberto.id).maybeSingle();
            if (data) setAberto(data as Prospeccao);
          }}
        />
      )}

      {novaOpen && (
        <NovaProspeccaoModal
          lancamentos={lancamentos ?? []}
          onClose={() => setNovaOpen(false)}
          onCreated={async (id) => {
            setNovaOpen(false);
            await qc.invalidateQueries({ queryKey: ["prospeccoes"] });
            const { data } = await db.from("mkt_prospeccoes").select("*").eq("id", id).maybeSingle();
            if (data) setAberto(data as Prospeccao);
          }}
        />
      )}
    </>
  );
}

function Metrica({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="border border-[color:var(--divisoria)] bg-white p-4">
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
        {label.toUpperCase()}
      </div>
      <div className="font-serif text-3xl text-[color:var(--graphite)] mt-2">{valor}</div>
    </div>
  );
}

function potencialColor(p: string | null) {
  if (p === "alto") return "border-emerald-500 text-emerald-700";
  if (p === "medio") return "border-amber-500 text-amber-700";
  if (p === "baixo") return "border-[color:var(--divisoria)] text-[color:var(--muted-foreground)]";
  return "border-[color:var(--divisoria)] text-[color:var(--muted-foreground)]";
}

function KanbanCard({
  p,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  p: Prospeccao;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const vencido = followupVencido(p);
  const origemLabel = ORIGENS.find((o) => o.key === p.origem)?.label ?? p.origem.toUpperCase();
  const ultimoContato = p.data_primeiro_contato ?? p.created_at.slice(0, 10);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="bg-white border border-[color:var(--divisoria)] rounded-[4px] p-3 cursor-pointer hover:border-[color:var(--bronze)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-serif text-sm text-[color:var(--graphite)] truncate">
            {p.nome_contato ?? "Sem nome"}
          </div>
          {p.empresa && (
            <div className="text-[11px] text-[color:var(--muted-foreground)] truncate">
              {p.empresa}
            </div>
          )}
        </div>
        {vencido && (
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        <span className="font-mono text-[9px] tracking-widest border border-[color:var(--divisoria)] text-[color:var(--muted-foreground)] px-1.5 py-0.5">
          {origemLabel}
        </span>
        {p.linha_interesse && (
          <span className="font-mono text-[9px] tracking-widest border border-[color:var(--bronze)]/40 text-[color:var(--bronze)] px-1.5 py-0.5">
            LINHA {p.linha_interesse}
          </span>
        )}
        {p.potencial && (
          <span className={`font-mono text-[9px] tracking-widest border px-1.5 py-0.5 ${potencialColor(p.potencial)}`}>
            {p.potencial.toUpperCase()}
          </span>
        )}
      </div>
      <div className="text-[10px] text-[color:var(--muted-foreground)] mt-2">
        Últ. contato: {new Date(ultimoContato).toLocaleDateString("pt-BR")}
      </div>
    </div>
  );
}

function ProspeccaoDrawer({
  prospeccao,
  lancamentos,
  onClose,
  onChanged,
}: {
  prospeccao: Prospeccao;
  lancamentos: Lancamento[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [p, setP] = useState<Prospeccao>(prospeccao);
  const [notas, setNotas] = useState(prospeccao.notas ?? "");
  const [historicoModal, setHistoricoModal] = useState(false);
  const reescrever = useServerFn(reescreverMensagemProspeccao);
  const [reescrevendo, setReescrevendo] = useState(false);
  const qc = useQueryClient();

  const { data: historico } = useQuery({
    queryKey: ["historico", p.id],
    queryFn: async () => {
      const { data } = await db
        .from("mkt_prospeccao_historico")
        .select("*")
        .eq("prospeccao_id", p.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Historico[];
    },
  });

  const lanc = lancamentos.find((l) => l.id === p.lancamento_id);

  async function patch(fields: Partial<Prospeccao>) {
    const { error } = await db.from("mkt_prospeccoes").update(fields).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setP({ ...p, ...fields });
    await onChanged();
  }

  async function addHistorico(tipo: string, descricao: string, data_evento?: string | null) {
    const { error } = await db
      .from("mkt_prospeccao_historico")
      .insert({ prospeccao_id: p.id, tipo, descricao, data_evento: data_evento ?? hoje() });
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["historico", p.id] });
  }

  const vencido = followupVencido(p);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white overflow-y-auto border-l border-[color:var(--divisoria)]">
        <div className="px-6 py-5 border-b border-[color:var(--divisoria)] flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
              PROSPECÇÃO
            </div>
            <h3 className="font-serif text-2xl text-[color:var(--graphite)] mt-1">
              {p.nome_contato ?? "Sem nome"}
            </h3>
            {p.empresa && (
              <div className="text-sm text-[color:var(--muted-foreground)]">{p.empresa}</div>
            )}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Seção 1 — Contato */}
          <Section title="Dados do contato">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome" value={p.nome_contato ?? ""} onSave={(v) => patch({ nome_contato: v })} />
              <FieldSelect
                label="Cargo"
                value={p.cargo ?? ""}
                options={CARGOS}
                onSave={(v) => patch({ cargo: v || null })}
              />
              <Field label="Empresa" value={p.empresa ?? ""} onSave={(v) => patch({ empresa: v })} />
              <Field label="WhatsApp" value={p.whatsapp ?? ""} onSave={(v) => patch({ whatsapp: v })} />
              <Field label="E-mail" value={p.email ?? ""} onSave={(v) => patch({ email: v })} />
              <Field label="Instagram" value={p.instagram ?? ""} onSave={(v) => patch({ instagram: v })} />
              <FieldSelect
                label="Linha de interesse"
                value={p.linha_interesse ?? ""}
                options={LINHAS}
                onSave={(v) => patch({ linha_interesse: v || null })}
              />
              <FieldSelect
                label="Potencial"
                value={p.potencial ?? ""}
                options={POTENCIAIS}
                onSave={(v) => patch({ potencial: v || null })}
              />
            </div>
            {lanc && (
              <div className="mt-3 border border-[color:var(--divisoria)] bg-[color:var(--bege)] px-3 py-2 text-sm flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">EMPREENDIMENTO</span>
                  <div className="text-[color:var(--graphite)]">{lanc.nome} · {lanc.cidade}</div>
                </div>
                <Link
                  to="/radar-mercado"
                  className="text-[color:var(--bronze)] text-xs inline-flex items-center gap-1 hover:underline"
                >
                  Abrir <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </Section>

          {/* Seção 2 — Status */}
          <Section title="Status e datas">
            <div className="grid grid-cols-2 gap-3">
              <FieldSelect
                label="Status"
                value={p.status}
                options={STATUS_COLS.map((s) => s.key)}
                labelMap={Object.fromEntries(STATUS_COLS.map((s) => [s.key, s.label]))}
                onSave={(v) => patch({ status: v })}
                allowEmpty={false}
              />
              <FieldSelect
                label="Canal de abordagem"
                value={p.canal_abordagem ?? ""}
                options={CANAIS}
                onSave={(v) => patch({ canal_abordagem: v || null })}
              />
              <FieldDate
                label="Primeiro contato"
                value={p.data_primeiro_contato ?? ""}
                onSave={(v) => patch({ data_primeiro_contato: v || null })}
              />
              <FieldDate
                label="Próximo follow-up"
                value={p.data_followup ?? ""}
                warning={vencido}
                onSave={(v) => patch({ data_followup: v || null })}
              />
            </div>
            {vencido && (
              <div className="mt-2 text-xs text-red-700 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Follow-up vencido.
              </div>
            )}
          </Section>

          {/* Seção 3 — Mensagem */}
          <Section title="Mensagem enviada">
            <textarea
              value={p.mensagem_enviada ?? ""}
              onChange={(e) => setP({ ...p, mensagem_enviada: e.target.value })}
              onBlur={() => {
                if ((p.mensagem_enviada ?? "") !== (prospeccao.mensagem_enviada ?? "")) {
                  patch({ mensagem_enviada: p.mensagem_enviada });
                }
              }}
              rows={6}
              className="w-full border border-[color:var(--divisoria)] rounded-[4px] px-3 py-2 text-sm"
              placeholder="Cole ou escreva a mensagem que foi enviada…"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(p.mensagem_enviada ?? "");
                  toast.success("Mensagem copiada.");
                }}
                className="inline-flex items-center gap-1 border border-[color:var(--divisoria)] px-3 py-1.5 text-xs hover:border-[color:var(--bronze)] rounded-[4px]"
              >
                <CopyIcon className="h-3.5 w-3.5" /> Copiar
              </button>
              <button
                disabled={reescrevendo || !(p.mensagem_enviada ?? "").trim()}
                onClick={async () => {
                  setReescrevendo(true);
                  try {
                    const r = await reescrever({
                      data: {
                        mensagem: p.mensagem_enviada ?? "",
                        linha: p.linha_interesse ?? undefined,
                        contexto: lanc ? `${lanc.nome} — ${lanc.cidade}` : undefined,
                      },
                    });
                    await patch({ mensagem_enviada: r.mensagem });
                    setP((prev) => ({ ...prev, mensagem_enviada: r.mensagem }));
                    toast.success("Nova versão gerada.");
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "Falha ao reescrever.");
                  } finally {
                    setReescrevendo(false);
                  }
                }}
                className="inline-flex items-center gap-1 border border-[color:var(--divisoria)] px-3 py-1.5 text-xs hover:border-[color:var(--bronze)] rounded-[4px] disabled:opacity-50"
              >
                {reescrevendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Gerar nova versão
              </button>
            </div>
          </Section>

          {/* Seção 4 — Histórico */}
          <Section title="Histórico de interações">
            <button
              onClick={() => setHistoricoModal(true)}
              className="inline-flex items-center gap-1 border border-[color:var(--divisoria)] px-3 py-1.5 text-xs hover:border-[color:var(--bronze)] rounded-[4px] mb-3"
            >
              <Plus className="h-3.5 w-3.5" /> Registrar interação
            </button>
            {historico && historico.length > 0 ? (
              <div className="space-y-2">
                {historico.map((h) => (
                  <div key={h.id} className="border-l-2 border-[color:var(--bronze)] pl-3 py-1">
                    <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                      {(h.tipo || "").toUpperCase().replace(/_/g, " ")} · {h.data_evento ? new Date(h.data_evento).toLocaleDateString("pt-BR") : new Date(h.created_at).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="text-sm text-[color:var(--graphite)] whitespace-pre-wrap">{h.descricao}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[color:var(--muted-foreground)]">Nenhuma interação registrada.</div>
            )}
          </Section>

          {/* Seção 5 — Notas */}
          <Section title="Notas">
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              onBlur={() => {
                if (notas !== (p.notas ?? "")) patch({ notas });
              }}
              rows={4}
              className="w-full border border-[color:var(--divisoria)] rounded-[4px] px-3 py-2 text-sm"
              placeholder="Observações internas…"
            />
          </Section>

          {/* Ações rápidas */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[color:var(--divisoria)]">
            <QuickBtn
              onClick={async () => {
                await patch({ status: "contatado", data_primeiro_contato: p.data_primeiro_contato ?? hoje() });
                await addHistorico("contato_enviado", "Contato registrado como enviado.");
              }}
            >
              Marcar como contatado
            </QuickBtn>
            <QuickBtn
              onClick={async () => {
                await patch({ status: "respondeu" });
                await addHistorico("resposta_recebida", "Resposta recebida.");
              }}
            >
              Registrar resposta
            </QuickBtn>
            <QuickBtn
              onClick={() => {
                const d = prompt("Data do follow-up (AAAA-MM-DD):", hoje());
                if (d) patch({ data_followup: d });
              }}
            >
              Agendar follow-up
            </QuickBtn>
            <QuickBtn
              onClick={() => patch({ status: "arquivado" })}
              icon={<Archive className="h-3.5 w-3.5" />}
            >
              Arquivar
            </QuickBtn>
          </div>
        </div>
      </div>

      {historicoModal && (
        <InteracaoModal
          onClose={() => setHistoricoModal(false)}
          onSubmit={async (v) => {
            await addHistorico(v.tipo, v.descricao, v.data);
            setHistoricoModal(false);
          }}
        />
      )}
    </div>
  );
}

function QuickBtn({
  onClick,
  children,
  icon,
}: {
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 border border-[color:var(--divisoria)] px-3 py-1.5 text-xs hover:border-[color:var(--bronze)] rounded-[4px]"
    >
      {icon}
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-3">
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
        {label.toUpperCase()}
      </span>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== value) onSave(v);
        }}
        className="border border-[color:var(--divisoria)] rounded-[4px] px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onSave,
  labelMap,
  allowEmpty = true,
}: {
  label: string;
  value: string;
  options: string[];
  onSave: (v: string) => void;
  labelMap?: Record<string, string>;
  allowEmpty?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
        {label.toUpperCase()}
      </span>
      <select
        value={value}
        onChange={(e) => onSave(e.target.value)}
        className="border border-[color:var(--divisoria)] rounded-[4px] px-2 py-1.5 text-sm bg-white"
      >
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {labelMap?.[o] ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldDate({
  label,
  value,
  onSave,
  warning,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  warning?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
        {label.toUpperCase()}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onSave(e.target.value)}
        className={`border rounded-[4px] px-2 py-1.5 text-sm ${
          warning ? "border-red-500 text-red-700 bg-red-50" : "border-[color:var(--divisoria)]"
        }`}
      />
    </label>
  );
}

function InteracaoModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (v: { tipo: string; descricao: string; data: string }) => void;
}) {
  const [tipo, setTipo] = useState("contato_enviado");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(hoje());
  const TIPOS = [
    { k: "contato_enviado", l: "Contato enviado" },
    { k: "resposta_recebida", l: "Resposta recebida" },
    { k: "reuniao", l: "Reunião" },
    { k: "follow_up", l: "Follow-up" },
    { k: "nota", l: "Nota" },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-[color:var(--divisoria)] w-full max-w-md rounded-[4px]">
        <div className="px-5 py-4 border-b border-[color:var(--divisoria)] flex items-center justify-between">
          <div className="font-serif text-lg">Registrar interação</div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <FieldSelect
            label="Tipo"
            value={tipo}
            options={TIPOS.map((t) => t.k)}
            labelMap={Object.fromEntries(TIPOS.map((t) => [t.k, t.l]))}
            onSave={setTipo}
            allowEmpty={false}
          />
          <FieldDate label="Data" value={data} onSave={setData} />
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">DESCRIÇÃO</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              className="border border-[color:var(--divisoria)] rounded-[4px] px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="px-5 py-4 border-t border-[color:var(--divisoria)] flex justify-end gap-2">
          <button onClick={onClose} className="border border-[color:var(--divisoria)] px-4 py-2 text-sm rounded-[4px]">Cancelar</button>
          <button
            disabled={!descricao.trim()}
            onClick={() => onSubmit({ tipo, descricao: descricao.trim(), data })}
            className="bg-[color:var(--graphite)] text-white px-4 py-2 text-sm rounded-[4px] disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export function NovaProspeccaoModal({
  lancamentos,
  onClose,
  onCreated,
  preset,
}: {
  lancamentos: Lancamento[];
  onClose: () => void;
  onCreated: (id: string) => void;
  preset?: Partial<Prospeccao>;
}) {
  const [f, setF] = useState<Partial<Prospeccao>>({
    origem: "manual",
    status: "para_contatar",
    ...preset,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!f.nome_contato && !f.empresa) {
      toast.error("Informe pelo menos nome ou empresa.");
      return;
    }
    setSaving(true);
    const { data, error } = await db
      .from("mkt_prospeccoes")
      .insert(f)
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Prospecção criada.");
    onCreated(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-[color:var(--divisoria)] w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[4px]">
        <div className="px-5 py-4 border-b border-[color:var(--divisoria)] flex items-center justify-between">
          <div className="font-serif text-lg">Nova prospecção</div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <FieldSelect
            label="Origem"
            value={f.origem ?? "manual"}
            options={ORIGENS.map((o) => o.key)}
            labelMap={Object.fromEntries(ORIGENS.map((o) => [o.key, o.label]))}
            onSave={(v) => setF({ ...f, origem: v })}
            allowEmpty={false}
          />
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">EMPREENDIMENTO</span>
            <select
              value={f.lancamento_id ?? ""}
              onChange={(e) => setF({ ...f, lancamento_id: e.target.value || null })}
              className="border border-[color:var(--divisoria)] rounded-[4px] px-2 py-1.5 text-sm bg-white"
            >
              <option value="">—</option>
              {lancamentos.map((l) => (
                <option key={l.id} value={l.id}>{l.nome} · {l.cidade}</option>
              ))}
            </select>
          </label>
          <SimpleInput label="Nome do contato" value={f.nome_contato ?? ""} onChange={(v) => setF({ ...f, nome_contato: v })} />
          <SimpleInput label="Empresa" value={f.empresa ?? ""} onChange={(v) => setF({ ...f, empresa: v })} />
          <FieldSelect
            label="Cargo"
            value={f.cargo ?? ""}
            options={CARGOS}
            onSave={(v) => setF({ ...f, cargo: v || null })}
          />
          <FieldSelect
            label="Canal"
            value={f.canal_abordagem ?? ""}
            options={CANAIS}
            onSave={(v) => setF({ ...f, canal_abordagem: v || null })}
          />
          <SimpleInput label="WhatsApp" value={f.whatsapp ?? ""} onChange={(v) => setF({ ...f, whatsapp: v })} />
          <SimpleInput label="E-mail" value={f.email ?? ""} onChange={(v) => setF({ ...f, email: v })} />
          <FieldSelect
            label="Linha de interesse"
            value={f.linha_interesse ?? ""}
            options={LINHAS}
            onSave={(v) => setF({ ...f, linha_interesse: v || null })}
          />
          <FieldSelect
            label="Potencial"
            value={f.potencial ?? ""}
            options={POTENCIAIS}
            onSave={(v) => setF({ ...f, potencial: v || null })}
          />
          <div className="col-span-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">MENSAGEM DE ABORDAGEM</span>
              <textarea
                value={f.mensagem_enviada ?? ""}
                onChange={(e) => setF({ ...f, mensagem_enviada: e.target.value })}
                rows={4}
                className="border border-[color:var(--divisoria)] rounded-[4px] px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[color:var(--divisoria)] flex justify-end gap-2">
          <button onClick={onClose} className="border border-[color:var(--divisoria)] px-4 py-2 text-sm rounded-[4px]">Cancelar</button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-[color:var(--graphite)] text-white px-4 py-2 text-sm rounded-[4px] disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Criar prospecção"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SimpleInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
        {label.toUpperCase()}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-[color:var(--divisoria)] rounded-[4px] px-2 py-1.5 text-sm"
      />
    </label>
  );
}