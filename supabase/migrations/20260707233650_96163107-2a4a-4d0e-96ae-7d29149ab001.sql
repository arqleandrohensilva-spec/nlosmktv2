CREATE TABLE public.uso_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  modulo text NOT NULL,
  operacao text NOT NULL,
  tokens_input int NOT NULL DEFAULT 0,
  tokens_output int NOT NULL DEFAULT 0,
  custo_usd numeric(10,6) NOT NULL DEFAULT 0,
  custo_brl numeric(10,4) NOT NULL DEFAULT 0,
  modelo text NOT NULL DEFAULT 'claude-sonnet-4-6',
  detalhes jsonb
);
GRANT SELECT, INSERT ON public.uso_ia TO anon, authenticated;
GRANT ALL ON public.uso_ia TO service_role;
ALTER TABLE public.uso_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open uso_ia" ON public.uso_ia
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);