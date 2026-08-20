import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, ROLE_LABELS } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, KeyRound, CalendarDays, UserCog, Church, LayoutDashboard, Users, Wallet, Building2, FileCheck, Music, GraduationCap, Megaphone, FileText, AlertTriangle, BookOpen, LayoutGrid, ArrowRightLeft, QrCode, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvisosPopup } from "@/components/avisos-popup";
import { LicensePanel } from "@/components/license-panel";
import { getLicenseDetail } from "@/lib/license.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { setImpersonation } from "@/lib/auth.functions";
import { listCongregations } from "@/lib/congregations.functions";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, isAdmin, isMaster, canSeeFinance, canManageMembers, signOut, refresh } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [showImpersonate, setShowImpersonate] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", replace: true });
    else if (user.mustChangePassword) navigate({ to: "/trocar-senha", replace: true });
  }, [user, loading, navigate]);

  const { data: license } = useQuery({
    queryKey: ["license-detail"],
    queryFn: () => getLicenseDetail(),
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
  });

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">Carregando...</div>;
  }

  if (license?.bloqueado && !isMaster) {
    return <LicenseBlockedFullScreen onSignOut={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }} />;
  }

  const NAV = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/membros", label: "Membros", icon: Users, show: canManageMembers },
    { to: "/financeiro", label: "Financeiro", icon: Wallet, show: canSeeFinance },
    { to: "/consolidado", label: "Consolidado", icon: LayoutGrid, show: isAdmin },
    
    { to: "/cultos", label: "Cultos e Escalas", icon: Music, show: true },
    { to: "/ebd", label: "EBD", icon: GraduationCap, show: true },
    { to: "/eventos", label: "Congressos e Eventos", icon: CalendarDays, show: true },
    { to: "/congregacoes", label: "Congregações", icon: Building2, show: isAdmin },
    { to: "/usuarios", label: "Usuários", icon: UserCog, show: isAdmin },
    { to: "/cadastros", label: "Cadastros", icon: Database, show: isAdmin || user.role === "coordenador" },
    { to: "/avisos", label: "Avisos", icon: Megaphone, show: isAdmin },
    { to: "/documentos", label: "Documentos", icon: FileText, show: true },
  ].filter((i) => i.show);

  return (
    <>
      <div className="min-h-screen bg-background">
        <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[240px] flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border print:hidden z-40">
          <div className="p-5 flex items-center justify-center border-b border-sidebar-border/50">
            <div className="bg-white px-2 py-3 rounded-xl shadow-sm w-full flex justify-center items-center h-28">
              <img src="/altar-logo-new.png" alt="Altar" className="h-full object-contain" />
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    active ? "bg-sidebar-primary text-sidebar-primary-foreground"
                           : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-sidebar-border space-y-2">
            {license && <LicencaCompacta license={license} />}
            <div className="text-xs px-2 text-sidebar-foreground/80 truncate">{user.fullName || user.username}</div>
            <div className="text-[10px] px-2 uppercase tracking-wider text-sidebar-foreground/50">
              {ROLE_LABELS[user.role]}
            </div>
            <Link to="/trocar-senha" className="flex items-center gap-2 px-2 py-1 text-xs text-sidebar-foreground/80">
              <KeyRound className="size-3" /> Trocar senha
            </Link>
            {user.trueRole === "master" && (
              <Button
                variant="ghost" size="sm"
                className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setShowImpersonate(true)}
              >
                <UserCog className="size-4 mr-2" /> Visualizar Como
              </Button>
            )}
            <Button
              variant="ghost" size="sm"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }}
            >
              <LogOut className="size-4 mr-2" /> Sair
            </Button>
          </div>
        </aside>

        <div className="lg:pl-[240px] flex flex-col min-h-screen w-full">
          {user.trueRole === "master" && user.role !== "master" && (
            <div className="bg-amber-500 text-amber-950 font-medium px-4 py-1.5 text-xs text-center sticky top-0 z-50 shadow-sm flex items-center justify-center gap-2 print:hidden">
              <AlertTriangle className="size-4" />
              <span>Você está no modo de visualização como <strong>{ROLE_LABELS[user.role]}</strong>.</span>
              <button onClick={() => setShowImpersonate(true)} className="underline hover:text-amber-900 font-bold ml-2">Mudar</button>
            </div>
          )}

          <AvisosPopup />

          <div className="lg:hidden sticky top-0 z-20 bg-sidebar text-sidebar-foreground p-3 flex items-center justify-between print:hidden shadow-sm">
            <div className="flex items-center gap-2">
              <div className="bg-white p-1.5 rounded-lg shadow-sm">
                <img src="/altar-logo-new.png" alt="Altar" className="h-10 object-contain" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {license && <LicencaCompacta license={license} compact />}
              {user.trueRole === "master" && (
                <Button size="sm" variant="ghost" className="text-sidebar-foreground" onClick={() => setShowImpersonate(true)}>
                  <UserCog className="size-5" />
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-sidebar-foreground" onClick={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }}>
                <LogOut className="size-5" />
              </Button>
            </div>
          </div>

          <div className="lg:hidden sticky top-[52px] z-10 bg-card border-b flex overflow-x-auto print:hidden">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = path.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to} className={cn("flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap", active ? "border-b-2 border-primary text-primary font-medium" : "text-muted-foreground")}>
                  <Icon className="size-4" /> {item.label}
                </Link>
              );
            })}
          </div>

          <main className="p-4 lg:p-8 max-w-[1400px] w-full mx-auto flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    
    {user.trueRole === "master" && (
      <ImpersonateDialog 
        open={showImpersonate} 
        onOpenChange={setShowImpersonate} 
        currentRole={user.role} 
        currentCongregationId={user.congregationId}
        onApplied={() => { setShowImpersonate(false); refresh(); }}
      />
    )}
    </>
  );
}

interface ImpersonateDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentRole: string;
  currentCongregationId: string | null;
  onApplied: () => void;
}

function ImpersonateDialog({ open, onOpenChange, currentRole, currentCongregationId, onApplied }: ImpersonateDialogProps) {
  const qc = useQueryClient();
  const [role, setRole] = useState(currentRole);
  const [congregationId, setCongregationId] = useState<string>(currentCongregationId ?? "");

  const { data: congs = [] } = useQuery({ queryKey: ["congregations"], queryFn: () => listCongregations(), enabled: open });

  const applyMut = useMutation({
    mutationFn: () => setImpersonation({ data: { role: role as any, congregationId: congregationId || null } }),
    onSuccess: () => { qc.clear(); onApplied(); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modo de Visualização</DialogTitle>
          <DialogDescription>Assuma temporariamente um perfil de usuário para testar ou verificar o sistema.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Cargo / Permissão</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="master">Master (Desativar Visualização)</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="coordenador">Coordenador</SelectItem>
                <SelectItem value="usuario">Usuário comum</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role !== "master" && (
            <div className="space-y-1.5">
              <Label>Congregação (Opcional para admin)</Label>
              <Select value={congregationId} onValueChange={setCongregationId}>
                <SelectTrigger><SelectValue placeholder="Sede (Padrão)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_todas">Sede (Ver Todas)</SelectItem>
                  {congs.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => applyMut.mutate()} disabled={applyMut.isPending}>Aplicar Perfil</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_DOT: Record<string, string> = {
  ATIVA: "bg-green-500",
  VENCIDA: "bg-red-500",
  CANCELADA: "bg-gray-400",
};

function LicencaCompacta({ license, compact }: { license: any; compact?: boolean }) {
  const urgente = license.diasRestantes <= 5;
  if (compact) {
    return (
      <Link to="/licenca" className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md hover:bg-sidebar-accent">
        <span className={cn("size-2 rounded-full", STATUS_DOT[license.status])} />
        {license.diasRestantes}d
      </Link>
    );
  }
  return (
    <Link
      to="/licenca"
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-sidebar-accent transition-colors",
        urgente && "text-amber-400",
      )}
    >
      <span className={cn("size-2 rounded-full shrink-0", STATUS_DOT[license.status])} />
      <span className="truncate">{license.status === "ATIVA" ? `Licença: ${license.diasRestantes} dias` : "Licença vencida"}</span>
    </Link>
  );
}

function LicenseBlockedFullScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="size-14 rounded-full bg-red-100 dark:bg-red-950 grid place-items-center mx-auto">
          <AlertTriangle className="size-7 text-red-600" />
        </div>
        <h1 className="text-xl font-semibold">Assinatura vencida</h1>
        <p className="text-sm text-muted-foreground">
          O acesso a todas as telas está temporariamente bloqueado até a mensalidade ser paga e confirmada.
        </p>
        <LicensePanel />
        <Button variant="ghost" size="sm" onClick={onSignOut}>Sair</Button>
      </div>
    </div>
  );
}
