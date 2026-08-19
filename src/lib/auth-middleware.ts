import { createMiddleware } from "@tanstack/react-start";
import { getAppSession, type SessionData } from "./session.server";
import { checkLicenseBlocked } from "./license.server";

export type StaffRole = "master" | "admin" | "coordenador" | "usuario";

export type AuthContext = {
  userId: string;
  username: string;
  role: StaffRole;
  trueRole: StaffRole;
  fullName: string;
  congregationId: string | null;
  trueCongregationId: string | null;
};

// Login administrativo (equipe da igreja) — usado nas telas de gestão.
// Verifica sessão E licença: se a licença está vencida e o usuário não é
// "master" (o operador do SaaS, que nunca é bloqueado na própria
// instância), nega o acesso com um erro identificável pelo front-end.
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await getAppSession();
  const data: SessionData = session.data ?? {};
  if (!data.userId || !data.role) {
    throw new Response("Unauthorized", { status: 401 });
  }
  if (data.role !== "master") {
    const bloqueado = await checkLicenseBlocked();
    if (bloqueado) {
      throw new Error("LICENSE_EXPIRED");
    }
  }
  const trueRole = data.role as StaffRole;
  const isImpersonating = trueRole === "master" && !!data.impersonatedRole;
  const activeRole = isImpersonating ? data.impersonatedRole! : trueRole;
  const activeCongregationId = isImpersonating ? (data.impersonatedCongregationId ?? null) : (data.congregationId ?? null);

  const ctx: AuthContext = {
    userId: data.userId,
    username: data.username ?? "",
    role: activeRole,
    trueRole,
    fullName: data.fullName ?? "",
    congregationId: activeCongregationId,
    trueCongregationId: data.congregationId ?? null,
  };
  return next({ context: { auth: ctx } });
});

// Só master (operador do SaaS) — configura licença de todas as instâncias
// (uma de cada vez, entrando em cada uma) e vê tudo.
export const requireMaster = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    if (context.auth.role !== "master") {
      throw new Response("Forbidden", { status: 403 });
    }
    return next();
  });

// Master ou Admin: vê/administra tudo dentro da instância, todas as congregações.
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    if (!["master", "admin"].includes(context.auth.role)) {
      throw new Response("Forbidden", { status: 403 });
    }
    return next();
  });

// Master, Admin ou Coordenador — gestão da própria congregação (membros e financeiro).
export const requireCoordenador = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    if (!["master", "admin", "coordenador"].includes(context.auth.role)) {
      throw new Response("Forbidden", { status: 403 });
    }
    return next();
  });

// Quem pode ver/lançar finanças: qualquer usuário logado (todos os papéis).
export const requireFinance = requireAuth;

// Quem pode editar/apagar lançamentos financeiros já feitos: só
// Master/Admin/Coordenador — "usuario" lança, mas não mexe depois.
export const requireFinanceEdit = requireCoordenador;

// Quem pode gerenciar membros: qualquer usuário logado (todos os papéis).
export const requireMembersAccess = requireAuth;

// Login de membro/congregado (via Google) — reservado pra quando o app do
// membro voltar a existir.
export type ParticipantAuthContext = { participantId: string };

export const requireParticipant = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await getAppSession();
  const data: SessionData = session.data ?? {};
  if (!data.participantId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return next({ context: { participant: { participantId: data.participantId } } });
});
