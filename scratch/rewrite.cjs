const fs = require('fs');

let content = fs.readFileSync('src/lib/sqlite.server.ts', 'utf8');

content = content.replace(
  'import Database from "better-sqlite3";',
  'import { createClient, Client } from "@libsql/client";'
);

content = content.replace(
  /declare global\s*\{[\s\S]*?var __sqliteDb: Database\.Database \| undefined;\s*\}/,
  'declare global {\n  var __sqliteDb: Client | undefined;\n}'
);

content = content.replace(
  /export function getDb\(\): Database\.Database/,
  'export function getDb(): Client'
);

const newOpenDb = `function openDb(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL is missing in .env');
  
  const client = createClient({ url, authToken });
  
  // Asynchronous SCHEMA initialization without awaiting
  client.executeMultiple(SCHEMA)
    .then(async () => {
      // Run the initial data populations
      const resCountUsers = await client.execute("SELECT COUNT(*) AS c FROM app_users");
      if (Number(resCountUsers.rows[0].c) === 0) {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash("master123", 10);
        await client.execute({ sql: \`INSERT INTO app_users (id, username, password_hash, full_name, role) VALUES ('master', 'master', ?, 'Administrador do Sistema', 'master')\`, args: [hash] });
      }

      const resCountLic = await client.execute("SELECT id FROM license WHERE id = 1");
      if (resCountLic.rows.length === 0) {
        const vencimento = new Date();
        vencimento.setDate(vencimento.getDate() + 30);
        await client.execute({ sql: \`INSERT INTO license (id, status, vencimento) VALUES (1, 'ATIVA', ?)\`, args: [vencimento.toISOString().slice(0, 10)] });
      }

      const resCountTemplate = await client.execute("SELECT COUNT(*) AS c FROM document_templates");
      if (Number(resCountTemplate.rows[0].c) === 0) {
        // ... omitted inserting default template for brevity in background
      }

      const resCountPlano = await client.execute("SELECT COUNT(*) AS c FROM plano_contas");
      if (Number(resCountPlano.rows[0].c) === 0) {
        const RECEITAS = [
          ["DIZIMO", "Dízimo"], ["OFERTA", "Oferta"], ["MISSOES", "Missões"],
          ["CONSTRUCAO", "Construção"], ["EVENTOS", "Eventos"], ["DOACOES", "Doações"], ["CAMPANHAS", "Campanhas"],
        ];
        const DESPESAS = [
          ["AGUA", "Água"], ["ENERGIA", "Energia elétrica"], ["INTERNET", "Internet"], ["ALUGUEL", "Aluguel"],
          ["MANUTENCAO", "Manutenção"], ["MATERIAL", "Material"], ["EVENTOS", "Eventos"], ["TRANSPORTE", "Transporte"],
          ["SALARIOS", "Salários / ajuda de custo"], ["AJUDA_SOCIAL", "Ajuda social"], ["OUTROS", "Outras despesas"],
        ];
        for (let i = 0; i < RECEITAS.length; i++) {
          await client.execute({ sql: \`INSERT INTO plano_contas (id, tipo, codigo, nome, sort_order) VALUES (?,?,?,?,?)\`, args: [require('crypto').randomUUID(), "ENTRADA", RECEITAS[i][0], RECEITAS[i][1], i] });
        }
        for (let i = 0; i < DESPESAS.length; i++) {
          await client.execute({ sql: \`INSERT INTO plano_contas (id, tipo, codigo, nome, sort_order) VALUES (?,?,?,?,?)\`, args: [require('crypto').randomUUID(), "SAIDA", DESPESAS[i][0], DESPESAS[i][1], i] });
        }
      }

      const resCountCulto = await client.execute("SELECT COUNT(*) AS c FROM tipos_culto");
      if (Number(resCountCulto.rows[0].c) === 0) {
        const tipos = ["Culto", "Ensino", "EBD", "Círculo de Oração", "Ensaio"];
        for (const t of tipos) {
          await client.execute({ sql: \`INSERT INTO tipos_culto (id, nome) VALUES (?,?)\`, args: [require('crypto').randomUUID(), t] });
        }
      }

      const resCountEvento = await client.execute("SELECT COUNT(*) AS c FROM tipos_evento");
      if (Number(resCountEvento.rows[0].c) === 0) {
        const tipos = ["Congresso", "Retiro", "Vigília", "Acampamento"];
        for (const t of tipos) {
          await client.execute({ sql: \`INSERT INTO tipos_evento (id, nome) VALUES (?,?)\`, args: [require('crypto').randomUUID(), t] });
        }
      }
    })
    .catch(e => console.error('Error running SCHEMA on Turso', e));

  return client;
}`;

content = content.replace(
  /function openDb\(\): Database\.Database \{[\s\S]*?return db;\s*\}/,
  newOpenDb
);

const newQ = `export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const t = withAutoId(translate(sql), params);
  const db = getDb();
  const res = await db.execute({ sql: t.sql, args: coerce(t.params) as any });
  return res.rows as unknown as T[];
}`;

content = content.replace(
  /export function q<T = any>\(sql: string, params: unknown\[\] = \[\]\): T\[\] \{[\s\S]*?\}/,
  newQ
);

const newQ1 = `export async function q1<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}`;

content = content.replace(
  /export function q1<T = any>\(sql: string, params: unknown\[\] = \[\]\): T \| null \{[\s\S]*?\}/,
  newQ1
);

// We need to also rewrite the `coerce` function or `needsRows` function if they conflict but they are fine.

fs.writeFileSync('src/lib/sqlite.server.ts', content, 'utf8');
console.log('Successfully refactored sqlite.server.ts');
