import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { listRegistrations, addPayment, toggleRoupaEntregue } from "@/lib/registrations.functions";
import { getEvent } from "@/lib/events.functions";
import { toast } from "sonner";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/eventos/$id/controle")({
  head: () => ({ meta: [{ title: "Controle de Entrega" }] }),
  component: ControleEntregaPage,
});

function ControleEntregaPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");

  const { data: event } = useQuery({ queryKey: ["event", id], queryFn: () => getEvent({ id }) });
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations", id], queryFn: () => listRegistrations({ event_id: id }) });

  const payMut = useMutation({
    mutationFn: addPayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations", id] });
      toast.success("Pagamento marcado como recebido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleRoupaMut = useMutation({
    mutationFn: toggleRoupaEntregue,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registrations", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Filtrar inscritos
  const list = registrations.filter((r: any) => 
    r.status !== "CANCELADO" && 
    (r.nome.toLowerCase().includes(busca.toLowerCase()) || (r.congregacao || "").toLowerCase().includes(busca.toLowerCase()))
  ).sort((a: any, b: any) => a.nome.localeCompare(b.nome));

  if (!event) return null;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10">
      <header className="flex items-center gap-4">
        <Link to="/eventos/$id" params={{ id }}>
          <Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Controle de Entrega</h1>
          <p className="text-sm text-muted-foreground">{event.nome}</p>
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Lista Rápida para Organizadores</CardTitle>
          <Input 
            placeholder="Buscar por nome ou congregação..." 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)}
            className="w-64 h-8 text-sm"
          />
        </CardHeader>
        <CardContent>
          <div className="border rounded-md divide-y">
            <div className="grid grid-cols-[1fr_80px_100px_100px] items-center px-4 py-2 bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
              <div>Nome</div>
              <div className="text-center">Tamanho</div>
              <div className="text-center">Pagamento</div>
              <div className="text-center">Uniforme</div>
            </div>
            
            {list.map((r: any) => {
              const isPago = r.status_pagamento === "PAGO" || r.valor_total === 0;
              const hasUniforme = r.tamanho_roupa || r.uniform_id;
              
              return (
                <div key={r.id} className="grid grid-cols-[1fr_80px_100px_100px] items-center px-4 py-2 hover:bg-muted/30 text-sm">
                  <div className="truncate">
                    <span className="font-medium">{r.nome}</span>
                    <div className="text-xs text-muted-foreground truncate">{r.congregacao || "Sem Congregação"}</div>
                  </div>
                  
                  <div className="text-center text-xs font-medium">
                    {r.possui_roupa_propria ? "Própria" : (r.tamanho_roupa || "-")}
                  </div>

                  <div className="flex justify-center">
                    {r.valor_total === 0 ? (
                      <span className="text-xs text-muted-foreground">Grátis</span>
                    ) : (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox 
                          checked={r.status_pagamento === "PAGO"} 
                          onCheckedChange={(v) => {
                            if (v && r.status_pagamento !== "PAGO") {
                              const faltante = r.valor_total - r.total_pago;
                              payMut.mutate({ reg_id: r.id, valor: faltante });
                            }
                          }}
                          disabled={r.status_pagamento === "PAGO" || payMut.isPending}
                        />
                        <span className={cn("text-xs font-medium", isPago ? "text-green-600" : "text-amber-600")}>
                          {isPago ? "Pago" : "Pagar"}
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="flex justify-center">
                    {hasUniforme && !r.possui_roupa_propria ? (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox 
                          checked={!!r.roupa_entregue} 
                          onCheckedChange={(v) => toggleRoupaMut.mutate({ id: r.id, entregue: !!v })}
                          disabled={toggleRoupaMut.isPending}
                        />
                        <span className={cn("text-xs font-medium", !!r.roupa_entregue ? "text-primary" : "text-muted-foreground")}>
                          Entregue
                        </span>
                      </label>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
              );
            })}
            
            {list.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum inscrito encontrado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
