## Radar 2.0 — Gemini + Google Search grounding

Substituir o motor do `/radar-mercado` (hoje Claude Sonnet + `web_search`) por **Gemini 2.5 Pro via AI Studio** com **Google Search grounding**, que devolve resultados reais indexados pelo Google (não alucinados) e cita as fontes.

### Escopo

Só toca no radar. Estudos de caso, reescrever, biblioteca etc. continuam no Claude — trocamos depois se compensar.

### Mudanças

**1. Secret**
- Novo secret `GEMINI_API_KEY` (AI Studio key). Solicitado via `add_secret`.

**2. `src/lib/radar-mercado.functions.ts`**
- Nova função interna `callGemini({ system, prompt, useGrounding })` que chama `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent` com `tools: [{ google_search: {} }]` quando `useGrounding=true`.
- `buscarLancamentos` e `adicionarManual` passam a usar Gemini + grounding (substitui `web_search_20250305` do Claude).
- `gerarConteudosLancamento` fica no Claude (é criativo, não precisa de web).
- Extrair citações de `groundingMetadata.groundingChunks[].web.uri` e salvar em `mkt_lancamentos.url_fonte` (usar a primeira fonte real) + novo campo `fontes` (JSONB array com `{title, uri}`).
- `logAnthropicUsage` vira `logIaUsage` com `provider: 'gemini' | 'anthropic'` (ou logar como já é, com módulo `radar-mercado-gemini`). Mantenho compatível: chamo `logAnthropicUsage` com `tokens_input/output` do `usageMetadata` do Gemini.

**3. Migration**
- `ALTER TABLE public.mkt_lancamentos ADD COLUMN IF NOT EXISTS fontes JSONB DEFAULT '[]'::jsonb;`

**4. UI `src/routes/radar-mercado.tsx`**
- No card/drawer do lançamento, mostrar a lista de fontes citadas (título + link externo) quando `fontes` estiver preenchido. Sem outras mudanças de layout.

### Detalhes técnicos

- Modelo: `gemini-2.5-pro` (grounding suportado; `-flash` como fallback se custo importar — deixo Pro por qualidade).
- Endpoint: `POST v1beta/models/gemini-2.5-pro:generateContent?key=GEMINI_API_KEY`.
- Body: `{ systemInstruction: { parts: [{text: SYSTEM}] }, contents: [{ role: 'user', parts: [{text: USER}] }], tools: [{ google_search: {} }], generationConfig: { responseMimeType: 'application/json', temperature: 0.3 } }`.
  - Nota: com `google_search` habilitado, alguns projetos não aceitam `responseMimeType: 'application/json'`. Se der 400, cai para texto puro e passa pelo `extractJson` que já existe.
- Parse JSON idêntico ao atual (`extractJson`).
- Erros: 429 → limite; 402/403 → créditos/permissão; outros → mensagem.

### Fora de escopo

- Não trocar Claude nos outros módulos.
- Não mexer no schema além do `fontes JSONB`.
- Não adicionar UI de "qual modelo usar" — Gemini fixo no radar.

Confirmo e mando bala?
