import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Calendar, MapPin, Shirt, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { getPortalDashboard } from "@/lib/registrations.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/")({
  head: () => ({ meta: [{ title: "Meu Painel - Portal do Inscrito" }] }),
  component: PortalDashboard,
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PortalDashboard() {
  const navigate = useNavigate();
  const [cpf, setCpf] = useState<string | null>(null);
  const [dn, setDn] = useState<string | null>(null);

  useEffect(() => {
    const savedCpf = localStorage.getItem("portal_cpf");
    const savedDn = localStorage.getItem("portal_dn");
    if (!savedCpf || !savedDn) {
      navigate({ to: "/portal/login", replace: true });
    } else {
      setCpf(savedCpf);
      setDn(savedDn);
    }
  }, [navigate]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["portal-dashboard", cpf, dn],
    queryFn: () => getPortalDashboard({ data: { cpf: cpf!, data_nascimento: dn! } }),
    enabled: !!cpf && !!dn,
    retry: false,
  });

  useEffect(() => {
    if (isError) {
      toast.error((error as any)?.message || "Não encontramos inscrições com esses dados.");
      handleLogout();
    }
  }, [isError, error]);

  function handleLogout() {
    localStorage.removeItem("portal_cpf");
    localStorage.removeItem("portal_dn");
    navigate({ to: "/portal/login", replace: true });
  }

  function handleCopyPix(chave: string) {
    navigator.clipboard.writeText(chave);
    toast.success("Chave PIX copiada!");
  }

  if (isLoading || !data) return <div className="p-8 text-center text-muted-foreground">Buscando suas inscrições...</div>;

  const { registrations, license } = data;

  return (
    <div className="min-h-screen bg-muted/30 pb-10">
      <header className="bg-background border-b px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="font-semibold text-lg">Portal do Inscrito</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="size-4 mr-2" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6 mt-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Minhas Inscrições</h2>
          <p className="text-muted-foreground">Acompanhe abaixo o status de cada evento que você está participando.</p>
        </div>

        {registrations.map((reg: any) => (
          <Card key={reg.id} className="overflow-hidden">
            <CardHeader className="bg-accent/30 border-b">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <Badge variant={reg.status === "INSCRITO" ? "default" : "secondary"} className="mb-2">
                    {reg.status}
                  </Badge>
                  <CardTitle className="text-xl">{reg.event_nome}</CardTitle>
                  <CardDescription className="flex flex-col gap-1 mt-2">
                    <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> {reg.data_inicio} até {reg.data_fim}</span>
                    {reg.local && <span className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {reg.local}</span>}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Inscrito como:</div>
                  <div className="font-medium">{reg.nome}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                
                {/* Pagamento */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">Status do Pagamento</h3>
                    {reg.pago_concluido ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Pago</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Pendente</Badge>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor Total:</span>
                      <span className="font-medium">{fmtBRL(reg.valor_total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor Pago:</span>
                      <span className="font-medium text-green-600">{fmtBRL(reg.total_pago)}</span>
                    </div>
                    {!reg.pago_concluido && reg.valor_total > 0 && (
                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-medium">Falta Pagar:</span>
                        <span className="font-bold text-base text-amber-600">{fmtBRL(reg.valor_faltante)}</span>
                      </div>
                    )}
                  </div>

                  {!reg.pago_concluido && reg.valor_total > 0 && (
                    <div className="mt-4 bg-muted p-4 rounded-md space-y-3">
                      <div className="text-sm font-medium">Realizar Pagamento via PIX</div>
                      <p className="text-xs text-muted-foreground">
                        Faça a transferência para a chave abaixo e apresente o comprovante para a organização do evento.
                      </p>
                      {license?.pix_chave ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input value={license.pix_chave} readOnly className="h-8 text-sm font-mono bg-background" />
                            <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => handleCopyPix(license.pix_chave)}>
                              <Copy className="size-4" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {license.pix_nome_recebedor && <div>Nome: {license.pix_nome_recebedor}</div>}
                            {license.pix_cidade && <div>Instituição: {license.pix_cidade}</div>}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-amber-600">A chave PIX da igreja não está configurada no sistema. Procure a tesouraria.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Roupa e Ingresso */}
                <div className="p-6 space-y-6">
                  {reg.uniform_modelo && (
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-4">
                        <Shirt className="size-4" /> Roupa / Uniforme
                      </h3>
                      <div className="flex gap-4 items-start">
                        {reg.uniform_foto_url ? (
                          <img src={reg.uniform_foto_url} alt="Uniforme" className="w-16 h-16 rounded-md object-cover border" />
                        ) : (
                          <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center border">
                            <Shirt className="size-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="space-y-1 flex-1">
                          <div className="font-medium text-sm">{reg.uniform_modelo}</div>
                          <div className="text-xs text-muted-foreground">Tamanho: {reg.tamanho_roupa || "Único"}</div>
                          
                          <div className="pt-2">
                            {reg.roupa_entregue ? (
                              <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                                <CheckCircle2 className="size-4" /> Roupa Entregue
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-sm text-amber-600 font-medium">
                                <AlertCircle className="size-4" /> Pendente de Entrega
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!reg.uniform_modelo && (
                     <div>
                       <h3 className="font-semibold flex items-center gap-2 mb-2">
                         <Shirt className="size-4" /> Uniforme
                       </h3>
                       <p className="text-sm text-muted-foreground">Sem pedido de uniforme para esta inscrição.</p>
                     </div>
                  )}

                  <div className="pt-4 border-t border-dashed">
                    <div className="text-xs text-muted-foreground text-center mb-2">Código da sua inscrição</div>
                    <div className="font-mono text-center bg-muted/50 py-2 rounded border tracking-widest">
                      {reg.qr_code}
                    </div>
                  </div>

                </div>
              </div>
            </CardContent>
          </Card>
        ))}

      </main>
    </div>
  );
}
