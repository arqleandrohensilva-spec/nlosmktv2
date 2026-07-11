
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['uso_ia','analises_concorrentes','antes_depois','performance','posts','projetos','estudos_caso','radar_buscas','biblioteca_imagens','dores','lancamentos','objecoes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_all_'||t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', 'auth_select_'||t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)', 'auth_insert_'||t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', 'auth_update_'||t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)', 'auth_delete_'||t, t);
  END LOOP;
END $$;
