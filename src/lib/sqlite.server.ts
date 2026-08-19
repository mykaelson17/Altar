import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import bcrypt from "bcryptjs";

declare global {
  // eslint-disable-next-line no-var
  var __sqliteDb: Database.Database | undefined;
}

const SCHEMA = `
-- Congregações — estrutura multi-congregação (sede + congregações).
CREATE TABLE IF NOT EXISTS congregations (
  id           TEXT PRIMARY KEY,
  nome         TEXT NOT NULL,
  tipo         TEXT NOT NULL DEFAULT 'CONGREGACAO' CHECK (tipo IN ('SEDE','CONGREGACAO')),
  endereco     TEXT,
  pastor_responsavel TEXT,
  telefone     TEXT,
  logo_url     TEXT,
  cor_primaria TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Usuários administrativos (equipe pastoral/liderança) — login usuário+senha,
-- separado do login de membros (que é via Google).
CREATE TABLE IF NOT EXISTS app_users (
  id                   TEXT PRIMARY KEY,
  username             TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash        TEXT NOT NULL,
  full_name            TEXT NOT NULL,
  role                 TEXT NOT NULL CHECK (role IN ('master','admin','coordenador','usuario')),
  congregation_id      TEXT REFERENCES congregations(id) ON DELETE SET NULL,
  active               INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Membros e congregados — autenticados via Google (login social). Nome/
-- e-mail/foto vêm do Google; telefone é confirmado manualmente no primeiro
-- acesso (o Google não garante fornecer telefone). Cadastro completo do
-- histórico espiritual é preenchido/mantido pela secretaria.
CREATE TABLE IF NOT EXISTS participants (
  id                TEXT PRIMARY KEY,
  google_sub        TEXT UNIQUE,
  nome              TEXT NOT NULL,
  email             TEXT NOT NULL,
  foto_url          TEXT,
  telefone          TEXT,
  telefone_confirmado INTEGER NOT NULL DEFAULT 0,
  cpf               TEXT,
  estado_civil      TEXT CHECK (estado_civil IN ('SOLTEIRO','CASADO','DIVORCIADO','VIUVO') OR estado_civil IS NULL),
  endereco          TEXT,
  numero            TEXT,
  bairro            TEXT,
  cidade            TEXT,
  estado            TEXT,
  cep               TEXT,
  congregacao       TEXT,
  congregation_id   TEXT REFERENCES congregations(id) ON DELETE SET NULL,
  departamento      TEXT,
  ministerio        TEXT,
  data_nascimento   TEXT,
  data_conversao    TEXT,
  data_batismo      TEXT,
  data_recepcao     TEXT,
  sexo              TEXT CHECK (sexo IN ('M','F') OR sexo IS NULL),
  cargo             TEXT,
  situacao          TEXT NOT NULL DEFAULT 'CONGREGADO' CHECK (situacao IN ('ATIVO','AFASTADO','CONGREGADO','VISITANTE')),
  conjuge_id        TEXT REFERENCES participants(id) ON DELETE SET NULL,
  responsavel_id    TEXT REFERENCES participants(id) ON DELETE SET NULL,
  responsavel_pastoral_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  observacoes_pastorais TEXT,
  carta_mudanca_url TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Carteira de pagamento do participante — métodos salvos (PIX ou cartão
-- tokenizado). O token/id real de cobrança vem de um gateway de pagamento
-- (Mercado Pago/Stripe/Asaas) — aqui só guardamos a referência e os dados
-- de exibição (nunca o número completo do cartão).
CREATE TABLE IF NOT EXISTS payment_methods (
  id             TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('PIX','CARTAO_CREDITO','CARTAO_DEBITO')),
  apelido        TEXT,
  chave_pix      TEXT,
  cartao_final4  TEXT,
  cartao_bandeira TEXT,
  gateway_token  TEXT,
  padrao         INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Congressos/eventos
CREATE TABLE IF NOT EXISTS events (
  id                TEXT PRIMARY KEY,
  nome              TEXT NOT NULL,
  tipo              TEXT,
  departamento      TEXT,
  congregacao       TEXT,
  data_inicio       TEXT NOT NULL,
  data_fim          TEXT NOT NULL,
  local             TEXT,
  organizador       TEXT,
  valor_inscricao   REAL NOT NULL DEFAULT 0,
  valor_uniforme    REAL NOT NULL DEFAULT 0,
  prazo_pagamento   TEXT,
  max_participantes INTEGER,
  observacoes       TEXT,
  arte_url          TEXT,
  regulamento_url   TEXT,
  programacao_url   TEXT,
  regras_inscricao  TEXT,
  preletores        TEXT NOT NULL DEFAULT '[]',
  cantores          TEXT NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','ENCERRADO','CANCELADO')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Configuração de uniforme/roupa por evento (pode ter mais de um modelo,
-- ex.: "Vestido" pras senhoras e "Camisa" pros homens no mesmo congresso).
CREATE TABLE IF NOT EXISTS event_uniforms (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  modelo     TEXT NOT NULL,
  cor        TEXT,
  tecido     TEXT,
  fornecedor TEXT,
  foto_url   TEXT,
  valor      REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Horários diários do evento
CREATE TABLE IF NOT EXISTS event_schedules (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  start_time TEXT,
  end_time   TEXT
);

-- Itens de checklist configuráveis por evento (o organizador define quais
-- fazem sentido pra aquele evento específico).
CREATE TABLE IF NOT EXISTS event_checklist_items (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Inscrições — participante em um evento específico.
CREATE TABLE IF NOT EXISTS registrations (
  id                  TEXT PRIMARY KEY,
  event_id            TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id      TEXT REFERENCES participants(id) ON DELETE SET NULL,
  nome                TEXT NOT NULL,
  cpf                 TEXT,
  email               TEXT,
  data_nascimento     TEXT,
  congregacao         TEXT,
  departamento        TEXT,
  telefone            TEXT,
  sexo                TEXT,
  idade               INTEGER,
  cargo               TEXT,
  uniform_id          TEXT REFERENCES event_uniforms(id) ON DELETE SET NULL,
  tamanho_roupa       TEXT CHECK (tamanho_roupa IN ('PP','P','M','G','GG','XG') OR tamanho_roupa IS NULL),
  possui_roupa_propria INTEGER NOT NULL DEFAULT 0,
  roupa_entregue      INTEGER NOT NULL DEFAULT 0,
  roupa_entregue_em   TEXT,
  valor_total         REAL NOT NULL DEFAULT 0,
  forma_pagamento     TEXT CHECK (forma_pagamento IN ('PIX','CARTAO','DINHEIRO','PARCELADO') OR forma_pagamento IS NULL),
  payment_method_id   TEXT REFERENCES payment_methods(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'INSCRITO' CHECK (status IN ('INSCRITO','DESISTENTE','CANCELADO')),
  qr_code             TEXT NOT NULL UNIQUE,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Parcelas de pagamento de cada inscrição.
CREATE TABLE IF NOT EXISTS payments (
  id              TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  valor           REAL NOT NULL,
  vencimento      TEXT,
  forma           TEXT CHECK (forma IN ('PIX','DINHEIRO','CARTAO') OR forma IS NULL),
  status          TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','PAGO','ATRASADO')),
  pago_em         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Checklist marcado por inscrição (uma linha por item do template do evento).
CREATE TABLE IF NOT EXISTS registration_checklist (
  id                 TEXT PRIMARY KEY,
  registration_id    TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  checklist_item_id  TEXT NOT NULL REFERENCES event_checklist_items(id) ON DELETE CASCADE,
  concluido          INTEGER NOT NULL DEFAULT 0,
  concluido_em       TEXT,
  UNIQUE(registration_id, checklist_item_id)
);

-- Presença via leitura de QR Code na entrada do evento.
CREATE TABLE IF NOT EXISTS attendance (
  id              TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  data_hora       TEXT NOT NULL DEFAULT (datetime('now')),
  responsavel     TEXT
);

-- Financeiro / tesouraria — lançamentos de entrada e saída, por congregação.
CREATE TABLE IF NOT EXISTS finance_transactions (
  id              TEXT PRIMARY KEY,
  congregation_id TEXT REFERENCES congregations(id) ON DELETE SET NULL,
  participant_id  TEXT REFERENCES participants(id) ON DELETE SET NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA')),
  categoria       TEXT NOT NULL,
  valor           REAL NOT NULL,
  data            TEXT NOT NULL,
  forma_pagamento TEXT,
  descricao       TEXT,
  comprovante_url TEXT,
  lancado_por     TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  prestacao_conta_id TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prestação de contas — a congregação "fecha" um período (mês/ano) e envia
-- pra sede toda a movimentação financeira lançada naquele período. Depois
-- de enviada, os lançamentos incluídos ficam "travados" (não aparecem mais
-- como pendentes de envio) — se algo mudar, precisa de uma nova prestação.
CREATE TABLE IF NOT EXISTS prestacoes_contas (
  id               TEXT PRIMARY KEY,
  congregation_id  TEXT NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  mes              INTEGER NOT NULL,
  ano              INTEGER NOT NULL,
  total_entradas   REAL NOT NULL DEFAULT 0,
  total_saidas     REAL NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'ENVIADA' CHECK (status IN ('ENVIADA','EM_ANALISE','PENDENCIA','APROVADA','ENCERRADA')),
  enviado_por      TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  enviado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  revisado_por     TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  revisado_em      TEXT,
  observacoes_sede TEXT
);

-- Plano de contas — categorias padronizadas que a SEDE define; as
-- congregações só escolhem entre elas (não inventam categoria nova),
-- pra permitir comparar "quanto todo mundo gastou com energia" de verdade.
CREATE TABLE IF NOT EXISTS plano_contas (
  id         TEXT PRIMARY KEY,
  tipo       TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA')),
  codigo     TEXT NOT NULL,
  nome       TEXT NOT NULL,
  ativo      INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(tipo, codigo)
);

-- Transferências entre unidades (sede <-> congregação, ou congregação <->
-- congregação) — NÃO entra como entrada/saída em finance_transactions,
-- porque não é dinheiro novo entrando/saindo da organização, só mudando
-- de bolso. Afeta o saldo de cada unidade, mas nunca o total consolidado.
CREATE TABLE IF NOT EXISTS transferencias (
  id                    TEXT PRIMARY KEY,
  origem_congregation_id  TEXT NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  destino_congregation_id TEXT NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  valor                 REAL NOT NULL,
  data                  TEXT NOT NULL,
  motivo                TEXT,
  comprovante_url       TEXT,
  criado_por            TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Auditoria — rastro de eventos financeiros importantes (quem fez o quê,
-- quando). Não é um log técnico, é o "histórico" que a sede/congregação
-- consultam pra entender o que aconteceu com um lançamento ou prestação.
CREATE TABLE IF NOT EXISTS financeiro_auditoria (
  id             TEXT PRIMARY KEY,
  tipo_entidade  TEXT NOT NULL CHECK (tipo_entidade IN ('LANCAMENTO','PRESTACAO','TRANSFERENCIA')),
  entidade_id    TEXT NOT NULL,
  congregation_id TEXT REFERENCES congregations(id) ON DELETE SET NULL,
  acao           TEXT NOT NULL,
  detalhe        TEXT,
  realizado_por  TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS license (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  status                TEXT NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA','VENCIDA','CANCELADA')),
  vencimento            TEXT NOT NULL,
  valor_sede            REAL NOT NULL DEFAULT 1000,
  valor_por_congregacao REAL NOT NULL DEFAULT 79.90,
  pix_chave             TEXT,
  pix_nome_recebedor    TEXT,
  pix_cidade            TEXT,
  atualizado_em         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cobranças de renovação da licença (PIX gerado pra pagar a mensalidade).
CREATE TABLE IF NOT EXISTS license_payments (
  id             TEXT PRIMARY KEY,
  txid           TEXT NOT NULL UNIQUE,
  valor          REAL NOT NULL,
  meses          INTEGER NOT NULL DEFAULT 1,
  metodo         TEXT CHECK (metodo IN ('PIX','CARTAO') OR metodo IS NULL),
  status         TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','CONFIRMADO','CANCELADO')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  confirmado_em  TEXT,
  confirmado_por TEXT REFERENCES app_users(id) ON DELETE SET NULL
);

-- Modelos de documentos — o admin cria o texto com {{placeholders}} que
-- puxam dados do membro/congregação automaticamente, mais campos extras
-- livres (preenchidos na hora de gerar, pra dados que não existem no
-- cadastro, tipo "nova igreja" numa carta de transferência).
CREATE TABLE IF NOT EXISTS document_templates (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  conteudo      TEXT NOT NULL,
  campos_extras TEXT NOT NULL DEFAULT '[]',
  ativo         INTEGER NOT NULL DEFAULT 1,
  criado_por    TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS church_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Cobranças PIX geradas (pelo membro no app, ou pela tesouraria) —
-- cada uma tem um código de referência único (txid) embutido no QR Code,
-- que é o que permite ligar o pagamento de volta ao membro certo.
CREATE TABLE IF NOT EXISTS pix_charges (
  id              TEXT PRIMARY KEY,
  participant_id  TEXT REFERENCES participants(id) ON DELETE SET NULL,
  txid            TEXT NOT NULL UNIQUE,
  categoria       TEXT NOT NULL DEFAULT 'OFERTA',
  valor           REAL,
  descricao       TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','CONFIRMADO','CANCELADO')),
  finance_transaction_id TEXT REFERENCES finance_transactions(id) ON DELETE SET NULL,
  confirmado_por  TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  confirmado_em   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mural de avisos — a sede manda avisos pras congregações (ou pra todo
-- mundo). Aparece automaticamente ao logar, uma vez por dia (controlado
-- por aviso_leituras, que guarda a DATA em que cada usuário já viu cada
-- aviso — no dia seguinte, se o aviso continuar ativo, aparece de novo).
CREATE TABLE IF NOT EXISTS avisos (
  id              TEXT PRIMARY KEY,
  titulo          TEXT NOT NULL,
  mensagem        TEXT NOT NULL,
  congregation_id TEXT REFERENCES congregations(id) ON DELETE CASCADE,
  criado_por      TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  ativo           INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS aviso_leituras (
  id            TEXT PRIMARY KEY,
  aviso_id      TEXT NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  app_user_id   TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  data          TEXT NOT NULL,
  UNIQUE(aviso_id, app_user_id, data)
);

-- Pedidos de oração — visibilidade controlada (público, só liderança, urgente).
CREATE TABLE IF NOT EXISTS prayer_requests (
  id             TEXT PRIMARY KEY,
  participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL,
  nome           TEXT NOT NULL,
  pedido         TEXT NOT NULL,
  visibilidade   TEXT NOT NULL DEFAULT 'PUBLICO' CHECK (visibilidade IN ('PUBLICO','LIDERANCA')),
  urgente        INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO','EM_ORACAO','RESPONDIDO')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pastoreio — visitas, aconselhamentos e acompanhamentos (acesso restrito
-- à liderança, nunca exibido no perfil público do membro).
CREATE TABLE IF NOT EXISTS pastoral_care_notes (
  id             TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('VISITA','ACONSELHAMENTO','ACOMPANHAMENTO','OBSERVACAO')),
  descricao      TEXT NOT NULL,
  registrado_por TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cultos — agenda de cultos/reuniões da congregação.
CREATE TABLE IF NOT EXISTS cultos (
  id              TEXT PRIMARY KEY,
  congregation_id TEXT REFERENCES congregations(id) ON DELETE SET NULL,
  tipo            TEXT NOT NULL,
  data            TEXT NOT NULL,
  horario         TEXT,
  observacoes     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Escalas — quem está escalado pra qual função em qual culto.
CREATE TABLE IF NOT EXISTS escalas (
  id             TEXT PRIMARY KEY,
  culto_id       TEXT NOT NULL REFERENCES cultos(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  funcao         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','CONFIRMADO','TROCA_SOLICITADA','RECUSADO')),
  observacoes    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- EBD — turmas, alunos e frequência.
CREATE TABLE IF NOT EXISTS ebd_turmas (
  id              TEXT PRIMARY KEY,
  congregation_id TEXT REFERENCES congregations(id) ON DELETE SET NULL,
  nome            TEXT NOT NULL,
  professor_id    TEXT REFERENCES participants(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ebd_alunos (
  id             TEXT PRIMARY KEY,
  turma_id       TEXT NOT NULL REFERENCES ebd_turmas(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  ano            INTEGER NOT NULL,
  trimestre      INTEGER NOT NULL,
  UNIQUE(turma_id, participant_id, ano, trimestre)
);

CREATE TABLE IF NOT EXISTS ebd_frequencia (
  id             TEXT PRIMARY KEY,
  turma_id       TEXT NOT NULL REFERENCES ebd_turmas(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  data           TEXT NOT NULL,
  presente       INTEGER NOT NULL DEFAULT 1,
  UNIQUE(turma_id, participant_id, data)
);

-- Discipulado — acompanhamento de novos convertidos, etapa por etapa.
CREATE TABLE IF NOT EXISTS discipulados (
  id               TEXT PRIMARY KEY,
  participant_id   TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  discipulador_id  TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  etapa            TEXT NOT NULL DEFAULT 'VISITANTE' CHECK (etapa IN ('VISITANTE','DECISAO','DISCIPULADO','BATISMO','INTEGRACAO','MINISTERIO')),
  proximo_encontro TEXT,
  observacoes      TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS discipulado_licoes (
  id             TEXT PRIMARY KEY,
  discipulado_id TEXT NOT NULL REFERENCES discipulados(id) ON DELETE CASCADE,
  titulo         TEXT NOT NULL,
  concluida      INTEGER NOT NULL DEFAULT 0,
  concluida_em   TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_registrations_event   ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_part     ON registrations(participant_id);
CREATE INDEX IF NOT EXISTS idx_payments_registration  ON payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_checklist_registration ON registration_checklist(registration_id);
CREATE INDEX IF NOT EXISTS idx_attendance_registration ON attendance(registration_id);
CREATE INDEX IF NOT EXISTS idx_finance_congregation ON finance_transactions(congregation_id, data);
CREATE INDEX IF NOT EXISTS idx_finance_prestacao ON finance_transactions(prestacao_conta_id);
CREATE INDEX IF NOT EXISTS idx_prestacoes_congregation ON prestacoes_contas(congregation_id, ano, mes);
CREATE INDEX IF NOT EXISTS idx_plano_contas_tipo ON plano_contas(tipo, ativo);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON financeiro_auditoria(tipo_entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_congregation ON financeiro_auditoria(congregation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transferencias_origem ON transferencias(origem_congregation_id, data);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON transferencias(destino_congregation_id, data);
CREATE INDEX IF NOT EXISTS idx_pix_charges_participant ON pix_charges(participant_id);
CREATE INDEX IF NOT EXISTS idx_avisos_congregation ON avisos(congregation_id, ativo);
CREATE INDEX IF NOT EXISTS idx_aviso_leituras ON aviso_leituras(aviso_id, app_user_id, data);
CREATE INDEX IF NOT EXISTS idx_participants_congregation ON participants(congregation_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_notes_participant ON pastoral_care_notes(participant_id);
CREATE INDEX IF NOT EXISTS idx_escalas_culto ON escalas(culto_id);
CREATE INDEX IF NOT EXISTS idx_escalas_participant ON escalas(participant_id);
CREATE INDEX IF NOT EXISTS idx_cultos_congregation ON cultos(congregation_id, data);
CREATE INDEX IF NOT EXISTS idx_ebd_alunos_turma ON ebd_alunos(turma_id);
CREATE INDEX IF NOT EXISTS idx_ebd_frequencia_turma ON ebd_frequencia(turma_id, data);
CREATE INDEX IF NOT EXISTS idx_discipulados_participant ON discipulados(participant_id);
CREATE INDEX IF NOT EXISTS idx_discipulado_licoes ON discipulado_licoes(discipulado_id);

CREATE TABLE IF NOT EXISTS cargos (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tipos_culto (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departamentos (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tipos_evento (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function openDb(): Database.Database {
  const dbPath = resolve(process.env.SQLITE_PATH || "./data/dashboard.db");
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  
  // MIGRATION: Add ano and trimestre to ebd_alunos
  try {
    const tableInfo = db.pragma("table_info(ebd_alunos)") as { name: string }[];
    const hasAno = tableInfo.some(col => col.name === "ano");
    if (!hasAno) {
      db.exec(`
        PRAGMA foreign_keys=off;
        BEGIN TRANSACTION;
        CREATE TABLE ebd_alunos_new (
          id             TEXT PRIMARY KEY,
          turma_id       TEXT NOT NULL REFERENCES ebd_turmas(id) ON DELETE CASCADE,
          participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
          ano            INTEGER NOT NULL,
          trimestre      INTEGER NOT NULL,
          UNIQUE(turma_id, participant_id, ano, trimestre)
        );
        INSERT INTO ebd_alunos_new (id, turma_id, participant_id, ano, trimestre) 
        SELECT id, turma_id, participant_id, 2026, 3 FROM ebd_alunos;
        DROP TABLE ebd_alunos;
        ALTER TABLE ebd_alunos_new RENAME TO ebd_alunos;
        CREATE INDEX idx_ebd_alunos_turma ON ebd_alunos(turma_id);
        COMMIT;
        PRAGMA foreign_keys=on;
      `);
    }
  } catch (e) {
    console.error("Migration failed:", e);
  }

  try { db.exec("ALTER TABLE participants ADD COLUMN numero TEXT"); } catch {}
  try { db.exec("ALTER TABLE participants ADD COLUMN bairro TEXT"); } catch {}
  try { db.exec("ALTER TABLE participants ADD COLUMN cidade TEXT"); } catch {}
  try { db.exec("ALTER TABLE participants ADD COLUMN estado TEXT"); } catch {}
  try { db.exec("ALTER TABLE participants ADD COLUMN grupo TEXT CHECK (grupo IN ('SENHORES','SENHORAS','JOVENS','CRIANCAS') OR grupo IS NULL)"); } catch { /* coluna ja existe */ }
  try { db.exec("ALTER TABLE events ADD COLUMN created_by TEXT"); } catch {}
  try { db.exec("ALTER TABLE events ADD COLUMN require_registration INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE events ADD COLUMN regras_inscricao TEXT"); } catch {}
  try { db.exec("ALTER TABLE event_uniforms ADD COLUMN foto_url TEXT"); } catch {}
  try { db.exec("ALTER TABLE registrations ADD COLUMN cpf TEXT"); } catch {}
  try { db.exec("ALTER TABLE registrations ADD COLUMN email TEXT"); } catch {}
  try { db.exec("ALTER TABLE registrations ADD COLUMN data_nascimento TEXT"); } catch {}
  seedAdmin(db);
  return db;
}

function seedAdmin(db: Database.Database) {
  const row = db.prepare("SELECT COUNT(*) AS c FROM app_users").get() as { c: number };
  if (row.c === 0) {
    const hashMaster = bcrypt.hashSync("master123", 10);
    db.prepare(
      `INSERT INTO app_users (id, username, password_hash, full_name, role, must_change_password)
       VALUES (?,?,?,?,?,1)`,
    ).run(randomUUID(), "master", hashMaster, "Suporte / Master", "master");

    const hashAdmin = bcrypt.hashSync("admin123", 10);
    db.prepare(
      `INSERT INTO app_users (id, username, password_hash, full_name, role, must_change_password)
       VALUES (?,?,?,?,?,1)`,
    ).run(randomUUID(), "admin", hashAdmin, "Administrador", "admin");
  }

  const lic = db.prepare("SELECT id FROM license WHERE id = 1").get();
  if (!lic) {
    // Toda instância nova nasce com 30 dias de teste antes de precisar de pagamento.
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 30);
    db.prepare(
      `INSERT INTO license (id, status, vencimento) VALUES (1, 'ATIVA', ?)`,
    ).run(vencimento.toISOString().slice(0, 10));
  }

  const temTemplate = db.prepare("SELECT COUNT(*) AS c FROM document_templates").get() as { c: number };
  if (temTemplate.c === 0) {
    const conteudo = `CARTA DE MUDANÇA DE IGREJA

1. Dados do Remetente
{{membro.nome}} – Remetente
{{membro.endereco}}
{{membro.email}}

2. Dados da Igreja de Origem
{{congregacao.nome}}
{{congregacao.endereco}}
{{congregacao.pastor}}

3. Dados da Nova Igreja
{{extra.nova_igreja_nome}}
{{extra.nova_igreja_endereco}}
{{extra.nova_igreja_pastor}}

4. Motivo da Mudança
{{extra.motivo_mudanca}}

5. Histórico na Igreja de Origem
{{extra.historico_igreja}}

6. Mensagem de Agradecimento
{{extra.mensagem_agradecimento}}

7. Data da Mudança
{{data_hoje}}

8. Assinatura do Remetente
_______________________________
{{membro.nome}}

9. Declaração Final
{{extra.declaracao_final}}

10. Data de Emissão da Carta
{{data_hoje_extenso}}`;
    const camposExtras = JSON.stringify([
      "nova_igreja_nome", "nova_igreja_endereco", "nova_igreja_pastor",
      "motivo_mudanca", "historico_igreja", "mensagem_agradecimento", "declaracao_final",
    ]);
    db.prepare(
      `INSERT INTO document_templates (id, nome, conteudo, campos_extras) VALUES (?,?,?,?)`,
    ).run(randomUUID(), "Carta de Mudança de Igreja", conteudo, camposExtras);
  }

  const temPlano = db.prepare("SELECT COUNT(*) AS c FROM plano_contas").get() as { c: number };
  if (temPlano.c === 0) {
    const RECEITAS: [string, string][] = [
      ["DIZIMO", "Dízimo"], ["OFERTA", "Oferta"], ["MISSOES", "Missões"],
      ["CONSTRUCAO", "Construção"], ["EVENTOS", "Eventos"], ["DOACOES", "Doações"], ["CAMPANHAS", "Campanhas"],
    ];
    const DESPESAS: [string, string][] = [
      ["AGUA", "Água"], ["ENERGIA", "Energia elétrica"], ["INTERNET", "Internet"], ["ALUGUEL", "Aluguel"],
      ["MANUTENCAO", "Manutenção"], ["MATERIAL", "Material"], ["EVENTOS", "Eventos"], ["TRANSPORTE", "Transporte"],
      ["SALARIOS", "Salários / ajuda de custo"], ["AJUDA_SOCIAL", "Ajuda social"], ["OUTROS", "Outras despesas"],
    ];
    const insertConta = db.prepare(`INSERT INTO plano_contas (id, tipo, codigo, nome, sort_order) VALUES (?,?,?,?,?)`);
    RECEITAS.forEach(([codigo, nome], i) => insertConta.run(randomUUID(), "ENTRADA", codigo, nome, i));
    DESPESAS.forEach(([codigo, nome], i) => insertConta.run(randomUUID(), "SAIDA", codigo, nome, i));
  }

  const temTiposCulto = db.prepare("SELECT COUNT(*) AS c FROM tipos_culto").get() as { c: number };
  if (temTiposCulto.c === 0) {
    const insertTipoCulto = db.prepare(`INSERT INTO tipos_culto (id, nome) VALUES (?,?)`);
    ["Culto", "Ensino", "EBD", "Círculo de Oração", "Ensaio"].forEach((nome) => insertTipoCulto.run(randomUUID(), nome));
  }

  const temTiposEvento = db.prepare("SELECT COUNT(*) AS c FROM tipos_evento").get() as { c: number };
  if (temTiposEvento.c === 0) {
    const insertTipoEvento = db.prepare(`INSERT INTO tipos_evento (id, nome) VALUES (?,?)`);
    ["Congresso", "Retiro", "Vigília", "Acampamento"].forEach((nome) => insertTipoEvento.run(randomUUID(), nome));
  }
}

// Mesma pasta onde fica o banco (montada como volume persistente no
// Docker) — usada também pra guardar arquivos (comprovantes de despesa,
// etc.), sem precisar de nenhum serviço de storage externo.
export function getDataDir(): string {
  return dirname(resolve(process.env.SQLITE_PATH || "./data/dashboard.db"));
}

export function getDb(): Database.Database {
  if (!globalThis.__sqliteDb) {
    globalThis.__sqliteDb = openDb();
  }
  return globalThis.__sqliteDb;
}

// -------- Adapter pra manter a mesma API q/q1 (estilo Postgres) --------

function translate(sql: string): string {
  return sql.replace(/\$(\d+)/g, "?");
}

function coerce(params: unknown[]): unknown[] {
  return params.map((p) => {
    if (typeof p === "boolean") return p ? 1 : 0;
    if (p === undefined) return null;
    return p;
  });
}

function needsRows(sql: string): boolean {
  const s = sql.trim().toLowerCase();
  if (s.startsWith("select") || s.startsWith("with")) return true;
  if (/\breturning\b/i.test(sql)) return true;
  return false;
}

const AUTO_ID_TABLES = [
  "app_users", "participants", "payment_methods", "events", "event_uniforms", "event_schedules",
  "event_checklist_items", "registrations", "payments", "registration_checklist", "attendance",
  "congregations", "finance_transactions", "prayer_requests", "pastoral_care_notes", "pix_charges",
  "prestacoes_contas", "cultos", "escalas", "ebd_turmas", "ebd_alunos", "ebd_frequencia",
  "discipulados", "discipulado_licoes", "license_payments", "avisos", "aviso_leituras", "cargos", "departamentos",
  "document_templates", "plano_contas", "financeiro_auditoria", "transferencias", "tipos_culto", "tipos_evento"
];

function withAutoId(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
  const m = sql.match(/insert\s+into\s+(\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
  if (!m) return { sql, params };
  const table = m[1];
  const cols = m[2].split(",").map((s) => s.trim().toLowerCase());
  if (cols.includes("id")) return { sql, params };
  if (!AUTO_ID_TABLES.includes(table.toLowerCase())) return { sql, params };
  const newCols = "id, " + m[2];
  const newVals = "?, " + m[3];
  const newSql = sql.replace(m[0], `INSERT INTO ${table} (${newCols}) VALUES (${newVals})`);
  return { sql: newSql, params: [randomUUID(), ...params] };
}

export function q<T = any>(sql: string, params: unknown[] = []): T[] {
  const t = withAutoId(translate(sql), params);
  const stmt = getDb().prepare(t.sql);
  if (needsRows(t.sql)) return stmt.all(...coerce(t.params)) as T[];
  stmt.run(...coerce(t.params));
  return [] as T[];
}

export function q1<T = any>(sql: string, params: unknown[] = []): T | null {
  const rows = q<T>(sql, params);
  return rows[0] ?? null;
}
