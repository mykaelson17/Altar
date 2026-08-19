import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Building2, Upload, Palette, Music, GraduationCap, Edit, X } from "lucide-react";
import { listCongregations, createCongregation, updateCongregation, deleteCongregation } from "@/lib/congregations.functions";
import { getPublicBranding, saveGlobalBranding } from "@/lib/branding.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/congregacoes")({
  head: () => ({ meta: [{ title: "Congregações" }] }),
  component: Page,
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Page() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: congregations = [] } = useQuery({ queryKey: ["congregations"], queryFn: () => listCongregations() });
  const [form, setForm] = useState({ nome: "", tipo: "CONGREGACAO", endereco: "", pastor_responsavel: "", telefone: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => createCongregation({ data: form as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["congregations"] });
      toast.success("Congregação criada");
      setForm({ nome: "", tipo: "CONGREGACAO", endereco: "", pastor_responsavel: "", telefone: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => updateCongregation({ data: { id: editId!, ...form } as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["congregations"] });
      toast.success("Congregação atualizada");
      setForm({ nome: "", tipo: "CONGREGACAO", endereco: "", pastor_responsavel: "", telefone: "" });
      setEditId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Sem permissão.</div>;

  return (
    <div className="space-y-6 pb-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Congregações</h1>
        <p className="text-sm text-muted-foreground">Estrutura multi-congregação — sede e congregações vinculadas.</p>
      </header>

      <BrandingCard />

      <Card>
        <CardHeader><CardTitle className="text-base">{editId ? "Editar congregação" : "Nova congregação"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((s) => ({ ...s, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEDE">Sede</SelectItem>
                  <SelectItem value="CONGREGACAO">Congregação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Pastor responsável</Label><Input value={form.pastor_responsavel} onChange={(e) => setForm((s) => ({ ...s, pastor_responsavel: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm((s) => ({ ...s, telefone: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm((s) => ({ ...s, endereco: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2">
            {editId && (
              <Button variant="outline" onClick={() => {
                setEditId(null);
                setForm({ nome: "", tipo: "CONGREGACAO", endereco: "", pastor_responsavel: "", telefone: "" });
              }}>
                <X className="size-4 mr-2" /> Cancelar
              </Button>
            )}
            <Button 
              onClick={() => editId ? updateMut.mutate() : createMut.mutate()} 
              disabled={!form.nome.trim() || createMut.isPending || updateMut.isPending}
            >
              {editId ? <><Edit className="size-4 mr-2" /> Salvar</> : <><Plus className="size-4 mr-2" /> Criar</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {congregations.map((c: any) => (
          <CongregationCard 
            key={c.id} 
            congregation={c} 
            onEdit={() => {
              setEditId(c.id);
              setForm({ 
                nome: c.nome, 
                tipo: c.tipo, 
                endereco: c.endereco || "", 
                pastor_responsavel: c.pastor_responsavel || "", 
                telefone: c.telefone || "" 
              });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ))}
        {congregations.length === 0 && <p className="col-span-full text-sm text-muted-foreground text-center py-10">Nenhuma congregação cadastrada.</p>}
      </div>
    </div>
  );
}

function BrandingCard() {
  const qc = useQueryClient();
  const { data: branding } = useQuery({ queryKey: ["public-branding"], queryFn: () => getPublicBranding() });
  const [showForm, setShowForm] = useState(false);
  const [nomeSistema, setNomeSistema] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loginBgUrl, setLoginBgUrl] = useState("");
  const [corPrimaria, setCorPrimaria] = useState("");

  const saveMut = useMutation({
    mutationFn: () => saveGlobalBranding({ data: { nome_sistema: nomeSistema, logo_url: logoUrl, login_bg_url: loginBgUrl, cor_primaria: corPrimaria } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["public-branding"] }); toast.success("Personalização salva"); setShowForm(false); },
    onError: (e: any) => toast.error(e.message),
  });

  function abrirForm() {
    setNomeSistema(branding?.nome_sistema ?? "");
    setLogoUrl(branding?.logo_url ?? "");
    setLoginBgUrl(branding?.login_bg_url ?? "");
    setCorPrimaria(branding?.cor_primaria ?? "");
    setShowForm(true);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2"><Palette className="size-5" /><CardTitle className="text-base">Personalização da tela de login</CardTitle></div>
        {!showForm && <Button size="sm" variant="outline" onClick={abrirForm}>Editar</Button>}
      </CardHeader>
      <CardContent>
        {!showForm ? (
          <div className="flex items-center gap-3">
            {branding?.logo_url && <img src={branding.logo_url} alt="Logo" className="h-10 rounded" />}
            <span className="text-sm text-muted-foreground">{branding?.nome_sistema}</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div><Label className="text-xs">Nome do sistema (aparece na tela de login)</Label><Input value={nomeSistema} onChange={(e) => setNomeSistema(e.target.value)} /></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Logo</Label>
                <div className="flex items-center gap-2 mt-1">
                  {logoUrl && <img src={logoUrl} alt="" className="h-10 rounded border" />}
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm cursor-pointer hover:bg-accent">
                    <Upload className="size-4" /> Enviar
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setLogoUrl(await fileToDataUrl(f)); }} />
                  </label>
                </div>
              </div>
              <div>
                <Label className="text-xs">Imagem de fundo do login (opcional)</Label>
                <div className="flex items-center gap-2 mt-1">
                  {loginBgUrl && <img src={loginBgUrl} alt="" className="h-10 rounded border" />}
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm cursor-pointer hover:bg-accent">
                    <Upload className="size-4" /> Enviar
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setLoginBgUrl(await fileToDataUrl(f)); }} />
                  </label>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Cor primária</Label>
              <input type="color" value={corPrimaria || "#2563eb"} onChange={(e) => setCorPrimaria(e.target.value)} className="size-9 rounded border cursor-pointer block mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => saveMut.mutate()} disabled={!nomeSistema.trim() || saveMut.isPending}>Salvar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CongregationCard({ congregation: c, onEdit }: { congregation: any, onEdit: () => void }) {
  const qc = useQueryClient();
  const uploadLogoMut = useMutation({
    mutationFn: (logo_url: string) => updateCongregation({ data: { id: c.id, logo_url } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["congregations"] }); toast.success("Logo atualizada"); },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {c.logo_url ? <img src={c.logo_url} alt="" className="size-8 rounded object-contain" /> : <Building2 className="size-5 text-muted-foreground" />}
            <span className="font-medium">{c.nome}</span>
          </div>
          <Badge variant={c.tipo === "SEDE" ? "default" : "outline"}>{c.tipo === "SEDE" ? "Sede" : "Congregação"}</Badge>
        </div>
        <div className="text-sm text-muted-foreground mt-2 space-y-0.5">
          {c.pastor_responsavel && <div>Pastor: {c.pastor_responsavel}</div>}
          {c.endereco && <div>{c.endereco}</div>}
          {c.telefone && <div>{c.telefone}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Link to="/cultos" search={{ congregacao: c.id }}>
            <Button size="sm" variant="outline" className="h-7 text-xs"><Music className="size-3.5 mr-1" /> Ver cultos</Button>
          </Link>
          <Link to="/ebd" search={{ congregacao: c.id }}>
            <Button size="sm" variant="outline" className="h-7 text-xs"><GraduationCap className="size-3.5 mr-1" /> Ver EBD</Button>
          </Link>
          <label className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs cursor-pointer hover:bg-accent">
            <Upload className="size-3.5" /> {c.logo_url ? "Trocar logo" : "Logo da congregação"}
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) uploadLogoMut.mutate(await fileToDataUrl(f)); }} />
          </label>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEdit}>
            <Edit className="size-3.5 mr-1" /> Editar
          </Button>
          <Button
            size="sm" variant="ghost" className="text-destructive h-7 text-xs"
            onClick={async () => {
              if (!confirm(`Remover "${c.nome}"?`)) return;
              await deleteCongregation({ data: { id: c.id } });
              qc.invalidateQueries({ queryKey: ["congregations"] });
            }}
          >
            <Trash2 className="size-3.5 mr-1" /> Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


