
-- Public tables: reset open policies to include anon + authenticated
DROP POLICY IF EXISTS "open projetos" ON public.projetos;
DROP POLICY IF EXISTS "open biblioteca" ON public.biblioteca_imagens;

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_imagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open projetos" ON public.projetos
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "open biblioteca" ON public.biblioteca_imagens
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_imagens TO anon, authenticated;
GRANT ALL ON public.projetos TO service_role;
GRANT ALL ON public.biblioteca_imagens TO service_role;

-- Storage: open policies for bucket biblioteca-visual (anon + authenticated)
DROP POLICY IF EXISTS "biblioteca-visual select" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca-visual insert" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca-visual update" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca-visual delete" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca-visual authenticated select" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca-visual authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca-visual authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca-visual authenticated delete" ON storage.objects;

CREATE POLICY "biblioteca-visual select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'biblioteca-visual');

CREATE POLICY "biblioteca-visual insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'biblioteca-visual');

CREATE POLICY "biblioteca-visual update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'biblioteca-visual')
  WITH CHECK (bucket_id = 'biblioteca-visual');

CREATE POLICY "biblioteca-visual delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'biblioteca-visual');
