import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { agendarViaWebhook } from "@/lib/make.functions";
import { supabase } from "@/lib/supabaseExternal";
import { toast } from "sonner";
import { Send, X, Loader2, CalendarClock, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { BibliotecaPicker, type BibliotecaImagemLite, signBibliotecaUrls } from "@/components/biblioteca-picker";

// Sobe a imagem (ex.: gerada no Google Flow) pro Storage e devolve uma URL
// assinada de LONGA duração — precisa continuar válida até o Make publicar o
// post agendado (por isso 1 ano, não os 3600s padrão da biblioteca).
async function uploadImagemPost(file: File): Promise<{ url: string; nome: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `posts/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("mkt-biblioteca-visual")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Falha no upload: ${error.message}`);
  const { data, error: signErr } = await supabase.storage
    .from("mkt-biblioteca-visual")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr || !data?.signedUrl) throw new Error("Falha ao gerar URL da imagem.");
  return { url: data.signedUrl, nome: file.name };
}

type Kind = "posicionamento" | "projeto" | "bastidor";

const CANAIS = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter / X" },
];

function nextSuggestion(kind: Kind = "projeto"): Date {
  const map = {
    posicionamento: { dow: 2, hour: 19 },
    projeto: { dow: 4, hour: 19 },
    bastidor: { dow: 6, hour: 10 },
  } as const;
  const cfg = map[kind];
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cfg.hour, 0, 0, 0);
  const currentDow = d.getDay();
  let diff = (cfg.dow - currentDow + 7) % 7;
  if (diff === 0 && d.getTime() <= now.getTime()) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AgendarModal({
  open,
  onClose,
  initialText,
  kind = "projeto",
  origem,
  postId,
  imageUrl,
  onScheduled,
}: {
  open: boolean;
  onClose: () => void;
  initialText: string;
  kind?: Kind;
  origem?: string;
  postId?: string;
  imageUrl?: string;
  onScheduled?: () => void;
}) {
  const agendar = useServerFn(agendarViaWebhook);
  const [texto, setTexto] = useState(initialText);
  const [quando, setQuando] = useState<string>(toLocalInput(nextSuggestion(kind)));
  const [canal, setCanal] = useState<string>("instagram");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imagem, setImagem] = useState<{ url: string; nome: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      setImagem(await uploadImagemPost(file));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload da imagem.");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setTexto(initialText);
      setQuando(toLocalInput(nextSuggestion(kind)));
      setImagem(imageUrl ? { url: imageUrl, nome: "Imagem gerada pela IA" } : null);
    }
  }, [open, initialText, kind, imageUrl]);

  const iso = useMemo(() => {
    if (!quando) return "";
    const d = new Date(quando);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  }, [quando]);

  const mut = useMutation({
    mutationFn: async () =>
      agendar({
        data: {
          texto,
          data_hora: iso,
          canal,
          conteudo_tipo: kind,
          origem,
          post_id: postId,
          imagem_url: imagem?.url ?? null,
        },
      }),
    onSuccess: () => {
      const d = new Date(quando);
      toast.success(`Publicação agendada para ${d.toLocaleString("pt-BR")}`);
      onScheduled?.();
      onClose();
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao agendar publicação"),
  });

  async function handlePick(img: BibliotecaImagemLite) {
    let url = img.signed_url;
    if (!url) {
      const map = await signBibliotecaUrls([img.url_storage]);
      url = map[img.url_storage];
    }
    if (!url) {
      toast.error("Não foi possível obter a URL da imagem.");
      return;
    }
    setImagem({ url, nome: img.nome_arquivo });
    setPickerOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white rounded-lg border border-[color:var(--divisoria)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--divisoria)]">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[color:var(--bronze)]" />
            <div className="font-serif text-lg text-[color:var(--graphite)]">Agendar publicação</div>
          </div>
          <button onClick={onClose} className="p-1 text-[color:var(--muted-foreground)] hover:text-[color:var(--graphite)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <label className="block">
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">TEXTO DO POST</div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-[color:var(--gelo)] px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)] resize-y"
              style={{ minHeight: 140 }}
            />
            <div className="text-[10px] font-mono text-[color:var(--muted-foreground)] mt-1">
              {texto.length} caracteres
            </div>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
                DATA E HORA
              </div>
              <input
                type="datetime-local"
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
                className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
              />
              <div className="text-[10px] text-[color:var(--muted-foreground)] mt-1">
                Sugestão: próxima janela de maior engajamento.
              </div>
            </label>

            <label className="block">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">CANAL</div>
              <select
                value={canal}
                onChange={(e) => setCanal(e.target.value)}
                className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
              >
                {CANAIS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-widest text-[color:var(--bronze)] mb-2">
              IMAGEM DO POST <span className="text-[color:var(--muted-foreground)] normal-case">(opcional)</span>
            </div>
            {imagem ? (
              <div className="flex items-center gap-3 border border-[color:var(--divisoria)] rounded-[4px] bg-white p-2">
                <img src={imagem.url} alt={imagem.nome} className="h-16 w-16 object-cover rounded-[3px]" />
                <div className="flex-1 text-xs text-[color:var(--graphite)] line-clamp-2">{imagem.nome}</div>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-1.5 text-xs text-[color:var(--graphite)] hover:border-[color:var(--bronze)]"
                >
                  Trocar
                </button>
                <button
                  onClick={() => setImagem(null)}
                  className="p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--graphite)]"
                  title="Remover imagem"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={`inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm text-[color:var(--graphite)] cursor-pointer hover:border-[color:var(--bronze)] ${
                    uploading ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Enviando…" : "Enviar imagem (Flow/computador)"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0])}
                  />
                </label>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)]"
                >
                  <ImageIcon className="h-4 w-4" />
                  Escolher da biblioteca
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[color:var(--divisoria)] bg-[color:var(--gelo)]">
          <button
            onClick={onClose}
            className="rounded-[4px] border border-[color:var(--divisoria)] bg-white px-4 py-2 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)]"
          >
            Cancelar
          </button>
          <button
            disabled={!texto.trim() || !canal || !iso || mut.isPending}
            onClick={() => mut.mutate()}
            className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {mut.isPending ? "Agendando…" : "Agendar"}
          </button>
        </div>
      </div>
      <BibliotecaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handlePick} />
    </div>
  );
}

export function AgendarButton({
  text,
  kind,
  origem,
  postId,
  imageUrl,
  label = "Agendar publicação",
  variant = "primary",
  className = "",
}: {
  text: string;
  kind?: Kind;
  origem?: string;
  postId?: string;
  imageUrl?: string;
  label?: string;
  variant?: "primary" | "secondary" | "chip";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const styles =
    variant === "primary"
      ? "inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-5 py-2.5 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40"
      : variant === "secondary"
      ? "inline-flex items-center gap-2 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-5 py-2.5 text-sm text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors"
      : "inline-flex items-center gap-1.5 rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-1.5 text-xs text-[color:var(--graphite)] hover:border-[color:var(--bronze)] transition-colors";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!text?.trim()}
        className={`${styles} ${className}`}
      >
        <Send className={variant === "chip" ? "h-3 w-3" : "h-4 w-4"} />
        {label}
      </button>
      <AgendarModal
        open={open}
        onClose={() => setOpen(false)}
        initialText={text}
        kind={kind}
        origem={origem}
        postId={postId}
        imageUrl={imageUrl}
      />
    </>
  );
}