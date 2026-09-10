// Conexão única do NL OS MKT v2 — mesmo projeto Supabase do NL OS (produção).
// Auth e dados (tabelas mkt_*) vivem aqui. Safe para browser e servidor:
// contém apenas URL + anon key (publicáveis).
export const NL_OS_SUPABASE_URL = "https://gwmifubdcjfyyrypenah.supabase.co";

// anon key em formato JWT (compatível com o header Authorization padrão do supabase-js).
export const NL_OS_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3bWlmdWJkY2pmeXlyeXBlbmFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MDI3MTYsImV4cCI6MjEwNDI3ODcxNn0.zfd7JU4JtqpSn-y-2mfuTIRQJafzNoBvlMQsL6-7pBQ";

// Chave publicável nova (sb_publishable_*), guardada para referência futura.
export const NL_OS_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_2A-V8o_XK3hafl4oua-jkg_hrvgrBwv";
