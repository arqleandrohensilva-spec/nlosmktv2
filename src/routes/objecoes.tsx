import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { PageHeader } from "@/components/page-header";
import { Check, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/objecoes")({
  component: Objecoes,
});

function Objecoes() {
  const navigate = useNavigate();
  const { data: objecoes } = useQuery({
    queryKey: ["objecoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkt_objecoes")
        .select("*")
        .order("respondida", { ascending: true })
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const respondidas = (objecoes ?? []).filter((o: any) => o.respondida).length;
  const total = objecoes?.length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Banco de objeções"
        title="Objeções da persona 7D"
        description="Cada objeção é uma pauta em potencial. Responder em conteúdo antecipa a venda."
      />
      <div className="px-4 md:px-10 py-8 space-y-6">
        <div className="flex flex-wrap gap-6 border-b border-[color:var(--divisoria)] pb-4">
          <Counter label="Respondidas em conteúdo" value={respondidas} />
          <Counter label="Pendentes" value={total - respondidas} accent />
          <Counter label="Total mapeadas" value={total} />
        </div>

        <ul className="divide-y divide-[color:var(--divisoria)] border border-[color:var(--divisoria)] rounded-lg bg-white">
          {(objecoes ?? []).map((o: any) => (
            <li key={o.id} className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {o.respondida ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                      <Check className="h-3 w-3" /> RESPONDIDA
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] tracking-widest text-[color:var(--travertino)]">
                      PENDENTE
                    </span>
                  )}
                  {o.categoria && (
                    <span className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
                      · {o.categoria.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[color:var(--graphite)]">"{o.texto}"</p>
              </div>
              {!o.respondida && (
                <button
                  onClick={() => navigate({ to: "/copy", search: { observacao: `Responder objeção: ${o.texto}` } })}
                  className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2 text-sm hover:border-[color:var(--bronze)]"
                >
                  Gerar post <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Counter({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
        {label.toUpperCase()}
      </div>
      <div className={`font-serif text-3xl mt-1 ${accent ? "text-[color:var(--bronze)]" : "text-[color:var(--graphite)]"}`}>
        {value}
      </div>
    </div>
  );
}