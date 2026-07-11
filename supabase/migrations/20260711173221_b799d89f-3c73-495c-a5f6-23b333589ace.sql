
-- 1) Roles infrastructure for admin gating on configuracoes
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- 2) Drop all permissive open-anon policies
DROP POLICY IF EXISTS "open uso_ia" ON public.uso_ia;
DROP POLICY IF EXISTS "open analises" ON public.analises_concorrentes;
DROP POLICY IF EXISTS "open antes_depois" ON public.antes_depois;
DROP POLICY IF EXISTS "open performance" ON public.performance;
DROP POLICY IF EXISTS "open posts" ON public.posts;
DROP POLICY IF EXISTS "open projetos" ON public.projetos;
DROP POLICY IF EXISTS "open estudos" ON public.estudos_caso;
DROP POLICY IF EXISTS "open radar_buscas" ON public.radar_buscas;
DROP POLICY IF EXISTS "open biblioteca" ON public.biblioteca_imagens;
DROP POLICY IF EXISTS "open dores" ON public.dores;
DROP POLICY IF EXISTS "open lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "open objecoes" ON public.objecoes;

-- Revoke anon grants
REVOKE ALL ON public.uso_ia, public.analises_concorrentes, public.antes_depois,
  public.performance, public.posts, public.projetos, public.estudos_caso,
  public.radar_buscas, public.biblioteca_imagens, public.dores,
  public.lancamentos, public.objecoes, public.configuracoes,
  public.prospeccoes, public.prospeccao_historico FROM anon;

-- 3) Authenticated-only policies for business tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['uso_ia','analises_concorrentes','antes_depois','performance','posts','projetos','estudos_caso','radar_buscas','biblioteca_imagens','dores','lancamentos','objecoes']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'authenticated_all_'||t, t);
  END LOOP;
END $$;

-- 4) configuracoes: read for authenticated, write only for admins
DROP POLICY IF EXISTS "authenticated can read configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "authenticated can write configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "authenticated can update configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "authenticated can delete configuracoes" ON public.configuracoes;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
CREATE POLICY "authenticated read configuracoes" ON public.configuracoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins insert configuracoes" ON public.configuracoes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update configuracoes" ON public.configuracoes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete configuracoes" ON public.configuracoes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5) prospeccoes / prospeccao_historico: add owner column and scope
ALTER TABLE public.prospeccoes ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.prospeccao_historico ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "authenticated can read prospeccoes" ON public.prospeccoes;
DROP POLICY IF EXISTS "authenticated can write prospeccoes" ON public.prospeccoes;
DROP POLICY IF EXISTS "authenticated can update prospeccoes" ON public.prospeccoes;
DROP POLICY IF EXISTS "authenticated can delete prospeccoes" ON public.prospeccoes;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospeccoes TO authenticated;
GRANT ALL ON public.prospeccoes TO service_role;
CREATE POLICY "owner or admin read prospeccoes" ON public.prospeccoes
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "authenticated insert prospeccoes" ON public.prospeccoes
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY "owner or admin update prospeccoes" ON public.prospeccoes
  FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin delete prospeccoes" ON public.prospeccoes
  FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "authenticated can read prospeccao_historico" ON public.prospeccao_historico;
DROP POLICY IF EXISTS "authenticated can write prospeccao_historico" ON public.prospeccao_historico;
DROP POLICY IF EXISTS "authenticated can update prospeccao_historico" ON public.prospeccao_historico;
DROP POLICY IF EXISTS "authenticated can delete prospeccao_historico" ON public.prospeccao_historico;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospeccao_historico TO authenticated;
GRANT ALL ON public.prospeccao_historico TO service_role;
CREATE POLICY "owner or admin read prospeccao_historico" ON public.prospeccao_historico
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "authenticated insert prospeccao_historico" ON public.prospeccao_historico
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY "owner or admin update prospeccao_historico" ON public.prospeccao_historico
  FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin delete prospeccao_historico" ON public.prospeccao_historico
  FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 6) Storage: add ownership checks on biblioteca-visual
DROP POLICY IF EXISTS "Authenticated users can delete from biblioteca-visual" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update biblioteca-visual" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to biblioteca-visual" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view biblioteca-visual" ON storage.objects;

CREATE POLICY "biblioteca-visual authenticated read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'biblioteca-visual');
CREATE POLICY "biblioteca-visual owner insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'biblioteca-visual' AND owner = auth.uid());
CREATE POLICY "biblioteca-visual owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'biblioteca-visual' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (bucket_id = 'biblioteca-visual' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "biblioteca-visual owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'biblioteca-visual' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));
