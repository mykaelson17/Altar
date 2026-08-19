import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { listAllAvisos, createAviso, toggleAvisoAtivo, deleteAviso } from "@/lib/avisos.functions";
import { listCongregations } from "@/lib/congregations.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/avisos")({
  head: () => ({ meta: [{ title: "Avisos" }] }),
  component: Page,
});

function Page() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: avisos = [] } = useQuery({ queryKey: ["avisos-all"], queryFn: () => listAllAvisos(), enabled: isAdmin });
  const { data: congregations = [] } = useQuery({ queryKey: ["congregations"], queryFn: () => listCongregations(), enabled: isAdmin });

  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [congregationId, setCongregationId] = useState("__todas");

  const createMut = useMutation({
    mutationFn: () => createAviso({ data: { titulo, mensagem, congregation_id: congregationId === "__todas" ? null : congregationId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["avisos-all"] });
      toast.success("Aviso enviado");
      setShowForm(false); setTitulo(""); setMensagem(""); setCongregationId("__todas");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Sem permissão.</div>;

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="size-6" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Avisos</h1>
            <p className="text-sm text-muted-foreground">Aparece automaticamente pra quem logar, uma vez por dia.</p>
          </div>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}><Plus className="size-4 mr-2" /> Novo aviso</Button>
      </header>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Novo aviso</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Congresso de Jovens — inscrições abertas" /></div>
            <div><Label>Mensagem</Label><Textarea rows={4} value={mensagem} onChange={(e) => setMensagem(e.target.value)} /></div>
            <div>
              <Label>Enviar para</Label>
              <Select value={congregationId} onValueChange={setCongregationId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todas">Todas as congregações</SelectItem>
                  {congregations.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={() => createMut.mutate()} disabled={!titulo.trim() || !mensagem.trim() || createMut.isPending}>Enviar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {avisos.map((a: any) => (
          <Card key={a.id}>
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {a.titulo}
                    <Badge variant="outline" className="text-[10px]">{a.congregation_nome ?? "Todas as congregações"}</Badge>
                    {!a.ativo && <Badge variant="outline" className="text-[10px] text-muted-foreground">Desativado</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.mensagem}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enviado por {a.criado_por_nome ?? "—"} em {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm" variant="outline"
                    onClick={async () => { await toggleAvisoAtivo({ data: { id: a.id, ativo: !a.ativo } }); qc.invalidateQueries({ queryKey: ["avisos-all"] }); }}
                  >
                    {a.ativo ? "Desativar" : "Reativar"}
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="text-destructive"
                    onClick={async () => {
                      if (!confirm(`Remover o aviso "${a.titulo}"?`)) return;
                      await deleteAviso({ data: { id: a.id } });
                      qc.invalidateQueries({ queryKey: ["avisos-all"] });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {avisos.length === 0 && !showForm && <p className="text-sm text-muted-foreground text-center py-10">Nenhum aviso enviado ainda.</p>}
      </div>
    </div>
  );
}
