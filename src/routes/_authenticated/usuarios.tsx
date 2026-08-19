import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth, ROLE_LABELS, type Role } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { listUsers, createUser, updateUser, deleteUser, resetPassword } from "@/lib/users.functions";
import { listCongregations } from "@/lib/congregations.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários" }] }),
  component: Page,
});

const ALL_ROLES: Role[] = ["master", "admin", "coordenador", "usuario"];

function Page() {
  const { isAdmin, isMaster } = useAuth();
  const ROLES = isMaster ? ALL_ROLES : ALL_ROLES.filter((r) => r !== "master");
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({ queryKey: ["users_all"], enabled: isAdmin, queryFn: () => listUsers() });
  const { data: congregations = [] } = useQuery({ queryKey: ["congregations"], enabled: isAdmin, queryFn: () => listCongregations() });

  const [form, setForm] = useState({
    username: "", password: "", full_name: "", role: "usuario" as Role, congregation_id: "__none",
  });

  const createMut = useMutation({
    mutationFn: () => createUser({ data: { ...form, congregation_id: form.congregation_id === "__none" ? null : form.congregation_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users_all"] });
      toast.success("Usuário criado");
      setForm({ username: "", password: "", full_name: "", role: "usuario", congregation_id: "__none" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const upd = useMutation({
    mutationFn: (d: any) => updateUser({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users_all"] }); toast.success("Atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const resetPw = useMutation({
    mutationFn: (d: { id: string; newPassword: string }) => resetPassword({ data: d }),
    onSuccess: () => toast.success("Senha redefinida — o usuário vai precisar trocar no próximo login"),
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteUser({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users_all"] }); toast.success("Usuário removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Sem permissão.</div>;

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">Equipe pastoral e liderança que acessa o sistema.</p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Novo usuário</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Nome completo</Label>
              <Input value={form.full_name} onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))} />
            </div>
            <div>
              <Label>Usuário (login)</Label>
              <Input value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} />
            </div>
            <div>
              <Label>Senha inicial</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} />
            </div>
            <div>
              <Label>Função</Label>
              <Select value={form.role} onValueChange={(v: Role) => setForm((s) => ({ ...s, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Congregação</Label>
              <Select value={form.congregation_id} onValueChange={(v) => setForm((s) => ({ ...s, congregation_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Todas (sede)</SelectItem>
                  {congregations.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.username.trim() || !form.password.trim() || !form.full_name.trim()}
            >
              <UserPlus className="size-4 mr-2" /> Criar usuário
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">O usuário será obrigado a trocar a senha no primeiro login.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Usuários cadastrados</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map((u: any) => {
              const isMasterRow = u.role === "master";
              const podeEditar = isMaster || !isMasterRow;
              const rolesParaEsseUsuario = isMasterRow && !isMaster ? [...ROLES, "master" as Role] : ROLES;
              return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                </div>
                <Select value={u.role} onValueChange={(v: Role) => upd.mutate({ id: u.id, role: v })} disabled={!podeEditar}>
                  <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rolesParaEsseUsuario.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Badge
                  variant={u.active ? "default" : "outline"}
                  className={podeEditar ? "cursor-pointer" : "opacity-60"}
                  onClick={() => podeEditar && upd.mutate({ id: u.id, active: !u.active })}
                >
                  {u.active ? "Ativo" : "Inativo"}
                </Badge>
                <Button
                  size="sm" variant="outline" disabled={!podeEditar}
                  onClick={() => {
                    const pw = prompt("Nova senha temporária (mín. 6 caracteres):");
                    if (pw && pw.length >= 6) resetPw.mutate({ id: u.id, newPassword: pw });
                  }}
                >
                  <KeyRound className="size-4" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="text-destructive" disabled={!podeEditar}
                  onClick={() => { if (confirm(`Remover "${u.full_name}"?`)) del.mutate(u.id); }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
