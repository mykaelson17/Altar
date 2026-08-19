import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, MapPin, Calendar as CalendarIcon, ChevronLeft, ChevronRight, List, CalendarDays, Clock, Edit } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listEvents, createEvent, getEvent } from "@/lib/events.functions";
import { listTiposEvento, listDepartamentos } from "@/lib/cadastros.functions";
import { listCongregations } from "@/lib/congregations.functions";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/eventos/")({
  head: () => ({ meta: [{ title: "Congressos e Eventos" }] }),
  component: Page,
});

const EMPTY_FORM = {
  nome: "", tipo: "", departamento: "", congregacao: "", data_inicio: "", data_fim: "",
  local: "", organizador: "", valor_inscricao: "0", valor_uniforme: "0", prazo_pagamento: "",
  max_participantes: "", observacoes: "", regras_inscricao: "", require_registration: false, schedules: {} as Record<string, { start_time: string, end_time: string }>
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Page() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => listEvents() });
  const { data: tiposEvento = [] } = useQuery({ queryKey: ["tipos-evento"], queryFn: () => listTiposEvento() });
  const { data: departamentos = [] } = useQuery({ queryKey: ["departamentos"], queryFn: () => listDepartamentos() });
  const { data: congregacoes = [] } = useQuery({ queryKey: ["congregations"], queryFn: () => listCongregations() });

  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<"calendario" | "lista">("calendario");
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (showForm && !isAdmin && user?.congregationId) {
      const minhavC = congregacoes.find((c: any) => c.id === user.congregationId);
      if (minhavC) {
        setForm(s => ({ ...s, congregacao: minhavC.nome }));
      }
    }
  }, [showForm, isAdmin, user?.congregationId, congregacoes]);

  const scheduleDays = useMemo(() => {
    if (!form.data_inicio || !form.data_fim) return [];
    const inicio = new Date(form.data_inicio + "T00:00:00");
    const fim = new Date(form.data_fim + "T00:00:00");
    if (inicio > fim) return [];
    const days = [];
    const cur = new Date(inicio);
    let limit = 0;
    while (cur <= fim && limit < 30) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
      limit++;
    }
    return days;
  }, [form.data_inicio, form.data_fim]);

  const createMut = useMutation({
    mutationFn: () => createEvent({
      data: {
        ...form,
        valor_inscricao: Number(form.valor_inscricao) || 0,
        valor_uniforme: Number(form.valor_uniforme) || 0,
        max_participantes: form.max_participantes ? Number(form.max_participantes) : undefined,
        preletores: [],
        cantores: [],
        schedules: scheduleDays.map(date => ({
          date,
          start_time: form.schedules[date]?.start_time,
          end_time: form.schedules[date]?.end_time,
        })),
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Evento criado");
      setShowForm(false);
      setView("calendario");
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Congressos e Eventos</h1>
          <p className="text-sm text-muted-foreground">
            Calendário de todas as congregações — congressos, retiros, círculos de oração, batismos e qualquer evento da igreja.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-4 w-full justify-end">
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              <Button size="sm" variant={view === "calendario" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setView("calendario")}>
                <CalendarDays className="size-4" />
              </Button>
              <Button size="sm" variant={view === "lista" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setView("lista")}>
                <List className="size-4" />
              </Button>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="size-4 mr-2" /> Novo evento
            </Button>
          </div>
        </div>
      </header>

      {view === "calendario" ? (
        <EventsCalendar events={events} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((ev: any) => (
            <Link key={ev.id} to="/eventos/$id" params={{ id: ev.id }}>
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{ev.nome}</CardTitle>
                    <Badge variant={ev.status === "ATIVO" ? "default" : "outline"}>{ev.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><CalendarIcon className="size-3.5" /> {ev.data_inicio} — {ev.data_fim}</div>
                  {ev.local && <div className="flex items-center gap-2"><MapPin className="size-3.5" /> {ev.local}</div>}
                  {ev.congregacao && <div>{ev.congregacao}</div>}
                  {ev.tipo && <div>{ev.tipo}</div>}
                </CardContent>
              </Card>
            </Link>
          ))}
          {events.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-10">Nenhum evento cadastrado ainda.</p>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cadastro do evento</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Nome do congresso/evento</Label>
              <Input value={form.nome} onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))} placeholder="Ex.: Congresso de Jovens 2026" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((s) => ({ ...s, tipo: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {tiposEvento.map((t: any) => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Departamento responsável</Label>
              <Select value={form.departamento} onValueChange={(v) => setForm((s) => ({ ...s, departamento: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {departamentos.map((d: any) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Congregação responsável</Label>
              <Select value={form.congregacao} onValueChange={(v) => setForm((s) => ({ ...s, congregacao: v }))} disabled={!isAdmin}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {congregacoes.map((c: any) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Organizador</Label>
              <Input value={form.organizador} onChange={(e) => setForm((s) => ({ ...s, organizador: e.target.value }))} />
            </div>
            <div>
              <Label>Data de início</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm((s) => ({ ...s, data_inicio: e.target.value }))} />
            </div>
            <div>
              <Label>Data de término</Label>
              <Input type="date" value={form.data_fim} onChange={(e) => setForm((s) => ({ ...s, data_fim: e.target.value }))} />
            </div>
            <div>
              <Label>Local</Label>
              <Input value={form.local} onChange={(e) => setForm((s) => ({ ...s, local: e.target.value }))} />
            </div>
            <div>
              <Label>Valor da inscrição (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_inscricao} onChange={(e) => setForm((s) => ({ ...s, valor_inscricao: e.target.value }))} />
            </div>
            <div>
              <Label>Valor da roupa/uniforme (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_uniforme} onChange={(e) => setForm((s) => ({ ...s, valor_uniforme: e.target.value }))} />
            </div>
            <div>
              <Label>Prazo para pagamento</Label>
              <Input type="date" value={form.prazo_pagamento} onChange={(e) => setForm((s) => ({ ...s, prazo_pagamento: e.target.value }))} />
            </div>
            <div>
              <Label>Número máximo de participantes</Label>
              <Input type="number" value={form.max_participantes} onChange={(e) => setForm((s) => ({ ...s, max_participantes: e.target.value }))} placeholder="Deixe vazio pra ilimitado" />
            </div>
            <div className="md:col-span-2">
              <Label>Exige inscrição prévia?</Label>
              <div className="flex items-center gap-2 mt-1 mb-2">
                <Checkbox checked={form.require_registration} onCheckedChange={(v) => setForm(s => ({ ...s, require_registration: !!v }))} />
                <span className="text-sm">Se ativado, aparecerá um botão de inscrição na agenda.</span>
              </div>
            </div>
            {form.require_registration && (
              <div className="md:col-span-2 border rounded-md p-3 space-y-3 bg-muted/10">
                <Label>Termos e Regras da Inscrição</Label>
                <Textarea 
                  value={form.regras_inscricao} 
                  onChange={(e) => setForm(s => ({ ...s, regras_inscricao: e.target.value }))}
                  placeholder="Ex: O uso da camiseta é obrigatório. O pagamento deve ser feito até o dia X."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">O candidato precisará marcar que leu e aceita essas regras antes de preencher o formulário.</p>
              </div>
            )}
            {scheduleDays.length > 0 && (
              <div className="md:col-span-2 border rounded-md p-3 space-y-3 bg-muted/20">
                <Label>Horários por dia</Label>
                {scheduleDays.map(dia => (
                  <div key={dia} className="flex items-center gap-3">
                    <span className="text-sm min-w-[100px]">{dia.split("-").reverse().join("/")}</span>
                    <Input type="time" className="w-32" value={form.schedules[dia]?.start_time || ""} onChange={(e) => setForm(s => ({...s, schedules: {...s.schedules, [dia]: {...(s.schedules[dia] || {}), start_time: e.target.value}}}))} />
                    <span className="text-sm">até</span>
                    <Input type="time" className="w-32" value={form.schedules[dia]?.end_time || ""} onChange={(e) => setForm(s => ({...s, schedules: {...s.schedules, [dia]: {...(s.schedules[dia] || {}), end_time: e.target.value}}}))} />
                  </div>
                ))}
              </div>
            )}
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm((s) => ({ ...s, observacoes: e.target.value }))} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.nome.trim() || !form.data_inicio || !form.data_fim}>
              {createMut.isPending ? "Salvando..." : "Criar evento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventDetailDialog({ eventId, open, onOpenChange }: { eventId: string | null, open: boolean, onOpenChange: (o: boolean) => void }) {
  const { data } = useQuery({ 
    queryKey: ["event", eventId], 
    queryFn: () => getEvent({ data: { id: eventId! } }),
    enabled: !!eventId
  });
  const { user, isAdmin } = useAuth();

  if (!eventId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {!data ? <p className="p-4 text-center text-muted-foreground">Carregando detalhes...</p> : (
          <>
            <DialogHeader>
              <DialogTitle>{data.event.nome}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm space-y-1 text-muted-foreground">
                {data.event.local && <div><MapPin className="inline size-3.5 mr-1" /> {data.event.local}</div>}
                {data.event.congregacao && <div><strong>Congregação:</strong> {data.event.congregacao}</div>}
                {data.event.observacoes && <div><strong>Observações:</strong> {data.event.observacoes}</div>}
              </div>

              {data.schedules && data.schedules.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-1 flex items-center gap-1"><Clock className="size-3.5" /> Horários do Evento</h4>
                  <div className="text-sm space-y-1 bg-muted/20 p-2 rounded border">
                    {data.schedules.map((sch: any) => (
                      <div key={sch.id} className="flex justify-between">
                        <span className="font-medium">{sch.date.split("-").reverse().join("/")}</span>
                        <span>{sch.start_time || "-"} às {sch.end_time || "-"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {data.event.require_registration === 1 && (
                  <Button className="w-full">Inscrever-se</Button>
                )}
                {(isAdmin || user?.role === "master" || user?.id === data.event.created_by) && (
                  <Link to="/eventos/$id" params={{ id: eventId }} className="w-full" onClick={() => onOpenChange(false)}>
                    <Button variant="outline" className="w-full"><Edit className="size-4 mr-2" /> Gerenciar Evento</Button>
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function EventsCalendar({ events }: { events: any[] }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const ev of events) {
      if (!ev.data_inicio || !ev.data_fim) continue;
      const inicio = new Date(ev.data_inicio + "T00:00:00");
      const fim = new Date(ev.data_fim + "T00:00:00");
      const cursorDia = new Date(inicio);
      let guard = 0;
      while (cursorDia <= fim && guard < 90) {
        const key = cursorDia.toISOString().slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
        cursorDia.setDate(cursorDia.getDate() + 1);
        guard++;
      }
    }
    return map;
  }, [events]);

  const ano = cursor.getFullYear();
  const mes = cursor.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hojeStr = new Date().toISOString().slice(0, 10);

  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  const eventosDoDiaSelecionado = diaSelecionado ? (eventosPorDia.get(diaSelecionado) ?? []) : [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{MESES[mes]} {ano}</CardTitle>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-7" onClick={() => setCursor(new Date(ano, mes - 1, 1))}><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => setCursor(new Date(ano, mes + 1, 1))}><ChevronRight className="size-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
          {DIAS_SEMANA.map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celulas.map((dia, i) => {
            if (dia === null) return <div key={i} />;
            const key = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
            const evsDoDia = eventosPorDia.get(key) ?? [];
            const ehHoje = key === hojeStr;
            return (
              <button
                key={i}
                onClick={() => {
                  if (evsDoDia.length > 0) {
                    setDiaSelecionado(key);
                  } else {
                    setForm(s => ({ ...s, data_inicio: key, data_fim: key }));
                    setShowForm(true);
                  }
                }}
                className={cn(
                  "min-h-[64px] rounded-md border p-1 text-left align-top text-xs flex flex-col gap-0.5 transition-colors cursor-pointer",
                  ehHoje ? "border-primary" : "border-border",
                  evsDoDia.length > 0 ? "hover:bg-accent" : "hover:border-primary/50",
                )}
              >
                <span className={cn("font-medium", ehHoje && "text-primary")}>{dia}</span>
                {evsDoDia.slice(0, 2).map((ev) => (
                  <span key={ev.id} className="truncate rounded bg-primary/10 text-primary px-1 py-0.5 text-[10px] leading-tight">
                    {ev.nome}
                  </span>
                ))}
                {evsDoDia.length > 2 && <span className="text-[10px] text-muted-foreground">+{evsDoDia.length - 2}</span>}
              </button>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={!!diaSelecionado && !selectedEventId} onOpenChange={(open) => !open && setDiaSelecionado(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{diaSelecionado && diaSelecionado.split("-").reverse().join("/")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {eventosDoDiaSelecionado.map((ev) => (
              <button key={ev.id} className="w-full text-left" onClick={() => setSelectedEventId(ev.id)}>
                <div className="rounded-md border p-2 text-sm hover:bg-accent transition-colors">
                  <div className="font-medium">{ev.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {ev.congregacao || "Sede"} {ev.local && `· ${ev.local}`} {ev.valor_uniforme > 0 && `· Uniforme: ${fmtBRL(ev.valor_uniforme)}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <EventDetailDialog eventId={selectedEventId} open={!!selectedEventId} onOpenChange={(o) => !o && setSelectedEventId(null)} />
    </Card>
  );
}
