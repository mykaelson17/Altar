// Script de dados de TESTE — cria uma sede + ~29 congregações, com
// membros, financeiro (entradas/saídas dos últimos 6 meses) e cultos
// realistas, pra dar pra testar o sistema como se já estivesse em uso.
//
// NÃO roda sozinho na instalação normal — é opcional, só pra quem quer
// ver o sistema "cheio" antes de entregar pra um cliente de verdade.
// NUNCA rode isso numa instância que já tem dados reais de uma igreja.
//
// Como usar:
//   npx tsx seed-demo-data.ts
// (ou dê duplo clique em popular-dados-teste.bat)

// Carrega o .env manualmente — `node`/`tsx` puro NÃO lê .env sozinho.
try { process.loadEnvFile(); } catch { /* sem .env ainda, tudo bem */ }

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getDb } from "./src/lib/sqlite.server";

const db = getDb();

function uid() { return randomUUID(); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

const CIDADES = [
  "Araguaína", "Palmas", "Gurupi", "Porto Nacional", "Colinas do Tocantins", "Paraíso do Tocantins",
  "Guaraí", "Tocantinópolis", "Dianópolis", "Miracema do Tocantins", "Araguatins", "Formoso do Araguaia",
  "Xambioá", "Wanderlândia", "Pedro Afonso", "Goiatins", "Augustinópolis", "Cristalândia",
  "Filadélfia", "Aguiarnópolis", "Novo Acordo", "Itacajá", "Colméia", "Nazaré", "Palmeirópolis",
  "Talismã", "São Miguel do Tocantins", "Riachinho", "Ananás",
];
const BAIRROS = [
  "Centro", "Vila Nova", "Jardim das Flores", "Setor Sul", "Setor Norte", "Bela Vista",
  "São José", "Santa Luzia", "Vila Aurora", "Parque das Acácias",
];
const NOMES_M = [
  "João", "José", "Pedro", "Paulo", "Marcos", "Lucas", "Mateus", "André", "Carlos", "Antônio",
  "Francisco", "Raimundo", "Sebastião", "Manoel", "Wesley", "Gabriel", "Daniel", "Rafael", "Felipe", "Bruno",
  "Ricardo", "Eduardo", "Fernando", "Roberto", "Alexandre", "Vinícius", "Gustavo", "Thiago", "Diego", "Renato",
];
const NOMES_F = [
  "Maria", "Ana", "Francisca", "Antônia", "Adriana", "Juliana", "Márcia", "Fernanda", "Patrícia", "Aline",
  "Sandra", "Camila", "Amanda", "Bruna", "Jéssica", "Letícia", "Vanessa", "Priscila", "Débora", "Raquel",
  "Rute", "Ester", "Sara", "Rebeca", "Tabita", "Lídia", "Joana", "Cláudia", "Simone", "Elaine",
];
const SOBRENOMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes",
  "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa",
  "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas",
];
const CARGOS = ["Membro", "Diácono", "Diaconisa", "Presbítero", "Auxiliar de EBD", "Líder de Louvor", "Tesoureiro Local", null, null, null];
const DEPARTAMENTOS = ["Jovens", "Senhoras", "Homens", "Louvor", "Infantil", "Missões", null, null];

function gerarNome(sexo: "M" | "F") {
  const primeiro = sexo === "M" ? pick(NOMES_M) : pick(NOMES_F);
  return `${primeiro} ${pick(SOBRENOMES)} ${pick(SOBRENOMES)}`;
}
function gerarCPF() {
  return `${randInt(100, 999)}.${randInt(100, 999)}.${randInt(100, 999)}-${randInt(10, 99)}`;
}
function gerarTelefone() {
  return `(63) 9${randInt(8000, 9999)}-${randInt(1000, 9999)}`;
}
function gerarCEP() {
  return `77${randInt(700, 999)}-${randInt(100, 999)}`;
}

function dataAleatoriaEntre(inicio: Date, fim: Date): Date {
  const t = inicio.getTime() + Math.random() * (fim.getTime() - inicio.getTime());
  return new Date(t);
}

console.log("Iniciando seed de dados de teste...\n");

// 1. Sede + 29 congregações ------------------------------------------------
const sedeId = uid();
db.prepare(
  `INSERT INTO congregations (id, nome, tipo, endereco, pastor_responsavel, telefone) VALUES (?,?,?,?,?,?)`,
).run(sedeId, "Igreja Sede", "SEDE", `Av. Central, ${randInt(100, 999)}, Centro, Araguaína - TO`, "Pastor Presidente José Ferreira", gerarTelefone());

const congregacaoIds: { id: string; nome: string; cidade: string }[] = [{ id: sedeId, nome: "Igreja Sede", cidade: "Araguaína" }];

for (let i = 0; i < 29; i++) {
  const cidade = CIDADES[i % CIDADES.length];
  const bairro = pick(BAIRROS);
  const nome = `Congregação ${bairro} — ${cidade}`;
  const id = uid();
  db.prepare(
    `INSERT INTO congregations (id, nome, tipo, endereco, pastor_responsavel, telefone) VALUES (?,?,?,?,?,?)`,
  ).run(id, nome, "CONGREGACAO", `Rua ${pick(SOBRENOMES)}, ${randInt(10, 500)}, ${bairro}, ${cidade} - TO`, `Pastor ${gerarNome("M")}`, gerarTelefone());
  congregacaoIds.push({ id, nome, cidade });
}
console.log(`✓ ${congregacaoIds.length} congregações criadas (1 sede + 29)`);

// 2. Um coordenador por congregação (menos a sede, que já tem o admin) -----
const hashPadrao = bcrypt.hashSync("teste123", 10);
let totalCoordenadores = 0;
for (const cong of congregacaoIds) {
  if (cong.id === sedeId) continue;
  const nome = gerarNome(Math.random() > 0.5 ? "M" : "F");
  const username = `coord_${cong.cidade.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12)}_${randInt(1, 999)}`;
  db.prepare(
    `INSERT INTO app_users (id, username, password_hash, full_name, role, congregation_id, must_change_password) VALUES (?,?,?,?,?,?,1)`,
  ).run(uid(), username, hashPadrao, nome, "coordenador", cong.id);
  totalCoordenadores++;
}
console.log(`✓ ${totalCoordenadores} coordenadores criados (senha padrão: teste123)`);

// 3. Membros por congregação -------------------------------------------------
const SITUACOES: { s: string; peso: number }[] = [
  { s: "ATIVO", peso: 65 }, { s: "CONGREGADO", peso: 20 }, { s: "VISITANTE", peso: 10 }, { s: "AFASTADO", peso: 5 },
];
function situacaoAleatoria() {
  const total = SITUACOES.reduce((s, x) => s + x.peso, 0);
  let r = Math.random() * total;
  for (const s of SITUACOES) { if (r < s.peso) return s.s; r -= s.peso; }
  return "ATIVO";
}

let totalMembros = 0;
const membrosPorCongregacao = new Map<string, string[]>();

for (const cong of congregacaoIds) {
  const qtdMembros = cong.id === sedeId ? randInt(60, 90) : randInt(15, 45);
  const idsDesta: string[] = [];
  for (let i = 0; i < qtdMembros; i++) {
    const sexo: "M" | "F" = Math.random() > 0.48 ? "F" : "M";
    const nome = gerarNome(sexo);
    const email = `${nome.toLowerCase().split(" ")[0]}.${i}.${randInt(100, 9999)}@exemplo.com`;
    const nascimento = dataAleatoriaEntre(new Date(1945, 0, 1), new Date(2015, 0, 1));
    const situacao = situacaoAleatoria();
    const temBatismo = situacao === "ATIVO" && Math.random() > 0.15;
    const dataBatismo = temBatismo ? isoDate(dataAleatoriaEntre(new Date(2005, 0, 1), new Date())) : null;
    const dataConversao = temBatismo || Math.random() > 0.5 ? isoDate(dataAleatoriaEntre(new Date(2000, 0, 1), new Date())) : null;
    const id = uid();
    db.prepare(
      `INSERT INTO participants (id, nome, email, telefone, cpf, estado_civil, endereco, cep, congregation_id,
                                  departamento, ministerio, data_nascimento, data_conversao, data_batismo,
                                  sexo, cargo, situacao)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id, nome, email, gerarTelefone(), gerarCPF(), pick(["SOLTEIRO", "CASADO", "DIVORCIADO", "VIUVO"]),
      `Rua ${pick(SOBRENOMES)}, ${randInt(10, 800)}, ${pick(BAIRROS)}, ${cong.cidade} - TO`, gerarCEP(), cong.id,
      pick(DEPARTAMENTOS), pick(DEPARTAMENTOS), isoDate(nascimento), dataConversao, dataBatismo,
      sexo, pick(CARGOS), situacao,
    );
    idsDesta.push(id);
    totalMembros++;
  }
  membrosPorCongregacao.set(cong.id, idsDesta);
}
console.log(`✓ ${totalMembros} membros criados`);

const admin = db.prepare(`SELECT id FROM app_users WHERE role = 'admin' LIMIT 1`).get() as { id: string } | undefined;

// 4. Financeiro — últimos 6 meses, cada congregação -------------------------
const CATEGORIAS_ENTRADA = ["DIZIMO", "DIZIMO", "DIZIMO", "OFERTA", "OFERTA", "MISSOES", "DOACOES"];
const CATEGORIAS_SAIDA = ["AGUA", "ENERGIA", "INTERNET", "MANUTENCAO", "MATERIAL", "AJUDA_SOCIAL", "SALARIOS"];
const hoje = new Date();
let totalTransacoes = 0;
let totalPrestacoesEnviadas = 0;

for (const cong of congregacaoIds) {
  const membrosIds = membrosPorCongregacao.get(cong.id) ?? [];
  const porte = cong.id === sedeId ? 3 : (membrosIds.length > 30 ? 1.5 : 1);

  for (let mesesAtras = 5; mesesAtras >= 0; mesesAtras--) {
    const anoMes = new Date(hoje.getFullYear(), hoje.getMonth() - mesesAtras, 1);
    const diasNoMes = new Date(anoMes.getFullYear(), anoMes.getMonth() + 1, 0).getDate();
    const idsDoMes: string[] = [];

    // Dízimos/ofertas — várias entradas espalhadas pelo mês (domingos, +/-)
    const qtdEntradas = Math.round(randInt(8, 16) * porte);
    for (let i = 0; i < qtdEntradas; i++) {
      const dia = randInt(1, diasNoMes);
      const data = isoDate(new Date(anoMes.getFullYear(), anoMes.getMonth(), dia));
      const categoria = pick(CATEGORIAS_ENTRADA);
      const valor = categoria === "DIZIMO" ? randInt(50, 400) : randInt(20, 200);
      const id = uid();
      db.prepare(
        `INSERT INTO finance_transactions (id, congregation_id, tipo, categoria, valor, data, forma_pagamento, descricao)
         VALUES (?,?,?,?,?,?,?,?)`,
      ).run(id, cong.id, "ENTRADA", categoria, valor, data, pick(["PIX", "DINHEIRO", "DINHEIRO", "PIX"]), null);
      idsDoMes.push(id);
      totalTransacoes++;
    }

    // Despesas fixas do mês
    for (const categoria of CATEGORIAS_SAIDA) {
      if (categoria === "SALARIOS" && Math.random() > 0.3) continue; // nem toda congregação pequena paga
      if (Math.random() > 0.75 && categoria !== "AGUA" && categoria !== "ENERGIA") continue;
      const dia = randInt(1, diasNoMes);
      const data = isoDate(new Date(anoMes.getFullYear(), anoMes.getMonth(), dia));
      const valor = categoria === "SALARIOS" ? randInt(800, 2500) * porte
        : categoria === "AGUA" ? randInt(60, 180)
        : categoria === "ENERGIA" ? randInt(150, 450)
        : randInt(40, 300);
      const id = uid();
      db.prepare(
        `INSERT INTO finance_transactions (id, congregation_id, tipo, categoria, valor, data, forma_pagamento, descricao)
         VALUES (?,?,?,?,?,?,?,?)`,
      ).run(id, cong.id, "SAIDA", categoria, Math.round(valor), data, pick(["PIX", "TRANSFERENCIA", "DINHEIRO"]), null);
      idsDoMes.push(id);
      totalTransacoes++;
    }

    // Prestação de contas: meses antigos (2+ atrás) ficam majoritariamente
    // enviados, pra simular uso real — só o mês corrente e o passado
    // ficam pendentes de propósito (pra dar pra testar a cobrança de
    // inadimplência de verdade).
    if (mesesAtras >= 2 && cong.id !== sedeId && Math.random() > 0.2) {
      const linhas = idsDoMes.map((id) => db.prepare(`SELECT * FROM finance_transactions WHERE id = ?`).get(id) as any);
      const entradas = linhas.filter((l) => l.tipo === "ENTRADA").reduce((s, l) => s + l.valor, 0);
      const saidas = linhas.filter((l) => l.tipo === "SAIDA").reduce((s, l) => s + l.valor, 0);
      const prestacaoId = uid();

      // Varia o status pra demonstração ficar realista: a maioria já foi
      // aprovada (mês antigo, tempo de sobra), algumas ainda em análise,
      // e umas poucas com pendência de verdade (com observação da sede).
      const roleta = Math.random();
      const status = roleta > 0.75 ? "APROVADA" : roleta > 0.6 ? "EM_ANALISE" : roleta > 0.5 ? "PENDENCIA" : "ENVIADA";
      const observacao = status === "PENDENCIA" ? pick([
        "Falta comprovante de uma das despesas de manutenção.",
        "Valor da oferta não bate com o total informado — favor revisar.",
        "Anexar comprovante da despesa de energia elétrica.",
      ]) : null;

      db.prepare(
        `INSERT INTO prestacoes_contas (id, congregation_id, mes, ano, total_entradas, total_saidas, enviado_em, status, observacoes_sede, revisado_por, revisado_em)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        prestacaoId, cong.id, anoMes.getMonth() + 1, anoMes.getFullYear(), entradas, saidas,
        isoDate(new Date(anoMes.getFullYear(), anoMes.getMonth() + 1, 3)), status, observacao,
        status !== "ENVIADA" ? admin?.id ?? null : null,
        status !== "ENVIADA" ? isoDate(new Date(anoMes.getFullYear(), anoMes.getMonth() + 1, 5)) : null,
      );
      db.prepare(`INSERT INTO financeiro_auditoria (id, tipo_entidade, entidade_id, congregation_id, acao, realizado_por) VALUES (?,?,?,?,?,?)`)
        .run(uid(), "PRESTACAO", prestacaoId, cong.id, "ENVIADA", admin?.id ?? null);
      if (status !== "ENVIADA") {
        db.prepare(`INSERT INTO financeiro_auditoria (id, tipo_entidade, entidade_id, congregation_id, acao, detalhe, realizado_por) VALUES (?,?,?,?,?,?,?)`)
          .run(uid(), "PRESTACAO", prestacaoId, cong.id, status, observacao, admin?.id ?? null);
      }

      const placeholders = idsDoMes.map(() => "?").join(",");
      db.prepare(`UPDATE finance_transactions SET prestacao_conta_id = ? WHERE id IN (${placeholders})`).run(prestacaoId, ...idsDoMes);
      totalPrestacoesEnviadas++;
    }
  }
}
console.log(`✓ ${totalTransacoes} lançamentos financeiros criados (6 meses de histórico por congregação)`);
console.log(`✓ ${totalPrestacoesEnviadas} prestações de contas já enviadas (meses antigos) — alguns meses recentes ficaram pendentes de propósito, pra testar a cobrança de inadimplência`);

// 5. Cultos (próximas semanas, sede + algumas congregações) -----------------
const TIPOS_CULTO = ["Doutrina", "Santa Ceia", "Jovens", "Senhoras", "Vigília", "Culto de Oração"];
let totalCultos = 0;
for (const cong of [congregacaoIds[0], ...congregacaoIds.slice(1, 8)]) {
  for (let semana = -2; semana <= 4; semana++) {
    const data = new Date(hoje);
    data.setDate(data.getDate() + semana * 7);
    db.prepare(
      `INSERT INTO cultos (id, congregation_id, tipo, data, horario) VALUES (?,?,?,?,?)`,
    ).run(uid(), cong.id, pick(TIPOS_CULTO), isoDate(data), pick(["19:00", "19:30", "20:00"]));
    totalCultos++;
  }
}
console.log(`✓ ${totalCultos} cultos agendados (sede + 7 congregações, ±1 mês)`);

// 5b. EBD — turmas, matrículas e frequência das últimas semanas -------------
const NOMES_TURMA = ["Adultos", "Jovens", "Adolescentes", "Crianças"];
let totalTurmas = 0, totalMatriculas = 0, totalChamadas = 0;
for (const cong of [congregacaoIds[0], ...congregacaoIds.slice(1, 8)]) {
  const membrosIds = membrosPorCongregacao.get(cong.id) ?? [];
  if (membrosIds.length < 6) continue;

  const qtdTurmas = randInt(1, 2);
  for (let i = 0; i < qtdTurmas; i++) {
    const professorId = pick(membrosIds);
    const turmaId = uid();
    db.prepare(`INSERT INTO ebd_turmas (id, nome, professor_id, congregation_id) VALUES (?,?,?,?)`)
      .run(turmaId, NOMES_TURMA[i % NOMES_TURMA.length], professorId, cong.id);
    totalTurmas++;

    // Matricula um punhado de membros (evita repetir o professor como aluno também, sem problema se repetir).
    const qtdAlunos = randInt(5, Math.min(15, membrosIds.length));
    const alunosDaTurma = [...membrosIds].sort(() => Math.random() - 0.5).slice(0, qtdAlunos);
    alunosDaTurma.forEach((alunoId) => {
      db.prepare(`INSERT INTO ebd_alunos (id, turma_id, participant_id) VALUES (?,?,?)`).run(uid(), turmaId, alunoId);
      totalMatriculas++;
    });

    // Chamada nos últimos ~8 domingos — cada aluno tem uma frequência
    // "de base" diferente (uns vêm sempre, outros faltam mais), pra dar
    // dados realistas pro ranking de presença.
    const frequenciaBase = new Map(alunosDaTurma.map((id) => [id, 0.5 + Math.random() * 0.45]));
    for (let semanasAtras = 8; semanasAtras >= 1; semanasAtras--) {
      const dataChamada = new Date(hoje);
      dataChamada.setDate(dataChamada.getDate() - semanasAtras * 7);
      // Só registra a chamada se cair num domingo (aproxima ajustando pro domingo mais próximo).
      const diaSemana = dataChamada.getDay();
      dataChamada.setDate(dataChamada.getDate() + (0 - diaSemana));
      alunosDaTurma.forEach((alunoId) => {
        const presente = Math.random() < (frequenciaBase.get(alunoId) ?? 0.7) ? 1 : 0;
        db.prepare(`INSERT INTO ebd_frequencia (id, turma_id, participant_id, data, presente) VALUES (?,?,?,?,?)`)
          .run(uid(), turmaId, alunoId, isoDate(dataChamada), presente);
        totalChamadas++;
      });
    }
  }
}
console.log(`✓ ${totalTurmas} turma(s) de EBD, ${totalMatriculas} matrícula(s), ${totalChamadas} registro(s) de chamada`);

// 6. Avisos de exemplo -------------------------------------------------------
if (admin) {
  db.prepare(`INSERT INTO avisos (id, titulo, mensagem, congregation_id, criado_por) VALUES (?,?,?,?,?)`).run(
    uid(), "Bem-vindos ao sistema!", "Esse é um aviso de exemplo — qualquer congregação pode receber comunicados assim.", null, admin.id,
  );
  console.log("✓ 1 aviso de exemplo criado");
}

console.log("\n=== Resumo ===");
console.log(`Congregações: ${congregacaoIds.length}`);
console.log(`Coordenadores: ${totalCoordenadores} (login: coord_<cidade>_<numero> / senha: teste123)`);
console.log(`Membros: ${totalMembros}`);
console.log(`Lançamentos financeiros: ${totalTransacoes}`);
console.log(`Cultos: ${totalCultos}`);
console.log("\nPronto! O sistema já está com dados de teste parecidos com um ambiente real.");
