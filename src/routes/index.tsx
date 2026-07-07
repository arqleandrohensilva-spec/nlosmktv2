import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { CustoIaCard, CustoIaAlertas } from "@/components/custo-ia-card";
import {
  Sparkles,
  Calendar,
  Shield,
  BarChart3,
  BookOpen,
  Radar,
  ArrowUpRight,
  DollarSign,
} from "lucide-react";
import { LINHAS } from "@/lib/nl-brand";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: metrics } = useQuery({
    queryKey: ["dashboard-metrics", mes, ano],
    queryFn: async () => {
      const [{ data: mensal }, { data: publicados }, { data: dores }] = await Promise.all([
        supabase.from("posts").select("id, linha").eq("mes", mes).eq("ano", ano),
        supabase.from("posts").select("id").eq("status", "publicado"),
        supabase
          .from("dores")
          .select("titulo, vezes_usada")
          .order("vezes_usada", { ascending: false })
          .limit(1),
      ]);
      const byLinha: Record<string, number> = {};
      (mensal ?? []).forEach((p: any) => (byLinha[p.linha] = (byLinha[p.linha] ?? 0) + 1));
      const linhaTop =
        Object.entries(byLinha).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      return {
        mensal: mensal?.length ?? 0,
        publicados: publicados?.length ?? 0,
        linhaTop,
        dorTop: dores?.[0]?.titulo ?? "—",
      };
    },
  });

  const { data: custos } = useQuery({
    queryKey: ["uso-ia-mes", inicioMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uso_ia")
        .select("modulo, custo_brl")
        .gte("created_at", inicioMes);
      if (error) throw error;
      const rows = (data ?? []) as { modulo: string; custo_brl: number }[];
      const total = rows.reduce((s, r) => s + Number(r.custo_brl ?? 0), 0);
      const porModulo = (m: string) => rows.filter((r) => r.modulo === m);
      return {
        total,
        operacoes: rows.length,
        copy: porModulo("copy").length,
        concorrentes: porModulo("concorrentes").length,
        validar: porModulo("validar").length,
        media: rows.length > 0 ? total / rows.length : 0,
      };
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Painel executivo"
        description="Visão consolidada da produção de conteúdo do mês. Cada decisão registrada, cada linha equilibrada."
      />

      <div className="px-4 md:px-10 py-8 space-y-10">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <MetricCard label="Posts gerados no mês" value={metrics?.mensal ?? 0} />
          <MetricCard label="Posts publicados" value={metrics?.publicados ?? 0} />
          <MetricCard label="Linha mais ativa" value={metrics?.linhaTop ?? "—"} />
          <MetricCard label="Dor mais atacada" value={metrics?.dorTop ?? "—"} small />
        </section>

        <div className="space-y-4">
          <CustoIaCard />
          <CustoIaAlertas />
          <div className="flex justify-end">
            <Link
              to="/custos"
              className="inline-flex items-center gap-1 text-xs text-[color:var(--bronze)] hover:underline"
            >
              Ver detalhes <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <section className="border border-[color:var(--divisoria)] bg-[color:var(--bege)] p-6 md:p-8 rounded-lg">
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-3">
            PRÓXIMA AÇÃO SUGERIDA
          </div>
          <h2 className="font-serif text-xl md:text-2xl text-[color:var(--graphite)] mb-3">
            {sugestao(metrics)}
          </h2>
          <Link
            to="/copy"
            className="inline-flex items-center gap-2 text-sm text-[color:var(--bronze)] hover:underline"
          >
            Ir para o motor de copy <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>

        <section>
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-4">
            ATALHOS
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Shortcut to="/copy" icon={Sparkles} title="Motor de Copy IA" desc="Gerar novo post com raciocínio estratégico" />
            <Shortcut to="/calendario" icon={Calendar} title="Calendário Editorial" desc="Programar e revisar posts do mês" />
            <Shortcut to="/objecoes" icon={Shield} title="Banco de Objeções" desc="Responder objeções pendentes em conteúdo" />
            <Shortcut to="/performance" icon={BarChart3} title="Performance" desc="Registrar e analisar posts publicados" />
            <Shortcut to="/marca" icon={BookOpen} title="Biblioteca de Marca" desc="Persona, paleta, tom e regras" />
            <Shortcut to="/radar" icon={Radar} title="Radar de Oportunidade" desc="Datas relevantes cruzadas com linhas" />
            <Shortcut to="/custos" icon={DollarSign} title="Custos IA" desc="Rastreamento de tokens e custo por operação" />
          </div>
        </section>

        <section>
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-4">
            LINHAS DE NEGÓCIO
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {LINHAS.map((l) => (
              <div key={l.value} className="border border-[color:var(--divisoria)] p-4 rounded-lg bg-white">
                <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                  LINHA {l.value}
                </div>
                <div className="font-serif text-lg text-[color:var(--graphite)] mt-1">
                  {l.label.split(" — ")[1]}
                </div>
                <div className="text-sm text-[color:var(--muted-foreground)] mt-2">{l.tom}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function sugestao(m: { mensal: number; publicados: number; linhaTop: string } | undefined) {
  if (!m) return "Carregando análise…";
  if (m.mensal === 0) return "Você ainda não gerou posts este mês. Comece pela dor mais central da persona.";
  if (m.publicados === 0) return "Tem rascunhos parados. Feche um post para publicação hoje.";
  if (m.linhaTop === "A") return "Linha A dominou o mês. Equilibre com um post da Linha B ou A+B.";
  if (m.linhaTop === "B") return "Linha B dominou o mês. Reforce a Linha A para não parecer decorador.";
  return "Distribua o próximo post para uma dor que está há mais tempo sem tratamento.";
}

function MetricCard({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-4">
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
        {label}
      </div>
      <div
        className={`font-serif mt-2 text-[color:var(--graphite)] ${
          small ? "text-base leading-snug" : "text-3xl"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function Shortcut({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 border border-[color:var(--divisoria)] rounded-lg bg-white p-4 hover:border-[color:var(--bronze)] transition-colors"
    >
      <Icon className="h-5 w-5 mt-0.5 text-[color:var(--bronze)]" strokeWidth={1.5} />
      <div className="flex-1">
        <div className="font-serif text-base text-[color:var(--graphite)]">{title}</div>
        <div className="text-sm text-[color:var(--muted-foreground)] mt-1">{desc}</div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-[color:var(--travertino)] group-hover:text-[color:var(--bronze)]" />
    </Link>
  );
}
