import { useSession } from "@tanstack/react-start/server";

export type SessionData = {
  // Login administrativo (equipe pastoral/liderança) — usuário e senha
  userId?: string;
  username?: string;
  role?: "master" | "admin" | "coordenador" | "usuario";
  congregationId?: string | null;
  fullName?: string;
  // Modo visualização (só master)
  impersonatedRole?: "master" | "admin" | "coordenador" | "usuario";
  impersonatedCongregationId?: string | null;

  mustChangePassword?: boolean;

  // Login de membro — via Google
  participantId?: string;

  // Usado só durante o fluxo OAuth (CSRF) — nunca fica salvo depois do login
  oauthState?: string;
};

export function getSessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou muito curto (mínimo 32 caracteres). Ajuste no .env.",
    );
  }
  return {
    password,
    name: "gestao_igreja_session",
    maxAge: 60 * 60 * 24 * 30, // 30 dias — membros não devem precisar logar toda hora
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      // Por padrão o cookie NÃO exige HTTPS — a maioria das instâncias
      // desse app roda em rede local/self-hosted por http://. Só fica
      // "secure" se a pessoa configurar HTTPS na frente (proxy reverso)
      // e ligar isso explicitamente. Localhost mascarava esse bug (Chrome
      // trata http://localhost como contexto seguro), mas qualquer acesso
      // por IP de rede local sem HTTPS quebrava o login silenciosamente.
      secure: process.env.COOKIE_SECURE === "true",
      path: "/",
    },
  };
}

export function getAppSession() {
  return useSession<SessionData>(getSessionConfig());
}
