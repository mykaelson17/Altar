import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { q, q1 } from "./db.server";
import { requireAuth } from "./auth-middleware";

// ---------------------------------------------------------------------------
// Busca de participantes já cadastrados (logaram via Google alguma vez),
// pra autopreencher uma inscrição sem digitar tudo de novo.
// ---------------------------------------------------------------------------
export const searchParticipants = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(2) }).parse(d))
  .handler(async ({ data }) => {
    return await q(
      `SELECT id, nome, email, telefone, congregacao, departamento, foto_url, data_nascimento, sexo, cargo
         FROM participants
        WHERE nome LIKE $1 OR email LIKE $1
        ORDER BY nome LIMIT 15`,
      [`%${data.query}%`],
    );
  });

export type RegistrationRow = {
  id: string;
  event_id: string;
  participant_id: string | null;
  nome: string;
  congregacao: string | null;
  departamento: string | null;
  telefone: string | null;
  sexo: string | null;
  idade: number | null;
  cargo: string | null;
  uniform_id: string | null;
  tamanho_roupa: string | null;
  possui_roupa_propria: number;
  roupa_entregue: number;
  roupa_entregue_em: string | null;
  valor_total: number;
  forma_pagamento: string | null;
  status: "INSCRITO" | "DESISTENTE" | "CANCELADO";
  qr_code: string;
};

export const listRegistrations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const regs = await q<RegistrationRow>(`SELECT * FROM registrations WHERE event_id = $1 ORDER BY nome`, [data.event_id]);
    const ids = regs.map((r) => r.id);
    if (ids.length === 0) return [];

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const pagos = await q<{ registration_id: string; total: number }>(
      `SELECT registration_id, COALESCE(SUM(valor),0) AS total FROM payments
        WHERE registration_id IN (${placeholders}) AND status = 'PAGO' GROUP BY registration_id`,
      ids,
    );
    const checklistTotal = await q<{ event_id: string; c: number }>(
      `SELECT event_id, COUNT(*) AS c FROM event_checklist_items WHERE event_id = $1 GROUP BY event_id`,
      [data.event_id],
    );
    const checklistFeitos = await q<{ registration_id: string; c: number }>(
      `SELECT registration_id, COUNT(*) AS c FROM registration_checklist
        WHERE registration_id IN (${placeholders}) AND concluido = 1 GROUP BY registration_id`,
      ids,
    );

    const pagoMap = new Map(pagos.map((p) => [p.registration_id, p.total]));
    const checklistFeitosMap = new Map(checklistFeitos.map((c) => [c.registration_id, c.c]));
    const totalItens = checklistTotal[0]?.c ?? 0;

    return regs.map((r) => {
      const totalPago = pagoMap.get(r.id) ?? 0;
      let statusPagamento: "PAGO" | "PARCIAL" | "ABERTO" = "ABERTO";
      if (totalPago >= r.valor_total && r.valor_total > 0) statusPagamento = "PAGO";
      else if (totalPago > 0) statusPagamento = "PARCIAL";
      return {
        ...r,
        total_pago: totalPago,
        status_pagamento: statusPagamento,
        checklist_feitos: checklistFeitosMap.get(r.id) ?? 0,
        checklist_total: totalItens,
      };
    });
  });

export const getRegistration = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const registration = await q1<RegistrationRow>(`SELECT * FROM registrations WHERE id = $1`, [data.id]);
    if (!registration) throw new Error("Inscrição não encontrada.");
    const event = await q1(`SELECT * FROM events WHERE id = $1`, [registration.event_id]);
    const payments = await q(`SELECT * FROM payments WHERE registration_id = $1 ORDER BY vencimento`, [data.id]);
    const checklist = await q(
      `SELECT eci.id AS checklist_item_id, eci.label, eci.sort_order,
              COALESCE(rc.concluido, 0) AS concluido, rc.concluido_em
         FROM event_checklist_items eci
         LEFT JOIN registration_checklist rc ON rc.checklist_item_id = eci.id AND rc.registration_id = $1
        WHERE eci.event_id = $2
        ORDER BY eci.sort_order`,
      [data.id, registration.event_id],
    );
    const attendance = await q(`SELECT * FROM attendance WHERE registration_id = $1 ORDER BY data_hora DESC`, [data.id]);
    return { registration, event, payments, checklist, attendance };
  });

const CreateRegistrationSchema = z.object({
  event_id: z.string().min(1),
  participant_id: z.string().min(1).nullable().optional(),
  nome: z.string().trim().min(1),
  cpf: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  data_nascimento: z.string().trim().optional(),
  congregacao: z.string().trim().optional(),
  departamento: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  sexo: z.enum(["M", "F"]).optional(),
  idade: z.number().int().positive().optional(),
  cargo: z.string().trim().optional(),
  uniform_id: z.string().min(1).nullable().optional(),
  tamanho_roupa: z.enum(["PP", "P", "M", "G", "GG", "XG"]).optional(),
  possui_roupa_propria: z.boolean().default(false),
});

export const createRegistration = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CreateRegistrationSchema.parse(d))
  .handler(async ({ data }) => {
    const event = await q1<any>(`SELECT * FROM events WHERE id = $1`, [data.event_id]);
    if (!event) throw new Error("Evento não encontrado.");

    if (event.max_participantes) {
      const count = await q1<{ c: number }>(
        `SELECT COUNT(*) AS c FROM registrations WHERE event_id = $1 AND status = 'INSCRITO'`,
        [data.event_id],
      );
      if ((count?.c ?? 0) >= event.max_participantes) {
        throw new Error("Esse evento já atingiu o número máximo de participantes.");
      }
    }

    const valorTotal = event.valor_inscricao + (data.possui_roupa_propria ? 0 : event.valor_uniforme);
    const qrCode = randomBytes(12).toString("hex");

    const row = await q1<{ id: string }>(
      `INSERT INTO registrations (event_id, participant_id, nome, cpf, email, data_nascimento, congregacao, departamento, telefone, sexo,
                                   idade, cargo, uniform_id, tamanho_roupa, possui_roupa_propria, valor_total, qr_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [data.event_id, data.participant_id || null, data.nome, data.cpf || null, data.email || null, data.data_nascimento || null,
       data.congregacao || null, data.departamento || null,
       data.telefone || null, data.sexo || null, data.idade || null, data.cargo || null, data.uniform_id || null,
       data.tamanho_roupa || null, data.possui_roupa_propria, valorTotal, qrCode],
    );

    // Cria uma linha de checklist (não marcada) pra cada item do template do evento.
    const items = await q<{ id: string }>(`SELECT id FROM event_checklist_items WHERE event_id = $1`, [data.event_id]);
    for (const item of items) {
      await q1(
        `INSERT INTO registration_checklist (registration_id, checklist_item_id, concluido) VALUES ($1,$2,0)`,
        [row!.id, item.id],
      );
    }

    return row;
  });

export const createPublicRegistration = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateRegistrationSchema.parse(d))
  .handler(async ({ data }) => {
    const event = await q1<any>(`SELECT * FROM events WHERE id = $1 AND status = 'ATIVO'`, [data.event_id]);
    if (!event) throw new Error("Evento não encontrado ou não está aceitando inscrições.");
    if (!event.require_registration) throw new Error("Este evento não requer inscrição prévia.");

    if (event.max_participantes) {
      const count = await q1<{ c: number }>(
        `SELECT COUNT(*) AS c FROM registrations WHERE event_id = $1 AND status = 'INSCRITO'`,
        [data.event_id],
      );
      if ((count?.c ?? 0) >= event.max_participantes) {
        throw new Error("Esse evento já atingiu o número máximo de participantes.");
      }
    }

    const valorTotal = event.valor_inscricao + (data.possui_roupa_propria ? 0 : event.valor_uniforme);
    const qrCode = randomBytes(12).toString("hex");

    const row = await q1<{ id: string }>(
      `INSERT INTO registrations (event_id, participant_id, nome, cpf, email, data_nascimento, congregacao, departamento, telefone, sexo,
                                   idade, cargo, uniform_id, tamanho_roupa, possui_roupa_propria, valor_total, qr_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [data.event_id, null, data.nome, data.cpf || null, data.email || null, data.data_nascimento || null,
       data.congregacao || null, data.departamento || null,
       data.telefone || null, data.sexo || null, data.idade || null, data.cargo || null, data.uniform_id || null,
       data.tamanho_roupa || null, data.possui_roupa_propria, valorTotal, qrCode],
    );

    // Cria uma linha de checklist (não marcada) pra cada item do template do evento.
    const items = await q<{ id: string }>(`SELECT id FROM event_checklist_items WHERE event_id = $1`, [data.event_id]);
    for (const item of items) {
      await q1(
        `INSERT INTO registration_checklist (registration_id, checklist_item_id, concluido) VALUES ($1,$2,0)`,
        [row!.id, item.id],
      );
    }

    return row;
  });

const UpdateRegistrationSchema = z.object({
  id: z.string().min(1),
  tamanho_roupa: z.enum(["PP", "P", "M", "G", "GG", "XG"]).optional(),
  possui_roupa_propria: z.boolean().optional(),
  status: z.enum(["INSCRITO", "DESISTENTE", "CANCELADO"]).optional(),
  telefone: z.string().trim().optional(),
});

export const updateRegistration = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateRegistrationSchema.parse(d))
  .handler(async ({ data }) => {
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      if (k === "id" || v === undefined) continue;
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at = datetime('now')`);
    vals.push(data.id);
    await q1(`UPDATE registrations SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    return { ok: true };
  });

export const toggleRoupaEntregue = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), entregue: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await q1(
      `UPDATE registrations SET roupa_entregue = $1, roupa_entregue_em = $2 WHERE id = $3`,
      [data.entregue, data.entregue ? new Date().toISOString() : null, data.id],
    );
    return { ok: true };
  });

export const deleteRegistration = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await q1(`DELETE FROM registrations WHERE id = $1`, [data.id]);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// QR Code — gera a imagem (data URL) a partir do token salvo na inscrição.
// ---------------------------------------------------------------------------
export const getRegistrationQrImage = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ registrationId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const reg = await q1<{ qr_code: string }>(`SELECT qr_code FROM registrations WHERE id = $1`, [data.registrationId]);
    if (!reg) throw new Error("Inscrição não encontrada.");
    const dataUrl = await QRCode.toDataURL(reg.qr_code, { margin: 1, width: 320 });
    return { dataUrl };
  });

// ---------------------------------------------------------------------------
// Pagamentos (parcelas)
// ---------------------------------------------------------------------------
const AddPaymentSchema = z.object({
  registration_id: z.string().min(1),
  descricao: z.string().trim().min(1),
  valor: z.number().positive(),
  vencimento: z.string().optional(),
  forma: z.enum(["PIX", "DINHEIRO", "CARTAO"]).optional(),
});

export const addPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => AddPaymentSchema.parse(d))
  .handler(async ({ data }) => {
    await q1(
      `INSERT INTO payments (registration_id, descricao, valor, vencimento, forma) VALUES ($1,$2,$3,$4,$5)`,
      [data.registration_id, data.descricao, data.valor, data.vencimento || null, data.forma || null],
    );
    return { ok: true };
  });

export const markPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), status: z.enum(["PENDENTE", "PAGO", "ATRASADO"]) }).parse(d))
  .handler(async ({ data }) => {
    await q1(
      `UPDATE payments SET status = $1, pago_em = $2 WHERE id = $3`,
      [data.status, data.status === "PAGO" ? new Date().toISOString() : null, data.id],
    );
    return { ok: true };
  });

export const deletePayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await q1(`DELETE FROM payments WHERE id = $1`, [data.id]);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Checklist por inscrição
// ---------------------------------------------------------------------------
export const toggleChecklist = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ registration_id: z.string().min(1), checklist_item_id: z.string().min(1), concluido: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await q1(
      `INSERT INTO registration_checklist (registration_id, checklist_item_id, concluido, concluido_em)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (registration_id, checklist_item_id)
       DO UPDATE SET concluido = EXCLUDED.concluido, concluido_em = EXCLUDED.concluido_em`,
      [data.registration_id, data.checklist_item_id, data.concluido, data.concluido ? new Date().toISOString() : null],
    );
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Check-in (leitura de QR na entrada)
// ---------------------------------------------------------------------------
export const checkIn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ qr_code: z.string().min(1), responsavel: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const registration = await q1<RegistrationRow & { nome: string }>(
      `SELECT * FROM registrations WHERE qr_code = $1`, [data.qr_code],
    );
    if (!registration) throw new Error("QR Code não corresponde a nenhuma inscrição.");
    if (registration.status !== "INSCRITO") {
      throw new Error(`Esta inscrição está com status "${registration.status}", não pode fazer check-in.`);
    }
    const event = await q1<{ nome: string }>(`SELECT nome FROM events WHERE id = $1`, [registration.event_id]);
    await q1(
      `INSERT INTO attendance (registration_id, responsavel) VALUES ($1,$2)`,
      [registration.id, data.responsavel || context.auth.fullName || context.auth.username],
    );
    return { nome: registration.nome, evento: event?.nome ?? "" };
  });

// ---------------------------------------------------------------------------
// Painel de indicadores do evento
// ---------------------------------------------------------------------------
export const getEventDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const totalInscritos = await q1<{ c: number }>(
      `SELECT COUNT(*) AS c FROM registrations WHERE event_id = $1 AND status = 'INSCRITO'`, [data.event_id],
    );
    const roupaEntregue = await q1<{ c: number }>(
      `SELECT COUNT(*) AS c FROM registrations WHERE event_id = $1 AND status = 'INSCRITO' AND roupa_entregue = 1`, [data.event_id],
    );
    const valorEsperado = await q1<{ v: number }>(
      `SELECT COALESCE(SUM(valor_total),0) AS v FROM registrations WHERE event_id = $1 AND status = 'INSCRITO'`, [data.event_id],
    );
    const valorArrecadado = await q1<{ v: number }>(
      `SELECT COALESCE(SUM(p.valor),0) AS v FROM payments p
         JOIN registrations r ON r.id = p.registration_id
        WHERE r.event_id = $1 AND p.status = 'PAGO'`,
      [data.event_id],
    );
    const regs = await q<{ id: string; valor_total: number }>(
      `SELECT id, valor_total FROM registrations WHERE event_id = $1 AND status = 'INSCRITO'`, [data.event_id],
    );
    const ids = regs.map((r) => r.id);
    let pagos = 0;
    let pendentes = 0;
    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
      const totals = await q<{ registration_id: string; total: number }>(
        `SELECT registration_id, COALESCE(SUM(valor),0) AS total FROM payments
          WHERE registration_id IN (${placeholders}) AND status = 'PAGO' GROUP BY registration_id`,
        ids,
      );
      const totalsMap = new Map(totals.map((t) => [t.registration_id, t.total]));
      regs.forEach((r) => {
        const pago = totalsMap.get(r.id) ?? 0;
        if (pago >= r.valor_total && r.valor_total > 0) pagos++;
        else pendentes++;
      });
    }
    const totalInsc = totalInscritos?.c ?? 0;
    const esperado = valorEsperado?.v ?? 0;
    const arrecadado = valorArrecadado?.v ?? 0;
    return {
      totalInscritos: totalInsc,
      pagos,
      pendentes,
      roupaEntregue: roupaEntregue?.c ?? 0,
      roupaPendente: totalInsc - (roupaEntregue?.c ?? 0),
      valorArrecadado: arrecadado,
      valorEsperado: esperado,
      percentualPagamento: esperado > 0 ? (arrecadado / esperado) * 100 : 0,
    };
  });

// ---------------------------------------------------------------------------
// Portal do Inscrito
// ---------------------------------------------------------------------------
export const getPortalDashboard = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({
    cpf: z.string().trim().min(11, "CPF inválido"),
    data_nascimento: z.string().trim().min(10, "Data de Nascimento inválida"),
  }).parse(d))
  .handler(async ({ data }) => {
    // Busca inscrições que batem com os dados
    const regs = await q<any>(
      `SELECT r.id, r.event_id, r.nome, r.status, r.valor_total, r.roupa_entregue, r.tamanho_roupa, r.qr_code,
              e.nome AS event_nome, e.data_inicio, e.data_fim, e.local, e.organizador,
              u.modelo AS uniform_modelo, u.foto_url AS uniform_foto_url
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       LEFT JOIN event_uniforms u ON u.id = r.uniform_id
       WHERE r.cpf = $1 AND r.data_nascimento = $2
       ORDER BY e.data_inicio DESC`,
      [data.cpf, data.data_nascimento]
    );

    if (regs.length === 0) {
      throw new Error("Nenhuma inscrição encontrada para esses dados.");
    }

    // Busca status de pagamento e chave PIX
    const license = await q1<{ pix_chave: string, pix_nome_recebedor: string, pix_cidade: string }>(
      `SELECT pix_chave, pix_nome_recebedor, pix_cidade FROM license WHERE id = 1`
    );

    const ids = regs.map((r) => r.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const pagos = await q<{ registration_id: string; total: number }>(
      `SELECT registration_id, COALESCE(SUM(valor),0) AS total FROM payments
        WHERE registration_id IN (${placeholders}) AND status = 'PAGO' GROUP BY registration_id`,
      ids,
    );
    const pagoMap = new Map(pagos.map((p) => [p.registration_id, p.total]));

    return {
      registrations: regs.map(r => {
        const totalPago = pagoMap.get(r.id) ?? 0;
        return {
          ...r,
          total_pago: totalPago,
          pago_concluido: totalPago >= r.valor_total && r.valor_total > 0,
          valor_faltante: Math.max(0, r.valor_total - totalPago)
        };
      }),
      license
    };
  });
