import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import QRCode from "qrcode";
import { q, q1 } from "./db.server";
import { requireAuth, requireFinance } from "./auth-middleware";
import { buildPixPayload, generateTxid } from "./pix-brcode.server";

// ---------------------------------------------------------------------------
// Configurações da igreja (chave PIX de recebimento) — só quem mexe em
// financeiro pode ver/alterar.
// ---------------------------------------------------------------------------
export type ChurchPixSettings = {
  pix_chave: string;
  pix_nome_recebedor: string;
  pix_cidade: string;
};

export const getChurchPixSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const rows = q<{ key: string; value: string }>(
      `SELECT key, value FROM church_settings WHERE key IN ('pix_chave','pix_nome_recebedor','pix_cidade')`,
    );
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      pix_chave: map.pix_chave ?? "",
      pix_nome_recebedor: map.pix_nome_recebedor ?? "",
      pix_cidade: map.pix_cidade ?? "",
    } as ChurchPixSettings;
  });

const SaveSettingsSchema = z.object({
  pix_chave: z.string().trim().min(1),
  pix_nome_recebedor: z.string().trim().min(1),
  pix_cidade: z.string().trim().min(1),
});

export const saveChurchPixSettings = createServerFn({ method: "POST" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => SaveSettingsSchema.parse(d))
  .handler(async ({ data }) => {
    for (const [key, value] of Object.entries(data)) {
      await q1(
        `INSERT INTO church_settings (key, value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value],
      );
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Geração de cobrança PIX — sempre vinculada a um membro (participant_id).
// O txid gerado aqui é o que aparece embutido no QR Code e é o que permite
// achar de volta quem pagou quando o tesoureiro for confirmar.
// ---------------------------------------------------------------------------
async function buildChargeQr(txid: string, valor: number | undefined, descricao: string | undefined) {
  const settings = await getChurchPixSettingsInternal();
  if (!settings.pix_chave) {
    throw new Error("A igreja ainda não configurou a chave PIX de recebimento (Financeiro → Configurar PIX).");
  }
  const payload = buildPixPayload({
    chave: settings.pix_chave,
    nomeRecebedor: settings.pix_nome_recebedor,
    cidade: settings.pix_cidade,
    valor,
    txid,
    descricao,
  });
  const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
  return { payload, qrDataUrl };
}

async function getChurchPixSettingsInternal(): Promise<ChurchPixSettings> {
  const rows = q<{ key: string; value: string }>(
    `SELECT key, value FROM church_settings WHERE key IN ('pix_chave','pix_nome_recebedor','pix_cidade')`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    pix_chave: map.pix_chave ?? "",
    pix_nome_recebedor: map.pix_nome_recebedor ?? "",
    pix_cidade: map.pix_cidade ?? "",
  };
}

const CATEGORIAS_PIX = ["DIZIMO", "OFERTA", "MISSOES", "CONSTRUCAO", "EVENTOS", "DOACOES"] as const;

// Tesouraria gera cobrança em nome de um membro (ex.: combinado por telefone).
export const generateChargeForMember = createServerFn({ method: "POST" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) =>
    z.object({
      participant_id: z.string().min(1),
      categoria: z.enum(CATEGORIAS_PIX).default("OFERTA"),
      valor: z.number().positive().optional(),
      descricao: z.string().trim().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const txid = generateTxid();
    const { qrDataUrl } = await buildChargeQr(txid, data.valor, data.descricao || data.categoria);
    const row = await q1<{ id: string }>(
      `INSERT INTO pix_charges (participant_id, txid, categoria, valor, descricao)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [data.participant_id, txid, data.categoria, data.valor || null, data.descricao || null],
    );
    return { id: row!.id, txid, qrDataUrl };
  });

// ---------------------------------------------------------------------------
// Confirmação (lado da tesouraria) — o Brasil ainda não nos dá um jeito
// grátis de confirmar automaticamente sem um gateway pago. O fluxo aqui é:
// tesoureiro vê o extrato do banco, acha o pagamento (pelo valor e/ou pelo
// texto do txid quando o banco mostra), e confirma manualmente aqui —
// nesse momento, o sistema já cria o lançamento financeiro vinculado ao
// membro automaticamente.
// ---------------------------------------------------------------------------
export const listPendingPixCharges = createServerFn({ method: "GET" })
  .middleware([requireFinance])
  .handler(async () => {
    return q(
      `SELECT pc.*, p.nome AS membro_nome, p.telefone AS membro_telefone
         FROM pix_charges pc LEFT JOIN participants p ON p.id = pc.participant_id
        WHERE pc.status = 'PENDENTE' ORDER BY pc.created_at DESC`,
    );
  });

export const confirmPixCharge = createServerFn({ method: "POST" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), valorConfirmado: z.number().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const charge = await q1<any>(`SELECT * FROM pix_charges WHERE id = $1`, [data.id]);
    if (!charge) throw new Error("Cobrança não encontrada.");
    if (charge.status !== "PENDENTE") throw new Error("Essa cobrança já foi confirmada ou cancelada.");

    const txRow = await q1<{ id: string }>(
      `INSERT INTO finance_transactions (participant_id, tipo, categoria, valor, data, forma_pagamento, descricao, lancado_por)
       VALUES ($1,'ENTRADA',$2,$3,date('now'),'PIX',$4,$5) RETURNING id`,
      [charge.participant_id, charge.categoria, data.valorConfirmado,
       `${charge.descricao ?? charge.categoria} (PIX ${charge.txid})`, context.auth.userId],
    );

    await q1(
      `UPDATE pix_charges SET status = 'CONFIRMADO', finance_transaction_id = $1, confirmado_por = $2, confirmado_em = datetime('now') WHERE id = $3`,
      [txRow!.id, context.auth.userId, data.id],
    );
    return { ok: true };
  });

export const cancelPixCharge = createServerFn({ method: "POST" })
  .middleware([requireFinance])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await q1(`UPDATE pix_charges SET status = 'CANCELADO' WHERE id = $1`, [data.id]);
    return { ok: true };
  });
