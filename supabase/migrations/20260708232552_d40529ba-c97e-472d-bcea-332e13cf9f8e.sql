
CREATE TABLE public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  nome text NOT NULL,
  linha text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'ativo'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO anon, authenticated;
GRANT ALL ON public.projetos TO service_role;

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open projetos" ON public.projetos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.biblioteca_imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  nome_arquivo text NOT NULL,
  url_storage text NOT NULL,
  tipo text NOT NULL,
  linha text NOT NULL,
  descricao_tecnica text,
  tags text[] NOT NULL DEFAULT '{}',
  ambiente text,
  copies jsonb,
  conteudos_gerados jsonb,
  status_publicacao text NOT NULL DEFAULT 'nao_usado',
  ultima_vez_usada timestamptz,
  vezes_usada integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_imagens TO anon, authenticated;
GRANT ALL ON public.biblioteca_imagens TO service_role;

ALTER TABLE public.biblioteca_imagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open biblioteca" ON public.biblioteca_imagens
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX biblioteca_imagens_projeto_idx ON public.biblioteca_imagens(projeto_id);
CREATE INDEX biblioteca_imagens_created_idx ON public.biblioteca_imagens(created_at DESC);
