import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Users, Wallet, BookOpen, CalendarDays, Ticket } from "lucide-react";
import { listCargos, createCargo, deleteCargo, listDepartamentos, createDepartamento, deleteDepartamento, listTiposCulto, createTipoCulto, deleteTipoCulto, listTiposEvento, createTipoEvento, deleteTipoEvento } from "@/lib/cadastros.functions";
import { listAllPlanoContas, createPlanoConta, updatePlanoConta, deletePlanoConta } from "@/lib/plano-contas.functions";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({ meta: [{ title: "Cadastros" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManage = ["master", "admin"].includes(user?.role ?? "");

  const { data: cargos = [], isLoading: loadingCargos } = useQuery({ queryKey: ["cargos"], queryFn: () => listCargos() });
  const { data: departamentos = [], isLoading: loadingDepts } = useQuery({ queryKey: ["departamentos"], queryFn: () => listDepartamentos() });

  const [novoCargo, setNovoCargo] = useState("");
  const [novoDepto, setNovoDepto] = useState("");

  const mutCargo = useMutation({
    mutationFn: () => createCargo({ data: { nome: novoCargo } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cargos"] }); setNovoCargo(""); toast.success("Cargo adicionado"); },
    onError: (e: any) => toast.error(e.message)
  });

  const delCargo = useMutation({
    mutationFn: (id: string) => deleteCargo({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cargos"] }); toast.success("Cargo removido"); }
  });

  const mutDepto = useMutation({
    mutationFn: () => createDepartamento({ data: { nome: novoDepto } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departamentos"] }); setNovoDepto(""); toast.success("Departamento adicionado"); },
    onError: (e: any) => toast.error(e.message)
  });

  const delDepto = useMutation({
    mutationFn: (id: string) => deleteDepartamento({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departamentos"] }); toast.success("Departamento removido"); }
  });

  const { data: tiposCulto = [], isLoading: loadingTiposCulto } = useQuery({ queryKey: ["tipos-culto"], queryFn: () => listTiposCulto() });
  const [novoTipoCulto, setNovoTipoCulto] = useState("");

  const mutTipoCulto = useMutation({
    mutationFn: () => createTipoCulto({ data: { nome: novoTipoCulto } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tipos-culto"] }); setNovoTipoCulto(""); toast.success("Tipo de culto adicionado"); },
    onError: (e: any) => toast.error(e.message)
  });

  const delTipoCulto = useMutation({
    mutationFn: (id: string) => deleteTipoCulto({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tipos-culto"] }); toast.success("Tipo de culto removido"); }
  });

  const { data: tiposEvento = [], isLoading: loadingTiposEvento } = useQuery({ queryKey: ["tipos-evento"], queryFn: () => listTiposEvento() });
  const [novoTipoEvento, setNovoTipoEvento] = useState("");

  const mutTipoEvento = useMutation({
    mutationFn: () => createTipoEvento({ data: { nome: novoTipoEvento } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tipos-evento"] }); setNovoTipoEvento(""); toast.success("Tipo de evento adicionado"); },
    onError: (e: any) => toast.error(e.message)
  });

  const delTipoEvento = useMutation({
    mutationFn: (id: string) => deleteTipoEvento({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tipos-evento"] }); toast.success("Tipo de evento removido"); }
  });

  if (!canManage) return <div className="p-4 text-muted-foreground">Acesso restrito a administradores.</div>;

  return (
    <div className="space-y-6 pb-10 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastros</h1>
        <p className="text-sm text-muted-foreground">Gerencie as opções disponíveis nos formulários do sistema.</p>
      </div>

      <Tabs defaultValue="membros" className="w-full flex flex-col md:flex-row gap-6">
        <TabsList className="flex flex-row md:flex-col h-auto w-full md:w-48 shrink-0 bg-transparent gap-1 p-0 justify-start overflow-x-auto">
          <TabsTrigger value="membros" className="justify-start px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
            <Users className="size-4 mr-2 shrink-0" /> Membros
          </TabsTrigger>
          <TabsTrigger value="cultos" className="justify-start px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
            <CalendarDays className="size-4 mr-2 shrink-0" /> Cultos e Escalas
          </TabsTrigger>
          <TabsTrigger value="eventos" className="justify-start px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
            <Ticket className="size-4 mr-2 shrink-0" /> Eventos
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="justify-start px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"><Wallet className="size-4 mr-2 shrink-0" /> Financeiro</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 min-w-0">
          <TabsContent value="membros" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cargos (Eclesiásticos / Ministeriais)</CardTitle>
                <CardDescription>Estes cargos aparecerão na lista de seleção no perfil dos membros.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={(e) => { e.preventDefault(); if (novoCargo.trim()) mutCargo.mutate(); }} className="flex gap-2">
                  <Input placeholder="Ex: Pastor, Presbítero, Diácono..." value={novoCargo} onChange={e => setNovoCargo(e.target.value)} disabled={mutCargo.isPending} />
                  <Button type="submit" disabled={!novoCargo.trim() || mutCargo.isPending}><Plus className="size-4 mr-1" /> Adicionar</Button>
                </form>
                <div className="border rounded-md divide-y">
                  {loadingCargos ? <div className="p-3 text-sm text-muted-foreground">Carregando...</div> : cargos.length === 0 ? <div className="p-3 text-sm text-muted-foreground">Nenhum cargo cadastrado.</div> : cargos.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                      <span className="text-sm font-medium">{c.nome}</span>
                      <Button variant="ghost" size="sm" className="text-destructive size-7 p-0" onClick={() => { if(confirm("Remover este cargo?")) delCargo.mutate(c.id); }}><Trash2 className="size-4" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="cultos" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tipos de Culto</CardTitle>
                <CardDescription>Estes tipos aparecerão como opção ao agendar um novo culto.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={(e) => { e.preventDefault(); if (novoTipoCulto.trim()) mutTipoCulto.mutate(); }} className="flex gap-2">
                  <Input placeholder="Ex: Culto, Ensino, Vigília..." value={novoTipoCulto} onChange={e => setNovoTipoCulto(e.target.value)} disabled={mutTipoCulto.isPending} />
                  <Button type="submit" disabled={!novoTipoCulto.trim() || mutTipoCulto.isPending}><Plus className="size-4 mr-1" /> Adicionar</Button>
                </form>
                <div className="border rounded-md divide-y">
                  {loadingTiposCulto ? <div className="p-3 text-sm text-muted-foreground">Carregando...</div> : tiposCulto.length === 0 ? <div className="p-3 text-sm text-muted-foreground">Nenhum tipo de culto cadastrado.</div> : tiposCulto.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                      <span className="text-sm font-medium">{t.nome}</span>
                      <Button variant="ghost" size="sm" className="text-destructive size-7 p-0" onClick={() => { if(confirm("Remover este tipo?")) delTipoCulto.mutate(t.id); }}><Trash2 className="size-4" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="eventos" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Departamentos / Grupos</CardTitle>
                <CardDescription>Departamentos responsáveis por organizar os eventos (Ex: Mocidade, Infantil).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={(e) => { e.preventDefault(); if (novoDepto.trim()) mutDepto.mutate(); }} className="flex gap-2">
                  <Input placeholder="Ex: Mocidade, Senhores, Infantil..." value={novoDepto} onChange={e => setNovoDepto(e.target.value)} disabled={mutDepto.isPending} />
                  <Button type="submit" disabled={!novoDepto.trim() || mutDepto.isPending}><Plus className="size-4 mr-1" /> Adicionar</Button>
                </form>
                <div className="border rounded-md divide-y">
                  {loadingDepts ? <div className="p-3 text-sm text-muted-foreground">Carregando...</div> : departamentos.length === 0 ? <div className="p-3 text-sm text-muted-foreground">Nenhum departamento cadastrado.</div> : departamentos.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                      <span className="text-sm font-medium">{d.nome}</span>
                      <Button variant="ghost" size="sm" className="text-destructive size-7 p-0" onClick={() => { if(confirm("Remover este departamento?")) delDepto.mutate(d.id); }}><Trash2 className="size-4" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tipos de Evento</CardTitle>
                <CardDescription>Estes tipos aparecerão como opção ao criar um novo congresso ou evento.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={(e) => { e.preventDefault(); if (novoTipoEvento.trim()) mutTipoEvento.mutate(); }} className="flex gap-2">
                  <Input placeholder="Ex: Congresso, Retiro, Vigília..." value={novoTipoEvento} onChange={e => setNovoTipoEvento(e.target.value)} disabled={mutTipoEvento.isPending} />
                  <Button type="submit" disabled={!novoTipoEvento.trim() || mutTipoEvento.isPending}><Plus className="size-4 mr-1" /> Adicionar</Button>
                </form>
                <div className="border rounded-md divide-y">
                  {loadingTiposEvento ? <div className="p-3 text-sm text-muted-foreground">Carregando...</div> : tiposEvento.length === 0 ? <div className="p-3 text-sm text-muted-foreground">Nenhum tipo de evento cadastrado.</div> : tiposEvento.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                      <span className="text-sm font-medium">{t.nome}</span>
                      <Button variant="ghost" size="sm" className="text-destructive size-7 p-0" onClick={() => { if(confirm("Remover este tipo?")) delTipoEvento.mutate(t.id); }}><Trash2 className="size-4" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financeiro" className="mt-0">
            <PlanoContasTab isAdmin={canManage} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}


function PlanoContasTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: contas = [] } = useQuery({ queryKey: ["plano-contas-all"], queryFn: () => listAllPlanoContas(), enabled: isAdmin });
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA">("ENTRADA");
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");

  const createMut = useMutation({
    mutationFn: () => createPlanoConta({ data: { tipo, codigo, nome } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plano-contas-all"] });
      qc.invalidateQueries({ queryKey: ["plano-contas"] });
      toast.success("Categoria criada");
      setShowForm(false); setCodigo(""); setNome("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const entradas = contas.filter((c: any) => c.tipo === "ENTRADA");
  const saidas = contas.filter((c: any) => c.tipo === "SAIDA");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-6" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Plano de Contas</h2>
            <p className="text-sm text-muted-foreground">
              Categorias padronizadas pela sede.
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}><Plus className="size-4 mr-2" /> Nova categoria</Button>
      </header>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nova categoria</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={(v: "ENTRADA" | "SAIDA") => setTipo(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ENTRADA">Receita</SelectItem><SelectItem value="SAIDA">Despesa</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Código (sem espaço/acento)</Label>
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))} placeholder="EX_TRANSPORTE" />
              </div>
              <div>
                <Label className="text-xs">Nome exibido</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Transporte" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => createMut.mutate()} disabled={!codigo.trim() || !nome.trim() || createMut.isPending}>Criar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ContaColuna titulo="Receitas" contas={entradas} />
        <ContaColuna titulo="Despesas" contas={saidas} />
      </div>
    </div>
  );
}

function ContaColuna({ titulo, contas }: { titulo: string; contas: any[] }) {
  const qc = useQueryClient();

  const toggleMut = useMutation({
    mutationFn: (c: any) => updatePlanoConta({ data: { id: c.id, ativo: !c.ativo } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plano-contas-all"] }); qc.invalidateQueries({ queryKey: ["plano-contas"] }); },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => deletePlanoConta({ data: { id } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["plano-contas-all"] });
      qc.invalidateQueries({ queryKey: ["plano-contas"] });
      toast.success(r.desativada ? "Já tinha uso — foi desativada" : "Categoria removida");
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {contas.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
            <div>
              <span className="font-medium">{c.nome}</span>
              <span className="text-xs text-muted-foreground ml-2">({c.codigo})</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={c.ativo ? "default" : "outline"} className="cursor-pointer"
                onClick={() => toggleMut.mutate(c)}
              >
                {c.ativo ? "Ativa" : "Inativa"}
              </Badge>
              <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => removeMut.mutate(c.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {contas.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria.</p>}
      </CardContent>
    </Card>
  );
}