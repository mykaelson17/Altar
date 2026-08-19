import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, login as loginFn, logout as logoutFn } from "@/lib/auth.functions";
import type { LicenseStatus } from "@/lib/license.functions";

export type Role = "master" | "admin" | "coordenador" | "usuario";
export type CurrentUser = {
  userId: string;
  username?: string;
  role: Role;
  trueRole: Role;
  congregationId: string | null;
  trueCongregationId: string | null;
  fullName?: string;
  mustChangePassword: boolean;
};

export const ROLE_LABELS: Record<Role, string> = {
  master: "Master (suporte)",
  admin: "Admin",
  coordenador: "Coordenador(a)",
  usuario: "Usuário",
};

type LoginResult =
  | { blocked: true; license: LicenseStatus }
  | { blocked: false; userId: string; username: string; role: Role; congregationId: string | null; fullName: string; mustChangePassword: boolean };

interface AuthCtx {
  user: CurrentUser | null;
  loading: boolean;
  isMaster: boolean;
  isAdmin: boolean;          // master ou admin
  isCoordenadorOuAcima: boolean; // master, admin ou coordenador
  canSeeFinance: boolean;    // todo mundo logado vê e lança
  canEditFinance: boolean;   // só master/admin/coordenador editam ou apagam
  canManageMembers: boolean; // todo mundo logado cadastra/edita membros
  signIn: (username: string, password: string) => Promise<LoginResult>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["current-user"],
    enabled: hydrated,
    queryFn: async () => (await getCurrentUser()) as CurrentUser | null,
    staleTime: 30_000,
  });

  const user = data ?? null;
  const role = user?.role;
  const isCoordenadorOuAcima = role === "master" || role === "admin" || role === "coordenador";

  const value: AuthCtx = {
    user,
    loading: !hydrated || isLoading,
    isMaster: role === "master",
    isAdmin: role === "master" || role === "admin",
    isCoordenadorOuAcima,
    canSeeFinance: !!role,
    canEditFinance: isCoordenadorOuAcima,
    canManageMembers: !!role,
    signIn: async (username, password) => {
      const result = await loginFn({ data: { username, password } }) as LoginResult;
      if (!result.blocked) await refetch();
      return result;
    },
    signOut: async () => {
      await logoutFn();
      qc.clear();
      await refetch();
    },
    refresh: async () => { await refetch(); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
