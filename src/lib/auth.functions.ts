import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { q1 } from "./db.server";
import { getAppSession } from "./session.server";
import { requireAuth } from "./auth-middleware";
import { getPublicLicenseStatus } from "./license.functions";
import { checkLicenseBlocked } from "./license.server";

type DbUser = {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  role: "master" | "admin" | "coordenador" | "usuario";
  congregation_id: string | null;
  active: boolean;
  must_change_password: boolean;
};

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const login = createServerFn({ method: "POST" })
  .validator((d: unknown) => LoginSchema.parse(d))
  .handler(async ({ data }) => {
    const user = await q1<DbUser>(
      `SELECT id, username, password_hash, full_name, role, congregation_id, active, must_change_password
         FROM app_users WHERE lower(username) = lower($1) LIMIT 1`,
      [data.username],
    );
    if (!user || !user.active) throw new Error("Usuário ou senha inválidos");
    const ok = await bcrypt.compare(data.password, user.password_hash);
    if (!ok) throw new Error("Usuário ou senha inválidos");

    // Licença vencida bloqueia todo mundo, menos o master (ele é quem
    // resolve o pagamento) — em vez de logar, devolve o status da
    // licença pra tela de login mostrar a cobrança, sem criar sessão.
    if (user.role !== "master") {
      const bloqueado = await checkLicenseBlocked();
      if (bloqueado) {
        const licenseStatus = await getPublicLicenseStatus();
        return { blocked: true as const, license: licenseStatus };
      }
    }

    const session = await getAppSession();
    await session.update({
      userId: user.id,
      username: user.username,
      role: user.role,
      congregationId: user.congregation_id,
      fullName: user.full_name,
      mustChangePassword: user.must_change_password,
    });

    return {
      blocked: false as const,
      userId: user.id,
      username: user.username,
      role: user.role,
      congregationId: user.congregation_id,
      fullName: user.full_name,
      mustChangePassword: user.must_change_password,
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getAppSession();
  await session.clear();
  return { ok: true };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAppSession();
  const d = session.data ?? {};
  if (!d.userId || !d.role) return null;

  const trueRole = d.role as "master" | "admin" | "coordenador" | "usuario";
  const isImpersonating = trueRole === "master" && !!d.impersonatedRole;
  const activeRole = isImpersonating ? d.impersonatedRole! : trueRole;
  const activeCongregationId = isImpersonating ? (d.impersonatedCongregationId ?? null) : (d.congregationId ?? null);

  return {
    userId: d.userId,
    username: d.username,
    role: activeRole,
    trueRole,
    congregationId: activeCongregationId,
    trueCongregationId: d.congregationId ?? null,
    fullName: d.fullName,
    mustChangePassword: !!d.mustChangePassword,
  };
});

const ChangePwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "Mínimo 6 caracteres"),
});

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => ChangePwSchema.parse(d))
  .handler(async ({ data, context }) => {
    const u = await q1<DbUser>(
      `SELECT id, password_hash FROM app_users WHERE id = $1`,
      [context.auth.userId],
    );
    if (!u) throw new Error("Usuário não encontrado");
    const ok = await bcrypt.compare(data.currentPassword, u.password_hash);
    if (!ok) throw new Error("Senha atual incorreta");
    const hash = await bcrypt.hash(data.newPassword, 10);
    await q1(
      `UPDATE app_users SET password_hash = $1, must_change_password = FALSE WHERE id = $2`,
      [hash, u.id],
    );
    const session = await getAppSession();
    await session.update({ ...(session.data ?? {}), mustChangePassword: false });
    return { ok: true };
  });

export const setImpersonation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z.object({
      role: z.enum(["master", "admin", "coordenador", "usuario"]).nullable(),
      congregationId: z.string().nullable().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    if (context.auth.trueRole !== "master") {
      throw new Error("Apenas o master pode usar o modo visualização");
    }
    const session = await getAppSession();
    if (!data.role || data.role === "master") {
      await session.update({ ...session.data, impersonatedRole: undefined, impersonatedCongregationId: undefined });
    } else {
      await session.update({ ...session.data, impersonatedRole: data.role, impersonatedCongregationId: data.congregationId });
    }
    return { ok: true };
  });
