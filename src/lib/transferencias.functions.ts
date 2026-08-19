import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1 } from "./db.server";
import { requireAuth, requireAdmin } from "./auth-middleware";

function scopeCongregation(auth: { role: string; congregationId: string | null }) {
  return !["master", "admin"].includes(auth.role) ? auth.congregationId : null;
}

// Todo mundo logado pode CONSULTAR — mas quem não é admin/master só vê
// as transferências que envolvem a própria congregação (como origem ou
// destino), com um filtro pra separar "recebidas" de "enviadas".
export const listTransferencias = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ direcao: z.enum(["todas", "recebidas", "enviadas"]).default("todas") }).parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const conditions: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (scoped) {
      if (data.direcao === "recebidas") { conditions.push(`t.destino_congregation_id = $${i++}`); vals.push(scoped); }
      else if (data.direcao === "enviadas") { conditions.push(`t.origem_congregation_id = $${i++}`); vals.push(scoped); }
      else { conditions.push(`(t.origem_congregation_id = $${i} OR t.destino_congregation_id = $${i + 1})`); vals.push(scoped, scoped); i += 2; }
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return q(
      `SELECT t.*, co.nome AS origem_nome, cd.nome AS destino_nome, u.full_name AS criado_por_nome
         FROM transferencias t
         JOIN congregations co ON co.id = t.origem_congregation_id
         JOIN congregations cd ON cd.id = t.destino_congregation_id
         LEFT JOIN app_users u ON u.id = t.criado_por
        ${where}
        ORDER BY t.data DESC, t.created_at DESC`,
      vals,
    );
  });

const TransferenciaSchema = z.object({
  origem_congregation_id: z.string().min(1),
  destino_congregation_id: z.string().min(1),
  valor: z.number().positive(),
  data: z.string().min(1),
  motivo: z.string().trim().optional(),
  comprovante_url: z.string().optional(),
});

export const createTransferencia = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => TransferenciaSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.origem_congregation_id === data.destino_congregation_id) {
      throw new Error("Origem e destino não podem ser a mesma unidade.");
    }
    const row = await q1<{ id: string }>(
      `INSERT INTO transferencias (origem_congregation_id, destino_congregation_id, valor, data, motivo, comprovante_url, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [data.origem_congregation_id, data.destino_congregation_id, data.valor, data.data,
       data.motivo || null, data.comprovante_url || null, context.auth.userId],
    );
    const origem = await q1<{ nome: string }>(`SELECT nome FROM congregations WHERE id = $1`, [data.origem_congregation_id]);
    const destino = await q1<{ nome: string }>(`SELECT nome FROM congregations WHERE id = $1`, [data.destino_congregation_id]);
    await q1(
      `INSERT INTO financeiro_auditoria (tipo_entidade, entidade_id, congregation_id, acao, detalhe, realizado_por)
       VALUES ('TRANSFERENCIA',$1,$2,'CRIADA',$3,$4)`,
      [row!.id, data.origem_congregation_id, `R$ ${data.valor.toFixed(2)} de ${origem?.nome} para ${destino?.nome}`, context.auth.userId],
    );
    return row;
  });

export const deleteTransferencia = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await q1(`DELETE FROM transferencias WHERE id = $1`, [data.id]);
    return { ok: true };
  });

export const getSaldoTransferenciasPorCongregacao = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    return q<{ congregation_id: string; recebidas: number; enviadas: number }>(
      `SELECT c.id AS congregation_id,
              COALESCE((SELECT SUM(valor) FROM transferencias WHERE destino_congregation_id = c.id), 0) AS recebidas,
              COALESCE((SELECT SUM(valor) FROM transferencias WHERE origem_congregation_id = c.id), 0) AS enviadas
         FROM congregations c`,
    );
  });
