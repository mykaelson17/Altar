// Cria (ou confirma que já existe) o banco de dados SQLite do Altair —
// todas as tabelas, o plano de contas padrão, o modelo de carta de
// transferência, o usuário master/admin iniciais e a licença de teste
// de 30 dias.
//
// Não precisa do app rodando pra isso: é só o schema sendo montado direto.
// Se o banco já existir, roda sem duplicar nada (idempotente).
//
// Como usar:
//   npx tsx criar-banco.ts
// (ou dê duplo clique em criar-banco.bat)

// Carrega o .env manualmente — `node`/`tsx` puro NÃO lê .env sozinho
// (isso não é um detalhe: sem essa linha, SESSION_SECRET/SQLITE_PATH
// ficam undefined mesmo com o .env certinho no lugar).
try { process.loadEnvFile(); } catch { /* sem .env ainda, tudo bem */ }

import { getDb } from "./src/lib/sqlite.server";

console.log("Criando/verificando o banco de dados...\n");

const db = getDb();

const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
const usuarios = db.prepare("SELECT username, role FROM app_users WHERE role IN ('master','admin') ORDER BY role DESC").all() as { username: string; role: string }[];
const licenca = db.prepare("SELECT status, vencimento FROM license WHERE id = 1").get() as { status: string; vencimento: string } | undefined;
const planoContas = db.prepare("SELECT COUNT(*) AS c FROM plano_contas").get() as { c: number };
const templates = db.prepare("SELECT COUNT(*) AS c FROM document_templates").get() as { c: number };

console.log(`✓ Banco criado em: ${process.env.SQLITE_PATH || "./data/dashboard.db"}`);
console.log(`✓ ${tabelas.length} tabela(s) prontas`);
console.log(`✓ Plano de contas: ${planoContas.c} categoria(s) pré-cadastradas`);
console.log(`✓ Modelos de documento: ${templates.c} pré-cadastrado(s)`);
if (licenca) console.log(`✓ Licença: ${licenca.status}, vence em ${licenca.vencimento} (30 dias de teste grátis)`);
console.log(`✓ Usuário(s) inicial(is):`);
usuarios.forEach((u) => {
  const senha = u.role === "master" ? "master123" : "admin123";
  console.log(`   - ${u.username} / ${senha}  (${u.role}, precisa trocar a senha no primeiro acesso)`);
});

console.log("\nPronto! O banco está pronto pra usar. Agora é só rodar o app normalmente.");
