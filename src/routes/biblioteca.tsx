import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabaseExternal";
import { PageHeader } from "@/components/page-header";
import { analisarImagem, regenerarConteudos } from "@/lib/biblioteca.functions";
import {
  gerarAntesDepois,
  regenerarAntesDepois,
  gerarNarrativaProjeto,
} from "@/lib/antes-depois.functions";
import { signBibliotecaUrls } from "@/components/biblioteca-picker";
import { BibliotecaPicker, type BibliotecaImagemLite } from "@/components/biblioteca-picker";
import { AgendarButton } from "@/components/agendar-modal";
import {
  X,
  Upload,
  Image as ImageIcon,
  Loader2,
  Copy,
  RotateCcw,
  Folder,
  Plus,
  Search,
  Archive,
  Sparkles,
  ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";

type Search = { tab?: string; projeto?: string };

export const Route = createFileRoute("/biblioteca")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
    projeto: typeof s.projeto === "string" ? s.projeto : undefined,
  }),
  component: BibliotecaPage,
});

const AMBIENTES = [
  "Fachada",
  "Sala de estar",
  "Cozinha",
  "Quarto",
  "Banheiro",
  "Área gourmet",
  "Escritório",
  "Fachada comercial",
  "Outro",
];

const LINHAS = [
  { value: "A", label: "Linha A — Residencial" },
  { value: "B", label: "Linha B — Corporativo" },
  { value: "AB", label: "Linha A+B" },
  { value: "C", label: "Linha C — Consultoria" },
];

function BibliotecaPage() {
  const search = Route.useSearch();
  const [tab, setTab] = useState<"biblioteca" | "adicionar" | "antes_depois" | "projetos">(
    (search.tab as any) ?? "biblioteca",
  );

  return (
    <>
      <PageHeader
        eyebrow="Biblioteca Visual"
        title="Repositório de projetos"
        description="Imagens tagueadas por IA e transformadas em conteúdo pronto para todos os canais."
      />

      <div className="px-4 md:px-10 py-6">
        <div className="flex gap-1 border-b border-[color:var(--divisoria)] mb-6">
          {[
            { k: "biblioteca", label: "Biblioteca" },
            { k: "adicionar", label: "Adicionar" },
            { k: "antes_depois", label: "Antes e Depois" },
            { k: "projetos", label: "Projetos" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as any)}
              className={`px-4 py-2.5 text-xs font-mono tracking-widest uppercase border-b-2 -mb-px transition-colors ${
                tab === t.k
                  ? "border-[color:var(--bronze)] text-[color:var(--graphite)]"
                  : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--graphite)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "biblioteca" && <AbaBiblioteca projetoInicial={search.projeto} />}
        {tab === "adicionar" && <AbaAdicionar onDone={() => setTab("biblioteca")} />}
        {tab === "antes_depois" && <AbaAntesDepois />}
        {tab === "projetos" && <AbaProjetos onVer={() => setTab("biblioteca")} />}
      </div>
    </>
  );
}

// ============================================================
// ABA 1 — BIBLIOTECA
// ============================================================
function AbaBiblioteca({ projetoInicial }: { projetoInicial?: string }) {
  const [busca, setBusca] = useState("");
  const [linha, setLinha] = useState("");
  const [tipo, setTipo] = useState("");
  const [projetoId, setProjetoId] = useState(projetoInicial ?? "");
  const [selecionada, setSelecionada] = useState<any | null>(null);

  const { data: projetos } = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mkt_projetos").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: imagens } = useQuery({
    queryKey: ["biblioteca", linha, tipo, projetoId],
    queryFn: async () => {
      let q = supabase
        .from("mkt_biblioteca_imagens")
        .select("*, projeto:projetos(nome, linha)")
        .order("created_at", { ascending: false });
      if (linha) q = q.eq("linha", linha);
      if (tipo) q = q.eq("tipo", tipo);
      if (projetoId) q = q.eq("projeto_id", projetoId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const urlMap = await signBibliotecaUrls(rows.map((r) => r.url_storage));
      return rows.map((r) => ({ ...r, signed_url: urlMap[r.url_storage] }));
    },
  });

  const { data: buscaMatches } = useQuery({
    queryKey: ["biblioteca-busca", busca],
    enabled: busca.trim().length > 0,
    queryFn: async () => {
      const termo = busca.trim().toLowerCase();
      const [porTag, porDesc] = await Promise.all([
        supabase.from("mkt_biblioteca_imagens").select("id").contains("tags", [termo]),
        supabase.from("mkt_biblioteca_imagens").select("id").ilike("descricao_tecnica", `%${termo}%`),
      ]);
      const ids = new Set<string>();
      (porTag.data ?? []).forEach((r: any) => ids.add(r.id));
      (porDesc.data ?? []).forEach((r: any) => ids.add(r.id));
      return ids;
    },
  });

  const filtradas = useMemo(() => {
    const arr = imagens ?? [];
    if (!busca.trim()) return arr;
    if (!buscaMatches) return [];
    return arr.filter((i: any) => buscaMatches.has(i.id));
  }, [imagens, busca, buscaMatches]);

  const { data: topTags } = useQuery({
    queryKey: ["biblioteca-top-tags"],
    queryFn: async () => {
      const { data } = await supabase.from("mkt_biblioteca_imagens").select("tags");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        (r.tags ?? []).forEach((t: string) => {
          if (!t) return;
          const k = t.toLowerCase();
          counts[k] = (counts[k] ?? 0) + 1;
        });
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));
    },
  });

  const totalProjetos = new Set((imagens ?? []).map((i: any) => i.projeto_id).filter(Boolean)).size;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
          {imagens?.length ?? 0} IMAGENS · {totalProjetos} PROJETOS
        </div>
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por tag, ambiente, descrição…"
            className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
          />
        </div>
      </div>

      {(topTags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topTags!.map((t) => {
            const ativa = busca.trim().toLowerCase() === t.tag;
            return (
              <button
                key={t.tag}
                onClick={() => setBusca(ativa ? "" : t.tag)}
                className={`text-[10px] font-mono tracking-widest uppercase px-2 py-1 rounded-[3px] border transition-colors ${
                  ativa
                    ? "bg-[color:var(--bronze)] text-white border-[color:var(--bronze)]"
                    : "bg-[color:var(--gelo)] text-[color:var(--graphite)] border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                }`}
              >
                {t.tag}
                <span className="ml-1 opacity-60">{t.count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <FilterSel value={linha} onChange={setLinha} label="Linha">
          <option value="">Todas</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="AB">A+B</option>
          <option value="C">C</option>
        </FilterSel>
        <FilterSel value={tipo} onChange={setTipo} label="Tipo">
          <option value="">Todos</option>
          <option value="foto_real">Foto real</option>
          <option value="render">Render</option>
        </FilterSel>
        <FilterSel value={projetoId} onChange={setProjetoId} label="Projeto">
          <option value="">Todos</option>
          {(projetos ?? []).map((p: any) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </FilterSel>
      </div>

      {filtradas.length === 0 ? (
        <div className="border border-dashed border-[color:var(--divisoria)] rounded-lg p-10 text-center">
          <ImageIcon className="h-8 w-8 mx-auto mb-3 text-[color:var(--muted-foreground)]" />
          <p className="text-[color:var(--muted-foreground)]">
            Nenhuma imagem encontrada. Comece pela aba <b>Adicionar</b>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtradas.map((img: any) => (
            <CardImagem key={img.id} img={img} onClick={() => setSelecionada(img)} />
          ))}
        </div>
      )}

      {selecionada && (
        <DrawerDetalhes imagem={selecionada} onClose={() => setSelecionada(null)} />
      )}
    </div>
  );
}

const CANAIS = [
  { k: "feed", l: "Feed" },
  { k: "stories", l: "Stories" },
  { k: "reels", l: "Reels" },
  { k: "carrossel", l: "Carrossel" },
  { k: "blog", l: "Blog" },
  { k: "email", l: "E-mail" },
] as const;

function contarCanaisPublicados(status: any): number {
  if (!status || typeof status !== "object") return 0;
  return CANAIS.reduce((n, c) => (status[c.k] ? n + 1 : n), 0);
}

function CardImagem({ img, onClick }: { img: any; onClick: () => void }) {
  const tagsVisiveis = (img.tags ?? []).slice(0, 4);
  const restantes = (img.tags?.length ?? 0) - tagsVisiveis.length;
  const publicados = contarCanaisPublicados(img.status_canais);

  return (
    <button
      onClick={onClick}
      className="text-left border border-[color:var(--divisoria)] rounded-lg overflow-hidden bg-white hover:border-[color:var(--bronze)] transition-colors group"
    >
      <div className="aspect-[4/3] bg-[color:var(--gelo)] relative">
        {img.signed_url ? (
          <img src={img.signed_url} alt={img.nome_arquivo} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[color:var(--muted-foreground)]">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-[3px] text-[10px] font-mono tracking-widest bg-white/95 text-[color:var(--graphite)]">
          LINHA {img.linha}
        </span>
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-[3px] text-[10px] font-mono tracking-widest bg-[color:var(--graphite)]/85 text-white">
          {img.tipo === "foto_real" ? "FOTO REAL" : "RENDER"}
        </span>
        <span
          className={`absolute bottom-2 right-2 px-2 py-0.5 rounded-[3px] text-[9px] font-mono tracking-widest ${
            publicados === 0
              ? "bg-white/90 text-[color:var(--muted-foreground)]"
              : publicados === CANAIS.length
              ? "bg-green-600 text-white"
              : "bg-[color:var(--bronze)] text-white"
          }`}
          title={`${publicados} canais publicados`}
        >
          {publicados}/{CANAIS.length}
        </span>
      </div>
      <div className="px-3 py-3">
        <div className="text-sm text-[color:var(--graphite)] font-serif line-clamp-1">
          {img.projeto?.nome ?? img.nome_arquivo}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {tagsVisiveis.map((t: string) => (
            <span
              key={t}
              className="text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded-[2px] bg-[color:var(--bege)] text-[color:var(--bronze)]"
            >
              {t}
            </span>
          ))}
          {restantes > 0 && (
            <span className="text-[9px] font-mono tracking-widest text-[color:var(--muted-foreground)]">
              +{restantes}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function DrawerDetalhes({ imagem, onClose }: { imagem: any; onClose: () => void }) {
  const qc = useQueryClient();
  const regen = useServerFn(regenerarConteudos);
  const [conteudoTab, setConteudoTab] = useState<
    "feed" | "stories" | "reels" | "roteiro" | "carrossel" | "blog" | "email"
  >("feed");

  const regenMut = useMutation({
    mutationFn: async () => regen({ data: { id: imagem.id } }),
    onSuccess: () => {
      toast.success("Conteúdos regenerados.");
      qc.invalidateQueries({ queryKey: ["biblioteca"] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao regenerar"),
  });

  const copies = imagem.copies ?? {};
  const conteudos = imagem.conteudos_gerados ?? {};

  const textoAtual = (() => {
    switch (conteudoTab) {
      case "feed": return copies.feed ?? "";
      case "stories": return copies.stories ?? "";
      case "reels": return copies.reels ?? "";
      case "email": return copies.email ?? "";
      case "roteiro": return conteudos.roteiro_reels ?? "";
      case "carrossel": return conteudos.pauta_carrossel ?? "";
      case "blog": return conteudos.texto_blog ?? "";
    }
  })();

  const copiar = () => {
    navigator.clipboard.writeText(textoAtual).then(
      () => toast.success("Texto copiado."),
      () => toast.error("Não foi possível copiar."),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full md:w-[640px] bg-white h-full overflow-y-auto border-l border-[color:var(--divisoria)]">
        <div className="sticky top-0 bg-white z-10 border-b border-[color:var(--divisoria)] px-5 py-3 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
              {imagem.tipo === "foto_real" ? "FOTO REAL" : "RENDER"} · LINHA {imagem.linha}
            </div>
            <div className="font-serif text-lg mt-0.5">
              {imagem.projeto?.nome ?? imagem.nome_arquivo}
            </div>
          </div>
          <button onClick={onClose} className="p-1"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="aspect-video bg-[color:var(--gelo)] rounded-lg overflow-hidden">
            {imagem.signed_url ? (
              <img src={imagem.signed_url} alt={imagem.nome_arquivo} className="w-full h-full object-cover" />
            ) : null}
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">
              DESCRIÇÃO TÉCNICA
            </div>
            <p className="text-sm text-[color:var(--graphite)] leading-relaxed">
              {imagem.descricao_tecnica ?? "—"}
            </p>
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
              TAGS
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(imagem.tags ?? []).map((t: string) => (
                <span key={t} className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-[3px] bg-[color:var(--bege)] text-[color:var(--bronze)]">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
              CONTEÚDOS DISPONÍVEIS
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {[
                { k: "feed", l: "Feed" },
                { k: "stories", l: "Stories" },
                { k: "reels", l: "Reels" },
                { k: "roteiro", l: "Roteiro" },
                { k: "carrossel", l: "Carrossel" },
                { k: "blog", l: "Blog" },
                { k: "email", l: "E-mail" },
              ].map((t) => (
                <button
                  key={t.k}
                  onClick={() => setConteudoTab(t.k as any)}
                  className={`px-2.5 py-1 text-[10px] font-mono tracking-widest uppercase rounded-[3px] border transition-colors ${
                    conteudoTab === t.k
                      ? "bg-[color:var(--graphite)] text-white border-[color:var(--graphite)]"
                      : "bg-white text-[color:var(--graphite)] border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                  }`}
                >
                  {t.l}
                </button>
              ))}
            </div>
            <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-4 text-sm whitespace-pre-wrap min-h-[100px] leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
              {textoAtual || "—"}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button onClick={copiar} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[4px] border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]">
                <Copy className="h-3 w-3" /> Copiar
              </button>
              {textoAtual && (
                <AgendarButton
                  text={textoAtual}
                  variant="chip"
                  origem={`biblioteca:${conteudoTab}`}
                  kind={conteudoTab === "reels" || conteudoTab === "roteiro" ? "projeto" : conteudoTab === "stories" ? "bastidor" : "posicionamento"}
                  label="Agendar publicação"
                />
              )}
            </div>
          </div>

          {conteudos.sugestoes_valorizacao && conteudos.sugestoes_valorizacao.length > 0 && (
            <div>
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
                SUGESTÕES DE VALORIZAÇÃO
              </div>
              <ul className="space-y-1.5 text-sm">
                {conteudos.sugestoes_valorizacao.map((s: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[color:var(--bronze)]">·</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <StatusCanaisPanel
            tabela="biblioteca_imagens"
            id={imagem.id}
            status={imagem.status_canais}
            queryKey={["biblioteca"]}
          />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => regenMut.mutate()}
              disabled={regenMut.isPending}
              className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2 text-xs hover:border-[color:var(--bronze)]"
            >
              {regenMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Regenerar conteúdos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ABA 2 — ADICIONAR
// ============================================================
function AbaAdicionar({ onDone }: { onDone: () => void }) {
  const [modo, setModo] = useState<"individual" | "lote">("individual");
  return (
    <div className="space-y-5">
      <div className="flex gap-1">
        {[
          { k: "individual", l: "Individual" },
          { k: "lote", l: "Lote" },
        ].map((m) => (
          <button
            key={m.k}
            onClick={() => setModo(m.k as any)}
            className={`px-3 py-1.5 text-[10px] font-mono tracking-widest uppercase rounded-[3px] border transition-colors ${
              modo === m.k
                ? "bg-[color:var(--graphite)] text-white border-[color:var(--graphite)]"
                : "bg-white text-[color:var(--graphite)] border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
            }`}
          >
            {m.l}
          </button>
        ))}
      </div>

      {modo === "individual" ? <UploadIndividual onDone={onDone} /> : <UploadLote onDone={onDone} />}
    </div>
  );
}

function useProjetos() {
  return useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mkt_projetos").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

async function fileToBase64(file: File): Promise<{ base64: string; media_type: string }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
  }
  return { base64: btoa(binary), media_type: file.type || "image/jpeg" };
}

async function uploadParaStorage(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("mkt-biblioteca-visual")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw new Error(`Falha no upload: ${error.message}`);
  return path;
}

function UploadIndividual({ onDone }: { onDone: () => void }) {
  const analisar = useServerFn(analisarImagem);
  const qc = useQueryClient();
  const { data: projetos } = useProjetos();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [projetoId, setProjetoId] = useState<string>("");
  const [tipo, setTipo] = useState<"foto_real" | "render">("foto_real");
  const [linha, setLinha] = useState("A");
  const [ambiente, setAmbiente] = useState("Fachada");
  const [novoModal, setNovoModal] = useState(false);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione uma imagem");
      const path = await uploadParaStorage(file);
      const { base64, media_type } = await fileToBase64(file);
      return analisar({
        data: {
          base64,
          media_type,
          nome_arquivo: file.name,
          url_storage: path,
          tipo,
          linha,
          ambiente,
          projeto_id: projetoId || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Imagem analisada e salva.");
      qc.invalidateQueries({ queryKey: ["biblioteca"] });
      qc.invalidateQueries({ queryKey: ["projetos"] });
      onDone();
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao analisar"),
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <DropZone file={file} previewUrl={previewUrl} onFile={setFile} multiple={false} />

      <Field label="Projeto">
        <div className="flex gap-2">
          <select
            value={projetoId}
            onChange={(e) => setProjetoId(e.target.value)}
            className="flex-1 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm"
          >
            <option value="">— Sem projeto —</option>
            {(projetos ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.nome} (L.{p.linha})</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setNovoModal(true)}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-[4px] border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
          >
            <Plus className="h-3.5 w-3.5" /> Novo
          </button>
        </div>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm">
            <option value="foto_real">Foto real</option>
            <option value="render">Render</option>
          </select>
        </Field>
        <Field label="Linha">
          <select value={linha} onChange={(e) => setLinha(e.target.value)} className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm">
            {LINHAS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>
        <Field label="Ambiente">
          <select value={ambiente} onChange={(e) => setAmbiente(e.target.value)} className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm">
            {AMBIENTES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
      </div>

      <button
        onClick={() => mut.mutate()}
        disabled={!file || mut.isPending}
        className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-5 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40"
      >
        {mut.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Analisando…</>
        ) : (
          <>Analisar e salvar</>
        )}
      </button>

      {novoModal && <ProjetoModal onClose={() => setNovoModal(false)} onCreated={(p) => { setProjetoId(p.id); setNovoModal(false); }} />}
    </div>
  );
}

function UploadLote({ onDone }: { onDone: () => void }) {
  const analisar = useServerFn(analisarImagem);
  const qc = useQueryClient();
  const { data: projetos } = useProjetos();
  const [files, setFiles] = useState<File[]>([]);
  const [projetoId, setProjetoId] = useState("");
  const [tipo, setTipo] = useState<"foto_real" | "render">("foto_real");
  const [linha, setLinha] = useState("A");
  const [ambiente, setAmbiente] = useState("Fachada");
  const [progresso, setProgresso] = useState<{ i: number; total: number } | null>(null);
  const [novoModal, setNovoModal] = useState(false);

  const addFiles = (list: FileList | File[]) => {
    const arr = Array.from(list).slice(0, 20 - files.length);
    setFiles((prev) => [...prev, ...arr].slice(0, 20));
  };

  const remover = (i: number) => setFiles((f) => f.filter((_, idx) => idx !== i));

  const rodar = async () => {
    if (files.length === 0) return;
    setProgresso({ i: 0, total: files.length });
    try {
      for (let i = 0; i < files.length; i++) {
        setProgresso({ i: i + 1, total: files.length });
        const f = files[i];
        const path = await uploadParaStorage(f);
        const { base64, media_type } = await fileToBase64(f);
        await analisar({
          data: {
            base64,
            media_type,
            nome_arquivo: f.name,
            url_storage: path,
            tipo,
            linha,
            ambiente,
            projeto_id: projetoId || null,
          },
        });
      }
      toast.success(`${files.length} imagens analisadas.`);
      qc.invalidateQueries({ queryKey: ["biblioteca"] });
      qc.invalidateQueries({ queryKey: ["projetos"] });
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro no lote");
    } finally {
      setProgresso(null);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <Field label="Projeto">
            <div className="flex gap-2">
              <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)} className="flex-1 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm">
                <option value="">— Sem projeto —</option>
                {(projetos ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              <button type="button" onClick={() => setNovoModal(true)} className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-[4px] border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]">
                <Plus className="h-3.5 w-3.5" /> Novo
              </button>
            </div>
          </Field>
        </div>
        <Field label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm">
            <option value="foto_real">Foto real</option>
            <option value="render">Render</option>
          </select>
        </Field>
        <Field label="Linha">
          <select value={linha} onChange={(e) => setLinha(e.target.value)} className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm">
            {LINHAS.map((l) => <option key={l.value} value={l.value}>{l.value}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Ambiente (aplicado a todas)">
        <select value={ambiente} onChange={(e) => setAmbiente(e.target.value)} className="w-full max-w-xs rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm">
          {AMBIENTES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </Field>

      <DropZone multiple onFiles={addFiles} disabled={files.length >= 20} />

      {files.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative aspect-square border border-[color:var(--divisoria)] rounded-[4px] overflow-hidden bg-[color:var(--gelo)]">
              <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
              <button
                onClick={() => remover(i)}
                className="absolute top-1 right-1 bg-white/95 rounded-full p-0.5 text-[color:var(--graphite)] hover:text-red-600"
                disabled={!!progresso}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {progresso && (
        <div>
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">
            ANALISANDO IMAGEM {progresso.i} DE {progresso.total}…
          </div>
          <div className="h-1.5 bg-[color:var(--divisoria)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[color:var(--bronze)] transition-all"
              style={{ width: `${(progresso.i / progresso.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={rodar}
        disabled={files.length === 0 || !!progresso}
        className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-5 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40"
      >
        {progresso ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Processando…</>
        ) : (
          <>Analisar e salvar todas ({files.length})</>
        )}
      </button>

      {novoModal && <ProjetoModal onClose={() => setNovoModal(false)} onCreated={(p) => { setProjetoId(p.id); setNovoModal(false); }} />}
    </div>
  );
}

function DropZone({
  file,
  previewUrl,
  onFile,
  onFiles,
  multiple,
  disabled,
}: {
  file?: File | null;
  previewUrl?: string | null;
  onFile?: (f: File) => void;
  onFiles?: (fs: FileList | File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list || list.length === 0 || disabled) return;
    if (multiple && onFiles) onFiles(list);
    else if (onFile) onFile(list[0]);
  };

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
      className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        drag ? "border-[color:var(--bronze)] bg-[color:var(--bege)]" : "border-[color:var(--divisoria)] bg-[color:var(--gelo)] hover:border-[color:var(--bronze)]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(e) => handle(e.target.files)}
      />
      {previewUrl && file ? (
        <div className="flex flex-col items-center gap-2">
          <img src={previewUrl} alt="preview" className="max-h-48 rounded" />
          <div className="text-xs text-[color:var(--muted-foreground)]">{file.name}</div>
          <div className="text-[10px] font-mono tracking-widest text-[color:var(--bronze)]">TROCAR IMAGEM</div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-[color:var(--muted-foreground)]">
          <Upload className="h-6 w-6" />
          <div className="text-sm">
            {multiple ? "Arraste imagens ou clique para selecionar (até 20)" : "Arraste uma imagem ou clique para selecionar"}
          </div>
        </div>
      )}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2 uppercase">
        {label}
      </div>
      {children}
    </label>
  );
}

function FilterSel({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-widest text-[color:var(--bronze)] mb-1 uppercase">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-1.5 text-sm"
      >
        {children}
      </select>
    </div>
  );
}

// ============================================================
// ABA 3 — PROJETOS
// ============================================================
function AbaProjetos({ onVer }: { onVer: () => void }) {
  const qc = useQueryClient();
  const [novoModal, setNovoModal] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [narrativaProj, setNarrativaProj] = useState<any | null>(null);

  const { data: projetos } = useQuery({
    queryKey: ["projetos-detalhe"],
    queryFn: async () => {
      const { data: ps } = await supabase.from("mkt_projetos").select("*").order("nome");
      const { data: imgs } = await supabase.from("mkt_biblioteca_imagens").select("projeto_id");
      const counts = new Map<string, number>();
      (imgs ?? []).forEach((i: any) => {
        if (!i.projeto_id) return;
        counts.set(i.projeto_id, (counts.get(i.projeto_id) ?? 0) + 1);
      });
      return (ps ?? []).map((p: any) => ({ ...p, count: counts.get(p.id) ?? 0 }));
    },
  });

  const arquivar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mkt_projetos").update({ status: "arquivado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto arquivado.");
      qc.invalidateQueries({ queryKey: ["projetos-detalhe"] });
      qc.invalidateQueries({ queryKey: ["projetos"] });
    },
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
          {projetos?.length ?? 0} PROJETOS
        </div>
        <button
          onClick={() => setNovoModal(true)}
          className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo projeto
        </button>
      </div>

      {(projetos?.length ?? 0) === 0 ? (
        <div className="border border-dashed border-[color:var(--divisoria)] rounded-lg p-10 text-center">
          <Folder className="h-8 w-8 mx-auto mb-2 text-[color:var(--muted-foreground)]" />
          <p className="text-[color:var(--muted-foreground)]">Ainda sem projetos.</p>
        </div>
      ) : (
        <div className="border border-[color:var(--divisoria)] rounded-lg bg-white overflow-hidden">
          {(projetos ?? []).map((p: any) => (
            <div key={p.id} className={`flex items-center justify-between px-4 py-3 border-b border-[color:var(--divisoria)] last:border-b-0 ${p.status === "arquivado" ? "opacity-50" : ""}`}>
              <div className="min-w-0">
                <div className="font-serif text-base text-[color:var(--graphite)] truncate">{p.nome}</div>
                <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase mt-0.5">
                  Linha {p.linha} · {p.count} imagens {p.status === "arquivado" && "· ARQUIVADO"}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onVer()}
                  className="text-xs px-3 py-1.5 rounded-[4px] border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                >
                  Ver imagens
                </button>
                <button
                  onClick={() => setEditando(p)}
                  className="text-xs px-3 py-1.5 rounded-[4px] border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                >
                  Editar
                </button>
                <button
                  onClick={() => setNarrativaProj(p)}
                  className="text-xs px-3 py-1.5 rounded-[4px] border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)] inline-flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Narrativa
                </button>
                {p.status !== "arquivado" && (
                  <button
                    onClick={() => arquivar.mutate(p.id)}
                    className="text-xs px-3 py-1.5 rounded-[4px] border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)] inline-flex items-center gap-1"
                  >
                    <Archive className="h-3 w-3" /> Arquivar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {novoModal && <ProjetoModal onClose={() => setNovoModal(false)} onCreated={() => setNovoModal(false)} />}
      {editando && <ProjetoModal projeto={editando} onClose={() => setEditando(null)} onCreated={() => setEditando(null)} />}
      {narrativaProj && (
        <NarrativaProjetoDrawer projeto={narrativaProj} onClose={() => setNarrativaProj(null)} />
      )}
    </div>
  );
}

function ProjetoModal({
  projeto,
  onClose,
  onCreated,
}: {
  projeto?: any;
  onClose: () => void;
  onCreated: (p: any) => void;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(projeto?.nome ?? "");
  const [linha, setLinha] = useState(projeto?.linha ?? "A");
  const [descricao, setDescricao] = useState(projeto?.descricao ?? "");

  const salvar = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Nome obrigatório");
      if (projeto) {
        const { data, error } = await supabase
          .from("mkt_projetos")
          .update({ nome, linha, descricao: descricao || null })
          .eq("id", projeto.id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("mkt_projetos")
          .insert({ nome, linha, descricao: descricao || null })
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["projetos-detalhe"] });
      toast.success(projeto ? "Projeto atualizado." : "Projeto criado.");
      onCreated(data);
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[color:var(--divisoria)] flex items-center justify-between">
          <div className="font-serif text-lg">{projeto ? "Editar projeto" : "Novo projeto"}</div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
            />
          </Field>
          <Field label="Linha de negócio">
            <select
              value={linha}
              onChange={(e) => setLinha(e.target.value)}
              className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm"
            >
              {LINHAS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </Field>
          <Field label="Descrição">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
            />
          </Field>
          <button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}
            className="w-full rounded-[4px] bg-[color:var(--graphite)] px-4 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40"
          >
            {salvar.isPending ? "Salvando…" : projeto ? "Salvar alterações" : "Criar projeto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STATUS DE PUBLICAÇÃO POR CANAL
// ============================================================
function StatusCanaisPanel({
  tabela,
  id,
  status,
  queryKey,
}: {
  tabela: "biblioteca_imagens" | "antes_depois";
  id: string;
  status: any;
  queryKey: string[];
}) {
  const qc = useQueryClient();
  const atual = useMemo(() => {
    const base: Record<string, boolean> = {};
    CANAIS.forEach((c) => (base[c.k] = !!status?.[c.k]));
    return base;
  }, [status]);

  const toggle = useMutation({
    mutationFn: async (canal: string) => {
      const novo = { ...atual, [canal]: !atual[canal] };
      const col = tabela === "biblioteca_imagens" ? "status_canais" : "status_publicacao";
      const { error } = await supabase
        .from(tabela)
        .update({ [col]: novo as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar status"),
  });

  const publicados = CANAIS.reduce((n, c) => (atual[c.k] ? n + 1 : n), 0);

  return (
    <div className="border-t border-[color:var(--divisoria)] pt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
          STATUS DE PUBLICAÇÃO
        </div>
        <div className="text-[10px] font-mono tracking-widest text-[color:var(--muted-foreground)]">
          {publicados}/{CANAIS.length}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {CANAIS.map((c) => {
          const on = atual[c.k];
          return (
            <button
              key={c.k}
              onClick={() => toggle.mutate(c.k)}
              disabled={toggle.isPending}
              className={`px-2.5 py-1.5 text-[10px] font-mono tracking-widest uppercase rounded-[3px] border transition-colors ${
                on
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-[color:var(--graphite)] border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
              }`}
            >
              {on ? "✓ " : "○ "}
              {c.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ABA — ANTES E DEPOIS
// ============================================================
function AbaAntesDepois() {
  const [novo, setNovo] = useState(false);
  const [selecionado, setSelecionado] = useState<any | null>(null);

  const { data } = useQuery({
    queryKey: ["antes-depois"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkt_antes_depois")
        .select(
          "*, projeto:projetos(nome), antes:biblioteca_imagens!antes_depois_imagem_antes_id_fkey(id, url_storage, nome_arquivo), depois:biblioteca_imagens!antes_depois_imagem_depois_id_fkey(id, url_storage, nome_arquivo)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const paths = rows.flatMap((r) => [r.antes?.url_storage, r.depois?.url_storage].filter(Boolean));
      const map = await signBibliotecaUrls(paths);
      return rows.map((r) => ({
        ...r,
        antes_url: r.antes?.url_storage ? map[r.antes.url_storage] : null,
        depois_url: r.depois?.url_storage ? map[r.depois.url_storage] : null,
      }));
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
          {data?.length ?? 0} COMPARATIVOS
        </div>
        <button
          onClick={() => setNovo(true)}
          className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo comparativo
        </button>
      </div>

      {(data?.length ?? 0) === 0 ? (
        <div className="border border-dashed border-[color:var(--divisoria)] rounded-lg p-10 text-center">
          <ArrowLeftRight className="h-8 w-8 mx-auto mb-3 text-[color:var(--muted-foreground)]" />
          <p className="text-[color:var(--muted-foreground)]">
            Ainda sem comparativos. Crie o primeiro com duas imagens da biblioteca.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data ?? []).map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelecionado(c)}
              className="text-left border border-[color:var(--divisoria)] rounded-lg overflow-hidden bg-white hover:border-[color:var(--bronze)] transition-colors"
            >
              <div className="grid grid-cols-2 gap-px bg-[color:var(--divisoria)]">
                <div className="aspect-[4/3] bg-[color:var(--gelo)] relative">
                  {c.antes_url ? (
                    <img src={c.antes_url} alt="antes" className="w-full h-full object-cover" />
                  ) : null}
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-[2px] text-[9px] font-mono tracking-widest bg-white/90 uppercase text-[color:var(--bronze)]" style={{ fontFamily: "Courier New, monospace" }}>
                    ANTES
                  </span>
                </div>
                <div className="aspect-[4/3] bg-[color:var(--gelo)] relative">
                  {c.depois_url ? (
                    <img src={c.depois_url} alt="depois" className="w-full h-full object-cover" />
                  ) : null}
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-[2px] text-[9px] font-mono tracking-widest bg-white/90 uppercase text-[color:var(--bronze)]" style={{ fontFamily: "Courier New, monospace" }}>
                    DEPOIS
                  </span>
                </div>
              </div>
              <div className="px-3 py-3">
                <div className="font-serif text-base text-[color:var(--graphite)] line-clamp-1">{c.nome}</div>
                <div className="mt-0.5 font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase">
                  {c.projeto?.nome ?? "Sem projeto"} · Linha {c.linha}
                  {c.ambiente ? ` · ${c.ambiente}` : ""}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {CANAIS.map((canal) => {
                    const on = !!c.status_publicacao?.[canal.k];
                    return (
                      <span
                        key={canal.k}
                        className={`text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded-[2px] ${
                          on ? "bg-green-600 text-white" : "bg-[color:var(--gelo)] text-[color:var(--muted-foreground)]"
                        }`}
                      >
                        {canal.l}
                      </span>
                    );
                  })}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {novo && <NovoComparativoModal onClose={() => setNovo(false)} />}
      {selecionado && (
        <DrawerAntesDepois comparativo={selecionado} onClose={() => setSelecionado(null)} />
      )}
    </div>
  );
}

function NovoComparativoModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const gerar = useServerFn(gerarAntesDepois);
  const { data: projetos } = useProjetos();
  const [nome, setNome] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [linha, setLinha] = useState("A");
  const [ambiente, setAmbiente] = useState("Sala de estar");
  const [antesMode, setAntesMode] = useState<"upload" | "biblioteca">("upload");
  const [depoisMode, setDepoisMode] = useState<"upload" | "biblioteca">("upload");
  const [antesImg, setAntesImg] = useState<BibliotecaImagemLite | null>(null);
  const [depoisImg, setDepoisImg] = useState<BibliotecaImagemLite | null>(null);
  const [antesFile, setAntesFile] = useState<File | null>(null);
  const [depoisFile, setDepoisFile] = useState<File | null>(null);
  const [antesPreview, setAntesPreview] = useState<string | null>(null);
  const [depoisPreview, setDepoisPreview] = useState<string | null>(null);
  const [pickerAlvo, setPickerAlvo] = useState<"antes" | "depois" | null>(null);

  useEffect(() => {
    if (!antesFile) { setAntesPreview(null); return; }
    const url = URL.createObjectURL(antesFile);
    setAntesPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [antesFile]);
  useEffect(() => {
    if (!depoisFile) { setDepoisPreview(null); return; }
    const url = URL.createObjectURL(depoisFile);
    setDepoisPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [depoisFile]);

  async function pathToBase64(path: string): Promise<{ base64: string; media_type: string }> {
    const { data, error } = await supabase.storage.from("mkt-biblioteca-visual").download(path);
    if (error || !data) throw new Error("Falha ao baixar imagem da biblioteca.");
    const buf = new Uint8Array(await data.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
    }
    return { base64: btoa(binary), media_type: data.type || "image/jpeg" };
  }

  async function preparar(
    slot: "antes" | "depois",
  ): Promise<{ id: string; base64: string; media_type: string }> {
    const mode = slot === "antes" ? antesMode : depoisMode;
    if (mode === "biblioteca") {
      const img = slot === "antes" ? antesImg : depoisImg;
      if (!img) throw new Error(`Escolha a imagem ${slot} na biblioteca.`);
      const b = await pathToBase64(img.url_storage);
      return { id: img.id, base64: b.base64, media_type: b.media_type };
    }
    const file = slot === "antes" ? antesFile : depoisFile;
    if (!file) throw new Error(`Faça upload da imagem ${slot}.`);
    const path = await uploadParaStorage(file);
    const { base64, media_type } = await fileToBase64(file);
    const { data: row, error } = await supabase
      .from("mkt_biblioteca_imagens")
      .insert({
        nome_arquivo: file.name,
        url_storage: path,
        tipo: "foto_real",
        linha,
        ambiente,
        projeto_id: projetoId || null,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(`Falha ao registrar imagem ${slot}: ${error?.message ?? ""}`);
    return { id: row.id, base64, media_type };
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Dê um nome ao comparativo.");
      const a = await preparar("antes");
      const d = await preparar("depois");
      return gerar({
        data: {
          nome,
          linha,
          ambiente,
          projeto_id: projetoId || null,
          imagem_antes_id: a.id,
          imagem_depois_id: d.id,
          antes_base64: a.base64,
          antes_media_type: a.media_type,
          depois_base64: d.base64,
          depois_media_type: d.media_type,
        },
      });
    },
    onSuccess: () => {
      toast.success("Comparativo criado.");
      qc.invalidateQueries({ queryKey: ["antes-depois"] });
      qc.invalidateQueries({ queryKey: ["biblioteca"] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao gerar comparativo"),
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-lg overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[color:var(--divisoria)] flex items-center justify-between">
          <div className="font-serif text-lg">Novo comparativo</div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <Field label="Nome do comparativo">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Sala de estar — Vila Maria"
              className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Projeto">
              <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)} className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm">
                <option value="">— Sem projeto —</option>
                {(projetos ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </Field>
            <Field label="Linha">
              <select value={linha} onChange={(e) => setLinha(e.target.value)} className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm">
                {LINHAS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="Ambiente">
              <select value={ambiente} onChange={(e) => setAmbiente(e.target.value)} className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm">
                {AMBIENTES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(["antes", "depois"] as const).map((slot) => {
              const mode = slot === "antes" ? antesMode : depoisMode;
              const setMode = slot === "antes" ? setAntesMode : setDepoisMode;
              const file = slot === "antes" ? antesFile : depoisFile;
              const setFile = slot === "antes" ? setAntesFile : setDepoisFile;
              const preview = slot === "antes" ? antesPreview : depoisPreview;
              const img = slot === "antes" ? antesImg : depoisImg;
              const setImg = slot === "antes" ? setAntesImg : setDepoisImg;
              return (
                <div key={slot}>
                  <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1 uppercase" style={{ fontFamily: "Courier New, monospace" }}>
                    IMAGEM {slot}
                  </div>
                  <div className="flex gap-1 mb-2">
                    {(["upload", "biblioteca"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`flex-1 px-2 py-1 text-[10px] font-mono tracking-widest uppercase rounded-[3px] border transition-colors ${
                          mode === m
                            ? "bg-[color:var(--graphite)] text-white border-[color:var(--graphite)]"
                            : "bg-white text-[color:var(--graphite)] border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                        }`}
                      >
                        {m === "upload" ? "Upload novo" : "Da biblioteca"}
                      </button>
                    ))}
                  </div>
                  {mode === "upload" ? (
                    <label
                      className="w-full aspect-[4/3] border border-dashed border-[#D1D1D1] rounded-[4px] bg-[#F5F5F5] hover:border-[color:var(--bronze)] flex items-center justify-center overflow-hidden cursor-pointer relative"
                    >
                      {preview ? (
                        <>
                          <img src={preview} alt={slot} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setFile(null); }}
                            className="absolute top-1.5 right-1.5 bg-white/95 rounded-full p-1 border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-[color:var(--muted-foreground)] text-[12px] px-2 text-center">
                          <Upload className="h-5 w-5" />
                          <span>Arraste ou clique para fazer upload</span>
                          <span className="text-[10px]">JPG, PNG ou WebP</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setFile(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPickerAlvo(slot)}
                      className="w-full aspect-[4/3] border border-dashed border-[#D1D1D1] rounded-[4px] bg-[#F5F5F5] hover:border-[color:var(--bronze)] flex items-center justify-center overflow-hidden relative"
                    >
                      {img?.signed_url ? (
                        <>
                          <img src={img.signed_url} alt={slot} className="w-full h-full object-cover" />
                          <span
                            role="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setImg(null); }}
                            className="absolute top-1.5 right-1.5 bg-white/95 rounded-full p-1 border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                          >
                            <X className="h-3 w-3" />
                          </span>
                        </>
                      ) : (
                        <div className="text-[color:var(--muted-foreground)] text-xs">Escolher da biblioteca</div>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="w-full rounded-[4px] bg-[color:var(--graphite)] px-4 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {mut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <>Gerar conteúdos de transformação</>}
          </button>
        </div>

        <BibliotecaPicker
          open={pickerAlvo !== null}
          onClose={() => setPickerAlvo(null)}
          onSelect={(img) => {
            if (pickerAlvo === "antes") setAntesImg(img);
            if (pickerAlvo === "depois") setDepoisImg(img);
            setPickerAlvo(null);
          }}
        />
      </div>
    </div>
  );
}

function DrawerAntesDepois({ comparativo, onClose }: { comparativo: any; onClose: () => void }) {
  const qc = useQueryClient();
  const regen = useServerFn(regenerarAntesDepois);
  const [aba, setAba] = useState<
    "feed" | "stories" | "reels" | "roteiro_reels" | "carrossel" | "blog" | "email"
  >("feed");

  const regenMut = useMutation({
    mutationFn: async () => regen({ data: { id: comparativo.id } }),
    onSuccess: () => {
      toast.success("Conteúdos regenerados.");
      qc.invalidateQueries({ queryKey: ["antes-depois"] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao regenerar"),
  });

  const conteudos = comparativo.conteudos ?? {};
  const textoAtual = conteudos[aba] ?? "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full md:w-[720px] bg-white h-full overflow-y-auto border-l border-[color:var(--divisoria)]">
        <div className="sticky top-0 bg-white z-10 border-b border-[color:var(--divisoria)] px-5 py-3 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
              ANTES E DEPOIS · LINHA {comparativo.linha}
            </div>
            <div className="font-serif text-lg mt-0.5">{comparativo.nome}</div>
          </div>
          <button onClick={onClose} className="p-1"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { url: comparativo.antes_url, label: "ANTES" },
              { url: comparativo.depois_url, label: "DEPOIS" },
            ].map((slot) => (
              <div key={slot.label} className="relative aspect-[4/3] bg-[color:var(--gelo)] rounded-lg overflow-hidden">
                {slot.url ? <img src={slot.url} alt={slot.label} className="w-full h-full object-cover" /> : null}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-[3px] text-[10px] tracking-widest bg-white/95 uppercase text-[color:var(--bronze)]" style={{ fontFamily: "Courier New, monospace" }}>
                  {slot.label}
                </span>
              </div>
            ))}
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">
              DESCRIÇÃO DA TRANSFORMAÇÃO
            </div>
            <p className="text-sm text-[color:var(--graphite)] leading-relaxed">
              {comparativo.descricao_transformacao ?? "—"}
            </p>
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
              CONTEÚDOS
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {[
                { k: "feed", l: "Feed" },
                { k: "stories", l: "Stories" },
                { k: "reels", l: "Reels" },
                { k: "roteiro_reels", l: "Roteiro" },
                { k: "carrossel", l: "Carrossel" },
                { k: "blog", l: "Blog" },
                { k: "email", l: "E-mail" },
              ].map((t) => (
                <button
                  key={t.k}
                  onClick={() => setAba(t.k as any)}
                  className={`px-2.5 py-1 text-[10px] font-mono tracking-widest uppercase rounded-[3px] border transition-colors ${
                    aba === t.k
                      ? "bg-[color:var(--graphite)] text-white border-[color:var(--graphite)]"
                      : "bg-white text-[color:var(--graphite)] border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                  }`}
                >
                  {t.l}
                </button>
              ))}
            </div>
            <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-4 text-sm whitespace-pre-wrap min-h-[120px] leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
              {textoAtual || "—"}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(textoAtual).then(
                    () => toast.success("Texto copiado."),
                    () => toast.error("Não foi possível copiar."),
                  );
                }}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[4px] border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
              >
                <Copy className="h-3 w-3" /> Copiar
              </button>
            </div>
          </div>

          <StatusCanaisPanel
            tabela="antes_depois"
            id={comparativo.id}
            status={comparativo.status_publicacao}
            queryKey={["antes-depois"]}
          />

          <div>
            <button
              onClick={() => regenMut.mutate()}
              disabled={regenMut.isPending}
              className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2 text-xs hover:border-[color:var(--bronze)]"
            >
              {regenMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Regenerar conteúdos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ============================================================
// NARRATIVA DO PROJETO
// ============================================================
function NarrativaProjetoDrawer({ projeto, onClose }: { projeto: any; onClose: () => void }) {
  const gerar = useServerFn(gerarNarrativaProjeto);
  const [narrativa, setNarrativa] = useState<any | null>(null);
  const [imagens, setImagens] = useState<any[]>([]);
  const [aba, setAba] = useState<
    "partido" | "sequencia" | "caso" | "carrossel" | "reels" | "site" | "email"
  >("partido");

  const { data: contagem } = useQuery({
    queryKey: ["projeto-count", projeto.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("mkt_biblioteca_imagens")
        .select("id", { count: "exact", head: true })
        .eq("projeto_id", projeto.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const mut = useMutation({
    mutationFn: async () => gerar({ data: { projeto_id: projeto.id } }),
    onSuccess: (res: any) => {
      setNarrativa(res.narrativa);
      setImagens(res.imagens ?? []);
      toast.success("Narrativa gerada.");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao gerar narrativa"),
  });

  const insuficiente = (contagem ?? 0) < 3;

  const textoAba = (() => {
    if (!narrativa) return "";
    switch (aba) {
      case "partido": return narrativa.partido_central ?? "";
      case "carrossel": return narrativa.conteudos?.carrossel_projeto ?? "";
      case "reels": return narrativa.conteudos?.roteiro_reels_90s ?? "";
      case "site": return narrativa.conteudos?.texto_site ?? "";
      case "email": return narrativa.conteudos?.email_apresentacao ?? "";
      default: return "";
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full md:w-[760px] bg-white h-full overflow-y-auto border-l border-[color:var(--divisoria)]">
        <div className="sticky top-0 bg-white z-10 border-b border-[color:var(--divisoria)] px-5 py-3 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
              NARRATIVA DO PROJETO · LINHA {projeto.linha}
            </div>
            <div className="font-serif text-lg mt-0.5">{projeto.nome}</div>
          </div>
          <button onClick={onClose} className="p-1"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="font-mono text-[10px] tracking-widest text-[color:var(--muted-foreground)]">
            {contagem ?? 0} imagens catalogadas
          </div>

          {!narrativa && (
            <div className="border border-dashed border-[color:var(--divisoria)] rounded-lg p-6 text-center">
              {insuficiente ? (
                <div className="text-sm text-[color:var(--muted-foreground)]">
                  O projeto precisa ter pelo menos <b>3 imagens catalogadas</b> para gerar a narrativa.
                </div>
              ) : (
                <button
                  onClick={() => mut.mutate()}
                  disabled={mut.isPending}
                  className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-5 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40"
                >
                  {mut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <><Sparkles className="h-4 w-4" /> Gerar narrativa completa do projeto</>}
                </button>
              )}
            </div>
          )}

          {narrativa && (
            <>
              <div>
                <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">
                  TÍTULO EDITORIAL
                </div>
                <div className="font-serif text-2xl text-[color:var(--graphite)]">
                  {narrativa.titulo_projeto}
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {[
                  { k: "partido", l: "Partido" },
                  { k: "sequencia", l: "Sequência" },
                  { k: "caso", l: "Estudo de caso" },
                  { k: "carrossel", l: "Carrossel" },
                  { k: "reels", l: "Reels 90s" },
                  { k: "site", l: "Texto site" },
                  { k: "email", l: "E-mail" },
                ].map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setAba(t.k as any)}
                    className={`px-2.5 py-1 text-[10px] font-mono tracking-widest uppercase rounded-[3px] border transition-colors ${
                      aba === t.k
                        ? "bg-[color:var(--graphite)] text-white border-[color:var(--graphite)]"
                        : "bg-white text-[color:var(--graphite)] border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                    }`}
                  >
                    {t.l}
                  </button>
                ))}
              </div>

              {aba === "sequencia" ? (
                <div className="space-y-4">
                  {(narrativa.sequencia_narrativa ?? []).map((s: any, i: number) => {
                    const img = imagens.find((im) => (im.ambiente ?? "").toLowerCase() === (s.imagem_ambiente ?? "").toLowerCase());
                    return (
                      <div key={i} className="border border-[color:var(--divisoria)] rounded-lg p-4 bg-white">
                        <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] uppercase mb-1">
                          {String(i + 1).padStart(2, "0")} · {s.imagem_ambiente}
                        </div>
                        <div className="font-serif text-lg text-[color:var(--graphite)] mb-1">{s.titulo}</div>
                        <p className="text-sm text-[color:var(--graphite)] leading-relaxed">{s.texto}</p>
                        {img && (
                          <div className="mt-2 text-[10px] font-mono tracking-widest text-[color:var(--muted-foreground)]">
                            Imagem: {(img.tags ?? []).slice(0, 3).join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : aba === "caso" ? (
                <div className="space-y-3 text-sm">
                  <Bloco label="Problema" texto={narrativa.estudo_de_caso?.problema} />
                  <Bloco label="Partido" texto={narrativa.estudo_de_caso?.partido} />
                  <div>
                    <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1">SOLUÇÕES</div>
                    <ul className="space-y-1.5">
                      {(narrativa.estudo_de_caso?.solucoes ?? []).map((s: string, i: number) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-[color:var(--bronze)]">·</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Bloco label="Resultado" texto={narrativa.estudo_de_caso?.resultado} />
                </div>
              ) : (
                <div className="border border-[color:var(--divisoria)] rounded-lg bg-white p-4 text-sm whitespace-pre-wrap min-h-[120px] leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
                  {textoAba || "—"}
                </div>
              )}

              {aba !== "sequencia" && aba !== "caso" && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(textoAba).then(
                      () => toast.success("Texto copiado."),
                      () => toast.error("Não foi possível copiar."),
                    );
                  }}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[4px] border border-[color:var(--divisoria)] hover:border-[color:var(--bronze)]"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </button>
              )}

              <button
                onClick={() => mut.mutate()}
                disabled={mut.isPending}
                className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2 text-xs hover:border-[color:var(--bronze)] disabled:opacity-40"
              >
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Regenerar narrativa
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Bloco({ label, texto }: { label: string; texto?: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-1 uppercase">{label}</div>
      <p className="text-sm text-[color:var(--graphite)] leading-relaxed">{texto ?? "—"}</p>
    </div>
  );
}
