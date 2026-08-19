import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import QRCode from "qrcode";
import { q, q1 } from "./db.server";
import { getAppSession } from "./session.server";
import { buildPixPayload, generateTxid } from "./pix-brcode.server";

// Checagens de permissão feitas aqui, lendo a sessão diretamente (sem
// importar de auth-middleware.ts) — evita import circular, já que
// auth-middleware.ts importa checkLicenseBlocked() deste arquivo.
async function requireMasterSession() {
  const session = await getAppSession();
  if (session.data?.role !== "master") {
    throw new Error("Só o usuário master pode fazer isso.");
  }
}

async function requireStaffSession() {
  const session = await getAppSession();
  if (!session.data?.userId) {
    throw new Error("Não autenticado.");
  }
  return session.data;
}

async function requireAdminSession() {
  const session = await getAppSession();
  if (!["master", "admin"].includes(session.data?.role ?? "")) {
    throw new Error("Só admin ou master podem ver isso.");
  }
}

export type LicenseStatus = {
  status: "ATIVA" | "VENCIDA" | "CANCELADA";
  vencimento: string;
  diasRestantes: number;
  avisoVencimento: boolean; // true nos últimos 5 dias
  bloqueado: boolean;       // true quando já passou do vencimento
  valorMensal: number;      // já calculado: sede + (por congregação × quantidade)
};

function computeStatus(row: { status: string; vencimento: string }, valorMensal: number): LicenseStatus {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(row.vencimento + "T00:00:00");
  const diasRestantes = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  const vencidaPelaData = diasRestantes < 0 || row.status === "CANCELADA";
  return {
    status: vencidaPelaData ? "VENCIDA" : (row.status as any),
    vencimento: row.vencimento,
    diasRestantes,
    avisoVencimento: diasRestantes >= 0 && diasRestantes <= 5,
    bloqueado: vencidaPelaData,
    valorMensal,
  };
}

// Sede fixa (1000, por exemplo) + um valor por CADA congregação
// cadastrada (79,90, por exemplo) — o total sobe conforme a igreja cresce.
async function calcularValorMensal(lic: { valor_sede: number; valor_por_congregacao: number }): Promise<{ valor: number; numeroCongregacoes: number }> {
  const contagem = await q1<{ c: number }>(`SELECT COUNT(*) AS c FROM congregations WHERE tipo = 'CONGREGACAO'`);
  const numeroCongregacoes = contagem?.c ?? 0;
  const valor = lic.valor_sede + lic.valor_por_congregacao * numeroCongregacoes;
  return { valor, numeroCongregacoes };
}

// Chamável sem estar logado — é o que a tela de login usa pra decidir se
// mostra o formulário normal ou a tela de "assinatura vencida".
export const getPublicLicenseStatus = createServerFn({ method: "GET" }).handler(async () => {
  const row = await q1<any>(`SELECT * FROM license WHERE id = 1`);
  if (!row) return { status: "ATIVA" as const, vencimento: "", diasRestantes: 999, avisoVencimento: false, bloqueado: false, valorMensal: 0 };
  const { valor } = await calcularValorMensal(row);
  return computeStatus(row, valor);
});



export const getLicenseDetail = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaffSession();
  const row = await q1<any>(`SELECT * FROM license WHERE id = 1`);
  if (!row) throw new Error("Licença não configurada.");
  const { valor, numeroCongregacoes } = await calcularValorMensal(row);
  return {
    ...computeStatus(row, valor),
    valorSede: row.valor_sede,
    valorPorCongregacao: row.valor_por_congregacao,
    numeroCongregacoes,
    pixConfigurado: !!row.pix_chave,
  };
});

const PixSettingsSchema = z.object({
  pix_chave: z.string().trim().min(1),
  pix_nome_recebedor: z.string().trim().min(1),
  pix_cidade: z.string().trim().min(1),
  valor_sede: z.number().min(0),
  valor_por_congregacao: z.number().min(0),
});

// Só o "master" (operador do SaaS) configura pra onde vai o dinheiro da
// mensalidade — isso é diferente da chave PIX da igreja (que é pra
// doações dos membros).
export const saveLicensePixSettings = createServerFn({ method: "POST" })
  .validator((d: unknown) => PixSettingsSchema.parse(d))
  .handler(async ({ data }) => {
    await requireMasterSession();
    await q1(
      `UPDATE license SET pix_chave = $1, pix_nome_recebedor = $2, pix_cidade = $3, valor_sede = $4, valor_por_congregacao = $5, atualizado_em = datetime('now') WHERE id = 1`,
      [data.pix_chave, data.pix_nome_recebedor, data.pix_cidade, data.valor_sede, data.valor_por_congregacao],
    );
    return { ok: true };
  });

// Gera o PIX de renovação — chamável pelo admin da igreja (é quem perde
// acesso, então é quem precisa poder resolver) ou pelo master.
export const generateLicensePayment = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ meses: z.number().int().min(1).max(12).default(1) }).parse(d))
  .handler(async ({ data }) => {
    const lic = await q1<any>(`SELECT * FROM license WHERE id = 1`);
    if (!lic?.pix_chave) {
      throw new Error("O suporte ainda não configurou a chave PIX de recebimento da mensalidade.");
    }
    const { valor: valorMensal } = await calcularValorMensal(lic);
    const valor = valorMensal * data.meses;
    const txid = generateTxid();
    const payload = buildPixPayload({
      chave: lic.pix_chave,
      nomeRecebedor: lic.pix_nome_recebedor,
      cidade: lic.pix_cidade,
      valor,
      txid,
      descricao: `Mensalidade (${data.meses}x)`,
    });
    const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 300 });
    await q1(
      `INSERT INTO license_payments (txid, valor, meses, metodo) VALUES ($1,$2,$3,'PIX')`,
      [txid, valor, data.meses],
    );
    return { txid, valor, qrDataUrl, payload };
  });

export const listLicensePayments = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  return await q(`SELECT * FROM license_payments ORDER BY created_at DESC LIMIT 30`);
});

// Só o master confirma — é ele quem de fato recebe o PIX na conta dele.
const ConfirmSchema = z.object({ id: z.string().min(1) });

export const confirmLicensePayment = createServerFn({ method: "POST" })
  .validator((d: unknown) => ConfirmSchema.parse(d))
  .handler(async ({ data }) => {
    await requireMasterSession();
    const pagamento = await q1<any>(`SELECT * FROM license_payments WHERE id = $1`, [data.id]);
    if (!pagamento) throw new Error("Cobrança não encontrada.");
    if (pagamento.status !== "PENDENTE") throw new Error("Essa cobrança já foi processada.");

    const lic = await q1<any>(`SELECT * FROM license WHERE id = 1`);
    const base = new Date() > new Date(lic.vencimento) ? new Date() : new Date(lic.vencimento);
    base.setMonth(base.getMonth() + pagamento.meses);
    const novoVencimento = base.toISOString().slice(0, 10);

    await q1(`UPDATE license_payments SET status = 'CONFIRMADO', confirmado_em = datetime('now') WHERE id = $1`, [data.id]);
    await q1(`UPDATE license SET status = 'ATIVA', vencimento = $1, atualizado_em = datetime('now') WHERE id = 1`, [novoVencimento]);
    return { ok: true, novoVencimento };
  });

// Master pode ajustar manualmente também (ex.: cortesia, negociação por fora).
export const adjustLicenseManually = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ vencimento: z.string().min(1), status: z.enum(["ATIVA", "VENCIDA", "CANCELADA"]) }).parse(d))
  .handler(async ({ data }) => {
    await requireMasterSession();
    await q1(`UPDATE license SET status = $1, vencimento = $2, atualizado_em = datetime('now') WHERE id = 1`, [data.status, data.vencimento]);
    return { ok: true };
  });
