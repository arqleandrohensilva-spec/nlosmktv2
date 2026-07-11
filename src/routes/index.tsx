import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
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
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { LINHAS } from "@/lib/nl-brand";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const { data: metrics } = useQuery({
    queryKey: ["dashboard-metrics", mes, ano],
    queryFn: async () => {
      const [{ data: mensal }, { data: publicados }, { data: dores }] = await Promise.all([
        supabase.from("mkt_posts").select("id, linha").eq("mes", mes).eq("ano", ano),
        supabase.from("mkt_posts").select("id").eq("status", "publicado"),
        supabase
          .from("mkt_dores")
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

  const { data: pilaresPosts } = useQuery({
    queryKey: ["dashboard-pilares-30d"],
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("mkt_posts")
        .select("pilar, created_at")
        .gte("created_at", desde);
      return data ?? [];
    },
  });

  const { data: followupsVencidos } = useQuery({
    queryKey: ["dashboard-followups-vencidos"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await (supabase as any)
        .from("mkt_prospeccoes")
        .select("id")
        .lt("data_followup", hoje)
        .not("data_followup", "is", null)
        .not("status", "in", "(parceria_ativa,sem_interesse,arquivado)");
      return (data ?? []).length as number;
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
        {(followupsVencidos ?? 0) > 0 && (
          <Link
            to="/prospeccao"
            className="flex items-center justify-between gap-3 border border-red-300 bg-red-50 rounded-lg px-4 py-3 hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-2 text-red-800 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {followupsVencidos} prospecção(ões) aguardando follow-up.
            </div>
            <span className="text-xs text-red-700 inline-flex items-center gap-1">
              Abrir CRM <ArrowUpRight className="h-3 w-3" />
            </span>
          </Link>
        )}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <MetricCard label="Posts gerados no mês" value={metrics?.mensal ?? 0} />
          <MetricCard label="Posts publicados" value={metrics?.publicados ?? 0} />
          <MetricCard label="Linha mais ativa" value={metrics?.linhaTop ?? "—"} />
          <MetricCard label="Dor mais atacada" value={metrics?.dorTop ?? "—"} small />
        </section>

        <BalanceadorPilares posts={pilaresPosts ?? []} />

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
            <Shortcut to="/prospeccao" icon={UserCheck} title="CRM · Prospecção" desc="Pipeline de contatos e follow-ups" />
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
  return ShortcutImpl({ to, icon: Icon, title, desc });
}

const PILARES = ["Posicionamento", "Oferta", "Marketing", "Vendas"] as const;
type Pilar = (typeof PILARES)[number];

function BalanceadorPilares({ posts }: { posts: { pilar: string | null; created_at: string }[] }) {
  const total = posts.length;
  const counts: Record<Pilar, number> = { Posicionamento: 0, Oferta: 0, Marketing: 0, Vendas: 0 };
  const ultimaData: Record<Pilar, string | null> = { Posicionamento: null, Oferta: null, Marketing: null, Vendas: null };
  posts.forEach((p) => {
    const pil = (p.pilar ?? "") as Pilar;
    if ((PILARES as readonly string[]).includes(pil)) {
      counts[pil] += 1;
      if (!ultimaData[pil] || p.created_at > ultimaData[pil]!) ultimaData[pil] = p.created_at;
    }
  });

  const label = (
    <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-4">
      BALANCEADOR DE PILARES — 30 DIAS
    </div>
  );

  if (total < 4) {
    return (
      <section>
        {label}
        <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-6 text-sm text-[color:var(--muted-foreground)]">
          Ainda sem dados suficientes. Gere pelo menos 4 posts para ver o balanço.
        </div>
      </section>
    );
  }

  const diasDesde = (iso: string | null) => {
    if (!iso) return 30;
    return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)));
  };

  const alertas: { tipo: "ausente" | "dominante"; texto: string }[] = [];
  PILARES.forEach((pil) => {
    const c = counts[pil];
    const pct = (c / total) * 100;
    if (c === 0) {
      alertas.push({
        tipo: "ausente",
        texto: `${pil} ausente há 30 dias. Seu próximo post deveria reequilibrar.`,
      });
    } else if (pct > 50) {
      const semPos = counts.Posicionamento === 0;
      if (semPos && pil !== "Posicionamento") {
        alertas.push({
          tipo: "dominante",
          texto: `Você está ${Math.round(pct)}% em ${pil}. Sem Posicionamento há ${diasDesde(ultimaData.Posicionamento)} dias, a audiência percebe pressão antes de confiar.`,
        });
      } else {
        alertas.push({
          tipo: "dominante",
          texto: `Você está ${Math.round(pct)}% em ${pil}. Reequilibre com outros pilares para não saturar a audiência.`,
        });
      }
    }
  });

  return (
    <section>
      {label}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PILARES.map((pil) => {
          const c = counts[pil];
          const pct = (c / total) * 100;
          const saudavel = pct >= 15 && pct <= 40;
          const cor = saudavel ? "var(--bronze)" : pct < 10 ? "#B23A3A" : "#C99B4A";
          return (
            <div key={pil} className="border border-[color:var(--divisoria)] rounded-lg bg-white p-4">
              <div className="flex items-baseline justify-between">
                <div className="font-serif text-base text-[color:var(--graphite)]">{pil}</div>
                <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                  {c} POST{c === 1 ? "" : "S"} · {Math.round(pct)}%
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full bg-[color:var(--bege)] rounded">
                <div className="h-1.5 rounded transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: cor }} />
              </div>
            </div>
          );
        })}
      </div>
      {alertas.length > 0 && (
        <div className="mt-3 space-y-2">
          {alertas.map((a, i) => (
            <div
              key={i}
              className={`border rounded-lg p-4 text-sm ${
                a.tipo === "ausente"
                  ? "border-[color:var(--bronze)] bg-[color:var(--bege)] text-[color:var(--graphite)]"
                  : "border-[#C99B4A] bg-[#FBF3E4] text-[color:var(--graphite)]"
              }`}
            >
              {a.texto}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ShortcutImpl({
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
