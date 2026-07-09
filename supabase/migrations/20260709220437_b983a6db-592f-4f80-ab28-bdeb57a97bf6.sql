
CREATE TABLE public.estudos_caso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  nome_projeto text NOT NULL,
  linha text NOT NULL,
  cidade text,
  problema text NOT NULL,
  restricoes text,
  partido text NOT NULL,
  solucoes text[] NOT NULL DEFAULT '{}',
  resultado text NOT NULL,
  detalhe_tecnico text,
  imagens_ids uuid[] NOT NULL DEFAULT '{}',
  conteudos jsonb,
  status text NOT NULL DEFAULT 'rascunho'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudos_caso TO anon, authenticated;
GRANT ALL ON public.estudos_caso TO service_role;

ALTER TABLE public.estudos_caso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open estudos" ON public.estudos_caso
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
