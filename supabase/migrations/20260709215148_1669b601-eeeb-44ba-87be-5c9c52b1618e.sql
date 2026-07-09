CREATE TABLE public.prospeccoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL,
  lancamento_id uuid REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  nome_contato text,
  cargo text,
  empresa text,
  whatsapp text,
  email text,
  instagram text,
  canal_abordagem text,
  data_primeiro_contato date,
  mensagem_enviada text,
  status text NOT NULL DEFAULT 'para_contatar',
  data_followup date,
  notas text,
  linha_interesse text,
  potencial text
);

CREATE TABLE public.prospeccao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  prospeccao_id uuid REFERENCES public.prospeccoes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text NOT NULL,
  data_evento date
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospeccoes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospeccao_historico TO anon, authenticated;
GRANT ALL ON public.prospeccoes TO service_role;
GRANT ALL ON public.prospeccao_historico TO service_role;

ALTER TABLE public.prospeccoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccao_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open prospeccoes" ON public.prospeccoes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open historico" ON public.prospeccao_historico
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_prospeccoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER prospeccoes_updated_at
  BEFORE UPDATE ON public.prospeccoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_prospeccoes_updated_at();

CREATE INDEX prospeccoes_status_idx ON public.prospeccoes(status);
CREATE INDEX prospeccoes_followup_idx ON public.prospeccoes(data_followup);
CREATE INDEX prospeccao_historico_prospeccao_idx ON public.prospeccao_historico(prospeccao_id);