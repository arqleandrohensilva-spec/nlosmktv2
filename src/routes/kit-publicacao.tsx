import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { gerarKitPublicacao, type KitOutput } from "@/lib/kit.functions";
import { PageHeader } from "@/components/page-header";
import { LINHAS, PILARES } from "@/lib/nl-brand";
import { supabase } from "@/lib/supabaseExternal";
import { Loader2, Copy, RotateCcw, Square, Layers, Play, Briefcase, Mail, Save, Image as ImageIcon, X, Radar, Link2, Check } from "lucide-react";
import { BibliotecaPicker, type BibliotecaImagemLite } from "@/components/biblioteca-picker";
import { AgendarButton } from "@/components/agendar-modal";
import { toast } from "sonner";

type Search = { conteudo?: string; dor?: string; linha?: string };

export const Route = createFileRoute("/kit-publicacao")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    conteudo: typeof s.conteudo === "string" ? s.conteudo : undefined,
    dor: typeof s.dor === "string" ? s.dor : undefined,
    linha: typeof s.linha === "string" ? s.linha : undefined,
  }),
  component: KitPublicacaoPage,
});

// Ligação MKT → NL Diagnóstico: cada canal vira um link UTM rastreável.
const LANDING_DIAG = "https://diagnosticonlarquitetos.lovable.app";
const CANAIS_UTM: { key: keyof KitOutput; label: string; source: string; medium: string }[] = [
  { key: "feed", label: "Instagram · Feed", source: "instagram", medium: "feed" },
  { key: "stories", label: "Instagram · Stories", source: "instagram", medium: "stories" },
  { key: "reels", label: "Instagram · Reels", source: "instagram", medium: "reels" },
  { key: "linkedin", label: "LinkedIn", source: "linkedin", medium: "linkedin" },
  { key: "email", label: "E-mail", source: "email", medium: "email" },
];

function slugCampanha(s: string): string {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function montarUrlUtm(urlBase: string, source: string, medium: string, campaign: string): string {
  const base = urlBase.includes("://") ? urlBase : `https://${urlBase}`;
  try {
    const u = new URL(base);
    u.searchParams.set("utm_source", source);
    u.searchParams.set("utm_medium", medium);
    u.searchParams.set("utm_campaign", campaign);
    return u.toString();
  } catch {
    const sep = urlBase.includes("?") ? "&" : "?";
    return `${urlBase}${sep}utm_source=${encodeURIComponent(source)}&utm_medium=${encodeURIComponent(medium)}&utm_campaign=${encodeURIComponent(campaign)}`;
  }
}

function KitPublicacaoPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const gerar = useServerFn(gerarKitPublicacao);
  const [conteudo, setConteudo] = useState(search.conteudo ?? "");
  const [linha, setLinha] = useState<string>("A");
  const [tom, setTom] = useState<string>("");
  const [resultado, setResultado] = useState<KitOutput | null>(null);
  const [imagem, setImagem] = useState<BibliotecaImagemLite | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Rastreamento no NL Diagnóstico (links UTM por canal).
  const [rastrear, setRastrear] = useState(true);
  const [campanha, setCampanha] = useState(slugCampanha(search.dor ?? ""));
  const [urlDestino, setUrlDestino] = useState(LANDING_DIAG);
  const [campanhasCriadas, setCampanhasCriadas] = useState(false);

  useEffect(() => {
    if (search.conteudo && !conteudo) setConteudo(search.conteudo);
    if (search.linha) setLinha(search.linha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.conteudo, search.linha]);

  const mut = useMutation({
    mutationFn: async () =>
      gerar({ data: { conteudo, linha: linha || undefined, tom: tom || undefined, imagem_contexto: imagem?.descricao_tecnica || undefined } }),
    onSuccess: (data) => {
      setResultado(data);
      setCampanhasCriadas(false);
      // Sugere um nome de campanha se ainda não houver (dor > primeiras palavras).
      if (!campanha) {
        const base = search.dor || conteudo.split(/\s+/).slice(0, 5).join(" ");
        setCampanha(slugCampanha(base) || `campanha_linha_${(linha || "a").toLowerCase()}`);
      }
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao gerar kit"),
  });

  const criarCampanhas = useMutation({
    mutationFn: async () => {
      if (!resultado) throw new Error("Gere o kit primeiro.");
      const camp = slugCampanha(campanha);
      if (!camp) throw new Error("Defina o nome da campanha.");
      const linksVigentes = CANAIS_UTM.filter((c) => (resultado[c.key] ?? "").trim() !== "");
      const rows = linksVigentes.map((c) => ({
        origem: c.source,
        meio: c.medium,
        nome_campanha: camp,
        url_base: urlDestino.trim() || LANDING_DIAG,
        url_completa: montarUrlUtm(urlDestino.trim() || LANDING_DIAG, c.source, c.medium, camp),
      }));
      const { error } = await (supabase as any).from("diag_campanhas").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      setCampanhasCriadas(true);
      toast.success(`${n} link(s) criados no NL Diagnóstico.`);
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao criar campanhas no Diagnóstico."),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!resultado) throw new Error("Nada para salvar");
      const now = new Date();
      const { error } = await supabase.from("mkt_posts").insert({
        linha,
        formato: "kit",
        pilar: tom || null,
        copy_legenda: JSON.stringify(resultado),
        status: "rascunho",
        mes: now.getMonth() + 1,
        ano: now.getFullYear(),
        observacao: "Kit de Publicação — 5 canais",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kit salvo no calendário.");
      navigate({ to: "/calendario" });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao salvar"),
  });

  const resetar = () => {
    setConteudo("");
    setTom("");
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

  const parseEmail = (raw: string): { assunto: string; corpo: string } => {
    const assuntoMatch = raw.match(/ASSUNTO:\s*([^\n]*)/i);
    const corpoMatch = raw.match(/CORPO:\s*([\s\S]*)/i);
    return {
      assunto: assuntoMatch?.[1]?.trim() ?? "",
      corpo: corpoMatch?.[1]?.trim() ?? raw,
    };
  };

  return (
    <>
      <PageHeader
        eyebrow="Kit de Publicação"
        title="Distribuir conteúdo"
        description="Cole o conteúdo mestre e receba as variações prontas para cada canal — sem retrabalho, sem perda de tom."
      />

      <div className="px-4 md:px-10 py-8 space-y-6 max-w-6xl">
        {!resultado && (
          <>
            <label className="block">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
                CONTEÚDO MESTRE
              </div>
              <textarea
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Cole aqui a legenda principal, roteiro ou texto base que quer distribuir…"
                className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-3 text-sm focus:outline-none focus:border-[color:var(--bronze)] resize-y"
                style={{ minHeight: 150 }}
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <label className="block">
                <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
                  LINHA DE NEGÓCIO
                </div>
                <select
                  value={linha}
                  onChange={(e) => setLinha(e.target.value)}
                  className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
                >
                  {LINHAS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
                  TOM DO CONTEÚDO (OPCIONAL)
                </div>
                <select
                  value={tom}
                  onChange={(e) => setTom(e.target.value)}
                  className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
                >
                  <option value="">—</option>
                  {PILARES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
                IMAGEM DO PROJETO (OPCIONAL)
              </div>
              {imagem ? (
                <div className="flex items-center gap-3 border border-[color:var(--divisoria)] rounded-[4px] bg-white p-2 max-w-md">
                  {imagem.signed_url && (
                    <img src={imagem.signed_url} alt={imagem.nome_arquivo} className="h-14 w-20 object-cover rounded-[3px]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{imagem.projeto?.nome ?? imagem.nome_arquivo}</div>
                    <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase">
                      {imagem.tipo === "foto_real" ? "Foto real" : "Render"} · Linha {imagem.linha}
                    </div>
                  </div>
                  <button onClick={() => setImagem(null)} className="p-1 text-[color:var(--muted-foreground)] hover:text-[color:var(--graphite)]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm hover:border-[color:var(--bronze)]"
                >
                  <ImageIcon className="h-4 w-4" /> Escolher da biblioteca
                </button>
              )}
            </label>

            <button
              disabled={!conteudo.trim() || mut.isPending}
              onClick={() => mut.mutate()}
              className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-5 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando kit…
                </>
              ) : (
                "Gerar kit completo"
              )}
            </button>
          </>
        )}

        {resultado && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CanalCard
                icon={<Square className="h-4 w-4" />}
                label="INSTAGRAM FEED"
                onCopy={() => copiar(resultado.feed)}
                counter={`${resultado.feed.length} / 2.200`}
                bufferText={resultado.feed}
                bufferKind="projeto"
              >
                <p className="whitespace-pre-wrap">{resultado.feed}</p>
              </CanalCard>

              <CanalCard
                icon={<Layers className="h-4 w-4" />}
                label="STORIES — 3 TELAS"
                onCopy={() => copiar(resultado.stories)}
              >
                <div className="space-y-2">
                  {resultado.stories.split(/\n?---\n?/).map((tela, i) => (
                    <div
                      key={i}
                      className="border border-[color:var(--divisoria)] rounded-[4px] bg-[color:var(--gelo)] px-3 py-2"
                    >
                      <div className="font-mono text-[9px] tracking-widest text-[color:var(--bronze)] mb-1">
                        TELA {i + 1}
                      </div>
                      <div>{tela.trim()}</div>
                    </div>
                  ))}
                </div>
              </CanalCard>

              <CanalCard
                icon={<Play className="h-4 w-4" />}
                label="REELS — LEGENDA"
                onCopy={() => copiar(resultado.reels)}
                bufferText={resultado.reels}
                bufferKind="projeto"
                footer={
                  <span className="text-[color:var(--muted-foreground)]">
                    Primeiras 125 caracteres aparecem antes do "ver mais".
                  </span>
                }
              >
                <p className="whitespace-pre-wrap">
                  <span className="bg-[color:var(--bege)]">{resultado.reels.slice(0, 125)}</span>
                  {resultado.reels.slice(125)}
                </p>
              </CanalCard>

              <CanalCard
                icon={<Briefcase className="h-4 w-4" />}
                label="LINKEDIN"
                onCopy={() => copiar(resultado.linkedin)}
                bufferText={resultado.linkedin}
                bufferKind="posicionamento"
              >
                <p className="whitespace-pre-wrap">{resultado.linkedin}</p>
              </CanalCard>

              <CanalCard
                icon={<Mail className="h-4 w-4" />}
                label="E-MAIL"
                onCopy={() => copiar(resultado.email)}
                className="md:col-span-2"
              >
                {(() => {
                  const { assunto, corpo } = parseEmail(resultado.email);
                  return (
                    <div className="space-y-3">
                      <div>
                        <div className="font-mono text-[9px] tracking-widest text-[color:var(--bronze)] mb-1">
                          ASSUNTO
                        </div>
                        <div className="text-[color:var(--graphite)]" style={{ fontSize: 16 }}>
                          {assunto}
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[9px] tracking-widest text-[color:var(--bronze)] mb-1">
                          CORPO
                        </div>
                        <p className="whitespace-pre-wrap">{corpo}</p>
                      </div>
                    </div>
                  );
                })()}
              </CanalCard>
            </div>

            {/* Rastrear no NL Diagnóstico — gera links UTM por canal */}
            <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-5 md:p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-[color:var(--bronze)]">
                  <Radar className="h-4 w-4" />
                  <span className="font-mono text-[10px] tracking-widest">RASTREAR NO NL DIAGNÓSTICO</span>
                </div>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-[color:var(--graphite)]">
                  <input type="checkbox" checked={rastrear} onChange={(e) => setRastrear(e.target.checked)} />
                  Gerar links UTM por canal
                </label>
              </div>

              {rastrear && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <div className="font-mono text-[9px] tracking-widest text-[color:var(--bronze)] mb-1">CAMPANHA (VEM DA DOR DO POST)</div>
                      <input
                        value={campanha}
                        onChange={(e) => { setCampanha(e.target.value); setCampanhasCriadas(false); }}
                        placeholder="financiamento_ep1"
                        className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
                      />
                    </label>
                    <label className="block">
                      <div className="font-mono text-[9px] tracking-widest text-[color:var(--bronze)] mb-1">URL DE DESTINO (EDITÁVEL)</div>
                      <input
                        value={urlDestino}
                        onChange={(e) => { setUrlDestino(e.target.value); setCampanhasCriadas(false); }}
                        className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
                      />
                    </label>
                  </div>

                  {!urlDestino.toLowerCase().includes("diagnosticonlarquitetos") && (
                    <p className="text-xs text-[color:var(--bronze)]">
                      Atenção: esse destino não é a landing do diagnóstico — os leads não vão aparecer no painel do NL Diagnóstico.
                    </p>
                  )}

                  <div>
                    <div className="font-mono text-[9px] tracking-widest text-[color:var(--bronze)] mb-2">LINKS GERADOS — 1 POR CANAL</div>
                    <div className="space-y-2">
                      {CANAIS_UTM.filter((c) => (resultado[c.key] ?? "").trim() !== "").map((c) => {
                        const link = montarUrlUtm(urlDestino || LANDING_DIAG, c.source, c.medium, slugCampanha(campanha) || "campanha");
                        return (
                          <div key={c.key} className="flex items-center gap-2 border border-[color:var(--divisoria)] rounded-[4px] bg-[color:var(--gelo)] px-3 py-2">
                            <span className="text-sm text-[color:var(--graphite)] min-w-[130px] shrink-0">{c.label}</span>
                            <span className="flex-1 truncate text-xs font-mono text-[color:var(--muted-foreground)]">{link}</span>
                            <button onClick={() => copiar(link)} className="text-[color:var(--travertino)] hover:text-[color:var(--bronze)] shrink-0" aria-label="Copiar link">
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <button
                      disabled={criarCampanhas.isPending || !slugCampanha(campanha)}
                      onClick={() => criarCampanhas.mutate()}
                      className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-5 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {criarCampanhas.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : campanhasCriadas ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                      {campanhasCriadas ? "Criado no Diagnóstico" : "Criar campanhas no Diagnóstico"}
                    </button>
                    <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                      As campanhas aparecem no painel do NL Diagnóstico (HUB). Cole cada link no canal correspondente ao publicar.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                disabled={salvar.isPending}
                onClick={() => salvar.mutate()}
                className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-5 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40"
              >
                <Save className="h-4 w-4" />
                {salvar.isPending ? "Salvando…" : "Salvar kit no calendário"}
              </button>
              <button
                onClick={resetar}
                className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-5 py-2.5 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors"
              >
                <RotateCcw className="h-4 w-4" /> Novo kit
              </button>
            </div>
          </>
        )}
      </div>
      <BibliotecaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(img) => { setImagem(img); setPickerOpen(false); }}
      />
    </>
  );
}

function CanalCard({
  icon,
  label,
  children,
  onCopy,
  counter,
  footer,
  className = "",
  bufferText,
  bufferKind,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  onCopy: () => void;
  counter?: string;
  footer?: React.ReactNode;
  className?: string;
  bufferText?: string;
  bufferKind?: "posicionamento" | "projeto" | "bastidor";
}) {
  return (
    <div
      className={`border border-[color:var(--divisoria)] rounded-lg bg-white p-5 flex flex-col ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[color:var(--bronze)]">
          {icon}
          <span className="font-mono text-[10px] tracking-widest">{label}</span>
        </div>
        {counter && (
          <span className="font-mono text-[10px] text-[color:var(--muted-foreground)]">
            {counter}
          </span>
        )}
      </div>
      <div className="text-sm text-[color:var(--graphite)] flex-1 leading-relaxed">
        {children}
      </div>
      {footer && <div className="mt-3 text-xs">{footer}</div>}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[color:var(--divisoria)]">
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-1.5 text-xs text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors"
        >
          <Copy className="h-3 w-3" /> Copiar
        </button>
        {bufferText && (
          <AgendarButton
            text={bufferText}
            variant="chip"
            origem="kit-publicacao"
            kind={bufferKind}
            label="Agendar publicação"
          />
        )}
      </div>
    </div>
  );
}
