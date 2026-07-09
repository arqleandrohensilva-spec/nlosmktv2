import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import {
  atualizarLancamento,
  buscarLancamentos,
  gerarConteudosLancamento,
  adicionarManual,
} from "@/lib/radar-mercado.functions";
import {
  Loader2,
  ExternalLink,
  X,
  ArrowUpRight,
  Sparkles,
  Archive,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/radar-mercado")({
  component: RadarMercadoPage,
});

type Lancamento = {
  id: string;
  created_at: string;
  nome: string;
  tipo: string;
  cidade: string;
  construtora: string | null;
  bairro: string | null;
  faixa_preco: string | null;
  descricao: string | null;
  url_fonte: string | null;
  data_lancamento: string | null;
  status: string | null;
  oportunidade_linha: string | null;
  conteudos: {
    justificativa_linha?: string;
    por_que_agora?: string;
    post_feed?: string;
    gancho_conteudo?: string;
    script_abordagem?: string;
    cta_prospeccao?: string;
  } | null;
  notas: string | null;
};

type Busca = {
  id: string;
  created_at: string;
  resultados_encontrados: number | null;
  novos_lancamentos: number | null;
  resumo: string | null;
};

const TIPOS = ["loteamento", "condominio", "apartamento", "comercial"] as const;
const CIDADES = ["SJC", "Jacareí", "Caçapava"] as const;
const STATUS = ["novo", "conteudo_gerado", "prospectado", "arquivado"] as const;
const LINHAS = ["A", "B", "AB", "C"] as const;

const tipoLabel: Record<string, string> = {
  loteamento: "LOTEAMENTO",
  condominio: "CONDOMÍNIO",
  apartamento: "APARTAMENTO",
  comercial: "COMERCIAL",
};
const statusLabel: Record<string, string> = {
  novo: "Novo",
  conteudo_gerado: "Conteúdo gerado",
  prospectado: "Prospectado",
  arquivado: "Arquivado",
};

function statusColor(s: string | null) {
  if (s === "conteudo_gerado") return "text-[color:var(--bronze)] border-[color:var(--bronze)]/40";
  if (s === "prospectado") return "text-[color:var(--graphite)] border-[color:var(--graphite)]/40";
  if (s === "arquivado") return "text-[color:var(--muted-foreground)] border-[color:var(--divisoria)]";
  return "text-emerald-700 border-emerald-500/40";
}

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "há poucos minutos";
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

function RadarMercadoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const buscar = useServerFn(buscarLancamentos);
  const gerar = useServerFn(gerarConteudosLancamento);
  const atualizar = useServerFn(atualizarLancamento);
  const adicionar = useServerFn(adicionarManual);

  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroCidade, setFiltroCidade] = useState<string>("");
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [filtroLinha, setFiltroLinha] = useState<string>("");
  const [aberto, setAberto] = useState<Lancamento | null>(null);
  const [loadingStage, setLoadingStage] = useState<"idle" | "buscando" | "analisando">("idle");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualStage, setManualStage] = useState<"idle" | "pesquisando" | "consolidando" | "criando">("idle");

  const { data: lancamentos } = useQuery({
    queryKey: ["lancamentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as never as { from: (t: string) => { select: (s: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: Lancamento[] | null; error: Error | null }> } } })
        .from("lancamentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lancamento[];
    },
  });

  const { data: buscas } = useQuery({
    queryKey: ["radar_buscas"],
    queryFn: async () => {
      const { data, error } = await (supabase as never as { from: (t: string) => { select: (s: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Busca[] | null; error: Error | null }> } } } })
        .from("radar_buscas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as Busca[];
    },
  });

  const buscarMut = useMutation({
    mutationFn: async () => {
      setLoadingStage("buscando");
      const r = await buscar();
      setLoadingStage("analisando");
      return r;
    },
    onSuccess: async (r) => {
      setLoadingStage("idle");
      toast.success(`${r.novos} novos lançamento(s) detectado(s) de ${r.total} encontrado(s).`);
      await qc.invalidateQueries({ queryKey: ["lancamentos"] });
      await qc.invalidateQueries({ queryKey: ["radar_buscas"] });
    },
    onError: (e: unknown) => {
      setLoadingStage("idle");
      toast.error(e instanceof Error ? e.message : "Falha ao buscar lançamentos.");
    },
  });

  const gerarMut = useMutation({
    mutationFn: async (id: string) => await gerar({ data: { id } }),
    onSuccess: async (row) => {
      toast.success("Conteúdos gerados.");
      await qc.invalidateQueries({ queryKey: ["lancamentos"] });
      if (row) setAberto(row as Lancamento);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao gerar conteúdos."),
  });

  const manualMut = useMutation({
    mutationFn: async (input: { nome: string }) => {
      setManualStage("pesquisando");
      const timers: ReturnType<typeof setTimeout>[] = [];
      timers.push(setTimeout(() => setManualStage("identificando"), 4000));
      timers.push(setTimeout(() => setManualStage("criando"), 9000));
      try {
        const row = await adicionar({ data: input });
        return row;
      } finally {
        timers.forEach(clearTimeout);
      }
    },
    onSuccess: async (row) => {
      setManualStage("idle");
      setManualOpen(false);
      toast.success("Lançamento adicionado.");
      await qc.invalidateQueries({ queryKey: ["lancamentos"] });
      if (row) setAberto(row as Lancamento);
    },
    onError: (e: unknown) => {
      setManualStage("idle");
      toast.error(e instanceof Error ? e.message : "Falha ao adicionar lançamento.");
    },
  });

  const atualizarMut = useMutation({
    mutationFn: async (input: { id: string; status?: string; notas?: string }) =>
      await atualizar({ data: input as never }),
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: ["lancamentos"] });
      if (row) setAberto(row as Lancamento);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar."),
  });

  const lista = lancamentos ?? [];
  const filtrada = useMemo(() => {
    return lista.filter((l) => {
      if (filtroTipo && l.tipo !== filtroTipo) return false;
      if (filtroCidade && l.cidade !== filtroCidade) return false;
      if (filtroStatus && (l.status ?? "novo") !== filtroStatus) return false;
      if (filtroLinha && (l.oportunidade_linha ?? "") !== filtroLinha) return false;
      return true;
    });
  }, [lista, filtroTipo, filtroCidade, filtroStatus, filtroLinha]);

  const totalMonitorados = lista.length;
  const seteDiasMs = 7 * 86_400_000;
  const novosSemana = lista.filter(
    (l) => Date.now() - new Date(l.created_at).getTime() < seteDiasMs,
  ).length;
  const comConteudo = lista.filter((l) => l.status === "conteudo_gerado" || l.conteudos).length;
  const prospectados = lista.filter((l) => l.status === "prospectado").length;
  const ultimaBusca = buscas?.[0];

  return (
    <>
      <PageHeader
        eyebrow="Radar de Mercado Regional"
        title="Lançamentos em SJC e região"
        description="Monitoramento de loteamentos, condomínios e empreendimentos comerciais em São José dos Campos, Jacareí e Caçapava. Cada lançamento é uma oportunidade de conteúdo e prospecção."
      />
      <div className="px-4 md:px-10 py-8 space-y-8">
        {/* Métricas */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metrica label="Monitorados" valor={totalMonitorados} />
          <Metrica label="Novos esta semana" valor={novosSemana} />
          <Metrica label="Com conteúdo gerado" valor={comConteudo} />
          <Metrica label="Prospectados" valor={prospectados} />
        </section>

        {/* Painel de controle */}
        <section className="border border-[color:var(--divisoria)] bg-white p-4 md:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="font-serif text-lg text-[color:var(--graphite)]">
                Buscar lançamentos agora
              </div>
              <div className="text-xs text-[color:var(--muted-foreground)] mt-1">
                {ultimaBusca
                  ? `Última atualização: ${tempoRelativo(ultimaBusca.created_at)}`
                  : "Nenhuma busca registrada ainda."}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => buscarMut.mutate()}
                disabled={buscarMut.isPending}
                className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] text-white px-5 py-3 text-sm hover:bg-black disabled:opacity-60"
              >
                {buscarMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {loadingStage === "buscando"
                      ? "Buscando lançamentos em SJC..."
                      : "Analisando oportunidades..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Buscar lançamentos agora
                  </>
                )}
              </button>
              <button
                onClick={() => setManualOpen(true)}
                className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white text-[color:var(--graphite)] px-5 py-3 text-sm hover:border-[color:var(--bronze)] hover:text-[color:var(--bronze)]"
              >
                <Plus className="h-4 w-4" />
                Adicionar manualmente
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-[color:var(--divisoria)]">
            <Filtro label="Tipo" value={filtroTipo} onChange={setFiltroTipo}
              options={TIPOS.map((t) => ({ value: t, label: tipoLabel[t] }))} />
            <Filtro label="Cidade" value={filtroCidade} onChange={setFiltroCidade}
              options={CIDADES.map((c) => ({ value: c, label: c }))} />
            <Filtro label="Status" value={filtroStatus} onChange={setFiltroStatus}
              options={STATUS.map((s) => ({ value: s, label: statusLabel[s] }))} />
            <Filtro label="Linha NL" value={filtroLinha} onChange={setFiltroLinha}
              options={LINHAS.map((l) => ({ value: l, label: `Linha ${l}` }))} />
          </div>
        </section>

        {/* Lista */}
        <section>
          <h2 className="font-serif text-xl text-[color:var(--graphite)] mb-4">
            Lançamentos detectados
          </h2>
          {filtrada.length === 0 ? (
            <div className="border border-dashed border-[color:var(--divisoria)] bg-white p-8 text-center text-sm text-[color:var(--muted-foreground)]">
              Nenhum lançamento {lista.length === 0 ? "monitorado ainda. Clique em \"Buscar lançamentos agora\" para começar." : "com esses filtros."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtrada.map((l) => (
                <div
                  key={l.id}
                  className="border border-[color:var(--divisoria)] bg-white p-5 flex flex-col gap-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                      {tipoLabel[l.tipo] ?? l.tipo.toUpperCase()}
                    </span>
                    <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
                      {l.cidade.toUpperCase()}
                    </span>
                    {l.oportunidade_linha && (
                      <span className="font-mono text-[10px] tracking-widest border border-[color:var(--bronze)]/40 text-[color:var(--bronze)] px-2 py-0.5">
                        LINHA {l.oportunidade_linha}
                      </span>
                    )}
                    <span className={`ml-auto font-mono text-[10px] tracking-widest border px-2 py-0.5 ${statusColor(l.status)}`}>
                      {statusLabel[l.status ?? "novo"]}
                    </span>
                  </div>
                  <div>
                    <div className="font-serif text-lg text-[color:var(--graphite)] leading-tight">
                      {l.nome}
                    </div>
                    {l.construtora && (
                      <div className="text-xs text-[color:var(--muted-foreground)] mt-1">
                        {l.construtora}
                      </div>
                    )}
                  </div>
                  {(l.bairro || l.faixa_preco) && (
                    <div className="text-sm text-[color:var(--graphite)]">
                      {l.bairro}{l.bairro && l.faixa_preco ? " · " : ""}{l.faixa_preco}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 mt-auto border-t border-[color:var(--divisoria)]">
                    <div className="text-[11px] text-[color:var(--muted-foreground)]">
                      Detectado {tempoRelativo(l.created_at)}
                    </div>
                    <button
                      onClick={() => setAberto(l)}
                      className="inline-flex items-center gap-1 text-sm text-[color:var(--graphite)] hover:text-[color:var(--bronze)]"
                    >
                      Ver oportunidade <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Histórico */}
        <section>
          <h2 className="font-serif text-xl text-[color:var(--graphite)] mb-4">
            Histórico de buscas
          </h2>
          {!buscas || buscas.length === 0 ? (
            <div className="text-sm text-[color:var(--muted-foreground)]">
              Nenhuma busca ainda.
            </div>
          ) : (
            <div className="border border-[color:var(--divisoria)] bg-white divide-y divide-[color:var(--divisoria)]">
              {buscas.map((b) => (
                <div key={b.id} className="p-4 flex flex-col md:flex-row md:items-center gap-2">
                  <div className="font-mono text-[11px] tracking-widest text-[color:var(--bronze)] md:w-48">
                    {new Date(b.created_at).toLocaleString("pt-BR")}
                  </div>
                  <div className="flex-1 text-sm text-[color:var(--graphite)]">
                    {b.resumo ?? "—"}
                  </div>
                  <div className="font-mono text-[11px] text-[color:var(--muted-foreground)]">
                    {b.resultados_encontrados ?? 0} encontrados · {b.novos_lancamentos ?? 0} novos
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {aberto && (
        <Drawer
          lancamento={aberto}
          onClose={() => setAberto(null)}
          onGerar={() => gerarMut.mutate(aberto.id)}
          gerando={gerarMut.isPending}
          onStatus={(status) => atualizarMut.mutate({ id: aberto.id, status })}
          onNotas={(notas) => atualizarMut.mutate({ id: aberto.id, notas })}
          onCriarPost={() =>
            navigate({
              to: "/copy",
              search: {
                observacao: `Criar post para pessoas que compraram em ${aberto.nome} em ${aberto.cidade} — ${aberto.tipo}. Linha ${aberto.oportunidade_linha ?? "A"}.`,
              },
            })
          }
        />
      )}

      {manualOpen && (
        <ManualModal
          onClose={() => {
            if (!manualMut.isPending) setManualOpen(false);
          }}
          onSubmit={(v) => manualMut.mutate(v)}
          loading={manualMut.isPending}
          stage={manualStage}
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

function Filtro({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
        {label.toUpperCase()}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm rounded-[4px]"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Drawer({
  lancamento,
  onClose,
  onGerar,
  gerando,
  onStatus,
  onNotas,
  onCriarPost,
}: {
  lancamento: Lancamento;
  onClose: () => void;
  onGerar: () => void;
  gerando: boolean;
  onStatus: (s: string) => void;
  onNotas: (v: string) => void;
  onCriarPost: () => void;
}) {
  const [aba, setAba] = useState<"post" | "gancho" | "abordagem" | "cta">("post");
  const [notas, setNotas] = useState(lancamento.notas ?? "");
  const c = lancamento.conteudos ?? {};
  const temConteudos = !!(c.post_feed || c.gancho_conteudo || c.script_abordagem || c.cta_prospeccao);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white overflow-y-auto border-l border-[color:var(--divisoria)]">
        <div className="px-6 py-5 border-b border-[color:var(--divisoria)] flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                {tipoLabel[lancamento.tipo] ?? lancamento.tipo.toUpperCase()}
              </span>
              <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
                {lancamento.cidade.toUpperCase()}
              </span>
              <span className={`font-mono text-[10px] tracking-widest border px-2 py-0.5 ${statusColor(lancamento.status)}`}>
                {statusLabel[lancamento.status ?? "novo"]}
              </span>
            </div>
            <h3 className="font-serif text-2xl text-[color:var(--graphite)]">
              {lancamento.nome}
            </h3>
            {lancamento.construtora && (
              <div className="text-sm text-[color:var(--muted-foreground)] mt-1">
                {lancamento.construtora}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {lancamento.descricao && (
            <p className="text-sm text-[color:var(--graphite)] leading-relaxed">
              {lancamento.descricao}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            {lancamento.bairro && (
              <Info label="Bairro" valor={lancamento.bairro} />
            )}
            {lancamento.faixa_preco && (
              <Info label="Faixa de preço" valor={lancamento.faixa_preco} />
            )}
            {lancamento.data_lancamento && (
              <Info label="Lançamento" valor={lancamento.data_lancamento} />
            )}
            {lancamento.url_fonte && (
              <a
                href={lancamento.url_fonte}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[color:var(--bronze)] hover:underline"
              >
                Fonte <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="border border-[color:var(--divisoria)] bg-[#FAF9F7] p-4 space-y-2">
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
              OPORTUNIDADE NL
            </div>
            {lancamento.oportunidade_linha ? (
              <>
                <div className="font-serif text-lg text-[color:var(--graphite)]">
                  Linha {lancamento.oportunidade_linha}
                </div>
                {c.justificativa_linha && (
                  <p className="text-sm text-[color:var(--graphite)]">{c.justificativa_linha}</p>
                )}
                {c.por_que_agora && (
                  <p className="text-sm text-[color:var(--muted-foreground)] italic">
                    {c.por_que_agora}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-[color:var(--muted-foreground)]">
                Gere os conteúdos para revelar a oportunidade estratégica.
              </p>
            )}
          </div>

          {!temConteudos ? (
            <button
              onClick={onGerar}
              disabled={gerando}
              className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] text-white px-5 py-3 text-sm hover:bg-black disabled:opacity-60"
            >
              {gerando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando conteúdos...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Gerar conteúdos
                </>
              )}
            </button>
          ) : (
            <div>
              <div className="flex gap-2 border-b border-[color:var(--divisoria)] mb-3">
                {[
                  { k: "post", label: "POST" },
                  { k: "gancho", label: "GANCHO" },
                  { k: "abordagem", label: "ABORDAGEM" },
                  { k: "cta", label: "CTA PROSPECÇÃO" },
                ].map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setAba(t.k as typeof aba)}
                    className={`font-mono text-[10px] tracking-widest px-3 py-2 border-b-2 -mb-px ${
                      aba === t.k
                        ? "border-[color:var(--bronze)] text-[color:var(--bronze)]"
                        : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--graphite)]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="whitespace-pre-wrap text-sm text-[color:var(--graphite)] leading-relaxed border border-[color:var(--divisoria)] p-4 min-h-[140px]">
                {aba === "post" && (c.post_feed ?? "—")}
                {aba === "gancho" && (c.gancho_conteudo ?? "—")}
                {aba === "abordagem" && (c.script_abordagem ?? "—")}
                {aba === "cta" && (c.cta_prospeccao ?? "—")}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onCriarPost}
              className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] px-4 py-2 text-sm hover:border-[color:var(--bronze)]"
            >
              Criar post sobre isso <ArrowUpRight className="h-4 w-4" />
            </button>
            {lancamento.status !== "prospectado" && (
              <button
                onClick={() => onStatus("prospectado")}
                className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] px-4 py-2 text-sm hover:border-[color:var(--bronze)]"
              >
                <CheckCircle2 className="h-4 w-4" />
                Marcar como prospectado
              </button>
            )}
            {lancamento.status !== "arquivado" && (
              <button
                onClick={() => onStatus("arquivado")}
                className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] px-4 py-2 text-sm text-[color:var(--muted-foreground)] hover:border-[color:var(--graphite)]"
              >
                <Archive className="h-4 w-4" />
                Arquivar
              </button>
            )}
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)] block mb-1">
              NOTAS
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              onBlur={() => {
                if (notas !== (lancamento.notas ?? "")) onNotas(notas);
              }}
              rows={4}
              className="w-full border border-[color:var(--divisoria)] rounded-[4px] px-3 py-2 text-sm"
              placeholder="Observações internas sobre esse lançamento…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
        {label.toUpperCase()}
      </div>
      <div className="text-sm text-[color:var(--graphite)]">{valor}</div>
    </div>
  );
}

type ManualForm = { nome: string; informacoes_brutas: string; tipo: string; cidade: string };

function ManualModal({
  onClose,
  onSubmit,
  loading,
  stage,
}: {
  onClose: () => void;
  onSubmit: (v: ManualForm) => void;
  loading: boolean;
  stage: "idle" | "pesquisando" | "consolidando" | "criando";
}) {
  const [nome, setNome] = useState("");
  const [info, setInfo] = useState("");
  const [tipo, setTipo] = useState("nao_sei");
  const [cidade, setCidade] = useState("SJC");

  const podeSubmeter = nome.trim().length > 0 && info.trim().length >= 20 && !loading;

  const stageLabel =
    stage === "pesquisando"
      ? `Pesquisando na web por ${nome || "empreendimento"}...`
      : stage === "consolidando"
        ? "Consolidando informações..."
        : stage === "criando"
          ? "Criando oportunidade..."
          : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-[color:var(--divisoria)] w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[4px]">
        <div className="px-6 py-5 border-b border-[color:var(--divisoria)] flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
              RADAR DE MERCADO
            </div>
            <div className="font-serif text-xl text-[color:var(--graphite)] mt-1">
              Adicionar lançamento
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-[color:var(--muted-foreground)] hover:text-[color:var(--graphite)] disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="block">
            <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
              NOME DO EMPREENDIMENTO
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={loading}
              placeholder="Ex: Residencial Vila Nova, Loteamento Green Park..."
              className="mt-1 w-full border border-[color:var(--divisoria)] rounded-[4px] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
              O QUE VOCÊ SABE SOBRE ELE
            </span>
            <textarea
              value={info}
              onChange={(e) => setInfo(e.target.value)}
              disabled={loading}
              rows={6}
              placeholder="Cole aqui qualquer informação que tiver: nome da construtora, bairro, faixa de preço, link, o que ouviu de um corretor, foto de placa... quanto mais informação, melhor a análise."
              className="mt-1 w-full border border-[color:var(--divisoria)] rounded-[4px] px-3 py-2 text-sm"
            />
            <span className="text-[11px] text-[color:var(--muted-foreground)] mt-1 block">
              Mínimo 20 caracteres · {info.trim().length}/20
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
                TIPO
              </span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                disabled={loading}
                className="mt-1 w-full border border-[color:var(--divisoria)] rounded-[4px] px-3 py-2 text-sm bg-white"
              >
                <option value="loteamento">Loteamento</option>
                <option value="condominio">Condomínio</option>
                <option value="apartamento">Apartamento</option>
                <option value="comercial">Comercial</option>
                <option value="nao_sei">Não sei</option>
              </select>
            </label>

            <label className="block">
              <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
                CIDADE
              </span>
              <select
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                disabled={loading}
                className="mt-1 w-full border border-[color:var(--divisoria)] rounded-[4px] px-3 py-2 text-sm bg-white"
              >
                <option value="SJC">SJC</option>
                <option value="Jacareí">Jacareí</option>
                <option value="Caçapava">Caçapava</option>
                <option value="Outra">Outra</option>
              </select>
            </label>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-[color:var(--bronze)] border border-[color:var(--bronze)]/30 bg-[color:var(--bege)] rounded-[4px] px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {stageLabel}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[color:var(--divisoria)] flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)] disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={() =>
              onSubmit({ nome: nome.trim(), informacoes_brutas: info.trim(), tipo, cidade })
            }
            disabled={!podeSubmeter}
            className="rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white hover:bg-black disabled:opacity-40"
          >
            {loading ? "Processando…" : "Pesquisar e adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}