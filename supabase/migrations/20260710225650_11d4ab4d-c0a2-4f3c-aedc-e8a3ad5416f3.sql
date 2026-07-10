
-- configuracoes: restrict to authenticated only
DROP POLICY IF EXISTS "open configuracoes" ON public.configuracoes;
REVOKE ALL ON public.configuracoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
CREATE POLICY "authenticated can read configuracoes"
  ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can write configuracoes"
  ON public.configuracoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can update configuracoes"
  ON public.configuracoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated can delete configuracoes"
  ON public.configuracoes FOR DELETE TO authenticated USING (true);

-- prospeccoes: restrict to authenticated only
DROP POLICY IF EXISTS "open prospeccoes" ON public.prospeccoes;
REVOKE ALL ON public.prospeccoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospeccoes TO authenticated;
CREATE POLICY "authenticated can read prospeccoes"
  ON public.prospeccoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can write prospeccoes"
  ON public.prospeccoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can update prospeccoes"
  ON public.prospeccoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated can delete prospeccoes"
  ON public.prospeccoes FOR DELETE TO authenticated USING (true);

-- prospeccao_historico: restrict to authenticated only
DROP POLICY IF EXISTS "open historico" ON public.prospeccao_historico;
REVOKE ALL ON public.prospeccao_historico FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospeccao_historico TO authenticated;
CREATE POLICY "authenticated can read prospeccao_historico"
  ON public.prospeccao_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can write prospeccao_historico"
  ON public.prospeccao_historico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can update prospeccao_historico"
  ON public.prospeccao_historico FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated can delete prospeccao_historico"
  ON public.prospeccao_historico FOR DELETE TO authenticated USING (true);

-- storage: drop duplicate anon-inclusive policies (authenticated-only equivalents already exist)
DROP POLICY IF EXISTS "biblioteca-visual select" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca-visual insert" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca-visual update" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca-visual delete" ON storage.objects;
