import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1 } from "./db.server";
import { requireAuth } from "./auth-middleware";

export type EventRow = {
  id: string;
  nome: string;
  tipo: string | null;
  departamento: string | null;
  congregacao: string | null;
  data_inicio: string;
  data_fim: string;
  local: string | null;
  organizador: string | null;
  valor_inscricao: number;
  valor_uniforme: number;
  prazo_pagamento: string | null;
  max_participantes: number | null;
  observacoes: string | null;
  arte_url: string | null;
  regulamento_url: string | null;
  programacao_url: string | null;
  regras_inscricao: string | null;
  preletores: string;
  cantores: string;
  status: "ATIVO" | "ENCERRADO" | "CANCELADO";
  created_by: string | null;
  require_registration: number;
};

export type EventScheduleRow = {
  id: string;
  event_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
};

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    return q<EventRow>(`SELECT * FROM events ORDER BY data_inicio DESC`);
  });

export const getEvent = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const event = await q1<EventRow>(`SELECT * FROM events WHERE id = $1`, [data.id]);
    if (!event) throw new Error("Evento não encontrado.");
    const uniforms = await q(`SELECT * FROM event_uniforms WHERE event_id = $1 ORDER BY sort_order`, [data.id]);
    const checklist = await q(`SELECT * FROM event_checklist_items WHERE event_id = $1 ORDER BY sort_order`, [data.id]);
    const schedules = await q<EventScheduleRow>(`SELECT * FROM event_schedules WHERE event_id = $1 ORDER BY date`, [data.id]);
    return { event, uniforms, checklist, schedules };
  });

export const getPublicEvent = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const event = await q1<EventRow>(`SELECT * FROM events WHERE id = $1 AND status = 'ATIVO'`, [data.id]);
    if (!event) throw new Error("Evento não encontrado ou indisponível.");
    if (!event.require_registration) throw new Error("Este evento não requer inscrição prévia.");
    
    const uniforms = await q(`SELECT * FROM event_uniforms WHERE event_id = $1 ORDER BY sort_order`, [data.id]);
    const schedules = await q<EventScheduleRow>(`SELECT * FROM event_schedules WHERE event_id = $1 ORDER BY date`, [data.id]);
    
    // Fetch congregations for the form
    const congregations = await q(`SELECT id, nome FROM congregations ORDER BY nome`);
    
    return { event, uniforms, schedules, congregations };
  });

const EventSchema = z.object({
  nome: z.string().trim().min(1),
  tipo: z.string().trim().optional(),
  departamento: z.string().trim().optional(),
  congregacao: z.string().trim().optional(),
  data_inicio: z.string().min(1),
  data_fim: z.string().min(1),
  local: z.string().trim().optional(),
  organizador: z.string().trim().optional(),
  valor_inscricao: z.number().min(0).default(0),
  valor_uniforme: z.number().min(0).default(0),
  prazo_pagamento: z.string().optional(),
  max_participantes: z.number().int().positive().optional(),
  observacoes: z.string().optional(),
  preletores: z.array(z.string()).default([]),
  cantores: z.array(z.string()).default([]),
  arte_url: z.string().optional(),
  regulamento_url: z.string().optional(),
  programacao_url: z.string().optional(),
  regras_inscricao: z.string().optional(),
  require_registration: z.boolean().default(false),
  schedules: z.array(z.object({
    date: z.string().min(1),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
  })).default([]),
});

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => EventSchema.parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.auth.userId;
    const row = await q1<{ id: string }>(
      `INSERT INTO events (nome, tipo, departamento, congregacao, data_inicio, data_fim, local, organizador,
                           valor_inscricao, valor_uniforme, prazo_pagamento, max_participantes, observacoes,
                           preletores, cantores, require_registration, created_by, regras_inscricao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [data.nome, data.tipo || null, data.departamento || null, data.congregacao || null,
       data.data_inicio, data.data_fim, data.local || null, data.organizador || null,
       data.valor_inscricao, data.valor_uniforme, data.prazo_pagamento || null,
       data.max_participantes || null, data.observacoes || null,
       JSON.stringify(data.preletores), JSON.stringify(data.cantores),
       data.require_registration ? 1 : 0, userId, data.regras_inscricao || null],
    );

    if (row && data.schedules.length > 0) {
      for (const sch of data.schedules) {
        await q1(
          `INSERT INTO event_schedules (event_id, date, start_time, end_time) VALUES ($1,$2,$3,$4)`,
          [row.id, sch.date, sch.start_time || null, sch.end_time || null]
        );
      }
    }
    return row;
  });

const UpdateEventSchema = EventSchema.partial().extend({
  id: z.string().min(1),
  status: z.enum(["ATIVO", "ENCERRADO", "CANCELADO"]).optional(),
});

export const updateEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateEventSchema.parse(d))
  .handler(async ({ data, context }) => {
    const event = await q1<EventRow>(`SELECT * FROM events WHERE id = $1`, [data.id]);
    if (!event) throw new Error("Evento não encontrado.");
    
    if (context.auth.role !== "admin" && context.auth.role !== "master" && event.created_by !== context.auth.userId) {
      throw new Error("Você não tem permissão para editar este evento. Apenas o criador pode alterá-lo.");
    }

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      if (k === "id" || k === "schedules" || v === undefined) continue;
      sets.push(`${k} = $${i++}`);
      if (k === "require_registration") vals.push(v ? 1 : 0);
      else vals.push(k === "preletores" || k === "cantores" ? JSON.stringify(v) : v);
    }
    if (sets.length > 0) {
      sets.push(`updated_at = datetime('now')`);
      vals.push(data.id);
      await q1(`UPDATE events SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    }

    if (data.schedules) {
      await q1(`DELETE FROM event_schedules WHERE event_id = $1`, [data.id]);
      for (const sch of data.schedules) {
        await q1(
          `INSERT INTO event_schedules (event_id, date, start_time, end_time) VALUES ($1,$2,$3,$4)`,
          [data.id, sch.date, sch.start_time || null, sch.end_time || null]
        );
      }
    }
    return { ok: true };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const event = await q1<EventRow>(`SELECT * FROM events WHERE id = $1`, [data.id]);
    if (!event) return { ok: true };
    if (context.auth.role !== "admin" && context.auth.role !== "master" && event.created_by !== context.auth.userId) {
      throw new Error("Você não tem permissão para excluir este evento.");
    }
    await q1(`DELETE FROM events WHERE id = $1`, [data.id]);
    return { ok: true };
  });

// --- Uniformes (modelos de roupa do evento) ---

const UniformSchema = z.object({
  event_id: z.string().min(1),
  modelo: z.string().trim().min(1),
  cor: z.string().trim().optional(),
  tecido: z.string().trim().optional(),
  fornecedor: z.string().trim().optional(),
  foto_url: z.string().trim().optional(),
  valor: z.number().min(0).default(0),
});

export const addUniform = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UniformSchema.parse(d))
  .handler(async ({ data }) => {
    const maxOrder = await q1<{ m: number }>(`SELECT COALESCE(MAX(sort_order),0) AS m FROM event_uniforms WHERE event_id = $1`, [data.event_id]);
    await q1(
      `INSERT INTO event_uniforms (event_id, modelo, cor, tecido, fornecedor, valor, foto_url, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [data.event_id, data.modelo, data.cor || null, data.tecido || null, data.fornecedor || null, data.valor, data.foto_url || null, (maxOrder?.m ?? 0) + 1],
    );
    return { ok: true };
  });

export const removeUniform = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await q1(`DELETE FROM event_uniforms WHERE id = $1`, [data.id]);
    return { ok: true };
  });

// --- Checklist template do evento ---

const ChecklistItemSchema = z.object({ event_id: z.string().min(1), label: z.string().trim().min(1) });

export const addChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => ChecklistItemSchema.parse(d))
  .handler(async ({ data }) => {
    const maxOrder = await q1<{ m: number }>(`SELECT COALESCE(MAX(sort_order),0) AS m FROM event_checklist_items WHERE event_id = $1`, [data.event_id]);
    await q1(
      `INSERT INTO event_checklist_items (event_id, label, sort_order) VALUES ($1,$2,$3)`,
      [data.event_id, data.label, (maxOrder?.m ?? 0) + 1],
    );
    return { ok: true };
  });

export const removeChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await q1(`DELETE FROM event_checklist_items WHERE id = $1`, [data.id]);
    return { ok: true };
  });
