import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1 } from "./db.server";
import { requireAuth, requireAdmin } from "./auth-middleware";

// Avisos pendentes de mostrar HOJE pro usuário logado — global (sem
// congregação) ou da congregação dele. Se ele já viu hoje (existe linha
// em aviso_leituras com a data de hoje), não aparece de novo até amanhã.
export const getAvisosPendentesHoje = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const hoje = new Date().toISOString().slice(0, 10);
    const congId = context.auth.congregationId;
    // IMPORTANTE: os placeholders $1/$2/$3 precisam aparecer no texto da
    // query na mesma ordem numérica (o adaptador do banco traduz pra "?"
    // posicional por ordem de aparição no texto, não pelo número em si)
    // — por isso o NOT EXISTS ($1/$2) vem antes da condição de
    // congregação ($3) aqui embaixo.
    const cond = congId ? `AND (a.congregation_id IS NULL OR a.congregation_id = $3)` : `AND a.congregation_id IS NULL`;
    const vals = congId ? [context.auth.userId, hoje, congId] : [context.auth.userId, hoje];

    return await q(
      `SELECT a.* FROM avisos a
        WHERE a.ativo = 1
          AND NOT EXISTS (
            SELECT 1 FROM aviso_leituras al
             WHERE al.aviso_id = a.id AND al.app_user_id = $1 AND al.data = $2
          )
          ${cond}
        ORDER BY a.created_at DESC`,
      vals,
    );
  });

export const marcarAvisoVistoHoje = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ avisoId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const hoje = new Date().toISOString().slice(0, 10);
    await q1(
      `INSERT INTO aviso_leituras (aviso_id, app_user_id, data) VALUES ($1,$2,$3)
       ON CONFLICT (aviso_id, app_user_id, data) DO NOTHING`,
      [data.avisoId, context.auth.userId, hoje],
    );
    return { ok: true };
  });

// Gestão dos avisos — só admin/master (é a sede quem manda).
export const listAllAvisos = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    return await q(
      `SELECT a.*, c.nome AS congregation_nome, u.full_name AS criado_por_nome
         FROM avisos a
         LEFT JOIN congregations c ON c.id = a.congregation_id
         LEFT JOIN app_users u ON u.id = a.criado_por
        ORDER BY a.created_at DESC`,
    );
  });

const CreateAvisoSchema = z.object({
  titulo: z.string().trim().min(1),
  mensagem: z.string().trim().min(1),
  congregation_id: z.string().min(1).nullable().optional(),
});

export const createAviso = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => CreateAvisoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = await q1<{ id: string }>(
      `INSERT INTO avisos (titulo, mensagem, congregation_id, criado_por) VALUES ($1,$2,$3,$4) RETURNING id`,
      [data.titulo, data.mensagem, data.congregation_id || null, context.auth.userId],
    );
    return row;
  });

export const toggleAvisoAtivo = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), ativo: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await q1(`UPDATE avisos SET ativo = $1 WHERE id = $2`, [data.ativo, data.id]);
    return { ok: true };
  });

export const deleteAviso = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await q1(`DELETE FROM avisos WHERE id = $1`, [data.id]);
    return { ok: true };
  });
