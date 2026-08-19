import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileCheck, Send, TrendingUp, TrendingDown, AlertTriangle, Paperclip, Eye, Loader2, Megaphone, Clock, CheckCircle2, XCircle, History } from "lucide-react";
import { createAviso } from "@/lib/avisos.functions";
import { getComprovante } from "@/lib/comprovantes.functions";
import {
  getPendingAccountability, sendAccountability, listAccountabilityReports, getAccountabilityDetail, getFinanceSummary,
  getPrestacaoStatusResumo, moverPrestacaoParaAnalise, aprovarPrestacao, marcarPrestacaoPendencia,
} from "@/lib/finance.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/prestar-contas")({
  head: () => ({ meta: [{ title: "Prestar Contas" }] }),
  component: Page,
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function Page() {
  const { isAdmin } = useAuth();
  return (
    <div className="space-y-6 pb-10">
      <header className="flex items-center gap-2">
        <FileCheck className="size-6" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prestar Contas</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Prestações de contas recebidas de todas as congregações." : "Envie a movimentação financeira do período pra sede."}
          </p>
        </div>
      </header>

      {isAdmin ? <SedeView /> : <CongregacaoView />}
    </div>
  );
}

function CongregacaoView() {
  const { canEditFinance } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const { data } = useQuery({
    queryKey: ["pending-accountability", mes, ano],
    queryFn: () => getPendingAccountability({ data: { mes, ano } }),
  });

  const sendMut = useMutation({
    mutationFn: () => sendAccountability({ data: { mes, ano } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-accountability"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["pastor-dashboard"] });
      toast.success("Prestação de contas enviada pra sede!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <div className="flex gap-3">
        <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {data && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pendente de envio — {MESES[mes - 1]}/{ano}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><div className="text-xs text-muted-foreground">Entradas</div><div className="text-lg font-semibold text-green-600">{fmtBRL(data.totalEntradas)}</div></div>
              <div><div className="text-xs text-muted-foreground">Saídas</div><div className="text-lg font-semibold text-red-600">{fmtBRL(data.totalSaidas)}</div></div>
              <div><div className="text-xs text-muted-foreground">Saldo</div><div className="text-lg font-semibold">{fmtBRL(data.saldo)}</div></div>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {data.transactions.map((t: any) => (
                <div key={t.id} className="flex justify-between text-sm border-b pb-1">
                  <span>{t.categoria} {t.descricao && `— ${t.descricao}`}</span>
                  <span className={t.tipo === "ENTRADA" ? "text-green-600" : "text-red-600"}>
                    {t.tipo === "ENTRADA" ? "+" : "-"} {fmtBRL(t.valor)}
                  </span>
                </div>
              ))}
              {data.transactions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum lançamento pendente de envio nesse período.</p>
              )}
            </div>

            {data.transactions.length > 0 && (
              canEditFinance ? (
                <Button
                  className="w-full"
                  onClick={() => { if (confirm(`Enviar ${data.transactions.length} lançamento(s) pra sede? Depois de enviados, eles não podem mais ser removidos.`)) sendMut.mutate(); }}
                  disabled={sendMut.isPending}
                >
                  <Send className="size-4 mr-2" /> Enviar prestação de contas
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  Só um coordenador pode enviar a prestação de contas pra sede.
                </p>
              )
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function SedeView() {
  const { data: reports = [] } = useQuery({ queryKey: ["accountability-reports"], queryFn: () => listAccountabilityReports() });
  const { data: summary } = useQuery({ queryKey: ["finance-summary", new Date().getFullYear()], queryFn: () => getFinanceSummary({ data: { ano: new Date().getFullYear() } }) });
  const [selected, setSelected] = useState<string | null>(null);
  const { data: detail } = useQuery({
    queryKey: ["accountability-detail", selected],
    queryFn: () => getAccountabilityDetail({ data: { id: selected! } }),
    enabled: !!selected,
  });
  const [comprovanteAberto, setComprovanteAberto] = useState<string | null>(null);

  const now = new Date();
  const { data: statusResumo } = useQuery({
    queryKey: ["prestacao-status-resumo", now.getMonth() + 1, now.getFullYear()],
    queryFn: () => getPrestacaoStatusResumo({ data: { mes: now.getMonth() + 1, ano: now.getFullYear() } }),
  });

  const dadosStatus = statusResumo
    ? Object.entries(statusResumo.contagem).filter(([, v]) => (v as number) > 0).map(([k, v]) => ({ name: STATUS_INFO[k]?.label ?? k, value: v as number, key: k }))
    : [];

  const dadosFinanceiro = summary
    ? [
        { name: "Entradas", value: summary.totalEntradas },
        { name: "Saídas", value: summary.totalSaidas },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-4">
      {(dadosStatus.length > 0 || dadosFinanceiro.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {dadosStatus.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Prestações — situação geral (mês atual)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dadosStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}
                        label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {dadosStatus.map((d) => <Cell key={d.key} fill={STATUS_INFO[d.key]?.hex ?? "#94a3b8"} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          {dadosFinanceiro.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Situação financeira geral ({new Date().getFullYear()})</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dadosFinanceiro} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}>
                        <Cell fill="#22c55e" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <SituacaoPorCongregacao />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Prestações recebidas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {reports.map((r: any) => (
              <button key={r.id} onClick={() => setSelected(r.id)} className="w-full text-left">
                <div className={`rounded-md border p-3 text-sm ${selected === r.id ? "border-primary bg-muted/40" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.congregation_nome}</span>
                    <div className="flex items-center gap-1.5">
                      {r.total_comprovantes > 0 && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Paperclip className="size-3" /> {r.total_comprovantes}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">{MESES[r.mes - 1]}/{r.ano}</Badge>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1 text-green-600"><TrendingUp className="size-3" /> {fmtBRL(r.total_entradas)}</span>
                    <span className="flex items-center gap-1 text-red-600"><TrendingDown className="size-3" /> {fmtBRL(r.total_saidas)}</span>
                    <span>· enviado por {r.enviado_por_nome ?? "—"}</span>
                  </div>
                </div>
              </button>
            ))}
            {reports.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma prestação de contas recebida ainda.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Detalhe</CardTitle></CardHeader>
          <CardContent>
            {!detail && <p className="text-sm text-muted-foreground">Selecione uma prestação de contas ao lado.</p>}
            {detail && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{detail.prestacao.congregation_nome} — {MESES[detail.prestacao.mes - 1]}/{detail.prestacao.ano}</div>
                  <StatusBadge status={detail.prestacao.status} />
                </div>

                {detail.prestacao.observacoes_sede && (
                  <p className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 rounded p-2">
                    📌 {detail.prestacao.observacoes_sede}
                  </p>
                )}

                <PrestacaoAcoes prestacao={detail.prestacao} />

                <div className="border-t pt-2">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[11px] text-muted-foreground uppercase tracking-wide pb-1 border-b">
                    <span>Lançamento</span>
                    <span className="text-center">Comprovante</span>
                    <span className="text-right">Valor</span>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {detail.transactions.map((t: any) => (
                      <div key={t.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center text-sm border-b py-1.5">
                        <span className="truncate">{t.data} · {t.categoria} {t.descricao && `— ${t.descricao}`}</span>
                        <span className="text-center">
                          {t.comprovante_url ? (
                            <button
                              onClick={() => setComprovanteAberto(t.id)}
                              className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                            >
                              <Eye className="size-3.5" /> Ver
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </span>
                        <span className={`text-right ${t.tipo === "ENTRADA" ? "text-green-600" : "text-red-600"}`}>
                          {t.tipo === "ENTRADA" ? "+" : "-"} {fmtBRL(t.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {detail.auditoria?.length > 0 && (
                  <div className="border-t pt-2">
                    <p className="text-xs font-medium flex items-center gap-1.5 mb-1.5"><History className="size-3.5" /> Histórico</p>
                    <div className="space-y-1">
                      {detail.auditoria.map((a: any) => (
                        <div key={a.id} className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("pt-BR")} · {a.realizado_por_nome ?? "—"} — {acaoLabel(a.acao)} {a.detalhe && `(${a.detalhe})`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ComprovanteViewer transactionId={comprovanteAberto} onClose={() => setComprovanteAberto(null)} />
    </div>
  );
}

function ComprovanteViewer({ transactionId, onClose }: { transactionId: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["comprovante-view", transactionId],
    queryFn: () => getComprovante({ data: { transactionId: transactionId! } }),
    enabled: !!transactionId,
  });

  return (
    <Dialog open={!!transactionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Comprovante</DialogTitle></DialogHeader>
        {isLoading && <div className="py-10 grid place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}
        {data && !isLoading && (
          data.isPdf ? (
            <a href={`data:${data.mimeType};base64,${data.base64}`} download="comprovante.pdf" className="text-sm underline text-primary block text-center py-6">
              Abrir/baixar PDF do comprovante
            </a>
          ) : (
            <img src={`data:${data.mimeType};base64,${data.base64}`} alt="Comprovante" className="w-full rounded-md border" />
          )
        )}
        {!data && !isLoading && transactionId && <p className="text-sm text-muted-foreground text-center py-6">Comprovante não encontrado.</p>}
      </DialogContent>
    </Dialog>
  );
}

const ACAO_LABELS: Record<string, string> = {
  ENVIADA: "prestação enviada",
  EM_ANALISE: "movida pra análise",
  APROVADA: "aprovada",
  PENDENCIA: "marcada com pendência",
  ENCERRADA: "encerrada",
  CRIADO: "lançamento criado",
  EDITADO: "lançamento editado",
  EXCLUIDO: "lançamento excluído",
};

function acaoLabel(acao: string): string {
  return ACAO_LABELS[acao] ?? acao.toLowerCase();
}

const STATUS_INFO: Record<string, { label: string; emoji: string; className: string; hex: string }> = {
  ENVIADA: { label: "Enviada", emoji: "🔵", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", hex: "#3b82f6" },
  EM_ANALISE: { label: "Em análise", emoji: "🔵", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", hex: "#3b82f6" },
  PENDENCIA: { label: "Pendência", emoji: "🟠", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", hex: "#f59e0b" },
  APROVADA: { label: "Aprovada", emoji: "🟢", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", hex: "#22c55e" },
  ENCERRADA: { label: "Encerrada", emoji: "⚫", className: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200", hex: "#6b7280" },
  NAO_ENVIADA: { label: "Não enviada", emoji: "🔴", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", hex: "#ef4444" },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_INFO[status] ?? STATUS_INFO.ENVIADA;
  return <Badge className={info.className}>{info.emoji} {info.label}</Badge>;
}

// Tabela única — junta o dashboard de status (cards + lista do mês) com o
// que antes era um card separado de inadimplência. Um filtro só, uma
// lista só, com tudo (aprovadas, pendências, não enviadas...).
function SituacaoPorCongregacao() {
  const qc = useQueryClient();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [filtro, setFiltro] = useState<string>("__todas");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [showCobranca, setShowCobranca] = useState(false);
  const [titulo, setTitulo] = useState("⚠️ Pendência na prestação de contas");
  const [mensagem, setMensagem] = useState(
    `Oi! 👋 Notamos que existem pendências financeiras em aberto na prestação de contas. 📋\n\nPoderiam dar uma olhadinha e revisar assim que possível? 🙏\n\nQualquer dúvida, é só chamar a secretaria da sede. 😊`,
  );

  const { data } = useQuery({
    queryKey: ["prestacao-status-resumo", mes, ano],
    queryFn: () => getPrestacaoStatusResumo({ data: { mes, ano } }),
  });

  const CARDS = [
    { key: "APROVADA" as const, label: "Aprovadas" },
    { key: "EM_ANALISE" as const, label: "Em análise" },
    { key: "PENDENCIA" as const, label: "Pendência" },
    { key: "NAO_ENVIADA" as const, label: "Não enviadas" },
  ];

  const linhasFiltradas = data ? data.linhas.filter((l: any) => filtro === "__todas" || l.status === filtro) : [];

  const enviarMut = useMutation({
    mutationFn: async () => {
      for (const congId of selecionadas) {
        await createAviso({ data: { titulo, mensagem, congregation_id: congId } });
      }
    },
    onSuccess: () => {
      toast.success(`Pendência informada pra ${selecionadas.size} congregação(ões) 📬`);
      setSelecionadas(new Set());
      setShowCobranca(false);
      qc.invalidateQueries({ queryKey: ["avisos-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function toggleSelecionada(id: string) {
    setSelecionadas((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-600" />
          <CardTitle className="text-base">Situação por congregação — {MESES[mes - 1]}/{ano}</CardTitle>
        </div>
        <div className="flex gap-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CARDS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFiltro(filtro === c.key ? "__todas" : c.key)}
                  className={`rounded-md border p-3 text-center transition-colors ${filtro === c.key ? "border-primary bg-muted/50" : "hover:bg-accent/50"}`}
                >
                  <div className="text-xs text-muted-foreground">{STATUS_INFO[c.key].emoji} {c.label}</div>
                  <div className="text-2xl font-semibold">{data.contagem[c.key]}</div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <Select value={filtro} onValueChange={setFiltro}>
                <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todas">Todas ({data.total})</SelectItem>
                  {CARDS.map((c) => <SelectItem key={c.key} value={c.key}>{STATUS_INFO[c.key].emoji} {c.label} ({data.contagem[c.key]})</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Total: {data.total} congregação(ões)</p>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {linhasFiltradas.map((l: any) => (
                <label key={l.congregation_id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm cursor-pointer hover:bg-accent/50">
                  <input type="checkbox" className="size-4" checked={selecionadas.has(l.congregation_id)} onChange={() => toggleSelecionada(l.congregation_id)} />
                  <span className="flex-1">{l.nome}</span>
                  {l.totalEntradas !== null && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {fmtBRL(l.totalEntradas)} / {fmtBRL(l.totalSaidas)}
                    </span>
                  )}
                  <StatusBadge status={l.status} />
                </label>
              ))}
              {linhasFiltradas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma congregação nessa situação.</p>
              )}
            </div>
          </>
        )}

        {selecionadas.size > 0 && !showCobranca && (
          <Button size="sm" onClick={() => setShowCobranca(true)}>
            <Megaphone className="size-4 mr-2" /> Informar Pendência ({selecionadas.size})
          </Button>
        )}

        {showCobranca && (
          <div className="rounded-md border p-3 space-y-3 bg-muted/20">
            <div><Label className="text-xs">Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
            <div><Label className="text-xs">Mensagem</Label><Textarea rows={5} value={mensagem} onChange={(e) => setMensagem(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">
              📌 Vai aparecer automaticamente pra quem logar nessas {selecionadas.size} congregação(ões), como um aviso normal.
              (Envio por e-mail ainda não está disponível — exigiria configurar um servidor de e-mail à parte.)
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCobranca(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => enviarMut.mutate()} disabled={enviarMut.isPending}>
                {enviarMut.isPending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrestacaoAcoes({ prestacao }: { prestacao: any }) {
  const qc = useQueryClient();
  const [showPendencia, setShowPendencia] = useState(false);
  const [observacao, setObservacao] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["accountability-reports"] });
    qc.invalidateQueries({ queryKey: ["accountability-detail", prestacao.id] });
    qc.invalidateQueries({ queryKey: ["prestacao-status-resumo"] });
  };

  const analiseMut = useMutation({
    mutationFn: () => moverPrestacaoParaAnalise({ data: { id: prestacao.id } }),
    onSuccess: () => { invalidate(); toast.success("Movida pra análise"); },
    onError: (e: any) => toast.error(e.message),
  });
  const aprovarMut = useMutation({
    mutationFn: () => aprovarPrestacao({ data: { id: prestacao.id } }),
    onSuccess: () => { invalidate(); toast.success("Prestação aprovada ✅"); },
    onError: (e: any) => toast.error(e.message),
  });
  const pendenciaMut = useMutation({
    mutationFn: () => marcarPrestacaoPendencia({ data: { id: prestacao.id, observacao } }),
    onSuccess: () => { invalidate(); toast.success("Pendência informada"); setShowPendencia(false); setObservacao(""); },
    onError: (e: any) => toast.error(e.message),
  });

  if (prestacao.status === "ENCERRADA") return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {prestacao.status === "ENVIADA" && (
          <Button size="sm" variant="outline" onClick={() => analiseMut.mutate()} disabled={analiseMut.isPending}>
            <Clock className="size-4 mr-1.5" /> Mover pra análise
          </Button>
        )}
        {(prestacao.status === "ENVIADA" || prestacao.status === "EM_ANALISE") && (
          <>
            <Button size="sm" onClick={() => aprovarMut.mutate()} disabled={aprovarMut.isPending}>
              <CheckCircle2 className="size-4 mr-1.5" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" className="text-amber-700 border-amber-300" onClick={() => setShowPendencia((v) => !v)}>
              <XCircle className="size-4 mr-1.5" /> Marcar pendência
            </Button>
          </>
        )}
        {prestacao.status === "PENDENCIA" && (
          <Button size="sm" onClick={() => aprovarMut.mutate()} disabled={aprovarMut.isPending}>
            <CheckCircle2 className="size-4 mr-1.5" /> Aprovar mesmo assim
          </Button>
        )}
      </div>
      {showPendencia && (
        <div className="space-y-2 rounded-md border p-2 bg-amber-50 dark:bg-amber-950/30">
          <Label className="text-xs">O que precisa ser corrigido?</Label>
          <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: falta comprovante da despesa de manutenção" />
          <Button size="sm" onClick={() => pendenciaMut.mutate()} disabled={!observacao.trim() || pendenciaMut.isPending}>
            Enviar pendência
          </Button>
        </div>
      )}
    </div>
  );
}
