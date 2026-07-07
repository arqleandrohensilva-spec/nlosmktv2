import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, AlertOctagon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

export function useCustoIaMes() {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const custoQ = useQuery({
    queryKey: ["uso-ia-mes-total", inicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uso_ia")
        .select("custo_brl")
        .gte("created_at", inicio);
      if (error) throw error;
      return (data ?? []).reduce((s: number, r: any) => s + Number(r.custo_brl ?? 0), 0);
    },
  });

  const limiteQ = useQuery({
    queryKey: ["config-limite-mensal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "limite_mensal_brl")
        .maybeSingle();
      if (error) throw error;
      return Number(data?.valor ?? 10);
    },
  });

  const gasto = custoQ.data ?? 0;
  const limite = limiteQ.data ?? 10;
  const pct = limite > 0 ? (gasto / limite) * 100 : 0;

  return {
    gasto,
    limite,
    pct,
    mesLabel: `${MESES[now.getMonth()]} ${now.getFullYear()}`,
    isLoading: custoQ.isLoading || limiteQ.isLoading,
  };
}

export function CustoIaCard({ compact = false }: { compact?: boolean }) {
  const { gasto, limite, pct, mesLabel } = useCustoIaMes();
  const [openDialog, setOpenDialog] = useState(false);

  const barCor = useMemo(() => {
    if (pct >= 100) return "#B23A3A";
    if (pct >= 80) return "#C99B4A";
    return "#8B7355";
  }, [pct]);

  const barWidth = Math.min(pct, 100);

  return (
    <>
      <section
        className={`border border-[color:var(--divisoria)] bg-[color:var(--bege)] rounded-lg ${
          compact ? "p-5" : "p-6 md:p-8"
        }`}
      >
        <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
          CUSTO IA — {mesLabel}
        </div>
        <div
          className={`font-serif text-[color:var(--graphite)] ${
            compact ? "text-3xl" : "text-4xl md:text-5xl"
          }`}
        >
          {formatBRL(gasto)}
        </div>

        <div className="mt-4 h-2 rounded-full bg-[color:var(--divisoria)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${barWidth}%`, background: barCor }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="text-[color:var(--muted-foreground)]">
            {formatBRL(gasto)} de {formatBRL(limite)} ·{" "}
            <strong className="text-[color:var(--graphite)]">{Math.round(pct)}%</strong> do limite mensal
          </span>
          <button
            onClick={() => setOpenDialog(true)}
            className="text-xs text-[color:var(--bronze)] hover:underline"
          >
            Ajustar limite →
          </button>
        </div>
      </section>

      <AjustarLimiteDialog open={openDialog} onOpenChange={setOpenDialog} valorAtual={limite} />
    </>
  );
}

export function CustoIaAlertas() {
  const { pct } = useCustoIaMes();
  if (pct >= 100) {
    return (
      <div className="flex items-start gap-3 border border-[#B23A3A]/40 bg-[#B23A3A]/10 rounded-lg p-4 text-sm text-[#8a2a2a]">
        <AlertOctagon className="h-5 w-5 mt-0.5 shrink-0" strokeWidth={1.5} />
        <span>
          Limite mensal atingido. As operações continuam funcionando, mas fique
          atento ao custo acumulado.
        </span>
      </div>
    );
  }
  if (pct >= 80) {
    return (
      <div className="flex items-start gap-3 border border-[#C99B4A]/50 bg-[#C99B4A]/15 rounded-lg p-4 text-sm text-[#7a5a1e]">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" strokeWidth={1.5} />
        <span>
          Você usou {Math.round(pct)}% do limite mensal de IA. Considere revisar
          o uso ou ajustar o limite.
        </span>
      </div>
    );
  }
  return null;
}

export function AjustarLimiteButton() {
  const { limite } = useCustoIaMes();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors"
      >
        Ajustar limite
      </button>
      <AjustarLimiteDialog open={open} onOpenChange={setOpen} valorAtual={limite} />
    </>
  );
}

function AjustarLimiteDialog({
  open,
  onOpenChange,
  valorAtual,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  valorAtual: number;
}) {
  const qc = useQueryClient();
  const [valor, setValor] = useState(String(valorAtual));

  const salvar = useMutation({
    mutationFn: async () => {
      const n = Number(valor.replace(",", "."));
      if (!isFinite(n) || n <= 0) throw new Error("Informe um valor maior que zero.");
      const { error } = await supabase
        .from("configuracoes")
        .upsert(
          { chave: "limite_mensal_brl", valor: n.toFixed(2), updated_at: new Date().toISOString() },
          { onConflict: "chave" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Limite atualizado.");
      qc.invalidateQueries({ queryKey: ["config-limite-mensal"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar limite."),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setValor(String(valorAtual));
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Limite mensal de IA</DialogTitle>
          <DialogDescription>
            Você receberá um alerta visual quando o gasto se aproximar deste valor.
            Não bloqueia operações.
          </DialogDescription>
        </DialogHeader>

        <label className="block mt-2">
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
            LIMITE EM R$
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
          />
        </label>

        <DialogFooter className="mt-4 gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}
            className="rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40"
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}