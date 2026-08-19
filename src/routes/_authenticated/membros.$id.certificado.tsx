import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer } from "lucide-react";
import { getCertificadoData } from "@/lib/carteirinha.functions";

export const Route = createFileRoute("/_authenticated/membros/$id/certificado")({
  head: () => ({ meta: [{ title: "Certificado" }] }),
  component: Page,
});

function fmtDataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${Number(dia)} de ${meses[Number(mes) - 1]} de ${ano}`;
}

function Page() {
  const { id } = Route.useParams();
  const [tipo, setTipo] = useState<"BATISMO" | "MEMBRESIA">("BATISMO");
  const { data, isLoading, error } = useQuery({
    queryKey: ["certificado", id, tipo],
    queryFn: () => getCertificadoData({ data: { participantId: id, tipo } }),
    retry: false,
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Select value={tipo} onValueChange={(v: "BATISMO" | "MEMBRESIA") => setTipo(v)}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="BATISMO">Certificado de Batismo</SelectItem>
            <SelectItem value="MEMBRESIA">Certificado de Membresia</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => window.print()} disabled={!data}><Printer className="size-4 mr-2" /> Imprimir</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {data && (
        <Card className="border-4 border-double">
          <CardContent className="p-10 text-center space-y-6">
            <div className="text-sm uppercase tracking-widest text-muted-foreground">
              {data.member.congregacao_nome ?? "Igreja"}
            </div>
            <h1 className="text-2xl font-serif font-semibold">
              Certificado de {data.tipo === "BATISMO" ? "Batismo" : "Membresia"}
            </h1>
            <p className="text-sm leading-relaxed max-w-lg mx-auto">
              Certificamos que <span className="font-semibold">{data.member.nome}</span>{" "}
              {data.tipo === "BATISMO"
                ? <>foi batizado(a) nas águas, em obediência à Palavra de Deus, no dia{" "}
                    <span className="font-semibold">{fmtDataPorExtenso(data.member.data_batismo)}</span>.</>
                : <>foi recebido(a) como membro desta congregação no dia{" "}
                    <span className="font-semibold">{fmtDataPorExtenso(data.member.data_recepcao)}</span>.</>}
            </p>
            <div className="pt-10 grid grid-cols-2 gap-8 text-sm">
              <div className="border-t pt-2">{data.member.pastor_responsavel || "Pastor Responsável"}</div>
              <div className="border-t pt-2">{new Date().toLocaleDateString("pt-BR")}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
