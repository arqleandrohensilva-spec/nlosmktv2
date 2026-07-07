
-- DORES
CREATE TABLE public.dores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  titulo text NOT NULL,
  descricao text,
  categoria text NOT NULL CHECK (categoria IN ('medo','inseguranca','duvida','frustracao')),
  ultima_vez_usada timestamptz,
  vezes_usada int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dores TO anon, authenticated;
GRANT ALL ON public.dores TO service_role;
ALTER TABLE public.dores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open dores" ON public.dores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- POSTS
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  linha text NOT NULL CHECK (linha IN ('A','B','AB','C')),
  formato text NOT NULL CHECK (formato IN ('reels','estatico','carrossel','stories')),
  dor_id uuid REFERENCES public.dores(id) ON DELETE SET NULL,
  pilar text CHECK (pilar IN ('posicionamento','oferta','marketing','vendas')),
  raciocinio jsonb,
  copy_roteiro text,
  copy_legenda text,
  copy_cta text,
  briefing_visual text,
  observacao text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','pronto','publicado')),
  data_publicacao date,
  semana int,
  mes int,
  ano int
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO anon, authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open posts" ON public.posts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- PERFORMANCE
CREATE TABLE public.performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  views int NOT NULL DEFAULT 0,
  curtidas int NOT NULL DEFAULT 0,
  comentarios int NOT NULL DEFAULT 0,
  salvamentos int NOT NULL DEFAULT 0,
  compartilhamentos int NOT NULL DEFAULT 0,
  registrado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance TO anon, authenticated;
GRANT ALL ON public.performance TO service_role;
ALTER TABLE public.performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open performance" ON public.performance FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- OBJECOES
CREATE TABLE public.objecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  texto text NOT NULL,
  categoria text,
  respondida boolean NOT NULL DEFAULT false,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objecoes TO anon, authenticated;
GRANT ALL ON public.objecoes TO service_role;
ALTER TABLE public.objecoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open objecoes" ON public.objecoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- SEED DORES
INSERT INTO public.dores (titulo, categoria, descricao) VALUES
('Medo de estourar o orçamento', 'medo', 'Medo de estourar o orçamento e ficar com obra inacabada'),
('Insegurança em confiar só no pedreiro', 'inseguranca', 'Insegurança em confiar apenas no pedreiro sem projeto'),
('Dificuldade com burocracias', 'frustracao', 'Dificuldade de lidar com burocracias e documentação'),
('Ansiedade pela demora do sonho', 'medo', 'Ansiedade pela demora em realizar o sonho da casa própria'),
('Comparação social', 'frustracao', 'Frustração de ver conhecidos conquistando o que ainda não conseguiu'),
('Dúvida sobre necessidade de arquiteto', 'duvida', 'Dúvida se realmente precisa de arquiteto (custo percebido vs. valor)'),
('Medo de retrabalho', 'medo', 'Medo de retrabalho por incompatibilidade entre projeto e execução'),
('Insegurança sobre financiamento Caixa', 'inseguranca', 'Insegurança sobre como funciona o financiamento pela Caixa Federal'),
('Não saber por onde começar', 'duvida', 'Não saber por onde começar tendo o terreno mas sem projeto');

-- SEED OBJECOES
INSERT INTO public.objecoes (texto, categoria) VALUES
('Será que precisamos mesmo de arquiteto ou é gasto desnecessário?', 'valor'),
('Vamos dar conta de pagar até o fim da obra?', 'financeiro'),
('Não é mais fácil comprar pronto?', 'alternativa'),
('Quanto tempo vai levar até estarmos morando?', 'prazo'),
('O projeto vai ficar realmente do jeito que sonhamos?', 'confianca'),
('Arquiteto é só para quem tem muito dinheiro.', 'valor'),
('Pedreiro de confiança já basta, não precisa de projeto.', 'alternativa');
