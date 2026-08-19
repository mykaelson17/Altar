import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Printer, Settings, Plus, Trash2, X, GraduationCap } from "lucide-react";
import { searchParticipants } from "@/lib/registrations.functions";
import {
  listTemplates, listAllTemplates, createTemplate, updateTemplate, deleteTemplate, gerarDocumento,
} from "@/lib/documentos.functions";
import { getResumoTurmasRelatorio, getTopMembrosPorTurma, getTopMembrosPresenca } from "@/lib/ebd.functions";
import { getPublicBranding } from "@/lib/branding.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({ meta: [{ title: "Documentos" }] }),
  component: Page,
});

function humanize(campo: string): string {
  return campo.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function Page() {
  const { isAdmin } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);
  const [aba, setAba] = useState<"documentos" | "ebd">("documentos");

  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => listTemplates() });
  const { data: branding } = useQuery({ queryKey: ["public-branding"], queryFn: () => getPublicBranding() });

  const [templateId, setTemplateId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [selecionado, setSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [gerado, setGerado] = useState<{ texto: string; templateNome: string } | null>(null);

  useEffect(() => {
    if (!templateId && templates.length > 0) setTemplateId(templates[0].id);
  }, [templates, templateId]);

  const templateAtual = templates.find((t: any) => t.id === templateId);
  const camposExtras: string[] = templateAtual ? JSON.parse(templateAtual.campos_extras || "[]") : [];

  const { data: results = [] } = useQuery({
    queryKey: ["search-membro-documento", query],
    queryFn: () => searchParticipants({ data: { query } }),
    enabled: query.trim().length >= 2 && !selecionado,
  });

  const gerarMut = useMutation({
    mutationFn: () => gerarDocumento({ data: { templateId, participantId: selecionado!.id, extras } }),
    onSuccess: (r) => setGerado(r),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 pb-10 max-w-2xl">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="size-6" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documentos</h1>
            <p className="text-sm text-muted-foreground">Gere documentos oficiais prontos pra impressão.</p>
          </div>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => setShowAdmin((v) => !v)}>
            <Settings className="size-4 mr-2" /> Gerenciar modelos
          </Button>
        )}
      </header>

      {!showAdmin && (
        <div className="flex gap-1 border-b print:hidden">
          <button
            onClick={() => setAba("documentos")}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${aba === "documentos" ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"}`}
          >
            Documentos
          </button>
          <button
            onClick={() => setAba("ebd")}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${aba === "ebd" ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"}`}
          >
            Relatório de EBD
          </button>
        </div>
      )}

      {showAdmin ? (
        <TemplatesAdmin onClose={() => setShowAdmin(false)} />
      ) : aba === "ebd" ? (
        <RelatorioEbd branding={branding} />
      ) : (
        <>
          <Card className="print:hidden">
            <CardHeader><CardTitle className="text-base">Gerar documento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Modelo</Label>
                <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setExtras({}); setGerado(null); }}>
                  <SelectTrigger><SelectValue placeholder="Escolha um modelo..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhum modelo cadastrado ainda{isAdmin ? " — crie um em \"Gerenciar modelos\"." : "."}
                  </p>
                )}
              </div>

              <div className="relative">
                <Label className="text-xs">Membro</Label>
                <Input value={query} onChange={(e) => { setQuery(e.target.value); setSelecionado(null); setGerado(null); }} placeholder="Buscar por nome ou e-mail..." />
                {results.length > 0 && !selecionado && (
                  <div className="absolute z-10 mt-1 w-full border rounded-md divide-y max-h-48 overflow-y-auto bg-card shadow-md">
                    {results.map((p: any) => (
                      <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent" onClick={() => { setSelecionado(p); setQuery(p.nome); }}>
                        {p.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {camposExtras.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs text-muted-foreground">Esse modelo pede algumas informações extras:</p>
                  {camposExtras.map((campo) => (
                    <div key={campo}>
                      <Label className="text-xs">{humanize(campo)}</Label>
                      <Textarea
                        rows={2}
                        value={extras[campo] ?? ""}
                        onChange={(e) => setExtras((s) => ({ ...s, [campo]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => gerarMut.mutate()} disabled={!templateId || !selecionado || gerarMut.isPending}>
                  {gerarMut.isPending ? "Gerando..." : "Gerar documento"}
                </Button>
                {gerado && <Button variant="outline" onClick={() => window.print()}><Printer className="size-4 mr-2" /> Imprimir</Button>}
              </div>
            </CardContent>
          </Card>

          {gerado && (
            <Card className="border-2">
              <CardContent className="p-8 md:p-10 space-y-4">
                <div className="text-center space-y-1 border-b pb-4">
                  {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-14 mx-auto object-contain mb-2" />}
                  <div className="font-semibold text-base">{branding?.nome_sistema || "Igreja"}</div>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{gerado.texto}</div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const NOVO_TEMPLATE_VAZIO = { nome: "", conteudo: "", campos_extras: [] as string[] };

function TemplatesAdmin({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: templates = [] } = useQuery({ queryKey: ["templates-all"], queryFn: () => listAllTemplates() });
  const [editando, setEditando] = useState<any>(null);
  const [novoCampo, setNovoCampo] = useState("");

  const salvarMut = useMutation({
    mutationFn: () => editando.id
      ? updateTemplate({ data: { id: editando.id, nome: editando.nome, conteudo: editando.conteudo, campos_extras: editando.campos_extras } })
      : createTemplate({ data: { nome: editando.nome, conteudo: editando.conteudo, campos_extras: editando.campos_extras } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates-all"] });
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Modelo salvo");
      setEditando(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function abrirEdicao(t: any) {
    setEditando({ id: t.id, nome: t.nome, conteudo: t.conteudo, campos_extras: JSON.parse(t.campos_extras || "[]") });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Modelos de documento</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setEditando({ ...NOVO_TEMPLATE_VAZIO })}><Plus className="size-4 mr-2" /> Novo modelo</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Voltar</Button>
        </div>
      </div>

      {editando ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div><Label className="text-xs">Nome do modelo</Label><Input value={editando.nome} onChange={(e) => setEditando((s: any) => ({ ...s, nome: e.target.value }))} /></div>

            <div>
              <Label className="text-xs">Conteúdo</Label>
              <p className="text-xs text-muted-foreground mb-1">
                Use <code>{"{{membro.nome}}"}</code>, <code>{"{{membro.cpf}}"}</code>, <code>{"{{membro.endereco}}"}</code>,{" "}
                <code>{"{{membro.data_nascimento}}"}</code>, <code>{"{{membro.data_batismo}}"}</code>,{" "}
                <code>{"{{congregacao.nome}}"}</code>, <code>{"{{congregacao.endereco}}"}</code>,{" "}
                <code>{"{{congregacao.pastor}}"}</code>, <code>{"{{data_hoje}}"}</code>,{" "}
                <code>{"{{data_hoje_extenso}}"}</code>, e <code>{"{{extra.NOME_DO_CAMPO}}"}</code> pros campos
                extras abaixo.
              </p>
              <Textarea rows={16} className="font-mono text-xs" value={editando.conteudo} onChange={(e) => setEditando((s: any) => ({ ...s, conteudo: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Campos extras (preenchidos na hora de gerar)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                {editando.campos_extras.map((c: string) => (
                  <Badge key={c} variant="outline" className="gap-1">
                    {humanize(c)}
                    <button onClick={() => setEditando((s: any) => ({ ...s, campos_extras: s.campos_extras.filter((x: string) => x !== c) }))}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  className="h-8" value={novoCampo} onChange={(e) => setNovoCampo(e.target.value)}
                  placeholder="ex.: nova_igreja_nome"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novoCampo.trim()) {
                      e.preventDefault();
                      setEditando((s: any) => ({ ...s, campos_extras: [...s.campos_extras, novoCampo.trim()] }));
                      setNovoCampo("");
                    }
                  }}
                />
                <Button
                  size="sm" variant="outline"
                  onClick={() => { if (novoCampo.trim()) { setEditando((s: any) => ({ ...s, campos_extras: [...s.campos_extras, novoCampo.trim()] })); setNovoCampo(""); } }}
                >
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button size="sm" onClick={() => salvarMut.mutate()} disabled={!editando.nome.trim() || !editando.conteudo.trim() || salvarMut.isPending}>
                {salvarMut.isPending ? "Salvando..." : "Salvar modelo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t: any) => (
            <Card key={t.id}>
              <CardContent className="pt-6 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {t.nome}
                    {!t.ativo && <Badge variant="outline" className="text-[10px] text-muted-foreground">Desativado</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{JSON.parse(t.campos_extras || "[]").length} campo(s) extra(s)</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => abrirEdicao(t)}>Editar</Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={async () => { await updateTemplate({ data: { id: t.id, ativo: !t.ativo } }); qc.invalidateQueries({ queryKey: ["templates-all"] }); qc.invalidateQueries({ queryKey: ["templates"] }); }}
                  >
                    {t.ativo ? "Desativar" : "Reativar"}
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="text-destructive"
                    onClick={async () => {
                      if (!confirm(`Remover o modelo "${t.nome}"?`)) return;
                      await deleteTemplate({ data: { id: t.id } });
                      qc.invalidateQueries({ queryKey: ["templates-all"] });
                      qc.invalidateQueries({ queryKey: ["templates"] });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {templates.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum modelo criado ainda.</p>}
        </div>
      )}
    </div>
  );
}

function RelatorioEbd({ branding }: { branding: any }) {
  const { data: resumo = [] } = useQuery({ queryKey: ["ebd-resumo-relatorio"], queryFn: () => getResumoTurmasRelatorio() });
  const { data: topPorTurma = [] } = useQuery({ queryKey: ["ebd-top-por-turma"], queryFn: () => getTopMembrosPorTurma() });
  const { data: topGeral = [] } = useQuery({ queryKey: ["ebd-top-membros"], queryFn: () => getTopMembrosPresenca() });

  const semDados = resumo.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button variant="outline" onClick={() => window.print()} disabled={semDados}>
          <Printer className="size-4 mr-2" /> Imprimir relatório
        </Button>
      </div>

      {semDados ? (
        <p className="text-sm text-muted-foreground text-center py-10">Nenhuma turma de EBD cadastrada ainda.</p>
      ) : (
        <Card className="border-2">
          <CardContent className="p-8 md:p-10 space-y-6">
            <div className="text-center space-y-1 border-b pb-4">
              {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-14 mx-auto object-contain mb-2" />}
              <div className="font-semibold text-base">{branding?.nome_sistema || "Igreja"}</div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <GraduationCap className="size-4" /> Relatório de Frequência — EBD
              </div>
              <div className="text-xs text-muted-foreground">Emitido em {new Date().toLocaleDateString("pt-BR")}</div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Resumo das turmas</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-1.5 font-medium">Turma</th>
                    <th className="pb-1.5 font-medium">Professor</th>
                    <th className="pb-1.5 font-medium text-right">Inscritos</th>
                    <th className="pb-1.5 font-medium text-right">Chamadas</th>
                    <th className="pb-1.5 font-medium text-right">% Presença</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.map((t: any) => (
                    <tr key={t.turma_id} className="border-b last:border-0">
                      <td className="py-1.5">{t.nome}</td>
                      <td className="py-1.5 text-muted-foreground">{t.professor_nome ?? "—"}</td>
                      <td className="py-1.5 text-right">{t.inscritos}</td>
                      <td className="py-1.5 text-right">{t.totalChamadas}</td>
                      <td className="py-1.5 text-right">
                        {t.totalChamadas > 0 ? `${Math.round((t.presentes / t.totalChamadas) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {topGeral.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Top 10 membros mais frequentes (geral)</h3>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  {topGeral.map((m: any) => (
                    <li key={m.participant_id} className="flex justify-between">
                      <span>{m.nome}</span>
                      <span className="text-muted-foreground">{m.total_presencas} presença(s)</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {topPorTurma.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Top 10 por turma</h3>
                {topPorTurma.map((grupo: any) => (
                  <div key={grupo.turma_id}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{grupo.turma_nome}</p>
                    <ol className="text-sm space-y-0.5 list-decimal list-inside">
                      {grupo.top.map((m: any) => (
                        <li key={m.participant_id} className="flex justify-between">
                          <span>{m.nome}</span>
                          <span className="text-muted-foreground">{m.total_presencas}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
