import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Calendar as CalendarIcon, Trash2, ChevronLeft, ChevronRight, List, CalendarDays } from "lucide-react";
import { listCultos, createCulto, deleteCulto } from "@/lib/cultos.functions";
import { listTiposCulto } from "@/lib/cadastros.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cultos/")({
  head: () => ({ meta: [{ title: "Cultos e Escalas" }] }),
  validateSearch: z.object({ congregacao: z.string().optional() }),
  component: Page,
});

function Page() {
  const { congregacao } = Route.useSearch();
  const qc = useQueryClient();
  const { data: cultos = [] } = useQuery({
    queryKey: ["cultos", congregacao],
    queryFn: () => listCultos({ data: { congregation_id: congregacao } }),
  });
  const { data: tiposCulto = [] } = useQuery({
    queryKey: ["tipos-culto"],
    queryFn: () => listTiposCulto(),
  });
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<"calendario" | "lista">("calendario");
  const [tipo, setTipo] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [horario, setHorario] = useState("19:30");
  const [observacoes, setObservacoes] = useState("");

  const createMut = useMutation({
    mutationFn: () => createCulto({ data: { tipo, data, horario, observacoes: observacoes || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cultos"] });
      toast.success("Culto agendado");
      setShowForm(false);
      setView("calendario");
      setObservacoes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cultos e Escalas</h1>
          <p className="text-sm text-muted-foreground">
            {congregacao ? "Agenda desta congregação." : "Sua agenda + a da sede."} Escale quem serve em cada culto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            <Button size="sm" variant={view === "calendario" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setView("calendario")}>
              <CalendarDays className="size-4" />
            </Button>
            <Button size="sm" variant={view === "lista" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setView("lista")}>
              <List className="size-4" />
            </Button>
          </div>
          <Button onClick={() => setShowForm(true)}><Plus className="size-4 mr-2" /> Novo culto</Button>
        </div>
      </header>

      {view === "calendario" ? (
        <CultosCalendar 
          cultos={cultos} 
          onNewCulto={(dataInicial) => {
            setData(dataInicial);
            setShowForm(true);
          }} 
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {cultos.map((c: any) => (
            <Card key={c.id} className="relative">
              <Link to="/cultos/$id" params={{ id: c.id }}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.tipo}</CardTitle>
                    <Badge variant="outline">{c.totalConfirmados}/{c.totalEscalados} confirmados</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2"><CalendarIcon className="size-3.5" /> {c.data} {c.horario && `· ${c.horario}`}</div>
                  {c.observacoes && <div>{c.observacoes}</div>}
                </CardContent>
              </Link>
              <Button
                size="icon" variant="ghost" className="absolute top-3 right-3 text-destructive size-7"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm(`Remover o culto "${c.tipo}" de ${c.data}?`)) return;
                  await deleteCulto({ data: { id: c.id } });
                  qc.invalidateQueries({ queryKey: ["cultos"] });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </Card>
          ))}
          {cultos.length === 0 && !showForm && <p className="col-span-full text-sm text-muted-foreground text-center py-10">Nenhum culto agendado ainda.</p>}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agendar culto</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposCulto.length === 0 && <SelectItem value="_empty" disabled>Nenhum tipo cadastrado</SelectItem>}
                  {tiposCulto.map((t) => (
                    <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Horário</Label><Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} /></div>
            <div className="md:col-span-3"><Label>Observações</Label><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={!tipo.trim() || !data || createMut.isPending}>Agendar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function CultosCalendar({ cultos, onNewCulto }: { cultos: any[], onNewCulto: (data: string) => void }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const cultosPorDia = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const c of cultos) {
      if (!c.data) continue;
      if (!map.has(c.data)) map.set(c.data, []);
      map.get(c.data)!.push(c);
    }
    return map;
  }, [cultos]);

  const ano = cursor.getFullYear();
  const mes = cursor.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hojeStr = new Date().toISOString().slice(0, 10);

  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  const cultosDoDiaSelecionado = diaSelecionado ? (cultosPorDia.get(diaSelecionado) ?? []) : [];

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
            const doDia = cultosPorDia.get(key) ?? [];
            const ehHoje = key === hojeStr;
            return (
              <button
                key={i}
                onClick={() => {
                  if (doDia.length > 0) {
                    setDiaSelecionado(key);
                  } else {
                    onNewCulto(key);
                  }
                }}
                className={cn(
                  "min-h-[64px] rounded-md border p-1 text-left align-top text-xs flex flex-col gap-0.5 transition-colors",
                  ehHoje ? "border-primary" : "border-border",
                  "hover:bg-accent cursor-pointer"
                )}
              >
                <span className={cn("font-medium", ehHoje && "text-primary")}>{dia}</span>
                {doDia.slice(0, 2).map((c) => (
                  <span key={c.id} className="truncate rounded bg-primary/10 text-primary px-1 py-0.5 text-[10px] leading-tight">
                    {c.tipo}
                  </span>
                ))}
                {doDia.length > 2 && <span className="text-[10px] text-muted-foreground">+{doDia.length - 2}</span>}
              </button>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={!!diaSelecionado} onOpenChange={(open) => !open && setDiaSelecionado(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{diaSelecionado && new Date(diaSelecionado + "T12:00:00").toLocaleDateString("pt-BR")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {cultosDoDiaSelecionado.map((c) => (
              <Link key={c.id} to="/cultos/$id" params={{ id: c.id }} onClick={() => setDiaSelecionado(null)}>
                <div className="rounded-md border p-2 text-sm hover:bg-accent">
                  <div className="font-medium">{c.tipo}</div>
                  <div className="text-xs text-muted-foreground">{c.horario ?? "sem horário"} · {c.totalConfirmados}/{c.totalEscalados} confirmados</div>
                </div>
              </Link>
            ))}
            <Button variant="outline" className="w-full mt-2" size="sm" onClick={() => { setDiaSelecionado(null); onNewCulto(diaSelecionado!); }}>
              <Plus className="size-3.5 mr-2" /> Agendar outro evento nesse dia
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
