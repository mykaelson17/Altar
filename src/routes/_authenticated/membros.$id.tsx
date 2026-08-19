import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, Save, Plus, Lock, FileText, Upload, Trash2 } from "lucide-react";
import { getMember, updateMember, addPastoralNote } from "@/lib/members.functions";
import { listCargos, listDepartamentos } from "@/lib/cadastros.functions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/membros/$id")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManageMembers = ["master", "admin", "coordenador", "usuario"].includes(user?.role ?? "");

    const { data: cargosOpts = [] } = useQuery({ queryKey: ["cargos"], queryFn: () => listCargos() });
  const { data: departamentosOpts = [] } = useQuery({ queryKey: ["departamentos"], queryFn: () => listDepartamentos() });
  const { data, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: () => getMember({ data: { id } }),
  });

  const [form, setForm] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [noteTipo, setNoteTipo] = useState("VISITA");

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
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (data?.member) setForm({ ...data.member });
  }, [data?.member?.id]);

  const saveMut = useMutation({
    mutationFn: () => updateMember({ data: { id, ...form } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["member", id] }); setIsEditing(false); toast.success("Perfil salvo"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addNoteMut = useMutation({
    mutationFn: () => addPastoralNote({ data: { participant_id: id, tipo: noteTipo as any, descricao: noteText } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["member", id] }); setNoteText(""); toast.success("Registro adicionado"); },
  });

  if (isLoading || !data || !form) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const readOnly = !canManageMembers || !isEditing;

  return (
    <div className="space-y-6 pb-10 max-w-3xl">
      <header className="flex flex-wrap items-center gap-3">
        {form.foto_url && <img src={form.foto_url} alt="" className="size-14 rounded-full object-cover" />}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{form.nome}</h1>
          <p className="text-sm text-muted-foreground">{form.email}</p>
        </div>
      </header>
      
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" asChild><Link to="/membros"><ChevronLeft className="size-4 mr-1" /> Voltar</Link></Button>
        {canManageMembers && !isEditing && (
          <Button size="sm" onClick={() => setIsEditing(true)}>Editar Cadastro</Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Dados Principais</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} disabled={readOnly} /></div>
          <div><Label>E-mail</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} disabled={readOnly} /></div>
          <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} disabled={readOnly} /></div>
          <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} disabled={readOnly} /></div>
          <div><Label>Data de Nascimento</Label><Input type="date" value={form.data_nascimento} onChange={e => setForm({...form, data_nascimento: e.target.value})} disabled={readOnly} /></div>
          <div>
            <Label>Sexo</Label>
            <Select disabled={readOnly} value={form.sexo} onValueChange={v => setForm({...form, sexo: v})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>CEP</Label><Input value={form.cep || ""} onChange={handleCepChange} disabled={readOnly} maxLength={9} /></div>
          <div className="sm:col-span-2"><Label>Rua / Logradouro</Label><Input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} disabled={readOnly} /></div>
          <div><Label>Número</Label><Input value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} disabled={readOnly} /></div>
          <div><Label>Bairro</Label><Input value={form.bairro} onChange={e => setForm({...form, bairro: e.target.value})} disabled={readOnly} /></div>
          <div><Label>Cidade</Label><Input value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} disabled={readOnly} /></div>
          <div><Label>Estado</Label><Input value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} disabled={readOnly} maxLength={2} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Eclesiastico</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div>
            <Label>Cargo</Label>
            <Select disabled={readOnly} value={form.cargo} onValueChange={v => setForm({...form, cargo: v})}>
              <SelectTrigger><SelectValue placeholder="..."/></SelectTrigger>
              <SelectContent>
                {cargosOpts.map((c) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
                    <div>
            <Label>Departamento</Label>
            <Select disabled={readOnly} value={form.departamento} onValueChange={v => setForm({...form, departamento: v})}>
              <SelectTrigger><SelectValue placeholder="..."/></SelectTrigger>
              <SelectContent>
                {departamentosOpts.map((d) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div><Label>Data de Conversao</Label><Input type="date" value={form.data_conversao} onChange={e => setForm({...form, data_conversao: e.target.value})} disabled={readOnly} /></div>
          <div><Label>Data de Batismo</Label><Input type="date" value={form.data_batismo} onChange={e => setForm({...form, data_batismo: e.target.value})} disabled={readOnly} /></div>
          <div>
            <Label>Carta de Mudança (opcional)</Label>
            <CartaMudancaSection memberId={id} url={form.carta_mudanca_url} onUploaded={(url) => setForm({ ...form, carta_mudanca_url: url })} />
          </div>
          <div><Label>Data da recepção</Label><Input type="date" value={form.data_recepcao} onChange={e => setForm({...form, data_recepcao: e.target.value})} disabled={readOnly} /></div>
        </CardContent>
      </Card>

      {canManageMembers && isEditing && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setIsEditing(false); if (data?.member) setForm({ ...data.member }); }}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}><Save className="size-4 mr-2" /> Salvar alteracoes</Button>
        </div>
      )}

      {data.canSeePastoralNotes && (
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Lock className="size-5" /><CardTitle className="text-base">Pastoreio (acesso restrito)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Visitas, aconselhamentos e observacoes - so Pastor Presidente/Local enxergam esta secao.</p>
            <div className="grid gap-2 md:grid-cols-4">
              <Select value={noteTipo} onValueChange={setNoteTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VISITA">Visita</SelectItem>
                  <SelectItem value="ACONSELHAMENTO">Aconselhamento</SelectItem>
                  <SelectItem value="ACOMPANHAMENTO">Acompanhamento</SelectItem>
                  <SelectItem value="OBSERVACAO">Observacao</SelectItem>
                </SelectContent>
              </Select>
              <Textarea className="md:col-span-3" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Descreva..." rows={2} />
            </div>
            <Button size="sm" onClick={() => addNoteMut.mutate()} disabled={!noteText.trim() || addNoteMut.isPending}>
              <Plus className="size-4 mr-2" /> Registrar
            </Button>
            <div className="space-y-2 pt-2">
              {data.pastoralNotes.map((n: any) => (
                <div key={n.id} className="rounded-md border p-2 text-sm">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{n.tipo} - {n.registrado_por_nome ?? "-"}</span>
                    <span>{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {n.descricao}
                </div>
              ))}
              {data.pastoralNotes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>}
            </div>
          </CardContent>
        </Card>
      )}

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

function CartaMudancaSection({ memberId, url, onUploaded }: { memberId: string; url?: string | null; onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [openView, setOpenView] = useState(false);

  const saveMut = useMutation({
    mutationFn: (carta_mudanca_url: string) => updateMember({ data: { id: memberId, carta_mudanca_url } }),
  });

  async function handleUpload(file: File) {
    if (file.size > 8 * 1024 * 1024) { toast.error("Arquivo muito grande (maximo 8MB)."); return; }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await saveMut.mutateAsync(dataUrl);
      onUploaded(dataUrl);
      toast.success("Carta de mudanca anexada");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao anexar o arquivo");
    } finally {
      setUploading(false);
    }
  }

  async function remover() {
    if (!confirm("Remover a carta de mudanca anexada?")) return;
    await saveMut.mutateAsync("");
    onUploaded("");
    setOpenView(false);
    toast.success("Removida");
  }

  return (
    <div className="mt-1">
      {url ? (
        <div className="flex items-center gap-3">
          <button onClick={() => setOpenView(true)} className="text-sm underline text-primary hover:opacity-80">Ver arquivo anexado</button>
        </div>
      ) : (
        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm cursor-pointer hover:bg-accent">
          {uploading ? "Enviando..." : <><Upload className="size-4" /> Anexar carta de mudanca</>}
          <input
            type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
        </label>
      )}

      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>Carta de Mudança</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center mt-2">
            {url?.startsWith("data:image") ? (
              <img src={url} alt="Carta" className="max-w-full max-h-[75vh] object-contain rounded-md" />
            ) : url ? (
              <iframe src={url} className="w-full h-[75vh] border-0 rounded-md bg-white" />
            ) : null}
          </div>
          <div className="flex justify-end mt-2">
            <Button size="sm" variant="destructive" onClick={remover}>
              <Trash2 className="size-4 mr-2" /> Excluir Anexo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


