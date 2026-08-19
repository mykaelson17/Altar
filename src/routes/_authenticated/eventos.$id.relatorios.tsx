import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileDown, MessageCircle, ExternalLink } from "lucide-react";
import { getEvent } from "@/lib/events.functions";
import { getReport, exportReportExcel, getSegmentContacts, type ReportType } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/eventos/$id/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios e Comunicação" }] }),
  component: Page,
});

const REPORTS: { value: ReportType; label: string }[] = [
  { value: "participantes", label: "Lista de participantes" },
  { value: "inadimplentes", label: "Participantes inadimplentes" },
  { value: "sem_roupa", label: "Quem ainda não recebeu roupa" },
  { value: "sem_tamanho", label: "Quem não informou tamanho" },
  { value: "pagos", label: "Pagamentos concluídos" },
  { value: "presenca", label: "Lista de presença" },
  { value: "desistentes", label: "Quem desistiu" },
  { value: "faixa_etaria", label: "Estatísticas por faixa etária" },
];

function downloadCsv(title: string, columns: string[], rows: Record<string, any>[]) {
  const header = columns.join(";");
  const body = rows.map((r) => columns.map((c) => String(r[c] ?? "").replace(/;/g, ",")).join(";")).join("\n");
  const csv = "\uFEFF" + header + "\n" + body; // BOM pro Excel abrir acentos certos
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 11) digits = "55" + digits; // sem DDI -> assume Brasil
  return digits;
}

function Page() {
  const { id } = Route.useParams();
  const { data: eventData } = useQuery({ queryKey: ["event", id], queryFn: () => getEvent({ data: { id } }) });

  return (
    <div className="space-y-6 pb-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios e Comunicação</h1>
        <p className="text-sm text-muted-foreground">{eventData?.event.nome}</p>
      </header>

      <ReportsSection eventId={id} />
      <ComunicacaoSection eventId={id} />
    </div>
  );
}

function ReportsSection({ eventId }: { eventId: string }) {
  const [tipo, setTipo] = useState<ReportType>("participantes");
  const { data, isLoading } = useQuery({ queryKey: ["report", eventId, tipo], queryFn: () => getReport({ data: { event_id: eventId, tipo } }) });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Relatórios</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {REPORTS.map((r) => (
            <Button key={r.value} size="sm" variant={tipo === r.value ? "default" : "outline"} onClick={() => setTipo(r.value)}>
              {r.label}
            </Button>
          ))}
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {data && (
          <>
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline">{data.rows.length} registro(s)</Badge>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadCsv(data.title, data.columns, data.rows)}>
                  <FileDown className="size-4 mr-2" /> CSV
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={async () => {
                    const { base64, filename } = await exportReportExcel({ data: { event_id: eventId, tipo } });
                    const bytes = atob(base64);
                    const arr = new Uint8Array(bytes.length);
                    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                    const blob = new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = filename; a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <FileSpreadsheet className="size-4 mr-2" /> Excel
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    {data.columns.map((c) => <th key={c} className="py-1.5 pr-3 font-medium">{c.replace(/_/g, " ")}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {data.columns.map((c) => <td key={c} className="py-1.5 pr-3">{String(r[c] ?? "")}</td>)}
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr><td colSpan={data.columns.length} className="py-6 text-center text-muted-foreground">Nenhum registro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const SEGMENTOS = [
  { value: "todos", label: "Todos os inscritos" },
  { value: "inadimplentes", label: "Inadimplentes" },
  { value: "sem_roupa", label: "Sem roupa entregue" },
  { value: "sem_tamanho", label: "Sem tamanho informado" },
];

const TEMPLATE_PADRAO =
  "Olá, {{nome}}. Identificamos que ainda existe um saldo pendente referente ao congresso. " +
  "Caso já tenha realizado o pagamento, desconsidere esta mensagem. Em caso de dúvidas, procure a organização.";

function ComunicacaoSection({ eventId }: { eventId: string }) {
  const [segmento, setSegmento] = useState<string>("inadimplentes");
  const [mensagem, setMensagem] = useState(TEMPLATE_PADRAO);
  const [buscou, setBuscou] = useState(false);

  const { data: contatos = [], refetch, isFetching } = useQuery({
    queryKey: ["segment-contacts", eventId, segmento],
    queryFn: () => getSegmentContacts({ data: { event_id: eventId, segmento: segmento as any } }),
    enabled: false,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0"><MessageCircle className="size-5" /><CardTitle className="text-base">Comunicação (WhatsApp)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Selecionar</label>
            <Select value={segmento} onValueChange={setSegmento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEGMENTOS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline" className="w-full"
              onClick={async () => { await refetch(); setBuscou(true); }}
              disabled={isFetching}
            >
              {isFetching ? "Buscando..." : "Buscar contatos"}
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Mensagem (use {"{{nome}}"} pra personalizar)</label>
          <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4} />
        </div>

        {buscou && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{contatos.length} contato(s) encontrado(s) com telefone cadastrado.</p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {contatos.map((c: any, i: number) => {
                const phone = normalizePhone(c.telefone);
                const texto = mensagem.replace(/\{\{\s*nome\s*\}\}/gi, c.nome.split(" ")[0]);
                const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(texto)}` : null;
                return (
                  <div key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>{c.nome} <span className="text-muted-foreground">({c.telefone})</span></span>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline"><ExternalLink className="size-3.5 mr-1.5" /> Abrir WhatsApp</Button>
                      </a>
                    ) : (
                      <Badge variant="outline">Sem telefone válido</Badge>
                    )}
                  </div>
                );
              })}
              {contatos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Ninguém nesse grupo.</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              Cada botão abre o WhatsApp já com a mensagem pronta pra aquele contato — é só clicar em enviar, um de cada vez.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
