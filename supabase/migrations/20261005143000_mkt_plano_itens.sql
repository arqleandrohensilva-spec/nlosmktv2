-- Calendário editorial: persiste o PLANO gerado pela IA (semana/quinzena/mês)
-- para que ele não se perca ao atualizar a página. Cada linha é um item planejado
-- ("a produzir"); quando vira post publicado, o item sai da lista.
CREATE TABLE IF NOT EXISTS public.mkt_plano_itens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote         text,                               -- agrupa os itens de uma mesma geração
  periodo      text NOT NULL DEFAULT 'mes',         -- semana | quinzena | mes
  semana       integer NOT NULL DEFAULT 1,
  linha        text NOT NULL DEFAULT 'A',           -- A | B | AB | C
  formato      text NOT NULL DEFAULT 'reels',       -- reels | estatico | carrossel | stories
  pilar        text,
  dor_id       text,
  dor_titulo   text,
  tema         text,
  gancho       text,
  origem       text,                                -- projeto | dor | sazonal
  projeto_id   text,
  contexto_id  text,
  cliente      text,
  status       text NOT NULL DEFAULT 'planejado',   -- planejado | produzido | descartado
  post_id      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mkt_plano_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_mkt_plano_itens" ON public.mkt_plano_itens;
CREATE POLICY "authenticated_all_mkt_plano_itens" ON public.mkt_plano_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS mkt_plano_itens_status_idx ON public.mkt_plano_itens (status, created_at DESC);
