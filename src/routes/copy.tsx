import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { gerarCopy, type CopyOutput } from "@/lib/copy.functions";
import { PageHeader } from "@/components/page-header";
import { LINHAS, FORMATOS } from "@/lib/nl-brand";
import { Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Search = { dor?: string; linha?: string; formato?: string; observacao?: string };

export const Route = createFileRoute("/copy")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    dor: typeof s.dor === "string" ? s.dor : undefined,
    linha: typeof s.linha === "string" ? s.linha : undefined,
    formato: typeof s.formato === "string" ? s.formato : undefined,
    observacao: typeof s.observacao === "string" ? s.observacao : undefined,
  }),
  component: MotorCopy,
});

function MotorCopy() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const gerar = useServerFn(gerarCopy);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [linha, setLinha] = useState<string>(search.linha ?? "A");
  const [formato, setFormato] = useState<string>(search.formato ?? "reels");
  const [dorId, setDorId] = useState<string>(search.dor ?? "");
  const [observacao, setObservacao] = useState<string>(search.observacao ?? "");
  const [ajusteRaciocinio, setAjusteRaciocinio] = useState<string>("");
  const [ajustando, setAjustando] = useState(false);
  const [output, setOutput] = useState<CopyOutput | null>(null);

  const { data: dores } = useQuery({
    queryKey: ["dores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dores").select("*").order("titulo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const dorSelecionada = useMemo(
    () => (dores ?? []).find((d: any) => d.id === dorId),
    [dores, dorId],
  );

  const alertaLacuna = useMemo(() => {
    if (!dorSelecionada?.ultima_vez_usada) return null;
    const dias = Math.floor(
      (Date.now() - new Date(dorSelecionada.ultima_vez_usada).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return dias > 14
      ? `Esta dor não é atacada há ${dias} dias. Boa hora para retomar.`
      : null;
  }, [dorSelecionada]);

  const gerarMut = useMutation({
    mutationFn: async () => {
      if (!dorSelecionada) throw new Error("Selecione uma dor");
      return gerar({
        data: {
          linha: linha as any,
          formato: formato as any,
          dor_titulo: dorSelecionada.titulo,
          dor_descricao: dorSelecionada.descricao ?? undefined,
          observacao: observacao || undefined,
          ajuste_raciocinio: ajusteRaciocinio || undefined,
        },
      });
    },
    onSuccess: (data) => {
      setOutput(data);
      setStep(3);
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao gerar copy"),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!output || !dorSelecionada) throw new Error("Sem conteúdo para salvar");
      const now = new Date();
      const { error } = await supabase.from("posts").insert({
        linha,
        formato,
        dor_id: dorSelecionada.id,
        pilar: output.pilar,
        raciocinio: {
          dor: dorSelecionada.titulo,
          pilar: output.pilar,
          formato,
          justificativa: output.justificativa_formato,
          raciocinio: output.raciocinio,
        },
        copy_roteiro: output.copy_roteiro,
        copy_legenda: output.copy_legenda,
        copy_cta: output.copy_cta,
        briefing_visual: output.briefing_visual,
        observacao,
        status: "rascunho",
        mes: now.getMonth() + 1,
        ano: now.getFullYear(),
      });
      if (error) throw error;
      await supabase
        .from("dores")
        .update({
          ultima_vez_usada: now.toISOString(),
          vezes_usada: (dorSelecionada.vezes_usada ?? 0) + 1,
        })
        .eq("id", dorSelecionada.id);
    },
    onSuccess: () => {
      toast.success("Post salvo no calendário como rascunho.");
      navigate({ to: "/calendario" });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao salvar"),
  });

  return (
    <>
      <PageHeader
        eyebrow={`Motor de Copy IA — Etapa ${step} de 3`}
        title={step === 1 ? "Contexto do post" : step === 2 ? "Diagnóstico de raciocínio" : "Copy gerado"}
        description={
          step === 1
            ? "Defina a linha, formato e dor da persona que este post vai atacar."
            : step === 2
              ? "Antes de gerar o copy, revise o raciocínio estratégico. Você pode ajustar antes de aprovar."
              : "Roteiro, legenda, CTA e briefing visual prontos para revisão."
        }
      />

      <div className="px-4 md:px-10 py-8 max-w-4xl">
        {step === 1 && (
          <div className="space-y-5">
            <Field label="Linha de negócio">
              <Select value={linha} onChange={setLinha}>
                {LINHAS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Formato">
              <Select value={formato} onChange={setFormato}>
                {FORMATOS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Dor da persona">
              <Select value={dorId} onChange={setDorId}>
                <option value="">Selecione uma dor…</option>
                {(dores ?? []).map((d: any) => (
                  <option key={d.id} value={d.id}>{d.titulo}</option>
                ))}
              </Select>
            </Field>
            <Field label="Observação (opcional)">
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
                placeholder="Ex: enfatizar o caso do terreno em condomínio…"
              />
            </Field>
            <div className="pt-2">
              <PrimaryButton disabled={!dorId} onClick={() => setStep(2)}>
                Continuar para diagnóstico
              </PrimaryButton>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="border border-[color:var(--divisoria)] rounded-lg bg-[color:var(--bege)] p-6">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-3">
                RACIOCÍNIO ESTRATÉGICO
              </div>
              <dl className="space-y-3 text-sm">
                <Row k="Linha" v={LINHAS.find((l) => l.value === linha)?.label} />
                <Row k="Formato" v={FORMATOS.find((f) => f.value === formato)?.label} />
                <Row k="Dor ativa" v={dorSelecionada?.titulo} />
                <Row k="Justificativa do formato" v={justificativaFormato(formato)} />
                <Row k="Pilar sugerido" v="Definido pela IA a partir do contexto acima" />
              </dl>
              {alertaLacuna && (
                <div className="mt-4 flex items-start gap-2 text-sm text-[color:var(--bronze)]">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <span>{alertaLacuna}</span>
                </div>
              )}
            </div>

            {ajustando && (
              <Field label="Ajuste no raciocínio">
                <textarea
                  value={ajusteRaciocinio}
                  onChange={(e) => setAjusteRaciocinio(e.target.value)}
                  rows={3}
                  className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
                  placeholder="Ex: quero puxar mais pelo lado da segurança financeira…"
                />
              </Field>
            )}

            <div className="flex flex-wrap gap-3">
              <PrimaryButton disabled={gerarMut.isPending} onClick={() => gerarMut.mutate()}>
                {gerarMut.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</>
                ) : (
                  "Aprovar e gerar copy"
                )}
              </PrimaryButton>
              <SecondaryButton onClick={() => setAjustando((v) => !v)}>
                {ajustando ? "Cancelar ajuste" : "Ajustar raciocínio"}
              </SecondaryButton>
              <SecondaryButton onClick={() => setStep(1)}>Voltar</SecondaryButton>
            </div>
          </div>
        )}

        {step === 3 && output && (
          <div className="space-y-6">
            {formato === "reels" && output.copy_roteiro && (
              <Block title="Roteiro de Reels (30–40s)">
                <p className="whitespace-pre-wrap">{output.copy_roteiro}</p>
              </Block>
            )}
            <Block title="Legenda do post" copyable={output.copy_legenda}>
              <p className="whitespace-pre-wrap">{output.copy_legenda}</p>
            </Block>
            <Block title="CTA">
              <p className="whitespace-pre-wrap">{output.copy_cta}</p>
            </Block>
            <Block title="Briefing visual">
              <p className="whitespace-pre-wrap">{output.briefing_visual}</p>
            </Block>
            <Block title="Registro de raciocínio">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-[color:var(--divisoria)]">
                    <td className="py-2 pr-4 font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">DOR</td>
                    <td className="py-2">{dorSelecionada?.titulo}</td>
                  </tr>
                  <tr className="border-b border-[color:var(--divisoria)]">
                    <td className="py-2 pr-4 font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">PILAR</td>
                    <td className="py-2 capitalize">{output.pilar}</td>
                  </tr>
                  <tr className="border-b border-[color:var(--divisoria)]">
                    <td className="py-2 pr-4 font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">FORMATO</td>
                    <td className="py-2">{FORMATOS.find((f) => f.value === formato)?.label}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">CTA</td>
                    <td className="py-2">{output.copy_cta}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">{output.raciocinio}</p>
            </Block>

            <div className="flex flex-wrap gap-3 pt-2">
              <PrimaryButton disabled={salvar.isPending} onClick={() => salvar.mutate()}>
                {salvar.isPending ? "Salvando…" : "Salvar no calendário"}
              </PrimaryButton>
              <SecondaryButton onClick={() => copyText(output.copy_legenda)}>
                <Copy className="h-4 w-4" /> Copiar legenda
              </SecondaryButton>
              <SecondaryButton onClick={() => { setOutput(null); setStep(1); }}>
                Novo post
              </SecondaryButton>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function justificativaFormato(f: string) {
  const m: Record<string, string> = {
    reels: "Reels com fundador constrói autoridade técnica e confiança de rosto — formato campeão para conversão de topo.",
    carrossel: "Carrossel permite desenvolver argumento em camadas — ideal para dores com dúvida ou objeção racional.",
    estatico: "Post estático fixa uma frase-âncora — bom para posicionamento e sedimentar tom de voz.",
    stories: "Stories é próximo e efêmero — ideal para bastidor de obra ou aviso curto.",
  };
  return m[f];
}

function copyText(t: string) {
  navigator.clipboard.writeText(t).then(
    () => toast.success("Legenda copiada."),
    () => toast.error("Não foi possível copiar."),
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
        {label.toUpperCase()}
      </div>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
    >
      {children}
    </select>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-5 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-5 py-2.5 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-1 md:gap-4">
      <dt className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">{k.toUpperCase()}</dt>
      <dd className="text-[color:var(--graphite)]">{v ?? "—"}</dd>
    </div>
  );
}

function Block({ title, children, copyable }: { title: string; children: React.ReactNode; copyable?: string }) {
  return (
    <section className="border border-[color:var(--divisoria)] rounded-lg bg-white p-5 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
          {title.toUpperCase()}
        </div>
        {copyable && (
          <button
            onClick={() => copyText(copyable)}
            className="text-[color:var(--travertino)] hover:text-[color:var(--bronze)]"
            aria-label="Copiar"
          >
            <Copy className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="text-sm text-[color:var(--graphite)] leading-relaxed">{children}</div>
    </section>
  );
}

// unused import guard
void Check;