import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, QrCode } from "lucide-react";
import {
  getRegistration, toggleRoupaEntregue, addPayment, markPaymentStatus, deletePayment,
  toggleChecklist, deleteRegistration, getRegistrationQrImage,
} from "@/lib/registrations.functions";

export const Route = createFileRoute("/_authenticated/eventos/$id/inscricao/$regId")({
  head: () => ({ meta: [{ title: "Inscrição" }] }),
  component: Page,
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Page() {
  const { id, regId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["registration", regId], queryFn: () => getRegistration({ data: { id: regId } }) });
  const { data: qr } = useQuery({ queryKey: ["registration-qr", regId], queryFn: () => getRegistrationQrImage({ data: { registrationId: regId } }) });

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [forma, setForma] = useState<string>("__none");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["registration", regId] });
    qc.invalidateQueries({ queryKey: ["registrations", id] });
    qc.invalidateQueries({ queryKey: ["event-dashboard", id] });
  };

  const addPaymentMut = useMutation({
    mutationFn: () => addPayment({
      data: { registration_id: regId, descricao, valor: Number(valor), vencimento: vencimento || undefined, forma: forma === "__none" ? undefined : (forma as any) },
    }),
    onSuccess: () => { invalidate(); setShowPaymentForm(false); setDescricao(""); setValor(""); setVencimento(""); setForma("__none"); toast.success("Parcela adicionada"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  const { registration: r, event, payments, checklist, attendance } = data;

  const totalPago = payments.filter((p: any) => p.status === "PAGO").reduce((s: number, p: any) => s + p.valor, 0);

  return (
    <div className="space-y-6 pb-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{r.nome}</h1>
          <p className="text-sm text-muted-foreground">{event.nome} · {r.congregacao || "sem congregação informada"}</p>
        </div>
        <Button
          variant="ghost" className="text-destructive"
          onClick={async () => {
            if (!confirm(`Remover a inscrição de "${r.nome}"?`)) return;
            await deleteRegistration({ data: { id: regId } });
            history.back();
          }}
        >
          <Trash2 className="size-4 mr-2" /> Remover inscrição
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Dados do participante</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div><span className="text-muted-foreground">Telefone:</span> {r.telefone || "—"}</div>
            <div><span className="text-muted-foreground">Departamento:</span> {r.departamento || "—"}</div>
            <div><span className="text-muted-foreground">Sexo:</span> {r.sexo === "M" ? "Masculino" : r.sexo === "F" ? "Feminino" : "—"}</div>
            <div><span className="text-muted-foreground">Idade:</span> {r.idade ?? "—"}</div>
            <div><span className="text-muted-foreground">Cargo:</span> {r.cargo || "—"}</div>
            <div className="flex items-center gap-2 pt-2">
              <span className="text-muted-foreground">Tamanho da roupa:</span>
              <Badge variant="outline">{r.tamanho_roupa || "não informado"}</Badge>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                checked={!!r.roupa_entregue}
                onCheckedChange={async (v) => { await toggleRoupaEntregue({ data: { id: regId, entregue: !!v } }); invalidate(); }}
              />
              <Label className="!mb-0">Roupa entregue</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0"><QrCode className="size-5" /><CardTitle className="text-base">QR Code de entrada</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            {qr && <img src={qr.dataUrl} alt="QR Code" className="size-48" />}
            <p className="text-xs text-muted-foreground text-center">
              Apresente na entrada do evento pra confirmar presença.
            </p>
            {attendance.length > 0 && (
              <Badge variant="default">Check-in feito em {new Date(attendance[0].data_hora).toLocaleString("pt-BR")}</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Financeiro — total {fmtBRL(r.valor_total)}, pago {fmtBRL(totalPago)}</CardTitle>
          <Button size="sm" onClick={() => setShowPaymentForm((v) => !v)}><Plus className="size-4 mr-2" /> Nova parcela</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showPaymentForm && (
            <div className="rounded-md border p-3 grid gap-3 md:grid-cols-4 items-end bg-muted/20">
              <div><Label className="text-xs">Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Entrada, 2ª parcela..." /></div>
              <div><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
              <div><Label className="text-xs">Vencimento</Label><Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></div>
              <div>
                <Label className="text-xs">Forma</Label>
                <Select value={forma} onValueChange={setForma}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                    <SelectItem value="CARTAO">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="md:col-span-4" onClick={() => addPaymentMut.mutate()} disabled={!descricao.trim() || !valor || addPaymentMut.isPending}>
                Adicionar
              </Button>
            </div>
          )}
          <div className="space-y-2">
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div>
                  <span className="font-medium">{p.descricao}</span> — {fmtBRL(p.valor)}
                  {p.vencimento && <span className="text-muted-foreground"> · vence {p.vencimento}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={p.status} onValueChange={async (v) => { await markPaymentStatus({ data: { id: p.id, status: v as any } }); invalidate(); }}>
                    <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDENTE">Pendente</SelectItem>
                      <SelectItem value="PAGO">Pago</SelectItem>
                      <SelectItem value="ATRASADO">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={async () => { await deletePayment({ data: { id: p.id } }); invalidate(); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            {payments.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma parcela lançada ainda.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Checklist</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {checklist.map((c: any) => (
            <label key={c.checklist_item_id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!c.concluido}
                onCheckedChange={async (v) => {
                  await toggleChecklist({ data: { registration_id: regId, checklist_item_id: c.checklist_item_id, concluido: !!v } });
                  invalidate();
                }}
              />
              {c.label}
            </label>
          ))}
          {checklist.length === 0 && <p className="text-sm text-muted-foreground">Este evento não tem checklist configurado.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
