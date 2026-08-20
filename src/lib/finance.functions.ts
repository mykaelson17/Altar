import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import ExcelJS from "exceljs";
import { q, q1 } from "./db.server";
import { randomUUID } from "crypto";
import { requireFinance, requireFinanceEdit, requireAdmin } from "./auth-middleware";

export type FinanceTransaction = {
  id: string;
  congregation_id: string | null;
  participant_id: string | null;
  tipo: "ENTRADA" | "SAIDA";
  categoria: string;
  valor: number;
  data: string;
  forma_pagamento: string | null;
  descricao: string | null;
  prestacao_conta_id: string | null;
};

// Quem não é Pastor Presidente só vê/lança na própria congregação.
function scopeCongregation(auth: { role: string; congregationId: string | null }) {
  return !["master", "admin"].includes(auth.role) ? auth.congregationId : null;
}

// Auditoria — grava um rastro de eventos importantes (não é log técnico,
// é o "histórico" que dá pra mostrar pra quem pergunta "o que aconteceu
// com esse lançamento/prestação").
async function registrarAuditoria(params: {
  tipoEntidade: "LANCAMENTO" | "PRESTACAO";
  entidadeId: string;
  congregationId: string | null;
  acao: string;
  detalhe?: string;
  userId: string;
}) {
  await q1(
    `INSERT INTO financeiro_auditoria (tipo_entidade, entidade_id, congregation_id, acao, detalhe, realizado_por)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [params.tipoEntidade, params.entidadeId, params.congregationId, params.acao, params.detalhe || null, params.userId],
  );
}

export const getAuditoria = createServerFn({ method: "GET" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ tipoEntidade: z.enum(["LANCAMENTO", "PRESTACAO"]), entidadeId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    if (scoped) {
      const tabela = data.tipoEntidade === "LANCAMENTO" ? "finance_transactions" : "prestacoes_contas";
      const registro = await q1<{ congregation_id: string | null }>(`SELECT congregation_id FROM ${tabela} WHERE id = $1`, [data.entidadeId]);
      if (registro?.congregation_id !== scoped) {
        throw new Error("Esse registro não pertence à sua congregação.");
      }
    }
    return await q(
      `SELECT fa.*, u.full_name AS realizado_por_nome
         FROM financeiro_auditoria fa LEFT JOIN app_users u ON u.id = fa.realizado_por
        WHERE fa.tipo_entidade = $1 AND fa.entidade_id = $2
        ORDER BY fa.created_at DESC`,
      [data.tipoEntidade, data.entidadeId],
    );
  });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) =>
    z.object({
      congregation_id: z.string().optional(),
      mes: z.number().int().min(1).max(12).optional(),
      ano: z.number().int().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const conditions: string[] = [];
    const vals: any[] = [];
    let i = 1;

    const scoped = scopeCongregation(context.auth);
    if (scoped) {
      conditions.push(`congregation_id = $${i++}`);
      vals.push(scoped);
    } else if (data.congregation_id) {
      conditions.push(`congregation_id = $${i++}`);
      vals.push(data.congregation_id);
    }

    if (data.ano) {
      const mm = String(data.mes ?? 1).padStart(2, "0");
      if (data.mes) {
        conditions.push(`strftime('%Y-%m', data) = $${i++}`);
        vals.push(`${data.ano}-${mm}`);
      } else {
        conditions.push(`strftime('%Y', data) = $${i++}`);
        vals.push(String(data.ano));
      }
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return await q<FinanceTransaction>(`SELECT * FROM finance_transactions ${where} ORDER BY data DESC`, vals);
  });

const TransactionSchema = z.object({
  congregation_id: z.string().min(1).nullable().optional(),
  tipo: z.enum(["ENTRADA", "SAIDA"]),
  categoria: z.string().trim().min(1),
  valor: z.number().positive(),
  data: z.string().min(1),
  forma_pagamento: z.string().trim().optional(),
  descricao: z.string().trim().optional(),
});

export const addTransaction = createServerFn({ method: "POST" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => TransactionSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Usuário de uma congregação específica só lança NA própria congregação.
    const scoped = scopeCongregation(context.auth);
    const congregationId = scoped ?? data.congregation_id ?? null;

    const [anoStr, mesStr] = data.data.split("-");
    const isFechado = await isPeriodoFechado(congregationId!, Number(mesStr), Number(anoStr));
    if (isFechado) throw new Error("Esse mês contábil já foi fechado/enviado para a Sede e não pode receber novos lançamentos.");

    const row = await q1<{ id: string }>(
      `INSERT INTO finance_transactions (congregation_id, tipo, categoria, valor, data, forma_pagamento, descricao, lancado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [congregationId, data.tipo, data.categoria, data.valor, data.data,
       data.forma_pagamento || null, data.descricao || null, context.auth.userId],
    );
    await registrarAuditoria({
      tipoEntidade: "LANCAMENTO", entidadeId: row!.id, congregationId, userId: context.auth.userId,
      acao: "CRIADO", detalhe: `${data.tipo === "ENTRADA" ? "Entrada" : "Saída"} de ${data.categoria}, R$ ${data.valor.toFixed(2)}`,
    });
    return { ok: true };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireFinanceEdit])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const tx = await q1<FinanceTransaction>(`SELECT * FROM finance_transactions WHERE id = $1`, [data.id]);
    if (!tx) return { ok: true };
    const scoped = scopeCongregation(context.auth);
    if (scoped && tx.congregation_id !== scoped) throw new Error("Esse lançamento não pertence à sua congregação.");
    const [anoStr, mesStr] = tx.data.split("-");
    const isFechado = await isPeriodoFechado(tx.congregation_id, Number(mesStr), Number(anoStr));
    if (isFechado) throw new Error("Esse mês contábil já foi fechado e o lançamento não pode ser removido. Solicite a abertura à Sede.");
    await q1(`DELETE FROM finance_transactions WHERE id = $1`, [data.id]);
    await registrarAuditoria({
      tipoEntidade: "LANCAMENTO", entidadeId: data.id, congregationId: tx.congregation_id, userId: context.auth.userId,
      acao: "EXCLUIDO", detalhe: `${tx.tipo === "ENTRADA" ? "Entrada" : "Saída"} de ${tx.categoria}, R$ ${tx.valor.toFixed(2)}`,
    });
    return { ok: true };
  });

// Editar um lançamento já feito — a congregação NUNCA muda depois de
// criado (por isso não está nos campos aceitos aqui), só master/admin/
// coordenador podem editar.
const UpdateTransactionSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(["ENTRADA", "SAIDA"]).optional(),
  categoria: z.string().trim().min(1).optional(),
  valor: z.number().positive().optional(),
  data: z.string().min(1).optional(),
  forma_pagamento: z.string().trim().optional(),
  descricao: z.string().trim().optional(),
});

export const updateTransaction = createServerFn({ method: "POST" })
  .middleware([requireFinanceEdit])
  .inputValidator((d: unknown) => UpdateTransactionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tx = await q1<FinanceTransaction>(`SELECT * FROM finance_transactions WHERE id = $1`, [data.id]);
    if (!tx) throw new Error("Lançamento não encontrado.");
    const scoped = scopeCongregation(context.auth);
    if (scoped && tx.congregation_id !== scoped) throw new Error("Esse lançamento não pertence à sua congregação.");
    const [anoStr, mesStr] = tx.data.split("-");
    const isFechado = await isPeriodoFechado(tx.congregation_id, Number(mesStr), Number(anoStr));
    if (isFechado) throw new Error("Esse mês contábil já foi fechado e não pode ser editado. Solicite a abertura à Sede.");

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      if (k === "id" || v === undefined) continue;
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
    if (sets.length === 0) return { ok: true };
    vals.push(data.id);
    await q1(`UPDATE finance_transactions SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    const camposAlterados = Object.keys(data).filter((k) => k !== "id");
    await registrarAuditoria({
      tipoEntidade: "LANCAMENTO", entidadeId: data.id, congregationId: tx.congregation_id, userId: context.auth.userId,
      acao: "EDITADO", detalhe: `Campos alterados: ${camposAlterados.join(", ")}`,
    });
    return { ok: true };
  });

// Entradas x saídas por DIA — últimos N dias, respeitando o mesmo escopo
// (congregação específica, sede, ou tudo).
export const getFinanceDaily = createServerFn({ method: "GET" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ dias: z.number().int().min(7).max(90).default(30), congregation_id: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const congId = scoped ?? data.congregation_id;
    const cond = congId ? `AND congregation_id = $2` : "";
    const vals = congId ? [String(data.dias), congId] : [String(data.dias)];

    return await q<{ data: string; tipo: string; total: number }>(
      `SELECT data, tipo, COALESCE(SUM(valor),0) AS total
         FROM finance_transactions
        WHERE data >= date('now', '-' || $1 || ' days') ${cond}
        GROUP BY data, tipo ORDER BY data`,
      vals,
    );
  });


async function isPeriodoFechado(congregation_id: string, mes: number, ano: number): Promise<boolean> {
  // Se não existir prestação de contas no período para a congregação, está aberto
  const prest = await q1(
    `SELECT status FROM prestacoes_contas WHERE congregation_id = $1 AND mes = $2 AND ano = $3`,
    [congregation_id, mes, ano]
  );
  if (!prest) return false; // Nenhuma prestação enviada, aberto
  if (prest.status === 'PENDENCIA') return false; // Sede mandou para correção, aberto

  // Se existir (ENVIADA, EM_ANALISE, APROVADA, ENCERRADA), está FECHADO.
  // Verifica se a Sede concedeu uma exceção de abertura na tabela financeiro_aberturas.
  const abertura = await q1(
    `SELECT id FROM financeiro_aberturas 
     WHERE congregation_id = $1 AND mes = $2 AND ano = $3 AND data_limite > datetime('now')`,
    [congregation_id, mes, ano]
  );
  if (abertura) return false; // Existe exceção aberta e não expirou, então aberto
  
  return true; // Fechado
}

export const requestPeriodOpening = createServerFn({ method: "POST" })
  .middleware([requireFinanceEdit])
  .inputValidator((d: unknown) => z.object({ mes: z.number(), ano: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    if (!scoped) throw new Error("Apenas congregações podem solicitar abertura.");
    
    // Cria um aviso para a sede
    const dtFormatada = `${data.mes.toString().padStart(2, "0")}/${data.ano}`;
    await q1(
      `INSERT INTO avisos (id, titulo, mensagem, author_id, congregation_id, visualizacao)
       VALUES ($1, $2, $3, $4, NULL, 'SEDE')`,
      [
        randomUUID(), 
        `Solicitação de Abertura Contábil: ${dtFormatada}`, 
        `A congregação de ID ${scoped} solicitou a abertura do período ${dtFormatada} para inserir/editar lançamentos.`,
        context.auth.userId
      ]
    );
    return { ok: true };
  });

export const openPeriod = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ congregation_id: z.string(), mes: z.number(), ano: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    // Apaga aberturas antigas se existirem
    await q1(
      `DELETE FROM financeiro_aberturas WHERE congregation_id = $1 AND mes = $2 AND ano = $3`,
      [data.congregation_id, data.mes, data.ano]
    );
    // Cria nova abertura por 24 horas
    await q1(
      `INSERT INTO financeiro_aberturas (id, congregation_id, mes, ano, data_limite, concedido_por)
       VALUES ($1, $2, $3, $4, datetime('now', '+1 day'), $5)`,
      [randomUUID(), data.congregation_id, data.mes, data.ano, context.auth.userId]
    );
    return { ok: true };
  });

export const closePeriod = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await q1(`DELETE FROM financeiro_aberturas WHERE id = $1`, [data.id]);
    return { ok: true };
  });

export const listOpenPeriods = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    return await q(
      `SELECT a.*, c.nome as congregation_nome, u.username as concedido_por_nome 
       FROM financeiro_aberturas a
       JOIN congregations c ON a.congregation_id = c.id
       LEFT JOIN app_users u ON a.concedido_por = u.id
       WHERE a.data_limite > datetime('now')
       ORDER BY a.criado_em DESC`
    );
  });

export const getFinanceSummary = createServerFn({ method: "GET" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ ano: z.number().int(), congregation_id: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const congId = scoped ?? data.congregation_id;
    const cond = congId ? `AND congregation_id = $2` : "";
    const vals = congId ? [String(data.ano), congId] : [String(data.ano)];

    const porMes = await q<{ mes: string; tipo: string; total: number }>(
      `SELECT strftime('%m', data) AS mes, tipo, COALESCE(SUM(valor),0) AS total
         FROM finance_transactions WHERE strftime('%Y', data) = $1 ${cond}
        GROUP BY mes, tipo ORDER BY mes`,
      vals,
    );
    const porCategoria = await q<{ categoria: string; tipo: string; total: number }>(
      `SELECT categoria, tipo, COALESCE(SUM(valor),0) AS total
         FROM finance_transactions WHERE strftime('%Y', data) = $1 ${cond}
        GROUP BY categoria, tipo ORDER BY total DESC`,
      vals,
    );
    const totalEntradas = porMes.filter((r) => r.tipo === "ENTRADA").reduce((s, r) => s + r.total, 0);
    const totalSaidas = porMes.filter((r) => r.tipo === "SAIDA").reduce((s, r) => s + r.total, 0);

    return { porMes, porCategoria, totalEntradas, totalSaidas, saldo: totalEntradas - totalSaidas };
  });

// Saldo é diferente de "resumo do ano" — é o acumulado histórico
// (desde sempre), que é o que realmente importa pra saber "quanto a
// congregação tem hoje".
export const getSaldoResumo = createServerFn({ method: "GET" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ congregation_id: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const congId = scoped ?? data.congregation_id;
    const cond = congId ? `AND congregation_id = $1` : "";
    const vals = congId ? [congId] : [];

    const totais = await q1<{ entradas: number; saidas: number }>(
      `SELECT COALESCE(SUM(CASE WHEN tipo='ENTRADA' THEN valor ELSE 0 END),0) AS entradas,
              COALESCE(SUM(CASE WHEN tipo='SAIDA' THEN valor ELSE 0 END),0) AS saidas
         FROM finance_transactions WHERE 1=1 ${cond}`,
      vals,
    );
    return {
      totalEntradas: totais?.entradas ?? 0,
      totalSaidas: totais?.saidas ?? 0,
      saldo: (totais?.entradas ?? 0) - (totais?.saidas ?? 0),
    };
  });

// Saldo de TODAS as congregações de uma vez — pra sede comparar. Cuidado:
// isso é a SOMA dos saldos de cada uma, não significa que a sede tem
// esse dinheiro numa conta só (cada congregação controla o próprio caixa).
export const getSaldoPorCongregacao = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    return await q<{ congregation_id: string; nome: string; entradas: number; saidas: number; transferenciasRecebidas: number; transferenciasEnviadas: number; saldo: number }>(
      `SELECT c.id AS congregation_id, c.nome,
              COALESCE(SUM(CASE WHEN ft.tipo='ENTRADA' THEN ft.valor ELSE 0 END),0) AS entradas,
              COALESCE(SUM(CASE WHEN ft.tipo='SAIDA' THEN ft.valor ELSE 0 END),0) AS saidas,
              COALESCE((SELECT SUM(valor) FROM transferencias WHERE destino_congregation_id = c.id), 0) AS transferenciasRecebidas,
              COALESCE((SELECT SUM(valor) FROM transferencias WHERE origem_congregation_id = c.id), 0) AS transferenciasEnviadas,
              COALESCE(SUM(CASE WHEN ft.tipo='ENTRADA' THEN ft.valor ELSE -ft.valor END),0)
                + COALESCE((SELECT SUM(valor) FROM transferencias WHERE destino_congregation_id = c.id), 0)
                - COALESCE((SELECT SUM(valor) FROM transferencias WHERE origem_congregation_id = c.id), 0) AS saldo
         FROM congregations c
         LEFT JOIN finance_transactions ft ON ft.congregation_id = c.id
        GROUP BY c.id, c.nome
        ORDER BY c.tipo DESC, c.nome`,
    );
  });

// Visão Consolidada — "como está financeiramente toda a igreja?" — pra
// um mês/ano específico, com o detalhe de cada congregação (receita,
// despesa, saldo DO PERÍODO, e a situação da prestação de contas dela).
// Importante: a soma dos saldos aqui é "saldo consolidado das unidades",
// não significa que a sede tem esse dinheiro numa conta só.
export const getConsolidado = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ mes: z.number().int().min(1).max(12), ano: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const mm = String(data.mes).padStart(2, "0");
    const periodo = `${data.ano}-${mm}`;

    const porCongregacao = await q<{ congregation_id: string | null; nome: string | null; entradas: number; saidas: number }>(
      `SELECT ft.congregation_id, c.nome,
              COALESCE(SUM(CASE WHEN ft.tipo='ENTRADA' THEN ft.valor ELSE 0 END),0) AS entradas,
              COALESCE(SUM(CASE WHEN ft.tipo='SAIDA' THEN ft.valor ELSE 0 END),0) AS saidas
         FROM finance_transactions ft LEFT JOIN congregations c ON c.id = ft.congregation_id
        WHERE strftime('%Y-%m', ft.data) = $1
        GROUP BY ft.congregation_id, c.nome`,
      [periodo],
    );

    const prestacoes = await q<any>(`SELECT congregation_id, status FROM prestacoes_contas WHERE mes = $1 AND ano = $2`, [data.mes, data.ano]);
    const statusMap = new Map(prestacoes.map((p) => [p.congregation_id, p.status]));

    const todasCongs = await q<{ id: string; nome: string; tipo: string }>(`SELECT id, nome, tipo FROM congregations ORDER BY tipo DESC, nome`);
    const dadosMap = new Map(porCongregacao.map((r) => [r.congregation_id, r]));

    const linhas = todasCongs.map((c) => {
      const r = dadosMap.get(c.id);
      return {
        congregation_id: c.id,
        nome: c.nome,
        tipo: c.tipo,
        entradas: r?.entradas ?? 0,
        saidas: r?.saidas ?? 0,
        saldo: (r?.entradas ?? 0) - (r?.saidas ?? 0),
        status: c.tipo === "CONGREGACAO" ? (statusMap.get(c.id) ?? "NAO_ENVIADA") : null,
      };
    });

    const totalEntradas = porCongregacao.reduce((s, r) => s + r.entradas, 0);
    const totalSaidas = porCongregacao.reduce((s, r) => s + r.saidas, 0);

    // Evolução dos últimos 6 meses (todas as congregações somadas).
    const evolucao = await q<{ mes: string; tipo: string; total: number }>(
      `SELECT strftime('%Y-%m', data) AS mes, tipo, COALESCE(SUM(valor),0) AS total
         FROM finance_transactions
        WHERE data >= date($1 || '-01', '-5 months')
        GROUP BY mes, tipo ORDER BY mes`,
      [periodo],
    );

    return { linhas, totalEntradas, totalSaidas, saldoConsolidado: totalEntradas - totalSaidas, evolucao };
  });

// ---------------------------------------------------------------------------
// Prestação de contas — a congregação "fecha" um mês e envia pra sede toda
// a movimentação lançada naquele período que ainda não tinha sido enviada.
// ---------------------------------------------------------------------------

// Resumo do que está PENDENTE de envio (ainda sem prestacao_conta_id) num
// mês/ano — mostrado antes de confirmar o envio.
export const getPendingAccountability = createServerFn({ method: "GET" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ mes: z.number().int().min(1).max(12), ano: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const congId = scopeCongregation(context.auth);
    if (!congId) throw new Error("Só uma congregação específica pode enviar prestação de contas (a sede recebe, não envia).");

    const mm = String(data.mes).padStart(2, "0");
    const prestacao = await q1<any>(
      `SELECT status, observacoes_sede FROM prestacoes_contas WHERE congregation_id = $1 AND mes = $2 AND ano = $3 ORDER BY enviado_em DESC LIMIT 1`,
      [congId, data.mes, data.ano]
    );

    // If there's an active accountability or not, we fetch all transactions of the month
    const rows = await q<FinanceTransaction>(
      `SELECT * FROM finance_transactions
        WHERE congregation_id = $1 AND strftime('%Y-%m', data) = $2
        ORDER BY data`,
      [congId, `${data.ano}-${mm}`],
    );
    const totalEntradas = rows.filter((r) => r.tipo === "ENTRADA").reduce((s, r) => s + r.valor, 0);
    const totalSaidas = rows.filter((r) => r.tipo === "SAIDA").reduce((s, r) => s + r.valor, 0);

    const pastRows = await q<FinanceTransaction>(
      `SELECT * FROM finance_transactions
        WHERE congregation_id = $1 AND strftime('%Y-%m', data) < $2 AND prestacao_conta_id IS NULL
        ORDER BY data DESC`,
      [congId, `${data.ano}-${mm}`]
    );

    const scoped = congId;
    return { 
      transactions: rows, 
      pastDueTransactions: pastRows,
      totalEntradas, 
      totalSaidas, 
      saldo: totalEntradas - totalSaidas,
      prestacaoStatus: prestacao?.status || null,
      observacoesSede: prestacao?.observacoes_sede || null,
      pendentesCount: rows.filter((r) => r.prestacao_conta_id === null).length,
      isFechado: prestacao && prestacao.status !== 'PENDENCIA' 
        ? !(await q1(`SELECT id FROM financeiro_aberturas WHERE congregation_id = $1 AND mes = $2 AND ano = $3 AND data_limite > datetime('now')`, [scoped, data.mes, data.ano]))
        : false,
    };
  });

export const sendAccountability = createServerFn({ method: "POST" })
  .middleware([requireFinanceEdit])
  .inputValidator((d: unknown) => z.object({ mes: z.number().int().min(1).max(12), ano: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const congId = scopeCongregation(context.auth);
    if (!congId) throw new Error("Só uma congregação específica pode enviar prestação de contas.");

    const mm = String(data.mes).padStart(2, "0");
    const rows = await q<FinanceTransaction>(
      `SELECT * FROM finance_transactions
        WHERE congregation_id = $1 AND strftime('%Y-%m', data) = $2 AND prestacao_conta_id IS NULL`,
      [congId, `${data.ano}-${mm}`],
    );
    if (rows.length === 0) throw new Error("Não há lançamentos pendentes de envio nesse período.");

    const totalEntradas = rows.filter((r) => r.tipo === "ENTRADA").reduce((s, r) => s + r.valor, 0);
    const totalSaidas = rows.filter((r) => r.tipo === "SAIDA").reduce((s, r) => s + r.valor, 0);

    const prestacao = await q1<{ id: string }>(
      `INSERT INTO prestacoes_contas (congregation_id, mes, ano, total_entradas, total_saidas, enviado_por)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [congId, data.mes, data.ano, totalEntradas, totalSaidas, context.auth.userId],
    );

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(",");
    await q1(
      `UPDATE finance_transactions SET prestacao_conta_id = $1 WHERE id IN (${placeholders})`,
      [prestacao!.id, ...ids],
    );

    await registrarAuditoria({
      tipoEntidade: "PRESTACAO", entidadeId: prestacao!.id, congregationId: congId, userId: context.auth.userId,
      acao: "ENVIADA", detalhe: `${rows.length} lançamento(s), entradas R$ ${totalEntradas.toFixed(2)}, saídas R$ ${totalSaidas.toFixed(2)}`,
    });

    return { ok: true, id: prestacao!.id, totalEntradas, totalSaidas };
  });

// ---------------------------------------------------------------------------
// Workflow de status — a sede move a prestação entre os estados, sempre
// deixando rastro em financeiro_auditoria.
// ---------------------------------------------------------------------------

export const moverPrestacaoParaAnalise = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const prestacao = await q1<any>(`SELECT * FROM prestacoes_contas WHERE id = $1`, [data.id]);
    if (!prestacao) throw new Error("Prestação não encontrada.");
    await q1(`UPDATE prestacoes_contas SET status = 'EM_ANALISE' WHERE id = $1`, [data.id]);
    await registrarAuditoria({ tipoEntidade: "PRESTACAO", entidadeId: data.id, congregationId: prestacao.congregation_id, userId: context.auth.userId, acao: "EM_ANALISE" });
    return { ok: true };
  });

export const aprovarPrestacao = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const prestacao = await q1<any>(`SELECT * FROM prestacoes_contas WHERE id = $1`, [data.id]);
    if (!prestacao) throw new Error("Prestação não encontrada.");
    await q1(
      `UPDATE prestacoes_contas SET status = 'APROVADA', revisado_por = $1, revisado_em = datetime('now'), observacoes_sede = NULL WHERE id = $2`,
      [context.auth.userId, data.id],
    );
    await registrarAuditoria({ tipoEntidade: "PRESTACAO", entidadeId: data.id, congregationId: prestacao.congregation_id, userId: context.auth.userId, acao: "APROVADA" });
    return { ok: true };
  });

export const marcarPrestacaoPendencia = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), observacao: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const prestacao = await q1<any>(`SELECT * FROM prestacoes_contas WHERE id = $1`, [data.id]);
    if (!prestacao) throw new Error("Prestação não encontrada.");
    await q1(
      `UPDATE prestacoes_contas SET status = 'PENDENCIA', revisado_por = $1, revisado_em = datetime('now'), observacoes_sede = $2 WHERE id = $3`,
      [context.auth.userId, data.observacao, data.id],
    );
    await registrarAuditoria({ tipoEntidade: "PRESTACAO", entidadeId: data.id, congregationId: prestacao.congregation_id, userId: context.auth.userId, acao: "PENDENCIA", detalhe: data.observacao });
    return { ok: true };
  });

export const encerrarPrestacao = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const prestacao = await q1<any>(`SELECT * FROM prestacoes_contas WHERE id = $1`, [data.id]);
    if (!prestacao) throw new Error("Prestação não encontrada.");
    if (prestacao.status !== "APROVADA") throw new Error("Só uma prestação aprovada pode ser encerrada.");
    await q1(`UPDATE prestacoes_contas SET status = 'ENCERRADA' WHERE id = $1`, [data.id]);
    await registrarAuditoria({ tipoEntidade: "PRESTACAO", entidadeId: data.id, congregationId: prestacao.congregation_id, userId: context.auth.userId, acao: "ENCERRADA" });
    return { ok: true };
  });

// Dashboard da sede: pra um mês/ano, mostra o status de CADA congregação
// (mesmo quem ainda não enviou nada) — é o que alimenta os cards
// 🟢 Aprovadas / 🔵 Em análise / 🟠 Pendência / 🔴 Não enviadas.
export const getPrestacaoStatusResumo = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ mes: z.number().int().min(1).max(12), ano: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const congs = await q<{ id: string; nome: string }>(`SELECT id, nome FROM congregations WHERE tipo = 'CONGREGACAO' ORDER BY nome`);
    const prestacoes = await q<any>(`SELECT * FROM prestacoes_contas WHERE mes = $1 AND ano = $2`, [data.mes, data.ano]);
    const map = new Map(prestacoes.map((p) => [p.congregation_id, p]));

    const linhas = congs.map((c) => {
      const p = map.get(c.id);
      return {
        congregation_id: c.id,
        nome: c.nome,
        prestacao_id: p?.id ?? null,
        status: p?.status ?? "NAO_ENVIADA",
        totalEntradas: p?.total_entradas ?? null,
        totalSaidas: p?.total_saidas ?? null,
        observacoes_sede: p?.observacoes_sede ?? null,
      };
    });

    const contagem = { APROVADA: 0, EM_ANALISE: 0, PENDENCIA: 0, ENVIADA: 0, ENCERRADA: 0, NAO_ENVIADA: 0 };
    linhas.forEach((l) => { contagem[l.status as keyof typeof contagem]++; });

    return { linhas, contagem, total: congs.length };
  });

// Comparativo anual — últimos anos, pra ver a evolução ano a ano.
export const getComparativoAnual = createServerFn({ method: "GET" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ congregation_id: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const congId = scoped ?? data.congregation_id;
    const cond = congId ? `AND congregation_id = $1` : "";
    const vals = congId ? [congId] : [];
    return await q<{ ano: string; tipo: string; total: number }>(
      `SELECT strftime('%Y', data) AS ano, tipo, COALESCE(SUM(valor),0) AS total
         FROM finance_transactions WHERE 1=1 ${cond}
        GROUP BY ano, tipo ORDER BY ano`,
      vals,
    );
  });

// Sede: lista todas as prestações recebidas (de todas as congregações).
export const listAccountabilityReports = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    return await q(
      `SELECT pc.*, c.nome AS congregation_nome, u.full_name AS enviado_por_nome,
              (SELECT COUNT(*) FROM finance_transactions ft WHERE ft.prestacao_conta_id = pc.id AND ft.comprovante_url IS NOT NULL) AS total_comprovantes
         FROM prestacoes_contas pc
         JOIN congregations c ON c.id = pc.congregation_id
         LEFT JOIN app_users u ON u.id = pc.enviado_por
        ORDER BY pc.ano DESC, pc.mes DESC, pc.enviado_em DESC`,
    );
  });

export const getAccountabilityDetail = createServerFn({ method: "GET" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const prestacao = await q1<any>(
      `SELECT pc.*, c.nome AS congregation_nome FROM prestacoes_contas pc JOIN congregations c ON c.id = pc.congregation_id WHERE pc.id = $1`,
      [data.id],
    );
    if (!prestacao) throw new Error("Prestação de contas não encontrada.");
    const scoped = scopeCongregation(context.auth);
    if (scoped && prestacao.congregation_id !== scoped) throw new Error("Essa prestação não é da sua congregação.");
    const transactions = await q(`SELECT * FROM finance_transactions WHERE prestacao_conta_id = $1 ORDER BY data`, [data.id]);
    const auditoria = await q(
      `SELECT fa.*, u.full_name AS realizado_por_nome FROM financeiro_auditoria fa
        LEFT JOIN app_users u ON u.id = fa.realizado_por
       WHERE fa.tipo_entidade = 'PRESTACAO' AND fa.entidade_id = $1 ORDER BY fa.created_at DESC`,
      [data.id],
    );
    return { prestacao, transactions, auditoria };
  });

// ---------------------------------------------------------------------------
// Exportação — relatórios de verdade em Excel (.xlsx), pra imprimir ou
// mandar pra contador/conselho. PDF é resolvido pela própria tela de
// impressão do navegador (mesma lógica já usada em Documentos/Carteirinha).
// ---------------------------------------------------------------------------

function fmtBRLXlsx(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const exportFinanceiroExcel = createServerFn({ method: "GET" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ mes: z.number().int().min(1).max(12), ano: z.number().int(), congregation_id: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const congId = scoped ?? data.congregation_id;
    const mm = String(data.mes).padStart(2, "0");
    const periodo = `${data.ano}-${mm}`;
    const cond = congId ? `AND ft.congregation_id = $2` : "";
    const vals = congId ? [periodo, congId] : [periodo];

    const linhas = await q<any>(
      `SELECT ft.data, ft.tipo, ft.categoria, ft.valor, ft.forma_pagamento, ft.descricao, c.nome AS congregacao_nome
         FROM finance_transactions ft LEFT JOIN congregations c ON c.id = ft.congregation_id
        WHERE strftime('%Y-%m', ft.data) = $1 ${cond}
        ORDER BY ft.data`,
      vals,
    );
    const congNome = congId ? (await q1<{ nome: string }>(`SELECT nome FROM congregations WHERE id = $1`, [congId]))?.nome : "Todo o ambiente";

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Lançamentos");
    sheet.addRow([`Relatório Financeiro — ${congNome} — ${MESES_PT[data.mes - 1]}/${data.ano}`]);
    sheet.getRow(1).font = { bold: true, size: 13 };
    sheet.addRow([]);
    sheet.addRow(["Data", "Tipo", "Categoria", "Valor", "Forma de Pagamento", "Descrição", "Congregação"]);
    sheet.getRow(3).font = { bold: true };
    let totalEntradas = 0, totalSaidas = 0;
    linhas.forEach((l) => {
      sheet.addRow([l.data, l.tipo === "ENTRADA" ? "Entrada" : "Saída", l.categoria, l.valor, l.forma_pagamento ?? "", l.descricao ?? "", l.congregacao_nome ?? "Sede/geral"]);
      if (l.tipo === "ENTRADA") totalEntradas += l.valor; else totalSaidas += l.valor;
    });
    sheet.addRow([]);
    sheet.addRow(["", "", "TOTAL ENTRADAS", totalEntradas]).font = { bold: true };
    sheet.addRow(["", "", "TOTAL SAÍDAS", totalSaidas]).font = { bold: true };
    sheet.addRow(["", "", "SALDO DO PERÍODO", totalEntradas - totalSaidas]).font = { bold: true };
    sheet.columns.forEach((col) => { col.width = 18; });
    sheet.getColumn(6).width = 30;

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { base64, filename: `financeiro-${periodo}.xlsx` };
  });

const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const exportConsolidadoExcel = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ mes: z.number().int().min(1).max(12), ano: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const mm = String(data.mes).padStart(2, "0");
    const periodo = `${data.ano}-${mm}`;

    const porCongregacao = await q<any>(
      `SELECT ft.congregation_id, c.nome,
              COALESCE(SUM(CASE WHEN ft.tipo='ENTRADA' THEN ft.valor ELSE 0 END),0) AS entradas,
              COALESCE(SUM(CASE WHEN ft.tipo='SAIDA' THEN ft.valor ELSE 0 END),0) AS saidas
         FROM finance_transactions ft LEFT JOIN congregations c ON c.id = ft.congregation_id
        WHERE strftime('%Y-%m', ft.data) = $1
        GROUP BY ft.congregation_id, c.nome
        ORDER BY entradas DESC`,
      [periodo],
    );
    const prestacoes = await q<any>(`SELECT congregation_id, status FROM prestacoes_contas WHERE mes = $1 AND ano = $2`, [data.mes, data.ano]);
    const statusMap = new Map(prestacoes.map((p) => [p.congregation_id, p.status]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Consolidado");
    sheet.addRow([`Financeiro Consolidado — ${MESES_PT[data.mes - 1]}/${data.ano}`]);
    sheet.getRow(1).font = { bold: true, size: 13 };
    sheet.addRow([]);
    sheet.addRow(["Congregação", "Receita", "Despesa", "Saldo", "Situação Prestação"]);
    sheet.getRow(3).font = { bold: true };
    let totalEntradas = 0, totalSaidas = 0;
    porCongregacao.forEach((r) => {
      sheet.addRow([r.nome ?? "Sede/geral", r.entradas, r.saidas, r.entradas - r.saidas, statusMap.get(r.congregation_id) ?? "—"]);
      totalEntradas += r.entradas; totalSaidas += r.saidas;
    });
    sheet.addRow([]);
    sheet.addRow(["TOTAL CONSOLIDADO", totalEntradas, totalSaidas, totalEntradas - totalSaidas]).font = { bold: true };
    sheet.columns.forEach((col) => { col.width = 26; });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { base64, filename: `consolidado-${periodo}.xlsx` };
  });
