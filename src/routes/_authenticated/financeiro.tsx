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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, Paperclip, Eye, Loader2, Pencil, Filter, FileDown, FileCheck, Send, AlertTriangle, Megaphone, Clock, CheckCircle2, XCircle, History, Unlock, LockOpen, Lock, ShieldAlert } from "lucide-react";
import { listTransactions, addTransaction, updateTransaction, deleteTransaction, getFinanceSummary, getComparativoAnual, getFinanceDaily, exportFinanceiroExcel, getPendingAccountability, sendAccountability, listAccountabilityReports, getAccountabilityDetail, getPrestacaoStatusResumo, moverPrestacaoParaAnalise, aprovarPrestacao, marcarPrestacaoPendencia } from "@/lib/finance.functions";
import { createAviso } from "@/lib/avisos.functions";
import { listPlanoContas } from "@/lib/plano-contas.functions";
import { listCongregations } from "@/lib/congregations.functions";
import { suppressAvisos, releaseAvisos } from "@/lib/avisos-gate";
import { uploadComprovante, getComprovante, removeComprovante } from "@/lib/comprovantes.functions";
import { useAuth } from "@/hooks/use-auth";
import React from "react";
class ErrorBoundary extends React.Component<any, { hasError: boolean; error: any }> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() { 
    if (this.state.hasError) { 
      return (
        <div className="p-8 max-w-2xl mx-auto space-y-4 text-left mt-20">
          <h1 className="text-2xl text-red-600 font-bold">Oops! Algo deu errado</h1>
          <p>Ocorreu um erro ao carregar o Financeiro. Tire um print da mensagem abaixo e envie para o desenvolvedor:</p>
          <pre className="bg-red-50 text-red-900 p-4 text-xs overflow-auto border border-red-200 rounded whitespace-pre-wrap">
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <Button onClick={() => window.location.reload()}>Tentar Novamente</Button>
        </div>
      );
    } 
    return this.props.children; 
  }
}


function SedeAberturaView() {
  const qc = useQueryClient();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [cong, setCong] = useState("");

  const { data: congs = [] } = useQuery({ queryKey: ["congregations"], queryFn: () => listCongregations() });
  const { data: abertas = [] } = useQuery({ queryKey: ["open-periods"], queryFn: () => listOpenPeriods() });

  const openMut = useMutation({
    mutationFn: () => openPeriod({ data: { congregation_id: cong, mes, ano } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["open-periods"] });
      toast.success("Período reaberto por 24 horas.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => closePeriod({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["open-periods"] });
      toast.success("Período fechado manualmente.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Unlock className="size-5 text-amber-500" /> Nova Abertura de Exceção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quando um mês tem as contas aprovadas, ele é trancado. Use este painel para reabrir temporariamente (24h) 
            um mês específico para que a congregação possa fazer edições.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs">Congregação</Label>
              <Select value={cong} onValueChange={setCong}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {congs.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mês</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={!cong || openMut.isPending} onClick={() => openMut.mutate()}>
              <LockOpen className="size-4 mr-2" /> Liberar Acesso
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Períodos Abertos Atualmente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {abertas.map((a: any) => (
              <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-md">
                <div>
                  <div className="font-semibold">{a.congregation_nome}</div>
                  <div className="text-sm text-muted-foreground">Mês: {MESES[a.mes - 1]}/{a.ano}</div>
                  <div className="text-xs text-muted-foreground mt-1">Concedido por: {a.concedido_por_nome || "Desconhecido"} • Expira em: {new Date(a.data_limite + "Z").toLocaleString("pt-BR")}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => closeMut.mutate(a.id)} disabled={closeMut.isPending}>
                  <Lock className="size-4 mr-2" /> Fechar agora
                </Button>
              </div>
            ))}
            {abertas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum período está aberto como exceção no momento.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro" }] }),
  component: () => <ErrorBoundary><Page /></ErrorBoundary>,
});

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const PALETTE = ["#2563eb", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#ef4444", "#6366f1"];

function fmtBRL(v: number | undefined | null) {
  if (v === undefined || v === null) return "R$ 0,00";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}


function Page() {
  const { isAdmin } = useAuth();
  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
            <p className="text-sm text-muted-foreground">Entradas, saídas e prestação de contas.</p>
          </div>
        </div>
      </header>
      
      <Tabs defaultValue="lancamentos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lancamentos">{isAdmin ? "Caixa Sede (Lançamentos)" : "Lançamentos da Congregação"}</TabsTrigger>
          <TabsTrigger value="prestacoes">Prestação de Contas</TabsTrigger>
          {isAdmin && <TabsTrigger value="aberturas">Abertura de Período</TabsTrigger>}
        </TabsList>
        <TabsContent value="lancamentos" className="space-y-6 outline-none">
          <LancamentosView isSede={isAdmin} />
        </TabsContent>
        <TabsContent value="prestacoes" className="space-y-6 outline-none">
          {isAdmin ? <SedePrestacaoView /> : <CongregacaoPrestacaoView />}
        </TabsContent>
        {isAdmin && (
          <TabsContent value="aberturas" className="space-y-6 outline-none">
            <SedeAberturaView />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function LancamentosView({ isSede }: { isSede: boolean }) {
const { canEditFinance } = useAuth();
  const isAdmin = isSede;
  const qc = useQueryClient();
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState("__todos"); // "__todos" ou "1" a "12"
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
  const mesParam = mes === "__todos" ? undefined : Number(mes);
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

  const { data: transactions = [] } = useQuery({ queryKey: ["transactions", escopoParam, ano, mesParam], queryFn: () => listTransactions({ data: { congregation_id: escopoParam, ano, mes: mesParam } }) });
  const { data: summary } = useQuery({ queryKey: ["finance-summary", ano, escopoParam], queryFn: () => getFinanceSummary({ data: { ano, congregation_id: escopoParam } }) });
    
  const { data: accountability } = useQuery({
    queryKey: ["pending-accountability", mes, ano],
    queryFn: () => getPendingAccountability({ data: { mes: Number(mes), ano } }),
    enabled: mes !== "__todos"
  });
  const isFechado = accountability?.isFechado ?? false;

  const reqAberturaMut = useMutation({
    mutationFn: () => requestPeriodOpening({ data: { mes: Number(mes), ano } }),
    onSuccess: () => toast.success("Solicitação enviada para a Sede!"),
    onError: (e: any) => toast.error(e.message),
  });

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
    const entrada = summary?.porMes?.find((r: any) => r.mes === mm && r.tipo === "ENTRADA")?.total ?? 0;
    const saida = summary?.porMes?.find((r: any) => r.mes === mm && r.tipo === "SAIDA")?.total ?? 0;
    return { mes: label, Entradas: entrada, Saídas: saida };
  });
  const dadosPorCategoria = (summary?.porCategoria ?? [])
    .filter((r: any) => r.tipo === "ENTRADA")
    .slice(0, 8)
    .map((r: any) => ({ name: r.categoria, value: r.total }));

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
      <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-2 flex-wrap ml-auto">
      <Select value={mes} onValueChange={setMes}>
        <SelectTrigger className="w-[140px]"><Filter className="size-3.5 mr-1.5 opacity-60" /><SelectValue placeholder="Mês" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__todos">Ano Inteiro</SelectItem>
          {MESES_ABREV.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
        <SelectTrigger className="w-[100px]"><SelectValue placeholder="Ano" /></SelectTrigger>
        <SelectContent>
          {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
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
  </div>
  

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
            <TransactionRow key={t.id} t={t} canEditFinance={canEditFinance && !isFechado} qc={qc} />
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
  const [viewData, setViewData] = useState<{ publicUrl: string; mimeType: string; isPdf: boolean } | null>(null);
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
                  href={viewData.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  download="comprovante.pdf"
                  className="text-sm underline text-primary block text-center py-6"
                >
                  Abrir/baixar PDF do comprovante
                </a>
              ) : (
                <img src={viewData.publicUrl} alt="Comprovante" className="w-full rounded-md border" />
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
  const info = STATUS_INFO[status] ?? STATUS_INFO.NAO_ENVIADA;
  return <Badge className={info.className}>{info.emoji} {info.label}</Badge>;
}

function SedePrestacaoView() {
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
            <a href={data.publicUrl} target="_blank" rel="noreferrer" download="comprovante.pdf" className="text-sm underline text-primary block text-center py-6">
              Abrir/baixar PDF do comprovante
            </a>
          ) : (
            <img src={data.publicUrl} alt="Comprovante" className="w-full rounded-md border" />
          )
        )}
        {!data && !isLoading && transactionId && <p className="text-sm text-muted-foreground text-center py-6">Comprovante não encontrado.</p>}
      </DialogContent>
    </Dialog>
  );
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
          <Textarea 
            value={observacao} 
            onChange={(e: any) => setObservacao(e.target.value)} 
            placeholder="Ex: Faltou o comprovante da conta de luz"
            className="mb-4"
          />
          <Button size="sm" onClick={() => pendenciaMut.mutate()} disabled={!observacao.trim() || pendenciaMut.isPending}>
            Enviar pendência
          </Button>
        </div>
      )}
    </div>
  );
}


function CongregacaoPrestacaoView() {
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
      toast.success("Prestação de contas enviada pra sede!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
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
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
              <span>{data.prestacaoStatus ? `Prestação de Contas — ${MESES[mes - 1]}/${ano}` : `Pendente de envio — ${MESES[mes - 1]}/${ano}`}</span>
              {data.prestacaoStatus && (
                <Badge 
                  variant={data.prestacaoStatus === "APROVADA" || data.prestacaoStatus === "ENCERRADA" ? "default" : data.prestacaoStatus === "PENDENCIA" ? "destructive" : "secondary"}
                  className={data.prestacaoStatus === "APROVADA" || data.prestacaoStatus === "ENCERRADA" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                >
                  {data.prestacaoStatus === "PENDENCIA" ? "Aguardando Correção" : data.prestacaoStatus === "APROVADA" ? "Contas Fechadas" : data.prestacaoStatus.replace("_", " ")}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.prestacaoStatus === "PENDENCIA" && data.observacoesSede && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm flex items-start gap-2">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <div>
                  <strong>Correção solicitada pela sede:</strong> {data.observacoesSede}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><div className="text-xs text-muted-foreground">Entradas</div><div className="text-lg font-semibold text-green-600">{fmtBRL(data.totalEntradas)}</div></div>
              <div><div className="text-xs text-muted-foreground">Saídas</div><div className="text-lg font-semibold text-red-600">{fmtBRL(data.totalSaidas)}</div></div>
              <div><div className="text-xs text-muted-foreground">Saldo</div><div className="text-lg font-semibold">{fmtBRL(data.saldo)}</div></div>
            </div>

            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-2">
              {data.transactions.map((t: any) => (
                <div key={t.id} className="flex justify-between text-sm border-b pb-1">
                  <span>{t.categoria} {t.descricao && `— ${t.descricao}`}</span>
                  <span className={t.tipo === "ENTRADA" ? "text-green-600" : "text-red-600"}>
                    {t.tipo === "ENTRADA" ? "+" : "-"} {fmtBRL(t.valor)}
                  </span>
                </div>
              ))}
              {data.transactions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum lançamento registrado nesse período.</p>
              )}
            </div>

            {data.pendentesCount > 0 && (
              canEditFinance ? (
                <Button
                  className="w-full"
                  onClick={() => { if (confirm(`Enviar ${data.pendentesCount} lançamento(s) pendente(s) pra sede? Depois de enviados, eles não podem mais ser removidos.`)) sendMut.mutate(); }}
                  disabled={sendMut.isPending}
                >
                  <Send className="size-4 mr-2" /> 
                  {data.prestacaoStatus ? `Enviar ${data.pendentesCount} lançamentos pendentes/novos` : "Enviar prestação de contas"}
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
    </div>
  );
}
