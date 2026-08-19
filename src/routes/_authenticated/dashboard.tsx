import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Wallet, FileCheck, CalendarDays } from "lucide-react";
import { getPastorDashboard } from "@/lib/dashboard.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: Page,
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const SITUACAO_LABEL: Record<string, string> = {
  ATIVO: "Ativos", AFASTADO: "Afastados", CONGREGADO: "Congregados", VISITANTE: "Visitantes",
};

function Page() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["pastor-dashboard"], queryFn: () => getPastorDashboard() });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 pb-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {user?.fullName?.split(" ")[0]}!</h1>
        <p className="text-sm text-muted-foreground">Visão geral da igreja.</p>
      </header>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="size-8 text-primary" />
            <div><div className="text-xs text-muted-foreground">Membros ativos</div><div className="text-2xl font-semibold">{data.membrosAtivos}</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <TrendingUp className="size-8 text-green-600" />
            <div><div className="text-xs text-muted-foreground">Novos convertidos (mês)</div><div className="text-2xl font-semibold">{data.novosConvertidos}</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Wallet className="size-8 text-blue-600" />
            <div><div className="text-xs text-muted-foreground">Ofertas do mês</div><div className="text-xl font-semibold">{fmtBRL(data.ofertasDoMes)}</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            {data.isCongregationScoped ? (
              <>
                <FileCheck className="size-8 text-amber-600" />
                <div><div className="text-xs text-muted-foreground">Lançamentos pendentes de envio</div><div className="text-2xl font-semibold">{data.lancamentosPendentesEnvio}</div></div>
              </>
            ) : (
              <>
                <CalendarDays className="size-8 text-purple-600" />
                <div><div className="text-xs text-muted-foreground">Eventos ativos</div><div className="text-2xl font-semibold">{data.eventosAtivos}</div></div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Membros por situação</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.situacoes.map((s: any) => (
              <div key={s.situacao} className="flex items-center justify-between text-sm">
                <span>{SITUACAO_LABEL[s.situacao] ?? s.situacao}</span>
                <Badge variant="outline">{s.c}</Badge>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm pt-2 border-t font-medium">
              <span>Total geral</span>
              <span>{data.totalMembros}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0"><CalendarDays className="size-5" /><CardTitle className="text-base">Financeiro do mês</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-center pt-8">
            <div><div className="text-xs text-muted-foreground">Entradas</div><div className="text-lg font-semibold text-green-600">{fmtBRL(data.ofertasDoMes)}</div></div>
            <div><div className="text-xs text-muted-foreground">Saídas</div><div className="text-lg font-semibold text-red-600">{fmtBRL(data.despesasDoMes)}</div></div>
            <div><div className="text-xs text-muted-foreground">Saldo</div><div className="text-lg font-semibold">{fmtBRL(data.ofertasDoMes - data.despesasDoMes)}</div></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Faixa etária dos membros</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.faixaEtaria} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
