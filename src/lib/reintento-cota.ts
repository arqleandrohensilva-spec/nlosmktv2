// Reenvio automático quando o Gemini grátis estoura a cota (429 / "limite de requisições").
// A cota por minuto do plano grátis reseta em ~1 min. Como as server functions têm timeout
// no servidor, a espera longa acontece AQUI, no navegador (sem timeout), com contador visível.

export function ehErroDeCota(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? String(err ?? "");
  return /limite de requisi|sobrecarreg|quota|rate limit|\b429\b|\b503\b/i.test(msg);
}

type Opts = {
  /** Quantos reenvios extras além da 1ª tentativa (padrão 2). */
  tentativas?: number;
  /** Espera entre tentativas, em ms (padrão 35s — cobre o reset por minuto). */
  esperaMs?: number;
  /** Chamado a cada segundo da espera, com os segundos restantes. */
  onEsperar?: (segundosRestantes: number) => void;
};

export async function comEsperaDeCota<T>(fn: () => Promise<T>, opts?: Opts): Promise<T> {
  const tentativas = opts?.tentativas ?? 2;
  const esperaMs = opts?.esperaMs ?? 35000;
  let ultimo: unknown;
  for (let i = 0; i <= tentativas; i++) {
    try {
      return await fn();
    } catch (err) {
      ultimo = err;
      // Só reenvia se for erro de cota e ainda houver tentativa; senão, propaga.
      if (i === tentativas || !ehErroDeCota(err)) throw err;
      const total = Math.ceil(esperaMs / 1000);
      for (let s = total; s > 0; s--) {
        opts?.onEsperar?.(s);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  throw ultimo;
}
