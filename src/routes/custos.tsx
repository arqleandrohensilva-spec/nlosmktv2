import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Sparkles, Crosshair, ShieldCheck, Search, DollarSign } from "lucide-react";
import {
  CustoIaCard,
  CustoIaAlertas,
  AjustarLimiteButton,
} from "@/components/custo-ia-card";

export const Route = createFileRoute("/custos")({
  component: CustosPage,
});

type Row = {
  id: string;
  created_at: string;
  modulo: string;
  operacao: string;
  tokens_input: number;
  tokens_output: number;
  custo_brl: number;
  custo_usd: number;
  modelo: string;
};

function formatBRL(v: number) {
  return Number(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

const MODULOS = [
  { value: "todos", label: "Todos os módulos" },
  { value: "copy", label: "Motor de Copy" },
  { value: "concorrentes", label: "Concorrentes" },
  { value: "validar", label: "Validar peça" },
];

function iconeDoModulo(m: string) {
  if (m === "copy") return Sparkles;
  if (m === "concorrentes") return Crosshair;
  if (m === "validar") return ShieldCheck;
  return Search;
}

function CustosPage() {
  const now = new Date();
  const [filtroModulo, setFiltroModulo] = useState("todos");
  const [filtroMes, setFiltroMes] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );

  const inicio = useMemo(() => {
    const [y, m] = filtroMes.split("-").map(Number);
    return new Date(y, m - 1, 1).toISOString();
  }, [filtroMes]);
  const fim = useMemo(() => {
    const [y, m] = filtroMes.split("-").map(Number);
    return new Date(y, m, 1).toISOString();
  }, [filtroMes]);

  const { data: rows } = useQuery({
    queryKey: ["uso-ia-full", filtroMes, filtroModulo],
    queryFn: async () => {
      let q = supabase
        .from("uso_ia")
        .select("*")
        .gte("created_at", inicio)
        .lt("created_at", fim)
        .order("created_at", { ascending: false });
      if (filtroModulo !== "todos") q = q.eq("modulo", filtroModulo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const totalMes = (rows ?? []).reduce((s, r) => s + Number(r.custo_brl ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Custos de IA"
        title="Rastreamento de operações"
        description="Cada chamada de IA, com tokens consumidos e custo real. Ordenado por data decrescente."
        actions={<AjustarLimiteButton />}
      />

      <div className="px-4 md:px-10 py-8 space-y-8">
        <CustoIaCard />
        <CustoIaAlertas />

        <section className="border border-[color:var(--divisoria)] bg-white rounded-lg p-5">
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2 flex items-center gap-2">
            <DollarSign className="h-3 w-3" /> TOTAL DO PERÍODO FILTRADO
          </div>
          <div className="font-serif text-2xl text-[color:var(--graphite)]">
            {formatBRL(totalMes)}
          </div>
          <div className="text-sm text-[color:var(--muted-foreground)] mt-1">
            {rows?.length ?? 0} operações no período selecionado.
          </div>
        </section>

        <section className="flex flex-wrap gap-3 items-end">
          <label className="block">
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
              MÊS
            </div>
            <input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
            />
          </label>
          <label className="block">
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
              MÓDULO
            </div>
            <select
              value={filtroModulo}
              onChange={(e) => setFiltroModulo(e.target.value)}
              className="rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
            >
              {MODULOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="border border-[color:var(--divisoria)] rounded-lg bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--divisoria)] text-left">
                <Th>Data</Th>
                <Th>Módulo</Th>
                <Th>Operação</Th>
                <Th>Tokens</Th>
                <Th>Custo (R$)</Th>
                <Th>Acumulado</Th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[color:var(--muted-foreground)]">
                    Nenhuma operação no período.
                  </td>
                </tr>
              )}
              {(() => {
                let acc = 0;
                const ordenadoDesc = rows ?? [];
                // Para "acumulado no mês" crescente conforme tempo, calcular reverso:
                const asc = [...ordenadoDesc].reverse();
                const acumuladoMap = new Map<string, number>();
                asc.forEach((r) => {
                  acc += Number(r.custo_brl ?? 0);
                  acumuladoMap.set(r.id, acc);
                });
                return ordenadoDesc.map((r) => {
                  const Icon = iconeDoModulo(r.modulo);
                  return (
                    <tr key={r.id} className="border-b border-[color:var(--divisoria)] last:border-0">
                      <td className="px-4 py-3 text-[color:var(--graphite)] whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-[color:var(--graphite)]">
                          <Icon className="h-4 w-4 text-[color:var(--bronze)]" strokeWidth={1.5} />
                          <span className="capitalize">{r.modulo}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--muted-foreground)]">{r.operacao}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[color:var(--graphite)] whitespace-nowrap">
                        {r.tokens_input.toLocaleString("pt-BR")} in ·{" "}
                        {r.tokens_output.toLocaleString("pt-BR")} out
                      </td>
                      <td className="px-4 py-3 text-[color:var(--graphite)] whitespace-nowrap">
                        {formatBRL(Number(r.custo_brl))}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--muted-foreground)] whitespace-nowrap">
                        {formatBRL(acumuladoMap.get(r.id) ?? 0)}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-mono text-[10px] tracking-widest text-[color:var(--bronze)] font-normal">
      {children}
    </th>
  );
}