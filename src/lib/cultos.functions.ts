import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1 } from "./db.server";
import { requireAuth } from "./auth-middleware";

function scopeCongregation(auth: { role: string; congregationId: string | null }) {
  return !["master", "admin"].includes(auth.role) ? auth.congregationId : null;
}

async function getSedeId(): Promise<string | null> {
  const sede = await q1<{ id: string }>(`SELECT id FROM congregations WHERE tipo = 'SEDE' LIMIT 1`);
  return sede?.id ?? null;
}

export type Culto = {
  id: string;
  congregation_id: string | null;
  tipo: string;
  data: string;
  horario: string | null;
  observacoes: string | null;
};

export const listCultos = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ mes: z.number().int().optional(), ano: z.number().int().optional(), congregation_id: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const conditions: string[] = [];
    const vals: any[] = [];
    let i = 1;

    const scoped = scopeCongregation(context.auth);
    if (scoped) {
      // Usuário/coordenador de uma congregação específica vê a própria
      // agenda MAIS a da sede — nunca a de outra congregação irmã.
      const sedeId = await getSedeId();
      if (sedeId && sedeId !== scoped) {
        conditions.push(`(congregation_id = $${i} OR congregation_id = $${i + 1})`);
        vals.push(scoped, sedeId);
        i += 2;
      } else {
        conditions.push(`congregation_id = $${i++}`);
        vals.push(scoped);
      }
    } else if (data.congregation_id) {
      // Admin/master pode filtrar por uma congregação específica — usado
      // quando entram no cadastro dela em Congregações.
      conditions.push(`congregation_id = $${i++}`);
      vals.push(data.congregation_id);
    }

    if (data.ano) {
      const periodo = data.mes ? `${data.ano}-${String(data.mes).padStart(2, "0")}` : String(data.ano);
      conditions.push(`strftime('${data.mes ? "%Y-%m" : "%Y"}', data) = $${i++}`);
      vals.push(periodo);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const cultos = q<Culto>(`SELECT * FROM cultos ${where} ORDER BY data DESC, horario DESC`, vals);
    const ids = cultos.map((c) => c.id);
    if (ids.length === 0) return cultos.map((c) => ({ ...c, totalEscalados: 0, totalConfirmados: 0 }));
    const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(",");
    const counts = q<{ culto_id: string; total: number; confirmados: number }>(
      `SELECT culto_id, COUNT(*) AS total, SUM(CASE WHEN status='CONFIRMADO' THEN 1 ELSE 0 END) AS confirmados
         FROM escalas WHERE culto_id IN (${placeholders}) GROUP BY culto_id`,
      ids,
    );
    const map = new Map(counts.map((c) => [c.culto_id, c]));
    return cultos.map((c) => ({
      ...c,
      totalEscalados: map.get(c.id)?.total ?? 0,
      totalConfirmados: map.get(c.id)?.confirmados ?? 0,
    }));
  });

const CultoSchema = z.object({
  tipo: z.string().trim().min(1),
  data: z.string().min(1),
  horario: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
  congregation_id: z.string().min(1).nullable().optional(),
});

export const createCulto = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => CultoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const congregationId = scoped ?? data.congregation_id ?? null;
    const row = await q1<{ id: string }>(
      `INSERT INTO cultos (congregation_id, tipo, data, horario, observacoes) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [congregationId, data.tipo, data.data, data.horario || null, data.observacoes || null],
    );
    return row;
  });

const UpdateCultoSchema = z.object({
  id: z.string().min(1),
  tipo: z.string().trim().min(1).optional(),
  data: z.string().min(1).optional(),
  horario: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
});

export const updateCulto = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateCultoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const culto = await q1<Culto>(`SELECT * FROM cultos WHERE id = $1`, [data.id]);
    if (!culto) throw new Error("Culto não encontrado.");
    const scoped = scopeCongregation(context.auth);
    const sedeId = await getSedeId();
    if (scoped && culto.congregation_id !== scoped && culto.congregation_id !== sedeId) {
      throw new Error("Esse culto não pertence à sua congregação.");
    }
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
    await q1(`UPDATE cultos SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    return { ok: true };
  });

export const deleteCulto = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await q1(`DELETE FROM cultos WHERE id = $1`, [data.id]);
    return { ok: true };
  });

export const getCultoDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const culto = await q1<Culto>(`SELECT * FROM cultos WHERE id = $1`, [data.id]);
    if (!culto) throw new Error("Culto não encontrado.");
    const escalas = q(
      `SELECT e.*, p.nome AS participant_nome, p.telefone AS participant_telefone
         FROM escalas e JOIN participants p ON p.id = e.participant_id
        WHERE e.culto_id = $1 ORDER BY e.funcao, p.nome`,
      [data.id],
    );
    return { culto, escalas };
  });

const AddEscalaSchema = z.object({
  culto_id: z.string().min(1),
  participant_id: z.string().min(1),
  funcao: z.string().trim().min(1),
  observacoes: z.string().trim().optional(),
});

export const addEscala = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => AddEscalaSchema.parse(d))
  .handler(async ({ data }) => {
    const existing = await q1(
      `SELECT id FROM escalas WHERE culto_id = $1 AND participant_id = $2 AND funcao = $3`,
      [data.culto_id, data.participant_id, data.funcao],
    );
    if (existing) throw new Error("Essa pessoa já está escalada nessa função pra esse culto.");
    await q1(
      `INSERT INTO escalas (culto_id, participant_id, funcao, observacoes) VALUES ($1,$2,$3,$4)`,
      [data.culto_id, data.participant_id, data.funcao, data.observacoes || null],
    );
    return { ok: true };
  });

export const updateEscalaStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), status: z.enum(["PENDENTE", "CONFIRMADO", "TROCA_SOLICITADA", "RECUSADO"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await q1(`UPDATE escalas SET status = $1 WHERE id = $2`, [data.status, data.id]);
    return { ok: true };
  });

export const removeEscala = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await q1(`DELETE FROM escalas WHERE id = $1`, [data.id]);
    return { ok: true };
  });

// Escalas futuras de um membro específico — útil pra ver "onde a pessoa X está escalada".
export const listEscalasDoMembro = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ participantId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    return q(
      `SELECT e.*, c.tipo AS culto_tipo, c.data AS culto_data, c.horario AS culto_horario
         FROM escalas e JOIN cultos c ON c.id = e.culto_id
        WHERE e.participant_id = $1 AND c.data >= date('now')
        ORDER BY c.data`,
      [data.participantId],
    );
  });
