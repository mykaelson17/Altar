import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { q, q1 } from "./db.server";
import { requireAdmin } from "./auth-middleware";

const ROLES = ["master", "admin", "coordenador", "usuario"] as const;

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    return q<{
      id: string; username: string; full_name: string; role: string; congregation_id: string | null; active: boolean;
    }>(
      `SELECT u.id, u.username, u.full_name, u.role, u.congregation_id, u.active
         FROM app_users u ORDER BY u.full_name`,
    );
  });

const CreateSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(6),
  full_name: z.string().trim().min(1),
  role: z.enum(ROLES),
  congregation_id: z.string().min(1).nullable().optional(),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Só quem já é master pode conceder o papel de master pra alguém —
    // senão o admin da própria igreja poderia criar uma conta que nunca
    // é bloqueada por licença, furando o sistema de cobrança.
    if (data.role === "master" && context.auth.role !== "master") {
      throw new Error("Só o usuário master pode conceder o papel de master.");
    }
    const hash = await bcrypt.hash(data.password, 10);
    const row = await q1<{ id: string }>(
      `INSERT INTO app_users (username, password_hash, full_name, role, congregation_id, must_change_password)
       VALUES ($1,$2,$3,$4,$5,1) RETURNING id`,
      [data.username, hash, data.full_name, data.role, data.congregation_id || null],
    );
    return row;
  });

const UpdateSchema = z.object({
  id: z.string().min(1),
  full_name: z.string().trim().min(1).optional(),
  role: z.enum(ROLES).optional(),
  congregation_id: z.string().min(1).nullable().optional(),
  active: z.boolean().optional(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.role === "master" && context.auth.role !== "master") {
      throw new Error("Só o usuário master pode conceder o papel de master.");
    }
    // Um admin comum não pode desativar/rebaixar um master (só outro master pode).
    if (context.auth.role !== "master") {
      const alvo = await q1<{ role: string }>(`SELECT role FROM app_users WHERE id = $1`, [data.id]);
      if (alvo?.role === "master") {
        throw new Error("Só o usuário master pode alterar outra conta master.");
      }
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
    await q1(`UPDATE app_users SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), newPassword: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (context.auth.role !== "master") {
      const alvo = await q1<{ role: string }>(`SELECT role FROM app_users WHERE id = $1`, [data.id]);
      if (alvo?.role === "master") {
        throw new Error("Só o usuário master pode redefinir a senha de outra conta master.");
      }
    }
    const hash = await bcrypt.hash(data.newPassword, 10);
    await q1(
      `UPDATE app_users SET password_hash = $1, must_change_password = 1 WHERE id = $2`,
      [hash, data.id],
    );
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.auth.role !== "master") {
      const alvo = await q1<{ role: string }>(`SELECT role FROM app_users WHERE id = $1`, [data.id]);
      if (alvo?.role === "master") {
        throw new Error("Só o usuário master pode remover outra conta master.");
      }
    }
    await q1(`DELETE FROM app_users WHERE id = $1`, [data.id]);
    return { ok: true };
  });
