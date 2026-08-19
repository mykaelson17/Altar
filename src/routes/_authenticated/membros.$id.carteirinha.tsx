import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Church } from "lucide-react";
import { getCarteirinhaData } from "@/lib/carteirinha.functions";

export const Route = createFileRoute("/_authenticated/membros/$id/carteirinha")({
  head: () => ({ meta: [{ title: "Carteirinha" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({ queryKey: ["carteirinha", id], queryFn: () => getCarteirinhaData({ data: { participantId: id } }) });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  const { member, qrDataUrl } = data;

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()}><Printer className="size-4 mr-2" /> Imprimir</Button>
      </div>

      <Card className="overflow-hidden border-2">
        <div className="bg-primary text-primary-foreground p-4 flex items-center gap-2">
          <Church className="size-5" />
          <span className="font-semibold text-sm">{member.congregacao_nome ?? "Igreja"}</span>
        </div>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            {member.foto_url ? (
              <img src={member.foto_url} alt="" className="size-20 rounded-full object-cover border" />
            ) : (
              <div className="size-20 rounded-full bg-muted grid place-items-center text-2xl font-semibold text-muted-foreground">
                {member.nome?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-semibold text-lg leading-tight">{member.nome}</div>
              <div className="text-xs text-muted-foreground">{member.cargo || "Membro"}</div>
              <div className="text-xs text-muted-foreground">{member.situacao}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3">
            <div><span className="text-muted-foreground">Congregação:</span><br />{member.congregacao_nome ?? "—"}</div>
            <div><span className="text-muted-foreground">Departamento:</span><br />{member.departamento ?? "—"}</div>
            {member.data_batismo && <div><span className="text-muted-foreground">Batismo:</span><br />{member.data_batismo}</div>}
            {member.data_recepcao && <div><span className="text-muted-foreground">Membro desde:</span><br />{member.data_recepcao}</div>}
          </div>

          <div className="flex justify-center pt-2 border-t">
            <img src={qrDataUrl} alt="QR Code" className="size-28" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
