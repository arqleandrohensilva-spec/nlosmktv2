import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { reescreverPorLinha, type ReescreverOutput } from "@/lib/reescrever.functions";
import { PageHeader } from "@/components/page-header";
import { LINHAS, LINHA_BADGE, type LinhaValue } from "@/lib/nl-brand";
import { Loader2, Copy, ArrowUpRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reescrever")({
  component: ReescreverPage,
});

const TIPOS = [
  "Legenda de post",
  "Roteiro de Reels",
  "CTA",
  "Legenda de Stories",
] as const;

function ReescreverPage() {
  const reescrever = useServerFn(reescreverPorLinha);
  const navigate = useNavigate();
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [resultado, setResultado] = useState<ReescreverOutput | null>(null);

  const mut = useMutation({
    mutationFn: async () => reescrever({ data: { texto, tipo: tipo || undefined } }),
    onSuccess: (data) => setResultado(data),
    onError: (err: any) => toast.error(err?.message ?? "Erro ao reescrever texto"),
  });

  const resetar = () => {
    setTexto("");
    setTipo("");
    setResultado(null);
  };

  const copiar = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast.success("Texto copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Reescritor por Linha"
        title="Adaptar por linha de negócio"
        description="Cole qualquer texto e receba 4 versões calibradas para cada linha — mesmo conteúdo, tons diferentes."
      />

      <div className="px-4 md:px-10 py-8 space-y-6 max-w-6xl">
        {!resultado && (
          <>
            <label className="block">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
                TEXTO ORIGINAL
              </div>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Cole aqui o texto original que quer adaptar…"
                className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-3 text-sm focus:outline-none focus:border-[color:var(--bronze)] resize-y"
                style={{ minHeight: 200 }}
              />
            </label>

            <label className="block max-w-sm">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
                TIPO DE PEÇA (OPCIONAL)
              </div>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
              >
                <option value="">—</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <button
              disabled={!texto.trim() || mut.isPending}
              onClick={() => mut.mutate()}
              className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-5 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Reescrevendo…
                </>
              ) : (
                "Reescrever nas 4 linhas"
              )}
            </button>
          </>
        )}

        {resultado && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {LINHAS.map((l) => {
                const key = l.value as LinhaValue;
                const t = resultado[key];
                return (
                  <div
                    key={key}
                    className="border border-[color:var(--divisoria)] rounded-lg bg-white p-5 flex flex-col"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-widest ${LINHA_BADGE[key]}`}
                      >
                        LINHA {key}
                      </span>
                      <span className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase">
                        {l.label.split(" — ")[1]}
                      </span>
                    </div>
                    <div className="text-xs text-[color:var(--muted-foreground)] mb-3">
                      {l.tom}
                    </div>
                    <div
                      className="text-sm text-[color:var(--graphite)] whitespace-pre-wrap flex-1"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {t}
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[color:var(--divisoria)]">
                      <button
                        onClick={() => copiar(t)}
                        className="inline-flex items-center gap-1.5 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-1.5 text-xs text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors"
                      >
                        <Copy className="h-3 w-3" /> Copiar
                      </button>
                      <button
                        onClick={() =>
                          navigate({
                            to: "/copy",
                            search: { observacao: t } as never,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-[4px] bg-[color:var(--bronze)] px-3 py-1.5 text-xs text-white hover:bg-[color:var(--graphite)] transition-colors"
                      >
                        Usar no Motor de Copy <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                onClick={resetar}
                className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-5 py-2.5 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors"
              >
                <RotateCcw className="h-4 w-4" /> Reescrever outro texto
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}