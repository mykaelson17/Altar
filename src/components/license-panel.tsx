import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileCheck, Copy, Settings, Check, Receipt } from "lucide-react";
import {
  getLicenseDetail, generateLicensePayment, listLicensePayments, confirmLicensePayment, saveLicensePixSettings,
} from "@/lib/license.functions";
import { useAuth } from "@/hooks/use-auth";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

const STATUS_BADGE: Record<string, string> = {
  ATIVA: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  VENCIDA: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  CANCELADA: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function LicensePanel() {
  const { isAdmin, isMaster } = useAuth();
  const { data: license, isLoading, error } = useQuery({ queryKey: ["license-detail"], queryFn: () => getLicenseDetail() });

  const [meses, setMeses] = useState(1);
  const [gerado, setGerado] = useState<{ qrDataUrl: string; payload: string; valor: number } | null>(null);

  const gerarMut = useMutation({
    mutationFn: () => generateLicensePayment({ data: { meses } }),
    onSuccess: (r) => setGerado(r),
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{(error as Error).message || "Não foi possível carregar a licença."}</p>;
  }

  if (!license) {
    return <p className="text-sm text-muted-foreground">Licença não encontrada.</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="flex items-center gap-2">
        <FileCheck className="size-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Licença</h1>
      </header>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge className={STATUS_BADGE[license.status]}>{license.status}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vencimento</span>
            <span className="text-sm font-medium">{license.vencimento}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Dias restantes</span>
            <span className={`text-sm font-medium ${license.diasRestantes <= 5 ? "text-amber-600" : ""}`}>{license.diasRestantes}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Mensalidade</span>
            <span className="text-sm font-medium">{fmtBRL(license.valorMensal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {fmtBRL(license.valorSede)} (sede) + {fmtBRL(license.valorPorCongregacao)} × {license.numeroCongregacoes} congregação(ões)
          </p>
          {license.avisoVencimento && !license.bloqueado && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 rounded p-2">
              A licença vence em breve — renove pra não perder o acesso.
            </p>
          )}
        </CardContent>
      </Card>

      {isAdmin && !gerado && (
        <Card>
          <CardHeader><CardTitle className="text-base">Renovar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Quantos meses</Label>
              <Input type="number" min={1} max={12} value={meses} onChange={(e) => setMeses(Number(e.target.value))} />
            </div>
            <Button onClick={() => gerarMut.mutate()} disabled={gerarMut.isPending}>Gerar PIX</Button>
          </CardContent>
        </Card>
      )}

      {gerado && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pague com PIX</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <img src={gerado.qrDataUrl} alt="QR Code PIX" className="size-56" />
            <p className="text-sm font-medium">{fmtBRL(gerado.valor)}</p>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(gerado.payload); toast.success("Código copiado"); }}>
              <Copy className="size-4 mr-2" /> Copiar código Copia e Cola
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Depois de pagar, avise o suporte pra confirmar o recebimento e liberar o acesso.
            </p>
          </CardContent>
        </Card>
      )}

      {isAdmin && <FaturasSection isMaster={isMaster} />}
    </div>
  );
}

function FaturasSection({ isMaster }: { isMaster: boolean }) {
  const qc = useQueryClient();
  const { data: payments = [] } = useQuery({ queryKey: ["license-payments"], queryFn: () => listLicensePayments() });
  const { data: license } = useQuery({ queryKey: ["license-detail"], queryFn: () => getLicenseDetail() });
  const [showConfig, setShowConfig] = useState(false);
  const [pixChave, setPixChave] = useState("");
  const [pixNome, setPixNome] = useState("");
  const [pixCidade, setPixCidade] = useState("");
  const [valorSede, setValorSede] = useState("1000");
  const [valorPorCongregacao, setValorPorCongregacao] = useState("79.90");

  function abrirConfig() {
    setValorSede(String(license?.valorSede ?? 1000));
    setValorPorCongregacao(String(license?.valorPorCongregacao ?? 79.9));
    setShowConfig(true);
  }

  const saveMut = useMutation({
    mutationFn: () => saveLicensePixSettings({
      data: {
        pix_chave: pixChave, pix_nome_recebedor: pixNome, pix_cidade: pixCidade,
        valor_sede: Number(valorSede), valor_por_congregacao: Number(valorPorCongregacao),
      },
    }),
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["license-detail"] });
      setShowConfig(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: (id: string) => confirmLicensePayment({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["license-payments"] });
      qc.invalidateQueries({ queryKey: ["license-detail"] });
      toast.success("Pagamento confirmado, licença renovada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const abertas = payments.filter((p: any) => p.status === "PENDENTE");
  const confirmadas = payments.filter((p: any) => p.status !== "PENDENTE");

  return (
    <>
      {isMaster && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Configuração (master)</CardTitle>
            <Button size="sm" variant="outline" onClick={abrirConfig}><Settings className="size-4 mr-2" /> Configurar</Button>
          </CardHeader>
          {showConfig && (
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div><Label className="text-xs">Chave PIX (pra receber a mensalidade)</Label><Input value={pixChave} onChange={(e) => setPixChave(e.target.value)} /></div>
                <div><Label className="text-xs">Nome do recebedor</Label><Input maxLength={25} value={pixNome} onChange={(e) => setPixNome(e.target.value)} /></div>
                <div><Label className="text-xs">Cidade</Label><Input maxLength={15} value={pixCidade} onChange={(e) => setPixCidade(e.target.value)} /></div>
                <div><Label className="text-xs">Valor da sede (R$/mês)</Label><Input type="number" step="0.01" value={valorSede} onChange={(e) => setValorSede(e.target.value)} /></div>
                <div><Label className="text-xs">Valor por congregação (R$/mês)</Label><Input type="number" step="0.01" value={valorPorCongregacao} onChange={(e) => setValorPorCongregacao(e.target.value)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">
                A mensalidade total é calculada sozinha: sede + (valor por congregação × quantas congregações existem).
              </p>
              <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Salvar</Button>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Receipt className="size-5" /><CardTitle className="text-base">Faturas em aberto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {abertas.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-2 text-sm">
              <div>
                <div className="font-medium">{fmtBRL(p.valor)} — {p.meses} mês(es)</div>
                <div className="text-xs text-muted-foreground">ref. {p.txid} · gerada em {fmtData(p.created_at)}</div>
              </div>
              {isMaster ? (
                <Button size="sm" onClick={() => confirmMut.mutate(p.id)} disabled={confirmMut.isPending}>
                  <Check className="size-4 mr-2" /> Confirmar
                </Button>
              ) : (
                <Badge variant="outline" className="text-amber-700 dark:text-amber-300">Aguardando confirmação</Badge>
              )}
            </div>
          ))}
          {abertas.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fatura em aberto.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de pagamentos</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {confirmadas.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div>
                <div>{fmtBRL(p.valor)} — {p.meses} mês(es)</div>
                <div className="text-xs text-muted-foreground">
                  ref. {p.txid} · {p.status === "CONFIRMADO" && p.confirmado_em ? `pago em ${fmtData(p.confirmado_em)}` : fmtData(p.created_at)}
                </div>
              </div>
              <Badge variant="outline">{p.status}</Badge>
            </div>
          ))}
          {confirmadas.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum pagamento confirmado ainda.</p>}
        </CardContent>
      </Card>
    </>
  );
}
