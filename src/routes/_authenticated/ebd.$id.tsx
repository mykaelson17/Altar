import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, ClipboardCheck, Pencil, ChevronLeft, CalendarIcon, CheckSquare } from "lucide-react";
import {
  getTurmaDetail, addAluno, removeAluno, getFrequenciaDoDia, salvarFrequencia, getFrequenciaHistorico, updateTurma, copiarAlunosTrimestreAnterior, listMembrosDisponiveis, addAlunosBatch
} from "@/lib/ebd.functions";
import { searchParticipants } from "@/lib/registrations.functions";
import { listCultos } from "@/lib/cultos.functions";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/ebd/$id")({
  head: () => ({ meta: [{ title: "Turma EBD" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [trimestre, setTrimestre] = useState(() => Math.floor(new Date().getMonth() / 3) + 1);
  const { data, isLoading } = useQuery({ queryKey: ["turma", id, ano, trimestre], queryFn: () => getTurmaDetail({ data: { id, ano, trimestre } }) });
  const [dataChamada, setDataChamada] = useState(new Date().toISOString().slice(0, 10));

  const { data: historico = [] } = useQuery({ 
    queryKey: ["frequencia-historico", id, ano, trimestre], 
    queryFn: () => getFrequenciaHistorico({ data: { turmaId: id, ano, trimestre } }) 
  });
  const [chamada, setChamada] = useState<Record<string, boolean> | null>(null);
  const [isEditingChamada, setIsEditingChamada] = useState(false);
  
  const isSavedDate = historico.some((h: any) => h.data === dataChamada);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ id: string; nome: string } | null>(null);

  const { data: results = [] } = useQuery({
    queryKey: ["search-aluno", query],
    queryFn: () => searchParticipants({ data: { query } }),
    enabled: query.trim().length >= 2 && !selected,
  });

  const turma = data?.turma;
  const alunos = data?.alunos ?? [];

  const { data: cultos = [] } = useQuery({
    queryKey: ["cultos", turma?.congregation_id],
    queryFn: () => listCultos({ data: { congregation_id: turma?.congregation_id } }),
    enabled: !!turma?.congregation_id,
  });

  const cultosEbd = cultos.filter((c: any) => 
    c.tipo.toUpperCase().includes("EBD") || 
    c.tipo.toUpperCase().includes("ESCOLA BÍBLICA") ||
    c.tipo.toUpperCase().includes("ESCOLA DOMINICAL")
  );
  const ebdDates = cultosEbd.map((c: any) => parseISO(c.data));

  const hasEbdOnSelectedDate = cultosEbd.some((c: any) => c.data === dataChamada);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["turma", id, ano, trimestre] });

  const addMut = useMutation({
    mutationFn: () => addAluno({ data: { turma_id: id, participant_id: selected!.id, ano, trimestre } }),
    onSuccess: () => { invalidate(); toast.success("Aluno matriculado"); setSelected(null); setQuery(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const copiarMut = useMutation({
    mutationFn: () => copiarAlunosTrimestreAnterior({ data: { turma_id: id, ano, trimestre } }),
    onSuccess: (data) => { invalidate(); toast.success(`${data.copiados} alunos importados com sucesso!`); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: freqDb } = useQuery({
    queryKey: ["frequencia-dia", id, dataChamada, ano, trimestre],
    queryFn: () => getFrequenciaDoDia({ data: { turmaId: id, data: dataChamada, ano, trimestre } }),
    enabled: hasEbdOnSelectedDate && alunos.length > 0,
  });

  useEffect(() => {
    if (freqDb) {
      const map: Record<string, boolean> = {};
      freqDb.forEach((f: any) => { map[f.participant_id] = !!f.presente; });
      setChamada(map);
    } else {
      setChamada(null);
    }
  }, [freqDb]);

  const salvarMut = useMutation({
    mutationFn: () => salvarFrequencia({
      data: { turmaId: id, data: dataChamada, presencas: Object.entries(chamada!).map(([participant_id, presente]) => ({ participant_id, presente })) },
    }),
    onSuccess: () => {
      toast.success("Frequência salva");
      setIsEditingChamada(false);
      // Atualiza o histórico local da turma
      qc.invalidateQueries({ queryKey: ["frequencia-historico", id, ano, trimestre] });
      // Invalida os gráficos e o calendário geral da tela principal de EBD
      qc.invalidateQueries({ queryKey: ["frequencia-dia"] });
      qc.invalidateQueries({ queryKey: ["ebd-freq-geral"] });
      qc.invalidateQueries({ queryKey: ["ebd-semanal"] });
      qc.invalidateQueries({ queryKey: ["ebd-inscritos-presentes"] });
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 pb-10">
      <TurmaHeader turma={turma} onSaved={invalidate} ano={ano} setAno={setAno} trimestre={trimestre} setTrimestre={setTrimestre} />

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0"><ClipboardCheck className="size-5" /><CardTitle className="text-base">Chamada</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row items-start gap-6">
            <div className="flex flex-col gap-2 bg-muted/30 p-2 rounded-lg border shrink-0">
              <Calendar
                mode="single"
                selected={dataChamada ? parseISO(dataChamada) : undefined}
                onSelect={(date) => {
                  if (date) {
                    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                    setDataChamada(localDate.toISOString().slice(0, 10));
                    setChamada(null);
                    setIsEditingChamada(false);
                  }
                }}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date > today;
                }}
                locale={ptBR}
                modifiers={{ ebd: ebdDates }}
                modifiersClassNames={{ ebd: "bg-primary/10 text-primary font-medium border-primary/20" }}
                className="p-1"
              />
            </div>
            
            <div className="space-y-4 shrink-0 min-w-[200px]">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {dataChamada ? format(parseISO(dataChamada), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Nenhuma data selecionada"}
                </p>
                {!hasEbdOnSelectedDate ? (
                  <p className="text-sm text-muted-foreground">Não há EBD registrada para esta data.</p>
                ) : (
                  <p className="text-sm text-emerald-600 font-medium">EBD programada para este dia.</p>
                )}
              </div>
            </div>

            <div className="flex-1 w-full min-w-0">
              {historico.length > 0 ? (
                <div className="border rounded-lg p-4 space-y-2 bg-muted/10 h-[304px] flex flex-col">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide shrink-0">
                    Histórico ({trimestre}º Trimestre de {ano})
                  </p>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-1.5">
                    {historico.map((h: any) => (
                      <div key={h.data} className="flex justify-between items-center text-sm py-1 border-b last:border-0 border-border/50">
                        <span>{h.data}</span>
                        <Badge variant="outline">{h.presentes}/{h.total} presentes</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-4 flex items-center justify-center h-[304px] text-sm text-muted-foreground bg-muted/10">
                  Nenhum histórico neste trimestre.
                </div>
              )}
            </div>
          </div>

          {chamada && (
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-medium">Lista de Presença</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {alunos.map((a: any) => (
                  <label key={a.participant_id} className="flex items-center gap-2 text-sm py-1.5 px-2 hover:bg-muted/50 rounded-md cursor-pointer border border-transparent hover:border-border">
                    <Checkbox
                      checked={chamada[a.participant_id] ?? false}
                      disabled={isSavedDate && !isEditingChamada && !!chamada[a.participant_id]}
                      onCheckedChange={(v) => setChamada((s) => ({ ...s!, [a.participant_id]: !!v }))}
                      className={cn(chamada[a.participant_id] ? "rounded-sm" : "rounded-full")}
                    />
                    <span className="truncate">{a.nome}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end mt-2">
                {isSavedDate && !isEditingChamada ? (
                  <Button type="button" variant="outline" onClick={() => setIsEditingChamada(true)}>
                    <Pencil className="size-4 mr-2" />
                    Alterar marcação
                  </Button>
                ) : (
                  <Button onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending}>Salvar chamada</Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Alunos matriculados ({alunos.length})</CardTitle>
          {alunos.length === 0 && (
            <Button size="sm" variant="outline" onClick={() => copiarMut.mutate()} disabled={copiarMut.isPending}>
              Importar do trimestre anterior
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-start">
            <div className="relative flex-1">
              <Input 
                value={query} 
                onChange={(e) => { setQuery(e.target.value); setSelected(null); }} 
                onKeyDown={(e) => { if (e.key === "Enter" && selected) { e.preventDefault(); addMut.mutate(); } }}
                placeholder="Buscar membro pra matricular..." 
              />
              {results.length > 0 && !selected && (
                <div className="absolute z-10 mt-1 w-full border rounded-md divide-y max-h-48 overflow-y-auto bg-card shadow-md">
                  {results.map((p: any) => (
                    <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent" onClick={() => { setSelected(p); setQuery(p.nome); }}>
                      {p.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button type="button" size="icon" className="shrink-0" onClick={(e) => { e.preventDefault(); if (selected) addMut.mutate(); }} disabled={!selected || addMut.isPending}>
              <Plus className="size-4" />
            </Button>
            <BatchEnrollModal turmaId={id} ano={ano} trimestre={trimestre} onSaved={invalidate} />
          </div>
          <div className="border rounded-md divide-y">
            {alunos.map((a: any) => (
              <div key={a.matricula_id} className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-accent/50">
                <span>{a.nome}</span>
                <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={async () => { await removeAluno({ data: { matriculaId: a.matricula_id } }); invalidate(); }}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {alunos.length === 0 && <div className="p-3 text-sm text-muted-foreground text-center">Nenhum aluno matriculado ainda neste trimestre.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



function TurmaHeader({ turma, onSaved, ano, setAno, trimestre, setTrimestre }: { turma: any; onSaved: () => void; ano: number; setAno: (a: number) => void; trimestre: number; setTrimestre: (t: number) => void }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(turma.nome);
  const [query, setQuery] = useState(turma.professor_nome ?? "");
  const [professorId, setProfessorId] = useState<string | null>(turma.professor_id ?? null);
  const [profFocused, setProfFocused] = useState(false);

  const { data: results = [] } = useQuery({
    queryKey: ["search-professor-edit", query],
    queryFn: () => searchParticipants({ data: { query } }),
    enabled: editando,
  });

  const salvarMut = useMutation({
    mutationFn: () => updateTurma({ data: { id: turma.id, nome, professor_id: professorId } }),
    onSuccess: () => { toast.success("Turma atualizada"); setEditando(false); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  const anosDisponiveis = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (!editando) {
    return (
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link to="/ebd"><ChevronLeft className="size-4" /></Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{turma.nome}</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-9">Professor: {turma.professor_nome ?? "não definido"}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={ano.toString()} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[100px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={trimestre.toString()} onValueChange={(v) => setTrimestre(Number(v))}>
            <SelectTrigger className="w-[135px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1º Trimestre</SelectItem>
              <SelectItem value="2">2º Trimestre</SelectItem>
              <SelectItem value="3">3º Trimestre</SelectItem>
              <SelectItem value="4">4º Trimestre</SelectItem>
            </SelectContent>
          </Select>
          
          <Button size="sm" variant="outline" onClick={() => setEditando(true)}><Pencil className="size-4 mr-2" /> Editar</Button>
        </div>
      </header>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Editar turma</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="relative">
          <Label className="text-xs">Professor</Label>
          <Input 
            value={query} 
            onChange={(e) => { setQuery(e.target.value); setProfessorId(null); }} 
            onFocus={() => setProfFocused(true)}
            onBlur={() => setTimeout(() => setProfFocused(false), 200)}
            placeholder="Buscar membro..." 
          />
          {results.length > 0 && profFocused && (
            <div className="absolute z-10 mt-1 w-full border rounded-md divide-y max-h-48 overflow-y-auto bg-card shadow-md">
              {results.map((p: any) => (
                <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent" onClick={() => { setProfessorId(p.id); setQuery(p.nome); }}>
                  {p.nome}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
          <Button size="sm" onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending}>Salvar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BatchEnrollModal({ turmaId, ano, trimestre, onSaved }: { turmaId: string, ano: number, trimestre: number, onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [idadeMin, setIdadeMin] = useState<number | "">("");
  const [idadeMax, setIdadeMax] = useState<number | "">("");
  const [depFiltro, setDepFiltro] = useState<string>("__todos");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: membros = [], isLoading } = useQuery({
    queryKey: ["membros-ebd-disponiveis"],
    queryFn: () => listMembrosDisponiveis(),
    enabled: open
  });

  const departamentos = Array.from(new Set(membros.map((m: any) => m.departamento).filter(Boolean))) as string[];

  const filtered = membros.filter((m: any) => {
    if (idadeMin !== "" && m.idade !== null && m.idade < idadeMin) return false;
    if (idadeMax !== "" && m.idade !== null && m.idade > idadeMax) return false;
    if (depFiltro !== "__todos" && m.departamento !== depFiltro) return false;
    return true;
  });

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((m: any) => m.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const saveMut = useMutation({
    mutationFn: () => addAlunosBatch({ data: { turma_id: turmaId, participant_ids: Array.from(selectedIds), ano, trimestre } }),
    onSuccess: (data) => {
      toast.success(`${data.count} alunos matriculados`);
      setOpen(false);
      setSelectedIds(new Set());
      onSaved();
    },
    onError: (e: any) => toast.error(e.message)
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2"><CheckSquare className="size-4 mr-2" /> Adicionar vários</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Adicionar Múltiplos Alunos</DialogTitle>
          <DialogDescription>Filtre os membros da congregação e selecione quem deseja matricular.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-4 shrink-0">
          <div>
            <Label className="text-xs">Departamento</Label>
            <Select value={depFiltro} onValueChange={setDepFiltro}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todos</SelectItem>
                {departamentos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Idade mínima</Label>
            <Input type="number" value={idadeMin} onChange={e => setIdadeMin(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Idade máxima</Label>
            <Input type="number" value={idadeMax} onChange={e => setIdadeMax(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
        </div>

        <div className="flex-1 min-h-0 border rounded-md flex flex-col">
          <div className="flex items-center gap-2 p-2 border-b bg-muted/20 shrink-0">
            <Checkbox checked={filtered.length > 0 && selectedIds.size === filtered.length} onCheckedChange={toggleAll} />
            <span className="text-sm font-medium">Selecionar todos os {filtered.length} filtrados</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? <p className="text-sm text-center py-4">Carregando...</p> : (
              <div className="grid sm:grid-cols-2 gap-2">
                {filtered.map((m: any) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm py-1.5 px-2 hover:bg-muted/50 rounded-md cursor-pointer border border-transparent hover:border-border">
                    <Checkbox checked={selectedIds.has(m.id)} onCheckedChange={() => toggleOne(m.id)} />
                    <span className="truncate flex-1">{m.nome}</span>
                    {m.idade !== null && <span className="text-xs text-muted-foreground">{m.idade}a</span>}
                  </label>
                ))}
                {filtered.length === 0 && <p className="col-span-2 text-sm text-muted-foreground text-center py-4">Nenhum membro encontrado neste filtro.</p>}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 shrink-0 gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={selectedIds.size === 0 || saveMut.isPending} onClick={() => saveMut.mutate()}>
            Matricular {selectedIds.size} selecionados
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
