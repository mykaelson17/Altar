import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, GraduationCap, Trash2, BarChart3, Trophy, Pencil, Users, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { listCultos } from "@/lib/cultos.functions";
import {
  listTurmas, createTurma, deleteTurma, getFrequenciaPorTurmaGeral, getInscritosPresentesPorTurma,
  getFrequenciaSemanal, getTopMembrosPresenca, updateTurma, getFrequenciaResumoDoDia, getFrequenciaHistoricoGeral
} from "@/lib/ebd.functions";
import { searchParticipants } from "@/lib/registrations.functions";
import { useAuth } from "@/hooks/use-auth";
import { listCongregations } from "@/lib/congregations.functions";

export const Route = createFileRoute("/_authenticated/ebd/")({
  head: () => ({ meta: [{ title: "EBD — Escola Bíblica" }] }),
  validateSearch: z.object({ congregacao: z.string().optional() }),
  component: Page,
});

function Page() {
  const { congregacao } = Route.useSearch();
  const qc = useQueryClient();
  const nav = useNavigate({ from: "/ebd" });
  const { user, isAdmin } = useAuth();

  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [trimestre, setTrimestre] = useState(() => Math.floor(new Date().getMonth() / 3) + 1);

  const { data: congregacoes = [] } = useQuery({ queryKey: ["congregations"], queryFn: () => listCongregations(), enabled: isAdmin });

  const defaultCongregacao = user?.congregationId ?? "__todas";
  const appliedCongregacao = isAdmin ? (congregacao ?? defaultCongregacao) : undefined;

  const { data: turmas = [] } = useQuery({ queryKey: ["ebd-turmas", appliedCongregacao, ano, trimestre], queryFn: () => listTurmas({ data: { congregation_id: appliedCongregacao, ano, trimestre } }) });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [query, setQuery] = useState("");
  const [professor, setProfessor] = useState<{ id: string; nome: string } | null>(null);

  const { data: results = [] } = useQuery({
    queryKey: ["search-professor", query],
    queryFn: () => searchParticipants({ data: { query } }),
    enabled: query.trim().length >= 2 && !professor,
  });

  const createMut = useMutation({
    mutationFn: () => createTurma({ data: { nome, professor_id: professor?.id ?? null, congregation_id: appliedCongregacao === "__todas" ? null : appliedCongregacao } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ebd-turmas"] });
      toast.success("Turma criada");
      fecharFormulario();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => updateTurma({ data: { id: editId!, nome, professor_id: professor?.id ?? null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ebd-turmas"] });
      toast.success("Turma atualizada");
      fecharFormulario();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fecharFormulario = () => {
    setShowForm(false);
    setEditId(null);
    setNome("");
    setProfessor(null);
    setQuery("");
  };

  const handleEdit = (t: any) => {
    setEditId(t.id);
    setNome(t.nome);
    setProfessor(t.professor_id ? { id: t.professor_id, nome: t.professor_nome } : null);
    setQuery(t.professor_nome ?? "");
    setShowForm(true);
  };

  const anosDisponiveis = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">EBD — Escola Bíblica Dominical</h1>
          <p className="text-sm text-muted-foreground">Turmas, professores, alunos e frequência.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={ano.toString()} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[110px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={trimestre.toString()} onValueChange={(v) => setTrimestre(Number(v))}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1º Trimestre</SelectItem>
              <SelectItem value="2">2º Trimestre</SelectItem>
              <SelectItem value="3">3º Trimestre</SelectItem>
              <SelectItem value="4">4º Trimestre</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin && (
            <Select value={appliedCongregacao} onValueChange={(v) => nav({ search: { congregacao: v } })}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Congregação..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas">Todas as Congregações</SelectItem>
                {congregacoes.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => { fecharFormulario(); setShowForm(true); }}><Plus className="size-4 mr-2" /> Nova turma</Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <EbdMiniCalendar appliedCongregacao={appliedCongregacao} ano={ano} trimestre={trimestre} />
        </div>
        <div className="lg:col-span-2">
          <EbdEstatisticas appliedCongregacao={appliedCongregacao} ano={ano} trimestre={trimestre} />
        </div>
      </div>

      {showForm && (
        <Card className="border-primary/50 shadow-sm">
          <CardHeader><CardTitle className="text-base">{editId ? "Editar turma" : "Criar turma"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Nome da turma</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Adultos, Adolescentes..." /></div>
              <div className="relative">
                <Label>Professor (opcional)</Label>
                <Input value={query} onChange={(e) => { setQuery(e.target.value); setProfessor(null); }} placeholder="Buscar membro..." />
                {results.length > 0 && !professor && (
                  <div className="absolute z-10 mt-1 w-full border rounded-md divide-y max-h-48 overflow-y-auto bg-card shadow-md">
                    {results.map((p: any) => (
                      <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent" onClick={() => { setProfessor(p); setQuery(p.nome); }}>
                        {p.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={fecharFormulario}>Cancelar</Button>
              <Button onClick={() => editId ? updateMut.mutate() : createMut.mutate()} disabled={!nome.trim() || (editId ? updateMut.isPending : createMut.isPending)}>
                {editId ? "Salvar" : "Criar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {turmas.map((t: any) => (
          <Card key={t.id} className="relative group overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="size-5 text-muted-foreground" />
                <CardTitle className="text-base">{t.nome}</CardTitle>
              </div>
              <div className="text-sm text-muted-foreground space-y-1 mb-6">
                <div>Professor: {t.professor_nome ?? "não definido"}</div>
                <Badge variant="outline">{t.totalAlunos} aluno(s)</Badge>
              </div>
              
              <Link to="/ebd/$id" params={{ id: t.id }} className="w-full block">
                <Button variant="secondary" className="w-full">
                  <Users className="size-4 mr-2" /> Gerenciar Alunos
                </Button>
              </Link>
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm p-1 rounded-md">
              <Button
                size="icon" variant="ghost" className="size-7"
                onClick={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  handleEdit(t);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon" variant="ghost" className="text-destructive size-7"
                onClick={async (e) => {
                  e.preventDefault(); e.stopPropagation();
                  if (!confirm(`Remover a turma "${t.nome}"?`)) return;
                  await deleteTurma({ data: { id: t.id } });
                  qc.invalidateQueries({ queryKey: ["ebd-turmas"] });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
        {turmas.length === 0 && !showForm && <p className="col-span-full text-sm text-muted-foreground text-center py-10">Nenhuma turma cadastrada ainda.</p>}
      </div>
    </div>
  );
}

const PALETTE = ["#2563eb", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#ef4444", "#6366f1"];

function EbdEstatisticas({ appliedCongregacao, ano, trimestre }: { appliedCongregacao: string | undefined; ano: number; trimestre: number }) {
  const now = new Date();
  const { data: freqGeral = [] } = useQuery({ queryKey: ["ebd-freq-geral", appliedCongregacao, ano, trimestre], queryFn: () => getFrequenciaPorTurmaGeral({ data: { congregation_id: appliedCongregacao, ano, trimestre } }) });
  
  // Note: InscritosPresentes uses Month/Year, but since we are showing quarter stats now, we might want to let it use the current month or pass the year from the filter. 
  // Let's pass the selected `ano` but keeping the current month for now, as it's a monthly chart.
  const { data: inscritosPresentes = [] } = useQuery({
    queryKey: ["ebd-inscritos-presentes", now.getMonth() + 1, ano, appliedCongregacao],
    queryFn: () => getInscritosPresentesPorTurma({ data: { mes: now.getMonth() + 1, ano: ano, congregation_id: appliedCongregacao } }),
  });
  const { data: topMembros = [] } = useQuery({ queryKey: ["ebd-top-membros", appliedCongregacao, ano, trimestre], queryFn: () => getTopMembrosPresenca({ data: { congregation_id: appliedCongregacao, ano, trimestre } }) });

  const { data: semanal = [] } = useQuery({
    queryKey: ["ebd-semanal", appliedCongregacao, ano, trimestre],
    queryFn: () => getFrequenciaSemanal({ data: { congregation_id: appliedCongregacao, ano, trimestre } }),
  });

  const dadosPizza = freqGeral.map((t: any) => ({ name: t.nome, value: t.presentes }));
  const semTurmas = freqGeral.length === 0 && inscritosPresentes.length === 0;

  const turmasKeys = Array.from(new Set(semanal.flatMap(item => Object.keys(item).filter(k => k !== "semana"))));

  if (semTurmas) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {dadosPizza.length > 0 && (
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0"><BarChart3 className="size-5" /><CardTitle className="text-base">Turmas com maior frequência</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dadosPizza} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}
                      label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {dadosPizza.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {inscritosPresentes.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Inscritos x média de presentes ({now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })})</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inscritosPresentes} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="inscritos" name="Inscritos" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="media_presentes" name="Média presentes" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 flex-wrap gap-2">
            <CardTitle className="text-base">Frequência semanal por turma</CardTitle>
          </CardHeader>
          <CardContent>
            {semanal.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhuma chamada registrada ainda.</p>}
            {semanal.length > 0 && (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={semanal} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {turmasKeys.map((k, i) => (
                      <Line key={k} type="monotone" dataKey={k} name={k} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0"><Trophy className="size-5 text-amber-600" /><CardTitle className="text-base">Top 10 mais presentes</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {topMembros.map((m: any, i: number) => (
              <div key={m.participant_id} className="flex items-center justify-between text-sm border-b pb-1 last:border-0">
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}º</span>
                  {m.nome}
                </span>
                <Badge variant="outline">{m.total_presencas} presença(s)</Badge>
              </div>
            ))}
            {topMembros.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhuma chamada registrada ainda.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function EbdMiniCalendar({ appliedCongregacao, ano: selectedAno, trimestre }: { appliedCongregacao: string | undefined, ano: number, trimestre: number }) {
  const reqCongregacao = appliedCongregacao === "__todas" ? undefined : appliedCongregacao;
  const { data: cultos = [] } = useQuery({
    queryKey: ["cultos", reqCongregacao],
    queryFn: () => listCultos({ data: { congregation_id: reqCongregacao } }),
  });

  const cultosEbd = cultos.filter((c: any) => 
    c.tipo.toUpperCase().includes("EBD") || 
    c.tipo.toUpperCase().includes("ESCOLA BÍBLICA") ||
    c.tipo.toUpperCase().includes("ESCOLA DOMINICAL")
  );

  const curMonth = new Date().getMonth();
  const curYear = new Date().getFullYear();
  const mesMin = (trimestre - 1) * 3;
  const mesMax = mesMin + 2;
  
  const [cursorMes, setCursorMes] = useState(() => {
    if (selectedAno === curYear && curMonth >= mesMin && curMonth <= mesMax) return curMonth;
    return mesMin;
  });

  // Keep cursor in bounds when trimestre/ano changes
  useEffect(() => {
    if (cursorMes < mesMin || cursorMes > mesMax) setCursorMes(mesMin);
  }, [trimestre, cursorMes, mesMin, mesMax]);

  const hojeStr = new Date().toISOString().slice(0, 10);
  const cultosPorDia = new Map<string, boolean>();
  for (const c of cultosEbd) {
    if (c.data) cultosPorDia.set(c.data, true);
  }

  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(() => {
    if (cultosPorDia.get(hojeStr)) return hojeStr;
    return null;
  });

  // Re-check today auto-selection when data loads
  useEffect(() => {
    if (!diaSelecionado && cultosPorDia.get(hojeStr)) {
      setDiaSelecionado(hojeStr);
    }
  }, [cultosEbd.length, diaSelecionado, hojeStr]);

  const { data: frequenciaDia = [], isLoading } = useQuery({
    queryKey: ["ebd-freq-dia", diaSelecionado, appliedCongregacao],
    queryFn: () => getFrequenciaResumoDoDia({ data: { data: diaSelecionado!, congregation_id: appliedCongregacao } }),
    enabled: !!diaSelecionado,
  });

  const { data: historicoGeral = [] } = useQuery({
    queryKey: ["ebd-historico-geral", appliedCongregacao],
    queryFn: () => getFrequenciaHistoricoGeral({ data: { congregation_id: appliedCongregacao } }),
  });

  const ano = selectedAno;
  const mes = cursorMes;
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          <CardTitle className="text-base">Agenda EBD</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-7" onClick={() => setCursorMes(m => Math.max(mesMin, m - 1))} disabled={mes <= mesMin}><ChevronLeft className="size-4" /></Button>
          <span className="text-xs font-medium w-20 text-center">{MESES[mes].slice(0,3)} {ano}</span>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => setCursorMes(m => Math.min(mesMax, m + 1))} disabled={mes >= mesMax}><ChevronRight className="size-4" /></Button>
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
            const temEbd = cultosPorDia.get(key);
            const ehHoje = key === hojeStr;
            return (
              <button
                key={i}
                onClick={() => temEbd && setDiaSelecionado(key)}
                className={cn(
                  "h-8 rounded-md border text-center text-xs flex items-center justify-center transition-colors",
                  ehHoje ? "border-primary font-bold text-primary" : "border-transparent",
                  temEbd ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer font-medium" : "cursor-default text-muted-foreground/50",
                )}
              >
                {dia}
              </button>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={!!diaSelecionado} onOpenChange={(open) => !open && setDiaSelecionado(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Chamada da EBD - {diaSelecionado && new Date(diaSelecionado + "T12:00:00").toLocaleDateString("pt-BR")}</DialogTitle></DialogHeader>
          <div className="space-y-2 mt-2">
            {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>}
            {!isLoading && frequenciaDia.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma chamada registrada nesse dia.</p>}
            {!isLoading && frequenciaDia.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {frequenciaDia.map((t: any) => (
                  <div key={t.turma_id} className="flex items-center justify-between border-b pb-2 last:border-0 text-sm">
                    <span>{t.nome}</span>
                    <span className="font-medium text-right">
                      {t.presentes} <span className="text-muted-foreground font-normal text-xs mx-0.5">/</span> {t.inscritos}
                      <span className="text-muted-foreground font-normal text-[10px] ml-1 block uppercase">presentes</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {historicoGeral.length > 0 && (
        <div className="px-6 pb-6 pt-2 space-y-2 flex-1 flex flex-col min-h-0">
          <div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase border-b pb-1 mb-2">Histórico</div>
          <div className="space-y-1.5 flex-1 overflow-y-auto pr-2">
            {historicoGeral.filter((h: any) => {
              if (!h.data) return false;
              const [y, m] = h.data.split("-");
              const month = parseInt(m, 10) - 1;
              return parseInt(y, 10) === selectedAno && month >= mesMin && month <= mesMax;
            }).map((h: any) => (
              <div key={h.data} className="flex justify-between text-sm py-1">
                <span>{h.data}</span>
                <Badge variant="outline">{h.presentes}/{h.total} presentes</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}