import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Shirt, ListChecks, Users, ChevronDown, ChevronRight, QrCode, ScanLine, BarChart3, Upload, X, Copy, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getEvent, addUniform, removeUniform, addChecklistItem, removeChecklistItem, updateEvent } from "@/lib/events.functions";
import {
  listRegistrations, createRegistration, searchParticipants, getEventDashboard, toggleRoupaEntregue, addPayment,
} from "@/lib/registrations.functions";

export const Route = createFileRoute("/_authenticated/eventos/$id")({
  head: () => ({ meta: [{ title: "Detalhe do evento" }] }),
  component: Page,
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["event", id], queryFn: () => getEvent({ data: { id } }) });
  const { data: dash } = useQuery({ queryKey: ["event-dashboard", id], queryFn: () => getEventDashboard({ data: { event_id: id } }) });
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations", id], queryFn: () => listRegistrations({ data: { event_id: id } }) });

  const [showConfig, setShowConfig] = useState(false);
  const [showNewReg, setShowNewReg] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);

  const [uniformForm, setUniformForm] = useState({ modelo: "", cor: "", tecido: "", fornecedor: "", valor: "0", foto_url: "" });
  const [checklistLabel, setChecklistLabel] = useState("");

  const addUniformMut = useMutation({
    mutationFn: () => addUniform({ data: { event_id: id, ...uniformForm, valor: Number(uniformForm.valor) || 0 } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", id] });
      setUniformForm({ modelo: "", cor: "", tecido: "", fornecedor: "", valor: "0", foto_url: "" });
      toast.success("Modelo de roupa adicionado");
    },
  });

  const addChecklistMut = useMutation({
    mutationFn: () => addChecklistItem({ data: { event_id: id, label: checklistLabel } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", id] });
      setChecklistLabel("");
      toast.success("Item adicionado ao checklist");
    },
  });

  const toggleRoupaMut = useMutation({
    mutationFn: (args: { id: string, entregue: boolean }) => toggleRoupaEntregue({ data: args }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations", id] });
      qc.invalidateQueries({ queryKey: ["event-dashboard", id] });
    }
  });

  const payMut = useMutation({
    mutationFn: (args: { reg_id: string, valor: number }) => addPayment({ data: { registration_id: args.reg_id, descricao: "Pagamento Inscrição", valor: args.valor, forma: "DINHEIRO" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations", id] });
      qc.invalidateQueries({ queryKey: ["event-dashboard", id] });
      toast.success("Pagamento registrado");
    }
  });

  const groupedRegistrations = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const r of registrations) {
      const c = r.congregacao || "Sem Congregação/Outros";
      if (!groups[c]) groups[c] = [];
      groups[c].push(r);
    }
    return groups;
  }, [registrations]);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  const { event, uniforms, checklist } = data;

  const STATUS_PAGAMENTO_BADGE: Record<string, { label: string; className: string }> = {
    PAGO: { label: "🟢 Pago", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    PARCIAL: { label: "🟡 Parcial", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
    ABERTO: { label: "🔴 Em aberto", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{event.nome}</h1>
          <p className="text-sm text-muted-foreground">{event.data_inicio} — {event.data_fim} {event.local ? `· ${event.local}` : ""}</p>
        </div>
        <div className="flex gap-2">
          {event.require_registration === 1 && (
            <Button variant="secondary" onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/inscricao/${id}`);
              toast.success("Link de inscrição copiado!");
            }}>
              <Copy className="size-4 mr-2" /> Link de Inscrição
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowEditEvent(true)}>
            <Edit className="size-4 mr-2" /> Editar
          </Button>
          <Link to="/eventos/$id/relatorios" params={{ id }}>
            <Button variant="outline"><BarChart3 className="size-4 mr-2" /> Relatórios e Comunicação</Button>
          </Link>
          <Link to="/checkin">
            <Button variant="outline"><ScanLine className="size-4 mr-2" /> Check-in (QR Code)</Button>
          </Link>
        </div>
      </header>
      
      {showEditEvent && (
        <EditEventDialog 
          event={event} 
          open={showEditEvent} 
          onOpenChange={setShowEditEvent} 
          onSaved={() => qc.invalidateQueries({ queryKey: ["event", id] })}
        />
      )}

      {/* Painel de indicadores */}
      {dash && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total inscritos</div><div className="text-2xl font-semibold">{dash.totalInscritos}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Pagos</div><div className="text-2xl font-semibold text-green-600">{dash.pagos}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-semibold text-amber-600">{dash.pendentes}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">% pagamento</div><div className="text-2xl font-semibold">{dash.percentualPagamento.toFixed(0)}%</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Roupa entregue</div><div className="text-2xl font-semibold">{dash.roupaEntregue}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Roupa pendente</div><div className="text-2xl font-semibold">{dash.roupaPendente}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Arrecadado</div><div className="text-xl font-semibold">{fmtBRL(dash.valorArrecadado)}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Esperado</div><div className="text-xl font-semibold">{fmtBRL(dash.valorEsperado)}</div></CardContent></Card>
        </div>
      )}

      {/* Inscritos */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2"><Users className="size-5" /><CardTitle className="text-base">Inscritos ({registrations.length})</CardTitle></div>
          <Button size="sm" onClick={() => setShowNewReg((v) => !v)}><Plus className="size-4 mr-2" /> Nova inscrição</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNewReg && (
            <NewRegistrationForm
              eventId={id}
              uniforms={uniforms}
              onDone={() => { setShowNewReg(false); qc.invalidateQueries({ queryKey: ["registrations", id] }); qc.invalidateQueries({ queryKey: ["event-dashboard", id] }); }}
            />
          )}

          <div className="space-y-6">
            {Object.entries(groupedRegistrations).sort((a, b) => a[0].localeCompare(b[0])).map(([cong, regs]) => (
              <div key={cong}>
                <h3 className="font-semibold text-sm mb-2 px-1 border-b pb-1 flex justify-between">
                  <span>{cong}</span>
                  <span className="text-muted-foreground">{regs.length} inscritos</span>
                </h3>
                <div className="space-y-2">
                  {regs.map((r: any) => (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 hover:border-primary/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <Link to="/eventos/$id/inscricao/$regId" params={{ id, regId: r.id }} className="hover:underline">
                          <div className="font-medium truncate">{r.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.tamanho_roupa ? `Tam. ${r.tamanho_roupa}` : "Sem uniforme"}
                            {r.valor_total > 0 ? ` · ${fmtBRL(r.valor_total)}` : " · Gratuito"}
                          </div>
                        </Link>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {/* Quick Checkboxes for organizers */}
                        {r.valor_total > 0 && (
                          <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded">
                            <Checkbox 
                              checked={r.status_pagamento === "PAGO"} 
                              onCheckedChange={(v) => {
                                if (v && r.status_pagamento !== "PAGO") {
                                  const faltante = r.valor_total - r.total_pago;
                                  payMut.mutate({ reg_id: r.id, valor: faltante });
                                }
                              }}
                              disabled={r.status_pagamento === "PAGO" || payMut.isPending}
                            />
                            <span className="text-xs font-medium">{r.status_pagamento === "PAGO" ? "Pago" : "Pagar"}</span>
                          </div>
                        )}
                        
                        {(r.tamanho_roupa || r.uniform_id) && !r.possui_roupa_propria && (
                          <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded">
                            <Checkbox 
                              checked={!!r.roupa_entregue} 
                              onCheckedChange={(v) => toggleRoupaMut.mutate({ id: r.id, entregue: !!v })}
                              disabled={toggleRoupaMut.isPending}
                            />
                            <span className="text-xs font-medium">Roupa</span>
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-1 items-end min-w-[90px]">
                          <Badge className={STATUS_PAGAMENTO_BADGE[r.status_pagamento].className + " w-full justify-center"}>{STATUS_PAGAMENTO_BADGE[r.status_pagamento].label}</Badge>
                          {r.checklist_total > 0 && (
                            <Badge variant="outline" className="w-full justify-center">{r.checklist_feitos}/{r.checklist_total} cklst</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {registrations.length === 0 && !showNewReg && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum inscrito ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configurações do evento (uniforme/checklist) — recolhível */}
      <div>
        <button onClick={() => setShowConfig((v) => !v)} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          {showConfig ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          Configurações do evento (uniforme e checklist)
        </button>
      </div>

      {showConfig && (
        <>
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0"><Shirt className="size-5" /><CardTitle className="text-base">Controle de roupa/uniforme</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-6 items-end">
                <div><Label className="text-xs">Modelo</Label><Input value={uniformForm.modelo} onChange={(e) => setUniformForm((s) => ({ ...s, modelo: e.target.value }))} placeholder="Vestido, Camiseta..." /></div>
                <div><Label className="text-xs">Cor</Label><Input value={uniformForm.cor} onChange={(e) => setUniformForm((s) => ({ ...s, cor: e.target.value }))} /></div>
                <div><Label className="text-xs">Tecido</Label><Input value={uniformForm.tecido} onChange={(e) => setUniformForm((s) => ({ ...s, tecido: e.target.value }))} /></div>
                <div><Label className="text-xs">Fornecedor</Label><Input value={uniformForm.fornecedor} onChange={(e) => setUniformForm((s) => ({ ...s, fornecedor: e.target.value }))} /></div>
                <div><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={uniformForm.valor} onChange={(e) => setUniformForm((s) => ({ ...s, valor: e.target.value }))} /></div>
                <div>
                  <Label className="text-xs">Foto</Label>
                  <label className="flex items-center justify-center h-10 w-full rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground">
                    <Upload className="size-4 mr-2" />
                    {uniformForm.foto_url ? "Troc. Foto" : "Foto"}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 5 * 1024 * 1024) return toast.error("Máx. 5MB");
                        const dataUrl = await fileToDataUrl(f);
                        setUniformForm(s => ({ ...s, foto_url: dataUrl }));
                      }
                    }} />
                  </label>
                </div>
              </div>
              <Button size="sm" onClick={() => addUniformMut.mutate()} disabled={!uniformForm.modelo.trim() || addUniformMut.isPending}>
                <Plus className="size-4 mr-2" /> Adicionar modelo
              </Button>
              <div className="space-y-2">
                {uniforms.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div className="flex items-center gap-3">
                      {u.foto_url && <img src={u.foto_url} alt="" className="w-10 h-10 rounded object-cover" />}
                      <span>{u.modelo} {u.cor && `· ${u.cor}`} {u.tecido && `· ${u.tecido}`} {u.fornecedor && `· ${u.fornecedor}`} — {fmtBRL(u.valor)}</span>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={async () => { await removeUniform({ data: { id: u.id } }); qc.invalidateQueries({ queryKey: ["event", id] }); }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {uniforms.length === 0 && <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado ainda.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0"><ListChecks className="size-5" /><CardTitle className="text-base">Checklist deste evento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Configure os itens que cada inscrito precisa cumprir — livre por evento.
              </p>
              <div className="flex gap-2">
                <Input value={checklistLabel} onChange={(e) => setChecklistLabel(e.target.value)} placeholder="Ex.: Documento entregue" />
                <Button onClick={() => addChecklistMut.mutate()} disabled={!checklistLabel.trim() || addChecklistMut.isPending}>
                  <Plus className="size-4 mr-2" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {checklist.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>{c.label}</span>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={async () => { await removeChecklistItem({ data: { id: c.id } }); qc.invalidateQueries({ queryKey: ["event", id] }); }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {checklist.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>}
              </div>
            </CardContent>
          </Card>

          <AnexosCard event={event} eventId={id} />
        </>
      )}
    </div>
  );
}

function NewRegistrationForm({ eventId, uniforms, onDone }: { eventId: string; uniforms: any[]; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [congregacao, setCongregacao] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [sexo, setSexo] = useState<"M" | "F" | "">("");
  const [idade, setIdade] = useState("");
  const [cargo, setCargo] = useState("");
  const [uniformId, setUniformId] = useState<string>("__none");
  const [tamanho, setTamanho] = useState<string>("__none");
  const [possuiRoupaPropria, setPossuiRoupaPropria] = useState(false);

  const { data: results = [] } = useQuery({
    queryKey: ["search-participants", query],
    queryFn: () => searchParticipants({ data: { query } }),
    enabled: query.trim().length >= 2 && !participantId,
  });

  const createMut = useMutation({
    mutationFn: () => createRegistration({
      data: {
        event_id: eventId,
        participant_id: participantId,
        nome, congregacao: congregacao || undefined, departamento: departamento || undefined,
        telefone: telefone || undefined, sexo: sexo || undefined, idade: idade ? Number(idade) : undefined,
        cargo: cargo || undefined,
        uniform_id: uniformId === "__none" ? null : uniformId,
        tamanho_roupa: tamanho === "__none" ? undefined : (tamanho as any),
        possui_roupa_propria: possuiRoupaPropria,
      },
    }),
    onSuccess: () => { toast.success("Inscrição realizada"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border p-4 space-y-3 bg-muted/20">
      <div>
        <Label>Buscar participante já cadastrado (opcional)</Label>
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setParticipantId(null); }}
          placeholder="Digite nome ou e-mail..."
        />
        {results.length > 0 && !participantId && (
          <div className="mt-1 border rounded-md divide-y max-h-48 overflow-y-auto bg-card">
            {results.map((p: any) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                onClick={() => {
                  setParticipantId(p.id);
                  setNome(p.nome); setCongregacao(p.congregacao ?? ""); setDepartamento(p.departamento ?? "");
                  setTelefone(p.telefone ?? ""); setSexo((p.sexo as any) ?? ""); setCargo(p.cargo ?? "");
                  setQuery(p.nome);
                }}
              >
                <div className="font-medium">{p.nome}</div>
                <div className="text-xs text-muted-foreground">{p.email}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
        <div><Label>Congregação</Label><Input value={congregacao} onChange={(e) => setCongregacao(e.target.value)} /></div>
        <div><Label>Departamento</Label><Input value={departamento} onChange={(e) => setDepartamento(e.target.value)} /></div>
        <div>
          <Label>Sexo</Label>
          <Select value={sexo} onValueChange={(v: "M" | "F") => setSexo(v)}>
            <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
            <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Idade</Label><Input type="number" value={idade} onChange={(e) => setIdade(e.target.value)} /></div>
        <div><Label>Cargo (opcional)</Label><Input value={cargo} onChange={(e) => setCargo(e.target.value)} /></div>
        <div>
          <Label>Modelo de roupa</Label>
          <Select value={uniformId} onValueChange={setUniformId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— nenhum —</SelectItem>
              {uniforms.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.modelo} {u.cor}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tamanho</Label>
          <Select value={tamanho} onValueChange={setTamanho}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">—</SelectItem>
              {["PP", "P", "M", "G", "GG", "XG"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Checkbox checked={possuiRoupaPropria} onCheckedChange={(v) => setPossuiRoupaPropria(!!v)} />
          <Label className="!mb-0">Já possui roupa própria (não cobra o valor do uniforme)</Label>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>Cancelar</Button>
        <Button onClick={() => createMut.mutate()} disabled={!nome.trim() || createMut.isPending}>
          {createMut.isPending ? "Salvando..." : "Inscrever"}
        </Button>
      </div>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AnexosCard({ event, eventId }: { event: any; eventId: string }) {
  const qc = useQueryClient();
  const [novoPreletor, setNovoPreletor] = useState("");
  const [novoCantor, setNovoCantor] = useState("");
  const preletores: string[] = JSON.parse(event.preletores || "[]");
  const cantores: string[] = JSON.parse(event.cantores || "[]");

  const saveMut = useMutation({
    mutationFn: (patch: any) => updateEvent({ data: { id: eventId, ...patch } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event", eventId] }),
  });

  async function uploadFile(campo: "arte_url" | "regulamento_url" | "programacao_url", file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 5MB)"); return; }
    const dataUrl = await fileToDataUrl(file);
    saveMut.mutate({ [campo]: dataUrl });
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Anexos e divulgação</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <AnexoField label="Arte oficial" value={event.arte_url} onUpload={(f) => uploadFile("arte_url", f)} onClear={() => saveMut.mutate({ arte_url: "" })} accept="image/*" isImage />
          <AnexoField label="Regulamento" value={event.regulamento_url} onUpload={(f) => uploadFile("regulamento_url", f)} onClear={() => saveMut.mutate({ regulamento_url: "" })} accept="application/pdf,image/*" />
          <AnexoField label="Programação" value={event.programacao_url} onUpload={(f) => uploadFile("programacao_url", f)} onClear={() => saveMut.mutate({ programacao_url: "" })} accept="application/pdf,image/*" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Preletores</Label>
            <div className="flex gap-2 mt-1">
              <Input value={novoPreletor} onChange={(e) => setNovoPreletor(e.target.value)} placeholder="Nome do preletor" />
              <Button
                size="icon"
                onClick={() => { saveMut.mutate({ preletores: [...preletores, novoPreletor] }); setNovoPreletor(""); }}
                disabled={!novoPreletor.trim()}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {preletores.map((p, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {p}
                  <button onClick={() => saveMut.mutate({ preletores: preletores.filter((_, idx) => idx !== i) })}><X className="size-3" /></button>
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label>Cantores convidados</Label>
            <div className="flex gap-2 mt-1">
              <Input value={novoCantor} onChange={(e) => setNovoCantor(e.target.value)} placeholder="Nome do cantor/ministério" />
              <Button
                size="icon"
                onClick={() => { saveMut.mutate({ cantores: [...cantores, novoCantor] }); setNovoCantor(""); }}
                disabled={!novoCantor.trim()}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {cantores.map((c, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {c}
                  <button onClick={() => saveMut.mutate({ cantores: cantores.filter((_, idx) => idx !== i) })}><X className="size-3" /></button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AnexoField({
  label, value, onUpload, onClear, accept, isImage,
}: {
  label: string; value: string | null; onUpload: (f: File) => void; onClear: () => void; accept: string; isImage?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 space-y-2">
        {value ? (
          <div className="flex items-center gap-2">
            {isImage ? (
              <img src={value} alt="" className="h-16 rounded border object-contain" />
            ) : (
              <Badge variant="outline">Arquivo enviado</Badge>
            )}
            <Button size="icon" variant="ghost" className="text-destructive" onClick={onClear}><Trash2 className="size-4" /></Button>
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm cursor-pointer hover:bg-accent">
            <Upload className="size-4" /> Enviar
            <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
          </label>
        )}
      </div>
    </div>
  );
}

function EditEventDialog({ event, open, onOpenChange, onSaved }: { event: any, open: boolean, onOpenChange: (o: boolean) => void, onSaved: () => void }) {
  const [form, setForm] = useState({
    nome: event.nome,
    local: event.local || "",
    organizador: event.organizador || "",
    observacoes: event.observacoes || "",
    regras_inscricao: event.regras_inscricao || "",
    require_registration: event.require_registration === 1,
  });

  const saveMut = useMutation({
    mutationFn: () => updateEvent({
      data: {
        id: event.id,
        nome: form.nome,
        local: form.local,
        organizador: form.organizador,
        observacoes: form.observacoes,
        regras_inscricao: form.regras_inscricao,
        require_registration: form.require_registration,
      }
    }),
    onSuccess: () => {
      toast.success("Evento atualizado com sucesso!");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar Evento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do Evento</Label>
            <Input value={form.nome} onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))} />
          </div>
          <div>
            <Label>Local</Label>
            <Input value={form.local} onChange={(e) => setForm((s) => ({ ...s, local: e.target.value }))} />
          </div>
          <div>
            <Label>Organizador (Contato)</Label>
            <Input value={form.organizador} onChange={(e) => setForm((s) => ({ ...s, organizador: e.target.value }))} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm((s) => ({ ...s, observacoes: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={form.require_registration} onCheckedChange={(v) => setForm((s) => ({ ...s, require_registration: !!v }))} />
            <Label>Exige inscrição prévia</Label>
          </div>
          {form.require_registration && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/10">
              <Label>Termos e Regras da Inscrição</Label>
              <Textarea 
                value={form.regras_inscricao} 
                onChange={(e) => setForm((s) => ({ ...s, regras_inscricao: e.target.value }))} 
                rows={4}
                placeholder="Ex: O uso da camiseta é obrigatório. O pagamento deve ser feito até o dia X."
              />
              <p className="text-xs text-muted-foreground">O candidato precisará marcar que leu e aceita essas regras antes de preencher o formulário na página pública.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.nome.trim()}>
              {saveMut.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
