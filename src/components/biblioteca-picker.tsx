import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseExternal";
import { X, Image as ImageIcon, Loader2 } from "lucide-react";

export type BibliotecaImagemLite = {
  id: string;
  nome_arquivo: string;
  url_storage: string;
  tipo: string;
  linha: string;
  ambiente: string | null;
  tags: string[];
  descricao_tecnica: string | null;
  signed_url?: string;
  projeto?: { nome: string } | null;
};

export async function signBibliotecaUrls(paths: string[]) {
  if (paths.length === 0) return {} as Record<string, string>;
  const { data, error } = await supabase.storage
    .from("mkt-biblioteca-visual")
    .createSignedUrls(paths, 3600);
  if (error) return {} as Record<string, string>;
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

export function BibliotecaPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (img: BibliotecaImagemLite) => void;
}) {
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["biblioteca-picker", filtroLinha, filtroTipo],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("mkt_biblioteca_imagens")
        .select("*, projeto:projetos(nome)")
        .order("created_at", { ascending: false })
        .limit(60);
      if (filtroLinha) q = q.eq("linha", filtroLinha);
      if (filtroTipo) q = q.eq("tipo", filtroTipo);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const map = await signBibliotecaUrls(rows.map((r) => r.url_storage));
      return rows.map((r) => ({ ...r, signed_url: map[r.url_storage] })) as BibliotecaImagemLite[];
    },
  });

  const filtradas = useMemo(() => {
    const arr = data ?? [];
    if (!busca.trim()) return arr;
    const b = busca.toLowerCase();
    return arr.filter(
      (i) =>
        i.tags?.some((t) => t.toLowerCase().includes(b)) ||
        i.ambiente?.toLowerCase().includes(b) ||
        i.nome_arquivo.toLowerCase().includes(b) ||
        i.descricao_tecnica?.toLowerCase().includes(b),
    );
  }, [data, busca]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[85vh] bg-white rounded-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--divisoria)]">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)]">
              BIBLIOTECA VISUAL
            </div>
            <div className="font-serif text-lg mt-1">Escolher imagem</div>
          </div>
          <button onClick={onClose} className="p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[color:var(--divisoria)] flex flex-wrap gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por tag, ambiente ou nome…"
            className="flex-1 min-w-[200px] rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
          />
          <select
            value={filtroLinha}
            onChange={(e) => setFiltroLinha(e.target.value)}
            className="rounded-[4px] border border-[color:var(--divisoria)] bg-white px-2 py-2 text-sm"
          >
            <option value="">Todas as linhas</option>
            <option value="A">Linha A</option>
            <option value="B">Linha B</option>
            <option value="AB">Linha A+B</option>
            <option value="C">Linha C</option>
          </select>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="rounded-[4px] border border-[color:var(--divisoria)] bg-white px-2 py-2 text-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="foto_real">Foto real</option>
            <option value="render">Render</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-[color:var(--muted-foreground)]">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-12 text-[color:var(--muted-foreground)] flex flex-col items-center gap-2">
              <ImageIcon className="h-8 w-8" />
              <div>Nenhuma imagem encontrada.</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {filtradas.map((img) => (
                <button
                  key={img.id}
                  onClick={() => onSelect(img)}
                  className="text-left border border-[color:var(--divisoria)] rounded-lg overflow-hidden bg-white hover:border-[color:var(--bronze)] transition-colors"
                >
                  <div className="aspect-[4/3] bg-[color:var(--gelo)] relative">
                    {img.signed_url ? (
                      <img src={img.signed_url} alt={img.nome_arquivo} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[color:var(--muted-foreground)]">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-[3px] text-[9px] font-mono tracking-widest bg-white/90 text-[color:var(--graphite)]">
                      L.{img.linha}
                    </span>
                  </div>
                  <div className="px-2 py-2">
                    <div className="text-[11px] text-[color:var(--graphite)] line-clamp-1">
                      {img.projeto?.nome ?? img.nome_arquivo}
                    </div>
                    <div className="font-mono text-[9px] tracking-widest text-[color:var(--bronze)] mt-0.5 uppercase">
                      {img.tipo === "foto_real" ? "Foto real" : "Render"} · {img.ambiente ?? "—"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}