CREATE TABLE public.configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.configuracoes TO anon, authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open configuracoes" ON public.configuracoes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.configuracoes (chave, valor) VALUES ('limite_mensal_brl', '10.00');