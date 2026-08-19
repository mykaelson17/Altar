import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1 } from "./db.server";
import { requireAuth, requireAdmin } from "./auth-middleware";

export type PlanoConta = {
  id: string;
  tipo: "ENTRADA" | "SAIDA";
  codigo: string;
  nome: string;
  ativo: number;
  sort_order: number;
};

export const listPlanoContas = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    return q<PlanoConta>(`SELECT * FROM plano_contas WHERE ativo = 1 ORDER BY tipo, sort_order, nome`);
  });

export const listAllPlanoContas = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    return q<PlanoConta>(`SELECT * FROM plano_contas ORDER BY tipo, sort_order, nome`);
  });

const PlanoContaSchema = z.object({
  tipo: z.enum(["ENTRADA", "SAIDA"]),
  codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]+$/, "Use só letras, números e _"),
  nome: z.string().trim().min(1),
});

export const createPlanoConta = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => PlanoContaSchema.parse(d))
  .handler(async ({ data }) => {
    const existente = await q1(`SELECT id FROM plano_contas WHERE tipo = $1 AND codigo = $2`, [data.tipo, data.codigo]);
    if (existente) throw new Error("Já existe uma categoria com esse código nesse tipo.");
    const maxOrder = await q1<{ m: number }>(`SELECT COALESCE(MAX(sort_order),0) AS m FROM plano_contas WHERE tipo = $1`, [data.tipo]);
    const row = await q1<{ id: string }>(
      `INSERT INTO plano_contas (tipo, codigo, nome, sort_order) VALUES ($1,$2,$3,$4) RETURNING id`,
      [data.tipo, data.codigo, data.nome, (maxOrder?.m ?? 0) + 1],
    );
    return row;
  });

export const updatePlanoConta = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), nome: z.string().trim().min(1).optional(), ativo: z.boolean().optional() }).parse(d))
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
    vals.push(data.id);
    await q1(`UPDATE plano_contas SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    return { ok: true };
  });

export const deletePlanoConta = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const conta = await q1<PlanoConta>(`SELECT * FROM plano_contas WHERE id = $1`, [data.id]);
    if (!conta) return { ok: true };
    const emUso = await q1(`SELECT id FROM finance_transactions WHERE categoria = $1 LIMIT 1`, [conta.codigo]);
    if (emUso) {
      await q1(`UPDATE plano_contas SET ativo = 0 WHERE id = $1`, [data.id]);
      return { ok: true, desativada: true };
    }
    await q1(`DELETE FROM plano_contas WHERE id = $1`, [data.id]);
    return { ok: true, desativada: false };
  });
