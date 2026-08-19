// Compatibilidade: o app inteiro importa `q`/`q1` daqui.
// A implementação real vive em `sqlite.server.ts` (SQLite local — é o
// banco de configuração do próprio painel: usuários, conexões, menus,
// widgets, etc.). Os bancos externos (Postgres/MySQL/SQL Server/Oracle)
// ficam em `query-engine/`.
export { q, q1, getDb } from "./sqlite.server";

// Wrappers assíncronos para código que aguarda os resultados com await.
// SQLite (better-sqlite3) é síncrono, mas manter Promise mantém a API antiga.
import { q as _q, q1 as _q1 } from "./sqlite.server";
export async function qAsync<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return _q<T>(sql, params);
}
export async function q1Async<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  return _q1<T>(sql, params);
}
