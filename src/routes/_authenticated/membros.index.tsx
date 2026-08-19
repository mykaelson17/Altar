import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, memo, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, UserCheck, Plus, Search, LayoutGrid, List, LayoutDashboard, ChevronDown, Cake, SortAsc, Filter, MapPin, Edit } from "lucide-react";
import { listMembers, createMember, updateMember, getMemberStats } from "@/lib/members.functions";
import { listCargos, listDepartamentos } from "@/lib/cadastros.functions";
import { Upload, Trash2 } from "lucide-react";
import { listCongregations } from "@/lib/congregations.functions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/membros/")({
  head: () => ({ meta: [{ title: "Membros" }] }),
  component: Page,
});

const SITUACAO_LABEL: Record<string, string> = {
  ATIVO: "Ativo", AFASTADO: "Inativo", CONGREGADO: "Congregado", VISITANTE: "Visitante",
};
const SITUACAO_COLOR: Record<string, string> = {
  ATIVO: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  AFASTADO: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  CONGREGADO: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  VISITANTE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

type ViewMode = "cards" | "linhas" | "compacto";
type OrderBy = "nome_asc" | "nome_desc" | "idade_asc" | "idade_desc";

function calcIdade(nasc: string): number {
  const d = new Date(nasc + "T00:00:00");
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
  return idade;
}

function PizzaChart({ data, title }: { data: { name: string; value: number; fill: string }[]; title: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4 pt-0">
        <div className="w-[90px] h-[90px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={24} outerRadius={42} paddingAngle={2}>
                {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip formatter={(v: number, n: string) => [`${v} (${total ? Math.round(v / total * 100) : 0}%)`, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
              <span className="truncate text-muted-foreground">{d.name}</span>
              <span className="ml-auto font-semibold">{d.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartMembrosMes({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;
  return (
    <Card className="sm:col-span-2">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">Novos cadastros (ultimos 12 meses)</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        <div className="h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} dy={5} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
              <Bar dataKey="novos" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function AniversariantesSection({ aniversariantes }: { aniversariantes: { id: string; nome: string; data_nascimento: string; departamento: string | null }[] }) {
  const [open, setOpen] = useState(false);
  if (aniversariantes.length === 0) return null;

  const deptos: Record<string, typeof aniversariantes> = {};
  for (const a of aniversariantes) {
    const key = a.departamento?.trim() || "Sem departamento";
    if (!deptos[key]) deptos[key] = [];
    deptos[key].push(a);
  }
  const deptosOrdenados = Object.entries(deptos).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardHeader className="flex-row items-center gap-2 space-y-0 py-3">
              <Cake className="size-5 text-pink-500" />
              <CardTitle className="text-base flex-1">
                Aniversariantes do mes <Badge variant="outline" className="ml-2 text-xs">{aniversariantes.length}</Badge>
              </CardTitle>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </CardHeader>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {deptosOrdenados.map(([depto, membros]) => (
                <div key={depto} className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1 mb-2">
                    {depto} <span className="font-normal normal-case">({membros.length})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {membros.map((m) => (
                      <Link key={m.id} to="/membros/$id" params={{ id: m.id }} className="flex items-center justify-between gap-1 text-xs hover:text-primary transition-colors group py-0.5 min-w-0">
                        <span className="truncate group-hover:underline">{m.nome}</span>
                        <Badge variant="outline" className="shrink-0 text-[9px] text-pink-600 border-pink-200 px-1">
                          {m.data_nascimento.slice(8, 10)}/{m.data_nascimento.slice(5, 7)}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function StatusDropdown({ situacao, onChange, disabled }: { situacao: string; onChange: (v: string) => void; disabled: boolean }) {
  if (disabled) {
    return <Badge className={`text-[10px] px-1.5 py-0 ${SITUACAO_COLOR[situacao]}`}>{SITUACAO_LABEL[situacao]}</Badge>;
  }
  return (
    <Select value={situacao} onValueChange={onChange}>
      <SelectTrigger className={`h-6 text-[10px] px-2 py-0 border-0 ${SITUACAO_COLOR[situacao]} font-medium focus:ring-0`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ATIVO">Ativo</SelectItem>
        <SelectItem value="AFASTADO">Inativo</SelectItem>
        <SelectItem value="CONGREGADO">Congregado</SelectItem>
        <SelectItem value="VISITANTE">Visitante</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ViewCards({ members, onEdit, onStatusChange, canManageMembers }: { members: any[], onEdit: (m:any)=>void, onStatusChange: (id:string, s:string)=>void, canManageMembers: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {members.map((m) => (
        <Card key={m.id} className="h-full hover:border-primary/50 hover:shadow-md transition-all duration-200 relative group">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Link to="/membros/$id" params={{ id: m.id }} className="shrink-0">
              {m.foto_url ? (
                <img src={m.foto_url} alt="" className="size-12 rounded-full object-cover shrink-0 ring-2 ring-muted hover:ring-primary/50 transition-all" />
              ) : (
                <div className="size-12 rounded-full bg-muted grid place-items-center shrink-0 hover:bg-muted/80 transition-all">
                  <UserCheck className="size-5 text-muted-foreground" />
                </div>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <Link to="/membros/$id" params={{ id: m.id }} className="font-medium truncate text-sm hover:text-primary transition-colors block">{m.nome}</Link>
              {m.departamento && <div className="text-[11px] text-muted-foreground truncate">{m.departamento}</div>}
              <div className="mt-1 inline-block">
                <StatusDropdown situacao={m.situacao} onChange={(v) => onStatusChange(m.id, v)} disabled={!canManageMembers} />
              </div>
            </div>
            {canManageMembers && (
              <Button variant="ghost" size="sm" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity size-7 p-0" onClick={(e) => { e.preventDefault(); onEdit(m); }}>
                <Edit className="size-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ViewLinhas({ members, onEdit, onStatusChange, canManageMembers }: { members: any[], onEdit: (m:any)=>void, onStatusChange: (id:string, s:string)=>void, canManageMembers: boolean }) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Membro</th>
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Recepção</th>
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Cargo</th>
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Departamento</th>
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Nascimento</th>
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
            {canManageMembers && <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-10"></th>}
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={m.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
              <td className="px-4 py-2.5">
                <Link to="/membros/$id" params={{ id: m.id }} className="flex items-center gap-2.5 hover:text-primary w-fit">
                  {m.foto_url ? (
                    <img src={m.foto_url} alt="" className="size-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="size-7 rounded-full bg-muted grid place-items-center shrink-0">
                      <UserCheck className="size-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="font-medium truncate">{m.nome}</span>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                {m.data_recepcao ? `${m.data_recepcao.slice(8,10)}/${m.data_recepcao.slice(5,7)}/${m.data_recepcao.slice(0,4)}` : "-"}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{m.cargo || "-"}</td>
              <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{m.departamento || "-"}</td>
              <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                {m.data_nascimento ? `${m.data_nascimento.slice(8,10)}/${m.data_nascimento.slice(5,7)}/${m.data_nascimento.slice(0,4)} (${calcIdade(m.data_nascimento)}a)` : "-"}
              </td>
              <td className="px-3 py-2.5">
                <div className="w-[110px]">
                  <StatusDropdown situacao={m.situacao} onChange={(v) => onStatusChange(m.id, v)} disabled={!canManageMembers} />
                </div>
              </td>
              {canManageMembers && (
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" size="sm" className="size-7 p-0" onClick={() => onEdit(m)}>
                    <Edit className="size-4" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ViewCompacto({ members, onEdit, onStatusChange, canManageMembers }: { members: any[], onEdit: (m:any)=>void, onStatusChange: (id:string, s:string)=>void, canManageMembers: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-all duration-150 group relative">
          <Link to="/membros/$id" params={{ id: m.id }} className="shrink-0">
            {m.foto_url ? (
              <img src={m.foto_url} alt="" className="size-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="size-8 rounded-full bg-muted grid place-items-center shrink-0">
                <UserCheck className="size-4 text-muted-foreground" />
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link to="/membros/$id" params={{ id: m.id }} className="text-sm font-medium truncate group-hover:text-primary transition-colors block">{m.nome}</Link>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${m.situacao === "ATIVO" ? "bg-green-500" : m.situacao === "AFASTADO" ? "bg-red-500" : m.situacao === "CONGREGADO" ? "bg-purple-500" : "bg-yellow-500"}`} />
              <div className="w-[85px]">
                <StatusDropdown situacao={m.situacao} onChange={(v) => onStatusChange(m.id, v)} disabled={!canManageMembers} />
              </div>
              {m.data_nascimento && <span className="text-[10px] text-muted-foreground ml-1 shrink-0">- {calcIdade(m.data_nascimento)}a</span>}
            </div>
          </div>
          {canManageMembers && (
            <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity size-6 p-0" onClick={() => onEdit(m)}>
              <Edit className="size-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function Page() {
  const { user } = useAuth();
  const isAdmin = ["master", "admin"].includes(user?.role ?? "");
  const canManageMembers = ["master", "admin", "coordenador", "usuario"].includes(user?.role ?? "");
  const [showForm, setShowForm] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [situacao, setSituacao] = useState("__todas");
  const [congregationFilter, setCongregationFilter] = useState("__todas");
  const [orderBy, setOrderBy] = useState<OrderBy>("nome_asc");
  const [viewMode, setViewMode] = useState<ViewMode>("linhas");
  const [filtroNovosMes, setFiltroNovosMes] = useState(false);

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 8) v = v.slice(0, 8);
    if (v.length >= 5) v = `${v.slice(0, 5)}-${v.slice(5)}`;
    setForm(s => ({ ...s, cep: v }));
    if (v.replace(/\D/g, "").length === 8) {
      buscarCep(v);
    }
  };
  const buscarCep = async (cep: string) => {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const d = await res.json();
      if (!d.erro) {
        setForm(s => ({ ...s, endereco: d.logradouro || s.endereco, bairro: d.bairro || s.bairro, cidade: d.localidade || s.cidade, estado: d.uf || s.estado }));
      }
    } catch (e) {}
  };
  const emptyForm = {
    id: "", nome: "", email: "", cpf: "", telefone: "", data_nascimento: "",
    sexo: "" as "M" | "F" | "", estado_civil: "", cargo: "",
    endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "", departamento: "", cargo: "", carta_mudanca_url: "",
    data_conversao: "", data_batismo: "", data_recepcao: "",
    congregation_id: "__none",
  };
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();
    const { data: cargosOpts = [] } = useQuery({ queryKey: ["cargos"], queryFn: () => listCargos() });
  const { data: departamentosOpts = [] } = useQuery({ queryKey: ["departamentos"], queryFn: () => listDepartamentos() });
  const [uploading, setUploading] = useState(false);

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  const { data: congregations = [] } = useQuery({ queryKey: ["congregations"], queryFn: () => listCongregations() });
    const { data: stats } = useQuery({ 
    queryKey: ["member-stats", congregationFilter], 
    queryFn: () => getMemberStats({ 
      data: { congregation_id: congregationFilter === "__todas" ? undefined : congregationFilter } as any 
    }) 
  });
  const { data: allMembers = [], isLoading } = useQuery({
    queryKey: ["members", situacao, congregationFilter, orderBy, filtroNovosMes],
    queryFn: () => listMembers({ 
      data: { 
        situacao: situacao === "__todas" ? undefined : situacao, 
        congregation_id: congregationFilter === "__todas" ? undefined : congregationFilter,
        orderBy, 
        novosMes: filtroNovosMes ? true : undefined 
      } as any
    }),
  });
  const members = useMemo(() => {
    if (!query.trim()) return allMembers;
    const q2 = query.toLowerCase();
    return (allMembers as any[]).filter((m) =>
      m.nome?.toLowerCase().includes(q2) || m.email?.toLowerCase().includes(q2) || m.cpf?.includes(q2)
    );
  }, [allMembers, query]);
  
  const createMut = useMutation({
    mutationFn: () => createMember({
      data: {
        ...form,
        sexo: form.sexo || undefined,
        estado_civil: (form.estado_civil as any) || undefined,
        congregation_id: form.congregation_id === "__none" ? null : form.congregation_id,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["member-stats"] });
      setShowForm(false);
      setForm(emptyForm);
      toast.success("Membro cadastrado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => updateMember({
      data: {
        id: form.id,
        ...form,
        sexo: form.sexo || undefined,
        estado_civil: (form.estado_civil as any) || undefined,
        congregation_id: form.congregation_id === "__none" ? null : form.congregation_id,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["member-stats"] });
      setShowForm(false);
      setIsEditing(false);
      setForm(emptyForm);
      toast.success("Membro atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, situacao }: { id: string; situacao: string }) => updateMember({ data: { id, situacao: situacao as any } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["member-stats"] });
      toast.success("Status alterado com sucesso!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleEdit = (m: any) => {
    setForm({ ...emptyForm, ...m, congregation_id: m.congregation_id ?? "__none" });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleStatusChange = (id: string, newSituacao: string) => {
    statusMut.mutate({ id, situacao: newSituacao });
  };

  const saveForm = () => {
    if (isEditing) updateMut.mutate();
    else createMut.mutate();
  };

  const isSaving = createMut.isPending || updateMut.isPending;
  const faltaObrigatorio = !form.nome.trim() || !form.cpf?.trim() || !form.telefone?.trim() || !form.endereco?.trim() || !form.bairro?.trim() || !form.cidade?.trim() || !form.data_recepcao;
  
  return (
    <div className="space-y-5 pb-10">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Membros</h1>
          <p className="text-sm text-muted-foreground">{members.length} exibido(s) - {stats?.total ?? 0} no total</p>
        </div>
        {canManageMembers && (
          <Button onClick={() => { setForm(emptyForm); setIsEditing(false); setShowForm((v) => !v); }}>
            <Plus className="size-4 mr-2" /> Novo membro
          </Button>
        )}
      </header>
      {stats && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {[
            { label: "Total", value: stats.total, color: "text-foreground", bg: "bg-primary/10", icon: <Users className="size-5 text-primary" />, onClick: () => { setSituacao("__todas"); setFiltroNovosMes(false); } },
            { label: "Ativos", value: stats.ativos, color: "text-green-600", bg: "bg-green-500/10", icon: <UserCheck className="size-5 text-green-600" />, onClick: () => { setSituacao("ATIVO"); setFiltroNovosMes(false); } },
            { label: "Congregados", value: (stats as any).congregados ?? 0, color: "text-purple-600", bg: "bg-purple-500/10", icon: <Users className="size-5 text-purple-600" />, onClick: () => { setSituacao("CONGREGADO"); setFiltroNovosMes(false); } },
            { label: "Inativos", value: stats.afastados, color: "text-red-500", bg: "bg-red-500/10", icon: <Users className="size-5 text-red-500" />, onClick: () => { setSituacao("AFASTADO"); setFiltroNovosMes(false); } },
            { label: "Novos (mes)", value: stats.novosMes, color: "text-blue-500", bg: "bg-blue-500/10", icon: <Plus className="size-5 text-blue-500" />, onClick: () => { setSituacao("__todas"); setFiltroNovosMes(true); } },
          ].map((s) => (
            <Card key={s.label} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={s.onClick}>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className={`size-10 rounded-full ${s.bg} grid place-items-center shrink-0`}>{s.icon}</div>
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-medium tracking-wide">{s.label}</div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ChartMembrosMes data={stats.membrosPorMes} />
          <PizzaChart data={stats.faixaPizza} title="Faixa etaria" />
          <PizzaChart data={stats.sexoPizza} title="Por sexo" />
        </div>
      )}
      {stats?.aniversariantes && (
        <AniversariantesSection aniversariantes={(stats.aniversariantes as any[]).map((a) => ({ ...a, departamento: a.departamento ?? null }))} />
      )}
      {showForm && (
        <Card className="border-primary/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {isEditing ? <><Edit className="size-4" /> Editar membro</> : <><Plus className="size-4" /> Cadastro de membro</>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-xs text-muted-foreground">Campos com <span className="text-destructive">*</span> sao obrigatorios.</p>
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-1">Dados Principais</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label>Nome completo <span className="text-destructive">*</span></Label>
                  <Input value={form.nome} onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))} />
                </div>
                <div>
                  <Label>CPF <span className="text-destructive">*</span></Label>
                  <Input value={form.cpf} onChange={(e) => setForm((s) => ({ ...s, cpf: e.target.value }))} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Telefone <span className="text-destructive">*</span></Label>
                  <Input value={form.telefone} onChange={(e) => setForm((s) => ({ ...s, telefone: e.target.value }))} />
                </div>
                <div>
                  <Label>Data de nascimento <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.data_nascimento} onChange={(e) => setForm((s) => ({ ...s, data_nascimento: e.target.value }))} />
                </div>
                <div>
                  <Label>Sexo</Label>
                  <Select value={form.sexo} onValueChange={(v: "M" | "F") => setForm((s) => ({ ...s, sexo: v }))}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado civil</Label>
                  <Select value={form.estado_civil} onValueChange={(v) => setForm((s) => ({ ...s, estado_civil: v }))}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SOLTEIRO">Solteiro(a)</SelectItem>
                      <SelectItem value="CASADO">Casado(a)</SelectItem>
                      <SelectItem value="DIVORCIADO">Divorciado(a)</SelectItem>
                      <SelectItem value="VIUVO">Viuvo(a)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={form.cep || ""} onChange={handleCepChange} placeholder="00000-000" maxLength={9} />
                </div>
                <div className="md:col-span-2">
                  <Label>Rua / Logradouro <span className="text-destructive">*</span></Label>
                  <Input value={form.endereco} onChange={(e) => setForm((s) => ({ ...s, endereco: e.target.value }))} />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={form.numero} onChange={(e) => setForm((s) => ({ ...s, numero: e.target.value }))} />
                </div>
                <div>
                  <Label>Bairro <span className="text-destructive">*</span></Label>
                  <Input value={form.bairro} onChange={(e) => setForm((s) => ({ ...s, bairro: e.target.value }))} />
                </div>
                <div>
                  <Label>Cidade <span className="text-destructive">*</span></Label>
                  <Input value={form.cidade} onChange={(e) => setForm((s) => ({ ...s, cidade: e.target.value }))} />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input value={form.estado} onChange={(e) => setForm((s) => ({ ...s, estado: e.target.value }))} maxLength={2} placeholder="UF" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-1">Eclesiastico</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label>Cargo</Label>
                  <Select value={form.cargo} onValueChange={(v) => setForm((s) => ({ ...s, cargo: v }))}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      {cargosOpts.map((c) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Departamento</Label>
                  <Select value={form.departamento} onValueChange={(v) => setForm((s) => ({ ...s, departamento: v }))}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      {departamentosOpts.map((d) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {isAdmin && (
                  <div>
                    <Label>Congregacao</Label>
                    <Select value={form.congregation_id} onValueChange={(v) => setForm((s) => ({ ...s, congregation_id: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Sede</SelectItem>
                        {congregations.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>Data de conversao</Label>
                  <Input type="date" value={form.data_conversao} onChange={(e) => setForm((s) => ({ ...s, data_conversao: e.target.value }))} />
                </div>
                <div>
                  <Label>Data de batismo</Label>
                  <Input type="date" value={form.data_batismo} onChange={(e) => setForm((s) => ({ ...s, data_batismo: e.target.value }))} />
                </div>
                <div>
                  <Label>Data da recepção <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.data_recepcao} onChange={(e) => setForm((s) => ({ ...s, data_recepcao: e.target.value }))} />
                </div>

                <div className="md:col-span-3 mt-2">
                  <Label>Carta de Mudança (opcional)</Label>
                  <div className="mt-1">
                    {form.carta_mudanca_url ? (
                      <div className="flex items-center gap-3 p-2">
                        <button onClick={(e) => { e.preventDefault(); setOpenView(true); }} className="text-sm underline text-primary hover:opacity-80">
                          Ver arquivo anexado
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm cursor-pointer hover:bg-accent w-fit">
                        {uploading ? "Carregando..." : <><Upload className="size-4" /> Anexar Imagem/PDF</>}
                        <input
                          type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading}
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            if (f.size > 8 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 8MB)."); return; }
                            setUploading(true);
                            try {
                              const dUrl = await fileToDataUrl(f);
                              setForm((s) => ({ ...s, carta_mudanca_url: dUrl }));
                            } catch(err) { toast.error("Falha ao ler o arquivo"); }
                            finally { setUploading(false); }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowForm(false); setIsEditing(false); }}>Cancelar</Button>
              <Button onClick={saveForm} disabled={faltaObrigatorio || isSaving}>
                {isSaving ? "Salvando..." : (isEditing ? "Salvar alteracoes" : "Cadastrar")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>Carta de Mudança</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center mt-2">
            {form.carta_mudanca_url?.startsWith("data:image") ? (
              <img src={form.carta_mudanca_url} alt="Carta" className="max-w-full max-h-[75vh] object-contain rounded-md" />
            ) : form.carta_mudanca_url ? (
              <iframe src={form.carta_mudanca_url} className="w-full h-[75vh] border-0 rounded-md bg-white" />
            ) : null}
          </div>
          <div className="flex justify-end mt-2">
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={() => {
                if (confirm("Remover a carta de mudanca anexada?")) {
                  setForm(s => ({ ...s, carta_mudanca_url: "" }));
                  setOpenView(false);
                }
              }}
            >
              <Trash2 className="size-4 mr-2" /> Excluir Anexo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex flex-wrap gap-2 items-center mt-6">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9 h-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, e-mail ou CPF..." />
        </div>
        
        {isAdmin && (
          <Select value={congregationFilter} onValueChange={setCongregationFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <MapPin className="size-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todas">Todas as congregacoes</SelectItem>
              
              {congregations.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={filtroNovosMes ? "__novos" : situacao} onValueChange={(v) => {
          if (v === "__novos") { setSituacao("__todas"); setFiltroNovosMes(true); }
          else { setSituacao(v); setFiltroNovosMes(false); }
        }}>
          <SelectTrigger className="w-[140px] h-9">
            <Filter className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todas">Todos</SelectItem>
            <SelectItem value="ATIVO">Ativos</SelectItem>
            <SelectItem value="CONGREGADO">Congregados</SelectItem>
            <SelectItem value="AFASTADO">Inativos</SelectItem>
            <SelectItem value="VISITANTE">Visitantes</SelectItem>
            <SelectItem value="__novos">Novos (mes)</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={orderBy} onValueChange={(v: OrderBy) => setOrderBy(v)}>
          <SelectTrigger className="w-[150px] h-9">
            <SortAsc className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nome_asc">Nome A a Z</SelectItem>
            <SelectItem value="nome_desc">Nome Z a A</SelectItem>
            <SelectItem value="idade_asc">Mais jovens</SelectItem>
            <SelectItem value="idade_desc">Mais velhos</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 border rounded-md p-0.5 h-9">
          <button onClick={() => setViewMode("cards")} className={`p-1.5 rounded transition-colors ${viewMode === "cards" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Cards">
            <LayoutGrid className="size-4" />
          </button>
          <button onClick={() => setViewMode("linhas")} className={`p-1.5 rounded transition-colors ${viewMode === "linhas" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Linhas">
            <List className="size-4" />
          </button>
          <button onClick={() => setViewMode("compacto")} className={`p-1.5 rounded transition-colors ${viewMode === "compacto" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Compacto">
            <LayoutDashboard className="size-4" />
          </button>
        </div>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-10">Carregando...</div>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Nenhum membro encontrado.</p>
      ) : viewMode === "cards" ? (
        <ViewCards members={members as any[]} onEdit={handleEdit} onStatusChange={handleStatusChange} canManageMembers={canManageMembers} />
      ) : viewMode === "linhas" ? (
        <ViewLinhas members={members as any[]} onEdit={handleEdit} onStatusChange={handleStatusChange} canManageMembers={canManageMembers} />
      ) : (
        <ViewCompacto members={members as any[]} onEdit={handleEdit} onStatusChange={handleStatusChange} canManageMembers={canManageMembers} />
      )}
    </div>
  );
}