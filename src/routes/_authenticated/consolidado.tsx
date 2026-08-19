import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, LayoutGrid, Trophy, FileDown, Printer } from "lucide-react";
import { getConsolidado, exportConsolidadoExcel } from "@/lib/finance.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/consolidado")({
  head: () => ({ meta: [{ title: "Consolidado" }] }),
  component: Page,
});

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STATUS_INFO: Record<string, { label: string; className: string }> = {
  ENVIADA: { label: "🔵 Enviada", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  EM_ANALISE: { label: "🔵 Em análise", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  PENDENCIA: { label: "🟠 Pendência", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  APROVADA: { label: "🟢 Aprovada", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  ENCERRADA: { label: "⚫ Encerrada", className: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200" },
  NAO_ENVIADA: { label: "🔴 Não enviada", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Page() {
  const { isAdmin } = useAuth();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const { data } = useQuery({
    queryKey: ["consolidado", mes, ano],
    queryFn: () => getConsolidado({ data: { mes, ano } }),
    enabled: isAdmin,
  });
  const [exportando, setExportando] = useState(false);

  async function handleExportar() {
    setExportando(true);
    try {
      const { base64, filename } = await exportConsolidadoExcel({ data: { mes, ano } });
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

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Sem permissão.</div>;

  const evolucaoMeses = data ? [...new Set(data.evolucao.map((r: any) => r.mes))].sort() : [];
  const dadosEvolucao = evolucaoMeses.map((mesStr) => {
    const [, m] = (mesStr as string).split("-");
    return {
      mes: MESES_ABREV[Number(m) - 1],
      Receitas: data!.evolucao.filter((r: any) => r.mes === mesStr && r.tipo === "ENTRADA").reduce((s: number, r: any) => s + r.total, 0),
      Despesas: data!.evolucao.filter((r: any) => r.mes === mesStr && r.tipo === "SAIDA").reduce((s: number, r: any) => s + r.total, 0),
    };
  });

  const ranking = data ? [...data.linhas].filter((l) => l.tipo === "CONGREGACAO").sort((a, b) => b.entradas - a.entradas) : [];

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-6" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Financeiro Consolidado</h1>
            <p className="text-sm text-muted-foreground">Como está financeiramente toda a igreja, num só lugar.</p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportar} disabled={exportando}>
            <FileDown className="size-4 mr-2" /> {exportando ? "..." : "Excel"}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4 mr-2" /> PDF
          </Button>
        </div>
      </header>

      {data && (
        <>
          <div className="grid gap-4 grid-cols-3">
            <Card><CardContent className="pt-6 flex items-center gap-3"><TrendingUp className="size-7 text-green-600" /><div><div className="text-xs text-muted-foreground">Receitas</div><div className="text-xl font-semibold">{fmtBRL(data.totalEntradas)}</div></div></CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-3"><TrendingDown className="size-7 text-red-600" /><div><div className="text-xs text-muted-foreground">Despesas</div><div className="text-xl font-semibold">{fmtBRL(data.totalSaidas)}</div></div></CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-3"><Wallet className="size-7" /><div><div className="text-xs text-muted-foreground">Saldo consolidado</div><div className="text-xl font-semibold">{fmtBRL(data.saldoConsolidado)}</div></div></CardContent></Card>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            💡 "Saldo consolidado" é a soma dos saldos de cada congregação no período — não significa que a sede tem
            esse valor disponível numa única conta bancária. Cada congregação controla o próprio caixa.
          </p>

          {dadosEvolucao.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Evolução (últimos 6 meses)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosEvolucao} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Trophy className="size-5 text-amber-600" /><CardTitle className="text-base">Por congregação — {MESES[mes - 1]}/{ano}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-2 font-medium">#</th>
                    <th className="pb-2 font-medium">Congregação</th>
                    <th className="pb-2 font-medium text-right">Receita</th>
                    <th className="pb-2 font-medium text-right">Despesa</th>
                    <th className="pb-2 font-medium text-right">Saldo</th>
                    <th className="pb-2 font-medium text-right">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((l: any, i: number) => (
                    <tr key={l.congregation_id} className="border-b last:border-0">
                      <td className="py-2 text-muted-foreground">{i + 1}º</td>
                      <td className="py-2">{l.nome}</td>
                      <td className="py-2 text-right text-green-600">{fmtBRL(l.entradas)}</td>
                      <td className="py-2 text-right text-red-600">{fmtBRL(l.saidas)}</td>
                      <td className="py-2 text-right font-medium">{fmtBRL(l.saldo)}</td>
                      <td className="py-2 text-right">
                        <Badge className={STATUS_INFO[l.status]?.className}>{STATUS_INFO[l.status]?.label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ranking.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma movimentação nesse período.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
