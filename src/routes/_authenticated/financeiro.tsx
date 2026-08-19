import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, Paperclip, Eye, Loader2, Pencil, Filter, FileDown } from "lucide-react";
import { listTransactions, addTransaction, updateTransaction, deleteTransaction, getFinanceSummary, getComparativoAnual, getFinanceDaily, exportFinanceiroExcel } from "@/lib/finance.functions";
import { listPlanoContas } from "@/lib/plano-contas.functions";
import { listCongregations } from "@/lib/congregations.functions";
import { suppressAvisos, releaseAvisos } from "@/lib/avisos-gate";
import { uploadComprovante, getComprovante, removeComprovante } from "@/lib/comprovantes.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro" }] }),
  component: Page,
});

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PALETTE = ["#2563eb", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#ef4444", "#6366f1"];

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Page() {
  const { isAdmin, canEditFinance } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [ano] = useState(now.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA">("ENTRADA");
  const [categoria, setCategoria] = useState("DIZIMO");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [formaPagamento, setFormaPagamento] = useState("__none");
  const [descricao, setDescricao] = useState("");
  const [congregationId, setCongregationId] = useState("__none");

  // Digitação rápida: Enter pula de campo em campo, e ao terminar o
  // último (Descrição), já lança e deixa pronto pro próximo — sem
  // precisar tocar no mouse. Tipo/categoria/data/forma/congregação ficam
  // "grudados" entre um lançamento e outro (normalmente se repetem).
  const valorRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef<HTMLInputElement>(null);
  const formaPagamentoRef = useRef<HTMLButtonElement>(null);
  const descricaoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) setTimeout(() => valorRef.current?.focus(), 50);
  }, [showForm]);

  // Enquanto o formulário está aberto, segura o mural de avisos — ele não
  // pode aparecer no meio de um lançamento sendo digitado. É liberado
  // momentaneamente logo depois de salvar (ver onSuccess abaixo), e
  // liberado de vez quando o formulário fecha.
  useEffect(() => {
    if (!showForm) return;
    suppressAvisos();
    return () => releaseAvisos();
  }, [showForm]);

  const { data: congregations = [] } = useQuery({ queryKey: ["congregations"], queryFn: () => listCongregations(), enabled: isAdmin });
  const { data: planoContas = [] } = useQuery({ queryKey: ["plano-contas"], queryFn: () => listPlanoContas() });
  const [escopo, setEscopo] = useState("__todos");
  const escopoParam = escopo === "__todos" ? undefined : escopo;
  const [exportando, setExportando] = useState(false);

  async function handleExportar() {
    setExportando(true);
    try {
      const { base64, filename } = await exportFinanceiroExcel({ data: { mes: now.getMonth() + 1, ano: now.getFullYear(), congregation_id: escopoParam } });
      const bytes = atob(base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  const { data: transactions = [] } = useQuery({ queryKey: ["transactions", escopoParam], queryFn: () => listTransactions({ data: { congregation_id: escopoParam } }) });
  const { data: summary } = useQuery({ queryKey: ["finance-summary", ano, escopoParam], queryFn: () => getFinanceSummary({ data: { ano, congregation_id: escopoParam } }) });
  const { data: comparativo } = useQuery({ queryKey: ["comparativo-anual", escopoParam], queryFn: () => getComparativoAnual({ data: { congregation_id: escopoParam } }) });
  const { data: diario = [] } = useQuery({ queryKey: ["finance-daily", escopoParam], queryFn: () => getFinanceDaily({ data: { dias: 30, congregation_id: escopoParam } }) });

  const addMut = useMutation({
    mutationFn: () => addTransaction({
      data: {
        tipo, categoria, valor: Number(valor), data,
        forma_pagamento: formaPagamento === "__none" ? undefined : formaPagamento,
        descricao: descricao || undefined,
        congregation_id: congregationId === "__none" ? null : congregationId,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      qc.invalidateQueries({ queryKey: ["pastor-dashboard"] });
      toast.success("Lançamento registrado");
      // Mantém tipo/categoria/data/forma/congregação (geralmente se repetem
      // entre lançamentos seguidos) — só limpa valor e descrição, e já
      // deixa pronto pro próximo, sem fechar o formulário.
      setValor(""); setDescricao("");
      // Abre uma brecha: acabou de salvar, ainda não começou o próximo —
      // é exatamente aqui que um aviso pendente tem chance de aparecer.
      // Se aparecer, o popup (modal) segura o foco sozinho; se não tiver
      // nenhum, a segunda chamada (no timeout) já tranca de novo antes do
      // usuário voltar a digitar.
      releaseAvisos();
      setTimeout(() => {
        suppressAvisos();
        valorRef.current?.focus();
      }, 50);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const categorias = planoContas.filter((c: any) => c.tipo === tipo).map((c: any) => ({ v: c.codigo, l: c.nome }));

  // Dados prontos pros gráficos.
  const dadosPorMes = MESES_ABREV.map((label, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const entrada = summary?.porMes.find((r) => r.mes === mm && r.tipo === "ENTRADA")?.total ?? 0;
    const saida = summary?.porMes.find((r) => r.mes === mm && r.tipo === "SAIDA")?.total ?? 0;
    return { mes: label, Entradas: entrada, Saídas: saida };
  });
  const dadosPorCategoria = (summary?.porCategoria ?? [])
    .filter((r) => r.tipo === "ENTRADA")
    .slice(0, 8)
    .map((r) => ({ name: r.categoria, value: r.total }));

  const anosComparativo = [...new Set((comparativo ?? []).map((r: any) => r.ano))].sort();
  const dadosComparativo = anosComparativo.map((anoStr) => ({
    ano: anoStr,
    Entradas: comparativo?.filter((r: any) => r.ano === anoStr && r.tipo === "ENTRADA").reduce((s: number, r: any) => s + r.total, 0) ?? 0,
    Saídas: comparativo?.filter((r: any) => r.ano === anoStr && r.tipo === "SAIDA").reduce((s: number, r: any) => s + r.total, 0) ?? 0,
  }));

  const diasComData = [...new Set(diario.map((r: any) => r.data))].sort();
  const dadosDiarios = diasComData.map((dataStr) => {
    const [, mes, dia] = (dataStr as string).split("-");
    return {
      data: dataStr,
      diaLabel: `${dia}/${mes}`,
      Entradas: diario.filter((r: any) => r.data === dataStr && r.tipo === "ENTRADA").reduce((s: number, r: any) => s + r.total, 0),
      Saídas: diario.filter((r: any) => r.data === dataStr && r.tipo === "SAIDA").reduce((s: number, r: any) => s + r.total, 0),
    };
  });

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Entradas, saídas e prestação de contas.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Select value={escopo} onValueChange={setEscopo}>
              <SelectTrigger className="w-[200px]"><Filter className="size-3.5 mr-1.5 opacity-60" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todo o ambiente</SelectItem>
                {congregations.filter((c: any) => c.tipo === "SEDE").map((c: any) => <SelectItem key={c.id} value={c.id}>Sede</SelectItem>)}
                {congregations.filter((c: any) => c.tipo !== "SEDE").map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={handleExportar} disabled={exportando}>
            <FileDown className="size-4 mr-2" /> {exportando ? "Exportando..." : "Exportar (mês atual)"}
          </Button>
          <Button onClick={() => setShowForm((v) => !v)}><Plus className="size-4 mr-2" /> Novo lançamento</Button>
        </div>
      </header>

      {summary && (
        <div className="grid gap-4 grid-cols-3">
          <Card><CardContent className="pt-6 flex items-center gap-3"><TrendingUp className="size-6 text-green-600" /><div><div className="text-xs text-muted-foreground">Entradas ({ano})</div><div className="text-lg font-semibold">{fmtBRL(summary.totalEntradas)}</div></div></CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-3"><TrendingDown className="size-6 text-red-600" /><div><div className="text-xs text-muted-foreground">Saídas ({ano})</div><div className="text-lg font-semibold">{fmtBRL(summary.totalSaidas)}</div></div></CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-3"><Wallet className="size-6" /><div><div className="text-xs text-muted-foreground">Saldo</div><div className="text-lg font-semibold">{fmtBRL(summary.saldo)}</div></div></CardContent></Card>
        </div>
      )}

      {summary && (summary.totalEntradas > 0 || summary.totalSaidas > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Entradas x Saídas por mês</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosPorMes} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Entradas por categoria</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {dadosPorCategoria.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dadosPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={90} paddingAngle={1}
                        label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {dadosPorCategoria.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem entradas registradas ainda.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {dadosComparativo.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Comparativo anual</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosComparativo} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {diario.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Entradas x Saídas por dia (últimos 30 dias)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosDiarios} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="diaLabel" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => fmtBRL(Number(v))} labelFormatter={(l, p) => p?.[0]?.payload?.data ?? l} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Novo lançamento</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground self-center mr-1">Atalhos:</span>
              {[
                { l: "Dízimo", tipo: "ENTRADA" as const, cat: "DIZIMO" },
                { l: "Oferta", tipo: "ENTRADA" as const, cat: "OFERTA" },
                { l: "Água", tipo: "SAIDA" as const, cat: "AGUA" },
                { l: "Energia", tipo: "SAIDA" as const, cat: "ENERGIA" },
                { l: "Internet", tipo: "SAIDA" as const, cat: "INTERNET" },
                { l: "Material", tipo: "SAIDA" as const, cat: "MATERIAL" },
              ].map((chip) => (
                <button
                  key={chip.l} type="button"
                  onClick={() => { setTipo(chip.tipo); setCategoria(chip.cat); setTimeout(() => valorRef.current?.focus(), 30); }}
                  className="px-2.5 py-1 rounded-full border text-xs hover:bg-accent transition-colors"
                >
                  {chip.l}
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v: "ENTRADA" | "SAIDA") => { setTipo(v); setCategoria(v === "ENTRADA" ? "DIZIMO" : "AGUA"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ENTRADA">Entrada</SelectItem><SelectItem value="SAIDA">Saída</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categorias.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  ref={valorRef}
                  type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); dataRef.current?.focus(); } }}
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input
                  ref={dataRef}
                  type="date" value={data} onChange={(e) => setData(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); formaPagamentoRef.current?.focus(); } }}
                />
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select
                  value={formaPagamento}
                  onValueChange={(v) => { setFormaPagamento(v); setTimeout(() => descricaoRef.current?.focus(), 30); }}
                >
                  <SelectTrigger ref={formaPagamentoRef}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                    <SelectItem value="CARTAO">Cartão</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <div>
                  <Label>Congregação</Label>
                  <Select value={congregationId} onValueChange={setCongregationId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sede / geral</SelectItem>
                      {congregations.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Só pode ser escolhida na criação — depois de lançado, não muda mais.
                  </p>
                </div>
              )}
              <div className="md:col-span-3">
                <Label>Descrição</Label>
                <Input
                  ref={descricaoRef}
                  value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (valor) addMut.mutate();
                    }
                  }}
                />
              </div>
              <p className="md:col-span-3 text-xs text-muted-foreground">
                Dica: preenche o Valor e aperta <kbd className="px-1 py-0.5 rounded border bg-muted">Enter</kbd> —
                vai pulando de campo em campo, e ao terminar a Descrição já lança e prepara o próximo.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={() => addMut.mutate()} disabled={!valor || addMut.isPending}>Lançar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Lançamentos recentes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {transactions.slice(0, 50).map((t: any) => (
            <TransactionRow key={t.id} t={t} canEditFinance={canEditFinance} qc={qc} />
          ))}
          {transactions.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum lançamento ainda.</p>}
        </CardContent>
      </Card>
    </div>
  );
}


function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // remove o prefixo "data:mime/type;base64," — só queremos o base64 puro
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ComprovanteButton({ transactionId, hasComprovante }: { transactionId: string; hasComprovante: boolean }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState<{ base64: string; mimeType: string; isPdf: boolean } | null>(null);
  const [loadingView, setLoadingView] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["transactions"] });

  async function handleUpload(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máximo 8MB).");
      return;
    }
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      await uploadComprovante({ data: { transactionId, filename: file.name, mimeType: file.type, base64 } });
      toast.success("Comprovante anexado");
      invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar o comprovante");
    } finally {
      setUploading(false);
    }
  }

  async function handleView() {
    setViewOpen(true);
    setLoadingView(true);
    try {
      const result = await getComprovante({ data: { transactionId } });
      setViewData(result);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao carregar o comprovante");
    } finally {
      setLoadingView(false);
    }
  }

  return (
    <>
      {hasComprovante ? (
        <Button size="icon" variant="ghost" className="size-8" onClick={handleView} title="Ver comprovante">
          <Eye className="size-4" />
        </Button>
      ) : (
        <label
          className={`inline-flex items-center justify-center size-8 rounded-md hover:bg-accent cursor-pointer text-muted-foreground ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          title="Anexar comprovante"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          <input
            type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
          />
        </label>
      )}

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Comprovante</DialogTitle></DialogHeader>
          {loadingView && <div className="py-10 grid place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}
          {viewData && !loadingView && (
            <div className="space-y-3">
              {viewData.isPdf ? (
                <a
                  href={`data:${viewData.mimeType};base64,${viewData.base64}`}
                  download="comprovante.pdf"
                  className="text-sm underline text-primary block text-center py-6"
                >
                  Abrir/baixar PDF do comprovante
                </a>
              ) : (
                <img src={`data:${viewData.mimeType};base64,${viewData.base64}`} alt="Comprovante" className="w-full rounded-md border" />
              )}
              <Button
                variant="outline" size="sm" className="w-full text-destructive"
                onClick={async () => {
                  if (!confirm("Remover este comprovante?")) return;
                  await removeComprovante({ data: { transactionId } });
                  setViewOpen(false);
                  invalidate();
                  toast.success("Comprovante removido");
                }}
              >
                <Trash2 className="size-4 mr-2" /> Remover comprovante
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TransactionRow({ t, canEditFinance, qc }: { t: any; canEditFinance: boolean; qc: ReturnType<typeof useQueryClient> }) {
  const { data: planoContas = [] } = useQuery({ queryKey: ["plano-contas"], queryFn: () => listPlanoContas() });
  const [editando, setEditando] = useState(false);
  const [categoria, setCategoria] = useState(t.categoria);
  const [valor, setValor] = useState(String(t.valor));
  const [data, setData] = useState(t.data);
  const [formaPagamento, setFormaPagamento] = useState(t.forma_pagamento ?? "__none");
  const [descricao, setDescricao] = useState(t.descricao ?? "");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  const salvarMut = useMutation({
    mutationFn: () => updateTransaction({
      data: {
        id: t.id, categoria, valor: Number(valor), data,
        forma_pagamento: formaPagamento === "__none" ? undefined : formaPagamento,
        descricao: descricao || undefined,
      },
    }),
    onSuccess: () => { invalidate(); toast.success("Lançamento atualizado"); setEditando(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const categoriasDisponiveis = planoContas.filter((c: any) => c.tipo === t.tipo).map((c: any) => ({ v: c.codigo, l: c.nome }));

  return (
    <div className="rounded-md border p-2 text-sm space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{t.categoria}</span>
          {t.descricao && <span className="text-muted-foreground"> — {t.descricao}</span>}
          <div className="text-xs text-muted-foreground">
            {t.data} {t.forma_pagamento && `· ${t.forma_pagamento}`}
            {t.prestacao_conta_id && <Badge variant="outline" className="ml-2 text-[10px]">Já enviado</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={t.tipo === "ENTRADA" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}>
            {t.tipo === "ENTRADA" ? "+" : "-"} {fmtBRL(t.valor)}
          </Badge>
          <ComprovanteButton transactionId={t.id} hasComprovante={!!t.comprovante_url} />
          {canEditFinance && !t.prestacao_conta_id && (
            <>
              <Button size="icon" variant="ghost" onClick={() => setEditando((v) => !v)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon" variant="ghost" className="text-destructive"
                onClick={async () => {
                  if (!confirm("Remover esse lançamento?")) return;
                  await deleteTransaction({ data: { id: t.id } });
                  invalidate();
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {editando && (
        <div className="grid gap-2 md:grid-cols-3 pt-2 border-t">
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{categoriasDisponiveis.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Valor</Label><Input className="h-8" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div><Label className="text-xs">Data</Label><Input className="h-8" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Forma</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                <SelectItem value="CARTAO">Cartão</SelectItem>
                <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2"><Label className="text-xs">Descrição</Label><Input className="h-8" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="md:col-span-3 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending}>Salvar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
