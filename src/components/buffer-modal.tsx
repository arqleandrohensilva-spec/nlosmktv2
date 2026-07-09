import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { agendarBuffer, listarPerfisBuffer, type BufferProfile } from "@/lib/buffer.functions";
import { toast } from "sonner";
import { Send, X, Loader2, CalendarClock } from "lucide-react";

type Kind = "posicionamento" | "projeto" | "bastidor";

function nextSuggestion(kind: Kind = "projeto"): Date {
  // 2 = terça (posicionamento) / 4 = quinta (projeto) / 6 = sábado (bastidor)
  const map = { posicionamento: { dow: 2, hour: 19 }, projeto: { dow: 4, hour: 19 }, bastidor: { dow: 6, hour: 10 } } as const;
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

export function BufferModal({
  open,
  onClose,
  initialText,
  kind = "projeto",
  origem,
  postId,
  onScheduled,
}: {
  open: boolean;
  onClose: () => void;
  initialText: string;
  kind?: Kind;
  origem?: string;
  postId?: string;
  onScheduled?: () => void;
}) {
  const listar = useServerFn(listarPerfisBuffer);
  const agendar = useServerFn(agendarBuffer);
  const [texto, setTexto] = useState(initialText);
  const [quando, setQuando] = useState<string>(toLocalInput(nextSuggestion(kind)));
  const [profileId, setProfileId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setTexto(initialText);
      setQuando(toLocalInput(nextSuggestion(kind)));
    }
  }, [open, initialText, kind]);

  const perfis = useQuery({
    queryKey: ["buffer-profiles"],
    queryFn: () => listar(),
    enabled: open,
    staleTime: 60_000,
  });

  const profiles: BufferProfile[] = perfis.data?.profiles ?? [];
  const perfilErr = perfis.data?.error;

  useEffect(() => {
    if (!profileId && profiles[0]) setProfileId(profiles[0].id);
  }, [profiles, profileId]);

  const iso = useMemo(() => {
    if (!quando) return "";
    const d = new Date(quando);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  }, [quando]);

  const mut = useMutation({
    mutationFn: async () =>
      agendar({
        data: {
          profile_ids: [profileId],
          text: texto,
          scheduled_at: iso,
          origem,
          post_id: postId,
        },
      }),
    onSuccess: () => {
      const d = new Date(quando);
      toast.success(`Post agendado para ${d.toLocaleString("pt-BR")} no Buffer`);
      onScheduled?.();
      onClose();
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao agendar no Buffer"),
  });

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
            <div className="font-serif text-lg text-[color:var(--graphite)]">Agendar no Buffer</div>
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
              {perfis.isLoading ? (
                <div className="text-sm text-[color:var(--muted-foreground)] flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando perfis…
                </div>
              ) : perfilErr ? (
                <div className="text-xs text-red-600">{perfilErr} Configure em <a href="/configuracoes" className="underline">/configuracoes</a>.</div>
              ) : profiles.length === 0 ? (
                <div className="text-xs text-[color:var(--muted-foreground)]">Nenhum perfil conectado no Buffer.</div>
              ) : (
                <select
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  className="w-full rounded-[4px] border border-[color:var(--divisoria)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--bronze)]"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.service} · {p.formatted_username || p.service_username || p.id.slice(0, 6)}
                    </option>
                  ))}
                </select>
              )}
            </label>
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
            disabled={!texto.trim() || !profileId || !iso || mut.isPending}
            onClick={() => mut.mutate()}
            className="inline-flex items-center gap-2 rounded-[4px] bg-[color:var(--graphite)] px-4 py-2 text-sm text-white hover:bg-[color:var(--bronze)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {mut.isPending ? "Agendando…" : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BufferButton({
  text,
  kind,
  origem,
  postId,
  label = "Agendar no Buffer",
  variant = "primary",
  className = "",
}: {
  text: string;
  kind?: Kind;
  origem?: string;
  postId?: string;
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
      <BufferModal
        open={open}
        onClose={() => setOpen(false)}
        initialText={text}
        kind={kind}
        origem={origem}
        postId={postId}
      />
    </>
  );
}
