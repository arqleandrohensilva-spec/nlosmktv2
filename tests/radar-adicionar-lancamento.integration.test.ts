/**
 * Integration test — "Adicionar Lançamento" (radar de mercado) com RLS ativo.
 *
 * Valida, contra o Supabase externo real (krzuroijejfozljhchok), que:
 *
 *  1. Um cliente anônimo (sem sessão) NÃO consegue inserir em `mkt_lancamentos`
 *     — a policy de RLS `authenticated` deve rejeitar (erro 42501 / 401/403).
 *  2. Um cliente autenticado (usuário real de `nlarquitetos.com.br`) CONSEGUE
 *     inserir uma linha e depois lê-la de volta com o mesmo token.
 *  3. A linha inserida traz os campos preenchidos pelo fluxo de UI
 *     ("Adicionar lançamento" → status inicial `novo`, notas indicando origem).
 *  4. Limpeza: o registro é apagado ao final para não poluir o Kanban.
 *
 * Requisitos de execução:
 *   TEST_USER_EMAIL=leandro@nlarquitetos.com.br \
 *   TEST_USER_PASSWORD=**** \
 *   bunx vitest run tests/radar-adicionar-lancamento.integration.test.ts
 *
 * Sem as env vars o teste é SKIPPED — nunca falha silenciosamente por falta
 * de credencial, e nunca commita segredos no repositório.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_EXTERNAL_ANON_KEY,
  SUPABASE_EXTERNAL_URL,
} from "../src/lib/supabaseExternal";

const EMAIL = process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TEST_USER_PASSWORD;
const RUN = Boolean(EMAIL && PASSWORD);

const describeIf = RUN ? describe : describe.skip;

function makeClient(): SupabaseClient {
  // Um client por teste, sem persistência — cada teste controla explicitamente
  // se está autenticado (signInWithPassword) ou anônimo (sem sessão).
  return createClient(SUPABASE_EXTERNAL_URL, SUPABASE_EXTERNAL_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

describeIf("Radar de mercado — Adicionar lançamento (RLS)", () => {
  const marker = `__integration_test_${Date.now()}`;
  const nomeLancamento = `Teste RLS ${marker}`;
  let authed: SupabaseClient;
  let insertedId: string | null = null;

  beforeAll(async () => {
    authed = makeClient();
    const { data, error } = await authed.auth.signInWithPassword({
      email: EMAIL!,
      password: PASSWORD!,
    });
    expect(error, "login do usuário de teste deve funcionar").toBeNull();
    expect(data.session?.access_token).toBeTruthy();
  });

  afterAll(async () => {
    if (insertedId && authed) {
      await authed.from("mkt_lancamentos").delete().eq("id", insertedId);
    }
    if (authed) await authed.auth.signOut();
  });

  it("rejeita insert de cliente anônimo (RLS bloqueia)", async () => {
    const anon = makeClient();
    const { data, error } = await anon
      .from("mkt_lancamentos")
      .insert({
        nome: `${nomeLancamento} (anon)`,
        tipo: "loteamento",
        cidade: "SJC",
        status: "novo",
        notas: "tentativa anônima — deve falhar",
      })
      .select("id")
      .maybeSingle();

    expect(data).toBeNull();
    expect(error, "policy deve rejeitar cliente anônimo").not.toBeNull();
    // Postgres RLS violation -> code 42501; PostgREST devolve 401/403 conforme a policy.
    expect(
      error?.code === "42501" ||
        error?.message?.toLowerCase().includes("row-level security"),
      `erro deve ser de RLS, veio: ${error?.code} ${error?.message}`,
    ).toBe(true);
  });

  it("permite insert do usuário autenticado e devolve a linha via SELECT", async () => {
    const { data: inserted, error: insertErr } = await authed
      .from("mkt_lancamentos")
      .insert({
        nome: nomeLancamento,
        tipo: "loteamento",
        cidade: "SJC",
        bairro: "Urbanova",
        construtora: "Teste Integração",
        descricao: "Registro criado pelo teste de integração do radar.",
        status: "novo",
        notas: "Adicionado manualmente",
      })
      .select("*")
      .single();

    expect(insertErr, "insert autenticado não deve retornar erro").toBeNull();
    expect(inserted).toBeTruthy();
    expect(inserted!.id).toBeTruthy();
    expect(inserted!.status).toBe("novo");
    expect(inserted!.nome).toBe(nomeLancamento);

    insertedId = inserted!.id;

    // Leitura de volta com o mesmo token — valida que RLS permite SELECT ao owner/authenticated.
    const { data: fetched, error: selectErr } = await authed
      .from("mkt_lancamentos")
      .select("id, nome, status, notas")
      .eq("id", insertedId!)
      .single();

    expect(selectErr).toBeNull();
    expect(fetched?.nome).toBe(nomeLancamento);
    expect(fetched?.notas).toBe("Adicionado manualmente");
  });

  it("registra a busca em mkt_radar_buscas quando o fluxo persiste o resumo", async () => {
    // Reflete o insert que `adicionarManual` / `buscarLancamentos` fazem ao final.
    const { data, error } = await authed
      .from("mkt_radar_buscas")
      .insert({
        resultados_encontrados: 1,
        novos_lancamentos: 1,
        resumo: `Teste de integração ${marker}`,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();

    if (data?.id) {
      await authed.from("mkt_radar_buscas").delete().eq("id", data.id);
    }
  });
});

if (!RUN) {
  // Log visível quando o teste é pulado para não passar despercebido no CI local.
  // eslint-disable-next-line no-console
  console.warn(
    "[radar-adicionar-lancamento] SKIP — defina TEST_USER_EMAIL e TEST_USER_PASSWORD para rodar contra o Supabase externo.",
  );
}