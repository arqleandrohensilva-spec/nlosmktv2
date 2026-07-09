import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { LINHAS } from "@/lib/nl-brand";
import { gerarEstudoCaso, type EstudoCasoOutput } from "@/lib/estudos.functions";
import { BibliotecaPicker, signBibliotecaUrls, type BibliotecaImagemLite } from "@/components/biblioteca-picker";
import { AgendarButton } from "@/components/agendar-modal";
import { toast } from "sonner";
import {
  Loader2,
  Copy,
  Save,
  Plus,
  X,
  Image as ImageIcon,
  Layers,
  Play,
  FileText,
  Mail,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/estudos-de-caso")({
  component: EstudosPage,
});

type EstudoRow = {
  id: string;
  created_at: string;
  nome_projeto: string;
  linha: string;
  cidade: string | null;
  problema: string;
  restricoes: string | null;
  partido: string;
  solucoes: string[];
  resultado: string;
  detalhe_tecnico: string | null;
  imagens_ids: string[];
  conteudos: EstudoCasoOutput | null;
  status: string;
};

const TABS = [
  { key: "carrossel", label: "Carrossel", icon: Layers },
  { key: "reels", label: "Reels 90s", icon: Play },
  { key: "blog", label: "Blog / Site", icon: FileText },
  { key: "email", label: "E-mail", icon: Mail },
  { key: "linkedin", label: "LinkedIn", icon: Briefcase },
] as const;

function EstudosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const gerar = useServerFn(gerarEstudoCaso);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [linha, setLinha] = useState("A");
  const [cidade, setCidade] = useState("");
  const [problema, setProblema] = useState("");
  const [restricoes, setRestricoes] = useState("");
  const [partido, setPartido] = useState("");
  const [solucoes, setSolucoes] = useState<string[]>(["", ""]);
  const [resultado, setResultado] = useState("");
  const [detalheTecnico, setDetalheTecnico] = useState("");
  const [imagens, setImagens] = useState<BibliotecaImagemLite[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [conteudos, setConteudos] = useState<EstudoCasoOutput | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("carrossel");
  const [estudoId, setEstudoId] = useState<string | null>(null);

  const salvos = useQuery({
    queryKey: ["estudos-caso"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estudos_caso")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EstudoRow[];
    },
  });

  const gerarMut = useMutation({
    mutationFn: async () => {
      const solucoesLimpas = solucoes.map((s) => s.trim()).filter(Boolean);
      if (solucoesLimpas.length < 2) throw new Error("Adicione pelo menos 2 soluções.");
      const out = await gerar({
        data: {
          nome_projeto: nomeProjeto.trim(),
          linha,
          cidade: cidade.trim() || null,
          problema: problema.trim(),
          restricoes: restricoes.trim() || null,
          partido: partido.trim(),
          solucoes: solucoesLimpas,
          resultado: resultado.trim(),
          detalhe_tecnico: detalheTecnico.trim() || null,
        },
      });
      return { out, solucoesLimpas };
    },
    onSuccess: ({ out }) => {
      setConteudos(out);
      setStep(4);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar estudo de caso"),
  });

  const salvarMut = useMutation({
    mutationFn: async () => {
      if (!conteudos) throw new Error("Nada para salvar");
      const solucoesLimpas = solucoes.map((s) => s.trim()).filter(Boolean);
      const payload = {
        nome_projeto: nomeProjeto.trim(),
        linha,
        cidade: cidade.trim() || null,
        problema: problema.trim(),
        restricoes: restricoes.trim() || null,
        partido: partido.trim(),
        solucoes: solucoesLimpas,
        resultado: resultado.trim(),
        detalhe_tecnico: detalheTecnico.trim() || null,
        imagens_ids: imagens.map((i) => i.id),
        conteudos: conteudos as any,
        status: "salvo",
      };
      const { data, error } = await (supabase as any)
        .from("estudos_caso")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setEstudoId(id);
      toast.success("Estudo de caso salvo.");
      qc.invalidateQueries({ queryKey: ["estudos-caso"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const resetar = () => {
    setStep(1);
    setNomeProjeto("");
    setLinha("A");
    setCidade("");
    setProblema("");
    setRestricoes("");
    setPartido("");
    setSolucoes(["", ""]);
    setResultado("");
    setDetalheTecnico("");
    setImagens([]);
    setConteudos(null);
    setTab("carrossel");
    setEstudoId(null);
  };

  const copiar = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const addSolucao = () => {
    if (solucoes.length >= 6) return;
    setSolucoes([...solucoes, ""]);
  };
  const removeSolucao = (i: number) => {
    if (solucoes.length <= 2) return;
    setSolucoes(solucoes.filter((_, idx) => idx !== i));
  };
  const updateSolucao = (i: number, v: string) => {
    setSolucoes(solucoes.map((s, idx) => (idx === i ? v : s)));
  };

  const addImagem = (img: BibliotecaImagemLite) => {
    if (imagens.length >= 8) {
      toast.error("Máximo 8 imagens");
      return;
    }
    if (imagens.some((i) => i.id === img.id)) {
      setPickerOpen(false);
      return;
    }
    setImagens([...imagens, img]);
    setPickerOpen(false);
  };

  const podeAvancar1 = nomeProjeto.trim() && problema.trim();
  const podeAvancar2 = partido.trim() && solucoes.filter((s) => s.trim()).length >= 2;
  const podeGerar = resultado.trim();

  const conteudoParaCopy = () => {
    if (!conteudos) return "";
    return `${conteudos.carrossel.titulo_capa}\n\n${conteudos.blog}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Fábrica de Estudos de Caso"
        title="Transformar entrega em autoridade"
        description="Wizard guiado — cada projeto entregue vira post, roteiro, texto longo e e-mail em uma passagem só."
      />

      <div className="px-4 md:px-10 py-8 space-y-8 max-w-5xl">
        {step !== 4 && (
          <StepIndicator step={step} />
        )}

        {step === 1 && (
          <div className="space-y-5">
            <SectionTitle title="O PROBLEMA" subtitle="QUAL ERA O DESAFIO DO PROJETO?" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Nome do projeto" required>
                <input
                  value={nomeProjeto}
                  onChange={(e) => setNomeProjeto(e.target.value)}
                  placeholder="Ex: Residência Verde, Loja Centro..."
                  className={inputClass}
                />
              </Field>
              <Field label="Linha" required>
                <select value={linha} onChange={(e) => setLinha(e.target.value)} className={selectClass}>
                  {LINHAS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Cidade">
                <input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="São José dos Campos"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Situação inicial" required>
              <textarea
                value={problema}
                onChange={(e) => setProblema(e.target.value)}
                placeholder="Descreva o que o cliente tinha ou queria resolver. Ex: terreno de esquina com desnível de 2m, família com 3 filhos que precisava de home office..."
                className={textareaClass}
                style={{ minHeight: 130 }}
              />
            </Field>

            <Field label="Restrições técnicas">
              <textarea
                value={restricoes}
                onChange={(e) => setRestricoes(e.target.value)}
                placeholder="Limitações de orçamento, terreno, legislação, prazo..."
                className={textareaClass}
                style={{ minHeight: 100 }}
              />
            </Field>

            <div className="flex justify-end pt-2">
              <button
                disabled={!podeAvancar1}
                onClick={() => setStep(2)}
                className={btnPrimary}
              >
                Próximo <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <SectionTitle title="O PARTIDO E AS SOLUÇÕES" subtitle="COMO A NL RESOLVEU?" />

            <Field label="Partido arquitetônico" required>
              <textarea
                value={partido}
                onChange={(e) => setPartido(e.target.value)}
                placeholder="Qual foi a abordagem central? A decisão técnica principal que orientou todo o projeto..."
                className={textareaClass}
                style={{ minHeight: 130 }}
              />
            </Field>

            <div>
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
                SOLUÇÕES ADOTADAS <span className="opacity-60">(mín. 2, máx. 6)</span>
              </div>
              <div className="space-y-2">
                {solucoes.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="mt-2.5 font-mono text-[10px] text-[color:var(--bronze)] w-6">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <textarea
                      value={s}
                      onChange={(e) => updateSolucao(i, e.target.value)}
                      placeholder="Ex: Laje invertida para resolver o desnível sem muros de arrimo..."
                      className={textareaClass}
                      style={{ minHeight: 60 }}
                    />
                    {solucoes.length > 2 && (
                      <button
                        onClick={() => removeSolucao(i)}
                        className="mt-2 p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--graphite)]"
                        aria-label="Remover solução"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {solucoes.length < 6 && (
                <button
                  onClick={addSolucao}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-1.5 text-xs text-[color:var(--graphite)] hover:border-[color:var(--bronze)]"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar solução
                </button>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className={btnSecondary}>
                <ChevronLeft className="h-4 w-4" /> Voltar
              </button>
              <button disabled={!podeAvancar2} onClick={() => setStep(3)} className={btnPrimary}>
                Próximo <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <SectionTitle title="O RESULTADO" subtitle="O QUE O PROJETO ENTREGOU?" />

            <Field label="Resultado mensurável" required>
              <textarea
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
                placeholder="O que mudou de forma concreta e verificável? Ex: área aproveitável aumentou 40m², custo de fundação reduziu 30% vs. solução convencional..."
                className={textareaClass}
                style={{ minHeight: 130 }}
              />
            </Field>

            <Field label="Detalhe técnico de destaque">
              <textarea
                value={detalheTecnico}
                onChange={(e) => setDetalheTecnico(e.target.value)}
                placeholder="Um detalhe construtivo, escolha de material ou decisão de projeto que você mais se orgulha nesse projeto..."
                className={textareaClass}
                style={{ minHeight: 100 }}
              />
            </Field>

            <div>
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
                IMAGENS DO PROJETO <span className="opacity-60">(até 8 · opcional)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {imagens.map((img) => (
                  <div key={img.id} className="relative border border-[color:var(--divisoria)] rounded-[4px] overflow-hidden bg-[color:var(--gelo)]">
                    {img.signed_url ? (
                      <img src={img.signed_url} alt={img.nome_arquivo} className="w-full h-24 object-cover" />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center text-[color:var(--muted-foreground)]"><ImageIcon className="h-5 w-5" /></div>
                    )}
                    <button
                      onClick={() => setImagens(imagens.filter((i) => i.id !== img.id))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black"
                      aria-label="Remover imagem"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {imagens.length < 8 && (
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="h-24 rounded-[4px] border border-dashed border-[color:var(--divisoria)] bg-white hover:border-[color:var(--bronze)] flex flex-col items-center justify-center text-[color:var(--muted-foreground)]"
                  >
                    <ImageIcon className="h-5 w-5 mb-1" />
                    <span className="text-[10px] uppercase tracking-widest">Adicionar</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className={btnSecondary}>
                <ChevronLeft className="h-4 w-4" /> Voltar
              </button>
              <button
                disabled={!podeGerar || gerarMut.isPending}
                onClick={() => gerarMut.mutate()}
                className={btnPrimary}
              >
                {gerarMut.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</>
                ) : (
                  <>Gerar estudo de caso <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 4 && conteudos && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">
                  ESTUDO DE CASO · {linha}
                </div>
                <h2 className="font-serif text-2xl text-[color:var(--graphite)]">
                  {conteudos.carrossel.titulo_capa}
                </h2>
              </div>
              <button onClick={resetar} className={btnSecondary}>
                Novo estudo
              </button>
            </div>

            <div className="border-b border-[color:var(--divisoria)] flex flex-wrap gap-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-widest border-b-2 -mb-px ${
                      active
                        ? "border-[color:var(--bronze)] text-[color:var(--graphite)]"
                        : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--graphite)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>

            <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-6">
              <div className="mb-3 flex justify-end">
                {(() => {
                  const textoAba =
                    tab === "carrossel"
                      ? `${conteudos.carrossel.titulo_capa}\n\n` +
                        conteudos.carrossel.slides.map((s) => `SLIDE ${s.numero} — ${s.titulo}\n${s.texto}`).join("\n\n")
                      : tab === "reels"
                      ? conteudos.roteiro_reels
                      : tab === "blog"
                      ? conteudos.blog
                      : tab === "email"
                      ? conteudos.email
                      : conteudos.linkedin;
                  const kind: "posicionamento" | "projeto" | "bastidor" =
                    tab === "linkedin" ? "posicionamento" : tab === "reels" || tab === "carrossel" ? "projeto" : "projeto";
                  return (
                    <AgendarButton
                      text={textoAba}
                      variant="chip"
                      origem={`estudos-caso:${tab}`}
                      kind={kind}
                      label="Agendar publicação"
                    />
                  );
                })()}
              </div>
              {tab === "carrossel" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
                      CAPA — {conteudos.carrossel.titulo_capa}
                    </div>
                    <CopyBtn onClick={() => copiar(
                      `${conteudos.carrossel.titulo_capa}\n\n` +
                      conteudos.carrossel.slides.map((s) => `SLIDE ${s.numero} — ${s.titulo}\n${s.texto}`).join("\n\n")
                    )} />
                  </div>
                  <div className="space-y-3">
                    {conteudos.carrossel.slides.map((s) => (
                      <div key={s.numero} className="border border-[color:var(--divisoria)] rounded-[4px] bg-[color:var(--gelo)] px-4 py-3">
                        <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">
                          SLIDE {String(s.numero).padStart(2, "0")}
                        </div>
                        <div className="font-serif text-base text-[color:var(--graphite)] mb-1">{s.titulo}</div>
                        <div className="text-sm leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>{s.texto}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "reels" && (
                <ConteudoBlock texto={conteudos.roteiro_reels} onCopy={() => copiar(conteudos.roteiro_reels)} />
              )}
              {tab === "blog" && (
                <ConteudoBlock texto={conteudos.blog} onCopy={() => copiar(conteudos.blog)} />
              )}
              {tab === "email" && (
                <ConteudoBlock texto={conteudos.email} onCopy={() => copiar(conteudos.email)} />
              )}
              {tab === "linkedin" && (
                <ConteudoBlock texto={conteudos.linkedin} onCopy={() => copiar(conteudos.linkedin)} />
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                disabled={salvarMut.isPending || !!estudoId}
                onClick={() => salvarMut.mutate()}
                className={btnPrimary}
              >
                <Save className="h-4 w-4" />
                {estudoId ? "Salvo" : salvarMut.isPending ? "Salvando…" : "Salvar estudo de caso"}
              </button>
              <button
                onClick={() => navigate({ to: "/copy", search: { observacao: conteudoParaCopy() } as any })}
                className={btnSecondary}
              >
                Usar imagens no post <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Listagem */}
        <div className="pt-8 border-t border-[color:var(--divisoria)]">
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-4">
            ESTUDOS SALVOS
          </div>
          {salvos.isLoading ? (
            <div className="text-sm text-[color:var(--muted-foreground)]">Carregando…</div>
          ) : (salvos.data ?? []).length === 0 ? (
            <div className="text-sm text-[color:var(--muted-foreground)]">
              Nenhum estudo de caso salvo ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(salvos.data ?? []).map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    if (!e.conteudos) return;
                    setNomeProjeto(e.nome_projeto);
                    setLinha(e.linha);
                    setCidade(e.cidade ?? "");
                    setProblema(e.problema);
                    setRestricoes(e.restricoes ?? "");
                    setPartido(e.partido);
                    setSolucoes(e.solucoes.length >= 2 ? e.solucoes : [...e.solucoes, ""]);
                    setResultado(e.resultado);
                    setDetalheTecnico(e.detalhe_tecnico ?? "");
                    setConteudos(e.conteudos);
                    setEstudoId(e.id);
                    setTab("carrossel");
                    setStep(4);
                    (async () => {
                      if (!e.imagens_ids || e.imagens_ids.length === 0) {
                        setImagens([]);
                        return;
                      }
                      const { data } = await (supabase as any)
                        .from("biblioteca_imagens")
                        .select("*, projeto:projetos(nome)")
                        .in("id", e.imagens_ids);
                      const rows = (data ?? []) as any[];
                      const map = await signBibliotecaUrls(rows.map((r) => r.url_storage));
                      setImagens(rows.map((r) => ({ ...r, signed_url: map[r.url_storage] })));
                    })();
                  }}
                  className="text-left border border-[color:var(--divisoria)] rounded-lg bg-white p-4 hover:border-[color:var(--bronze)] transition-colors"
                >
                  <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">
                    LINHA {e.linha} · {new Date(e.created_at).toLocaleDateString("pt-BR")}
                  </div>
                  <div className="font-serif text-lg text-[color:var(--graphite)]">{e.nome_projeto}</div>
                  {e.cidade && <div className="text-xs text-[color:var(--muted-foreground)] mt-0.5">{e.cidade}</div>}
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-[color:var(--muted-foreground)]">
                    {e.status}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <BibliotecaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addImagem}
      />
    </>
  );
}

const inputClass =
  "w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]";
const selectClass = inputClass;
const textareaClass =
  "w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)] resize-y";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-5 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const btnSecondary =
  "inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-5 py-2.5 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
        {label}{required && <span className="ml-1 opacity-60">*</span>}
      </div>
      {children}
    </label>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
        {title}
      </div>
      <h2 className="font-serif text-xl text-[color:var(--graphite)] mt-1">{subtitle}</h2>
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const labels = ["Problema", "Partido", "Resultado", "Conteúdos"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        const active = n === step;
        const done = n < step;
        return (
          <div key={l} className="flex items-center gap-2">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-mono ${
                active
                  ? "bg-[color:var(--graphite)] text-white"
                  : done
                  ? "bg-[color:var(--bronze)] text-white"
                  : "bg-white border border-[color:var(--divisoria)] text-[color:var(--muted-foreground)]"
              }`}
            >
              {n}
            </div>
            <div
              className={`text-[10px] uppercase tracking-widest ${
                active ? "text-[color:var(--graphite)]" : "text-[color:var(--muted-foreground)]"
              }`}
            >
              {l}
            </div>
            {i < labels.length - 1 && (
              <div className="w-6 h-px bg-[color:var(--divisoria)]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConteudoBlock({ texto, onCopy }: { texto: string; onCopy: () => void }) {
  return (
    <div>
      <div className="flex justify-end mb-2">
        <CopyBtn onClick={onCopy} />
      </div>
      <div className="whitespace-pre-wrap text-[color:var(--graphite)] leading-relaxed" style={{ fontFamily: "Georgia, serif", fontSize: 15 }}>
        {texto}
      </div>
    </div>
  );
}

function CopyBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-1.5 text-xs text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors"
    >
      <Copy className="h-3 w-3" /> Copiar
    </button>
  );
}