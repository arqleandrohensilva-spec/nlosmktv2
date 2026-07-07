import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { RADAR_DATAS } from "@/lib/nl-brand";
import { ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/radar")({
  component: RadarPage,
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function RadarPage() {
  const navigate = useNavigate();
  const now = new Date();
  const mesAtual = now.getMonth() + 1;

  return (
    <>
      <PageHeader
        eyebrow="Radar de oportunidade"
        title="Datas cruzadas com o negócio"
        description="Ganchos de conteúdo ancorados no calendário do nicho. Antecipar em 15 dias."
      />
      <div className="px-4 md:px-10 py-8 space-y-6">
        {MESES.map((mesNome, i) => {
          const mes = i + 1;
          const datas = RADAR_DATAS.filter((d) => d.mes === mes);
          if (datas.length === 0) return null;
          return (
            <section key={mes}>
              <div className="flex items-baseline gap-3 mb-3">
                <h2
                  className={`font-serif text-xl ${
                    mes === mesAtual ? "text-[color:var(--bronze)]" : "text-[color:var(--graphite)]"
                  }`}
                >
                  {mesNome}
                </h2>
                {mes === mesAtual && (
                  <span className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">MÊS ATUAL</span>
                )}
              </div>
              <div className="space-y-2">
                {datas.map((d) => (
                  <div
                    key={`${d.mes}-${d.dia}-${d.titulo}`}
                    className="border border-[color:var(--divisoria)] rounded-lg bg-white p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3"
                  >
                    <div className="md:w-24">
                      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                        {String(d.dia).padStart(2, "0")} / {String(d.mes).padStart(2, "0")}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-serif text-base text-[color:var(--graphite)]">{d.titulo}</div>
                      <div className="text-sm text-[color:var(--muted-foreground)] mt-1">{d.gancho}</div>
                    </div>
                    <button
                      onClick={() =>
                        navigate({
                          to: "/copy",
                          search: { observacao: `Data-âncora: ${d.titulo} — ${d.gancho}` },
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2 text-sm hover:border-[color:var(--bronze)] whitespace-nowrap"
                    >
                      Gerar post <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}