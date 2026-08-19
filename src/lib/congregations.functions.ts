import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1 } from "./db.server";
import { requireAuth, requireAdmin } from "./auth-middleware";

export type Congregation = {
  id: string;
  nome: string;
  tipo: "SEDE" | "CONGREGACAO";
  endereco: string | null;
  pastor_responsavel: string | null;
  telefone: string | null;
};

// Qualquer usuário logado (staff) pode LER a lista (pra popular selects) —
// só Pastor Presidente pode criar/editar/remover.
export const listCongregations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    return q<Congregation>(`SELECT * FROM congregations ORDER BY tipo DESC, nome`);
  });

// Congregações com pendência de prestação de contas — "inadimplente" aqui
// significa: tem lançamento de um mês ANTERIOR ao atual que ainda não foi
// enviado (o mês corrente ainda pode estar em andamento, isso não conta).
export const listCongregationsComStatusPrestacao = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const congs = q<Congregation>(`SELECT * FROM congregations WHERE tipo = 'CONGREGACAO' ORDER BY nome`);
    const mesAtual = new Date().toISOString().slice(0, 7); // YYYY-MM

    const pendencias = q<{ congregation_id: string; qtd: number; mais_antigo: string }>(
      `SELECT congregation_id, COUNT(*) AS qtd, MIN(data) AS mais_antigo
         FROM finance_transactions
        WHERE prestacao_conta_id IS NULL AND strftime('%Y-%m', data) < $1
        GROUP BY congregation_id`,
      [mesAtual],
    );
    const map = new Map(pendencias.map((p) => [p.congregation_id, p]));

    return congs.map((c) => {
      const p = map.get(c.id);
      return {
        ...c,
        inadimplente: !!p,
        lancamentosPendentes: p?.qtd ?? 0,
        pendenteDesde: p?.mais_antigo ?? null,
      };
    });
  });

const CongregationSchema = z.object({
  nome: z.string().trim().min(1),
  tipo: z.enum(["SEDE", "CONGREGACAO"]).default("CONGREGACAO"),
  endereco: z.string().trim().optional(),
  pastor_responsavel: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  logo_url: z.string().optional(),
  cor_primaria: z.string().optional(),
});

export const createCongregation = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => CongregationSchema.parse(d))
  .handler(async ({ data }) => {
    const row = await q1<{ id: string }>(
      `INSERT INTO congregations (nome, tipo, endereco, pastor_responsavel, telefone, logo_url, cor_primaria)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [data.nome, data.tipo, data.endereco || null, data.pastor_responsavel || null, data.telefone || null,
       data.logo_url || null, data.cor_primaria || null],
    );
    return row;
  });

const UpdateCongregationSchema = CongregationSchema.partial().extend({ id: z.string().min(1) });

export const updateCongregation = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => UpdateCongregationSchema.parse(d))
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
    await q1(`UPDATE congregations SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    return { ok: true };
  });

export const deleteCongregation = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await q1(`DELETE FROM congregations WHERE id = $1`, [data.id]);
    return { ok: true };
  });
