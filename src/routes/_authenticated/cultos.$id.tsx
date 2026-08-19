import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Users, Pencil, ChevronLeft } from "lucide-react";
import { getCultoDetail, addEscala, updateEscalaStatus, removeEscala, updateCulto } from "@/lib/cultos.functions";
import { searchParticipants } from "@/lib/registrations.functions";
import { listTiposCulto } from "@/lib/cadastros.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cultos/$id")({
  head: () => ({ meta: [{ title: "Escala do culto" }] }),
  component: Page,
});

const FUNCOES = ["Louvor", "Mídia", "Recepção", "Diáconos", "Intercessão", "Limpeza", "Transmissão"];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDENTE: { label: "Pendente", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  CONFIRMADO: { label: "Confirmado", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  TROCA_SOLICITADA: { label: "Troca solicitada", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  RECUSADO: { label: "Recusado", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["culto", id], queryFn: () => getCultoDetail({ data: { id } }) });

  const [query, setQuery] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState<{ id: string; nome: string } | null>(null);
  const [funcao, setFuncao] = useState("Louvor");

  const { data: results = [] } = useQuery({
    queryKey: ["search-participants-escala", query],
    queryFn: () => searchParticipants({ data: { query } }),
    enabled: query.trim().length >= 2 && !selectedParticipant,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["culto", id] });

  const addMut = useMutation({
    mutationFn: () => addEscala({ data: { culto_id: id, participant_id: selectedParticipant!.id, funcao } }),
    onSuccess: () => { invalidate(); toast.success("Escalado(a)"); setSelectedParticipant(null); setQuery(""); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  const { culto, escalas } = data;

  const porFuncao = FUNCOES.reduce<Record<string, any[]>>((acc, f) => {
    acc[f] = escalas.filter((e: any) => e.funcao === f);
    return acc;
  }, {});
  const outrasFuncoes = [...new Set(escalas.map((e: any) => e.funcao).filter((f: string) => !FUNCOES.includes(f)))];

  return (
    <div className="space-y-6 pb-10">
      <CultoHeader culto={culto} onSaved={invalidate} />

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0"><Users className="size-5" /><CardTitle className="text-base">Escalar alguém</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2 relative">
              <Label className="text-xs">Buscar pessoa</Label>
              <Input value={query} onChange={(e) => { setQuery(e.target.value); setSelectedParticipant(null); }} placeholder="Nome ou e-mail..." />
              {results.length > 0 && !selectedParticipant && (
                <div className="absolute z-10 mt-1 w-full border rounded-md divide-y max-h-48 overflow-y-auto bg-card shadow-md">
                  {results.map((p: any) => (
                    <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent" onClick={() => { setSelectedParticipant(p); setQuery(p.nome); }}>
                      {p.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Função</Label>
              <Input list="funcoes" value={funcao} onChange={(e) => setFuncao(e.target.value)} />
              <datalist id="funcoes">{FUNCOES.map((f) => <option key={f} value={f} />)}</datalist>
            </div>
          </div>
          <Button onClick={() => addMut.mutate()} disabled={!selectedParticipant || addMut.isPending}>
            <Plus className="size-4 mr-2" /> Adicionar à escala
          </Button>
        </CardContent>
      </Card>

      {[...FUNCOES, ...outrasFuncoes].map((f) => {
        const lista = porFuncao[f] ?? escalas.filter((e: any) => e.funcao === f);
        return (
          <Card key={f}>
            <CardHeader><CardTitle className="text-base">{f}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {lista.map((e: any) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div>
                    <div className="font-medium">{e.participant_nome}</div>
                    {e.participant_telefone && <div className="text-xs text-muted-foreground">{e.participant_telefone}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={e.status} onValueChange={async (v) => { await updateEscalaStatus({ data: { id: e.id, status: v as any } }); invalidate(); }}>
                      <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDENTE">Pendente</SelectItem>
                        <SelectItem value="CONFIRMADO">Confirmado</SelectItem>
                        <SelectItem value="TROCA_SOLICITADA">Troca solicitada</SelectItem>
                        <SelectItem value="RECUSADO">Recusado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge className={STATUS_BADGE[e.status].className}>{STATUS_BADGE[e.status].label}</Badge>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={async () => { await removeEscala({ data: { id: e.id } }); invalidate(); }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {lista.length === 0 && <p className="text-sm text-muted-foreground">Ninguém escalado ainda.</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CultoHeader({ culto, onSaved }: { culto: any; onSaved: () => void }) {
  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState(culto.tipo);
  const [data, setData] = useState(culto.data);
  const [horario, setHorario] = useState(culto.horario ?? "");
  const [observacoes, setObservacoes] = useState(culto.observacoes ?? "");

  const { data: tiposCulto = [] } = useQuery({ queryKey: ["tipos-culto"], queryFn: () => listTiposCulto(), enabled: editando });

  const salvarMut = useMutation({
    mutationFn: () => updateCulto({ data: { id: culto.id, tipo, data, horario, observacoes } }),
    onSuccess: () => { toast.success("Culto atualizado"); setEditando(false); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!editando) {
    return (
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link to="/cultos"><ChevronLeft className="size-4" /></Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{culto.tipo}</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-9">{culto.data} {culto.horario && `· ${culto.horario}`}</p>
          {culto.observacoes && <p className="text-sm text-muted-foreground mt-1 ml-9">{culto.observacoes}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditando(true)}><Pencil className="size-4 mr-2" /> Editar</Button>
      </header>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Editar culto</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Tipo</Label>
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
          <div><Label className="text-xs">Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div><Label className="text-xs">Horário</Label><Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} /></div>
          <div className="md:col-span-3"><Label className="text-xs">Observações</Label><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
          <Button size="sm" onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending}>Salvar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
