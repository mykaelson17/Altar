import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import ExcelJS from "exceljs";
import { q, q1 } from "./db.server";
import { requireAuth } from "./auth-middleware";

const REPORT_TYPES = [
  "participantes", "inadimplentes", "sem_roupa", "sem_tamanho",
  "pagos", "presenca", "desistentes", "faixa_etaria",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportResult = { title: string; columns: string[]; rows: Record<string, any>[] };

function diasEmAtraso(prazo: string | null): number {
  if (!prazo) return 0;
  const hoje = new Date();
  const venc = new Date(prazo);
  const dias = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
  return dias > 0 ? dias : 0;
}

// Função pura reaproveitada tanto pela leitura (getReport) quanto pela
// exportação em Excel — evita duplicar a lógica de cada relatório.
async function buildReport(eventId: string, tipo: ReportType): Promise<ReportResult> {
  const event = await q1<any>(`SELECT * FROM events WHERE id = $1`, [eventId]);
  if (!event) throw new Error("Evento não encontrado.");

  if (tipo === "participantes") {
    const rows = q(
      `SELECT nome, congregacao, departamento, telefone, sexo, idade, cargo, tamanho_roupa,
              CASE WHEN roupa_entregue = 1 THEN 'Sim' ELSE 'Não' END AS roupa_entregue, status
         FROM registrations WHERE event_id = $1 ORDER BY nome`,
      [eventId],
    );
    return { title: "Lista de participantes", columns: ["nome", "congregacao", "departamento", "telefone", "sexo", "idade", "cargo", "tamanho_roupa", "roupa_entregue", "status"], rows };
  }
  if (tipo === "inadimplentes") {
    const regs = q<any>(`SELECT id, nome, congregacao, telefone, valor_total FROM registrations WHERE event_id = $1 AND status = 'INSCRITO'`, [eventId]);
    const ids = regs.map((r) => r.id);
    const pagosMap = new Map<string, number>();
    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
      q<{ registration_id: string; total: number }>(
        `SELECT registration_id, COALESCE(SUM(valor),0) AS total FROM payments WHERE registration_id IN (${placeholders}) AND status = 'PAGO' GROUP BY registration_id`,
        ids,
      ).forEach((p) => pagosMap.set(p.registration_id, p.total));
    }
    const rows = regs
      .map((r) => ({ nome: r.nome, congregacao: r.congregacao, telefone: r.telefone, valor_devido: r.valor_total - (pagosMap.get(r.id) ?? 0), dias_em_atraso: diasEmAtraso(event.prazo_pagamento) }))
      .filter((r) => r.valor_devido > 0);
    return { title: "Participantes inadimplentes", columns: ["nome", "congregacao", "telefone", "valor_devido", "dias_em_atraso"], rows };
  }
  if (tipo === "sem_roupa") {
    const rows = q(`SELECT nome, congregacao, telefone, tamanho_roupa FROM registrations WHERE event_id = $1 AND status = 'INSCRITO' AND roupa_entregue = 0`, [eventId]);
    return { title: "Participantes que ainda não receberam roupa", columns: ["nome", "congregacao", "telefone", "tamanho_roupa"], rows };
  }
  if (tipo === "sem_tamanho") {
    const rows = q(`SELECT nome, congregacao, telefone FROM registrations WHERE event_id = $1 AND status = 'INSCRITO' AND (tamanho_roupa IS NULL OR tamanho_roupa = '')`, [eventId]);
    return { title: "Quem ainda não informou o tamanho", columns: ["nome", "congregacao", "telefone"], rows };
  }
  if (tipo === "pagos") {
    const rows = q(`SELECT r.nome, r.congregacao, p.descricao, p.valor, p.forma, p.pago_em FROM payments p JOIN registrations r ON r.id = p.registration_id WHERE r.event_id = $1 AND p.status = 'PAGO' ORDER BY p.pago_em DESC`, [eventId]);
    return { title: "Pagamentos concluídos", columns: ["nome", "congregacao", "descricao", "valor", "forma", "pago_em"], rows };
  }
  if (tipo === "presenca") {
    const rows = q(`SELECT r.nome, r.congregacao, a.data_hora, a.responsavel FROM attendance a JOIN registrations r ON r.id = a.registration_id WHERE r.event_id = $1 ORDER BY a.data_hora`, [eventId]);
    return { title: "Lista de presença", columns: ["nome", "congregacao", "data_hora", "responsavel"], rows };
  }
  if (tipo === "desistentes") {
    const rows = q(`SELECT nome, congregacao, telefone FROM registrations WHERE event_id = $1 AND status = 'DESISTENTE'`, [eventId]);
    return { title: "Quem desistiu", columns: ["nome", "congregacao", "telefone"], rows };
  }
  const idades = q<{ idade: number | null }>(`SELECT idade FROM registrations WHERE event_id = $1 AND status = 'INSCRITO'`, [eventId]);
  const faixas = [
    { label: "0-12", min: 0, max: 12 }, { label: "13-17", min: 13, max: 17 }, { label: "18-25", min: 18, max: 25 },
    { label: "26-40", min: 26, max: 40 }, { label: "41-60", min: 41, max: 60 }, { label: "61+", min: 61, max: 999 },
    { label: "Não informado", min: -1, max: -1 },
  ];
  const rows = faixas.map((f) => ({
    faixa_etaria: f.label,
    quantidade: idades.filter((r) => (f.label === "Não informado" ? r.idade == null : r.idade != null && r.idade >= f.min && r.idade <= f.max)).length,
  }));
  return { title: "Estatísticas por faixa etária", columns: ["faixa_etaria", "quantidade"], rows };
}

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().min(1), tipo: z.enum(REPORT_TYPES) }).parse(d))
  .handler(async ({ data }) => buildReport(data.event_id, data.tipo));

const SEGMENTS = ["todos", "inadimplentes", "sem_roupa", "sem_tamanho"] as const;

// Contatos (nome + telefone) de um segmento — usado na tela de Comunicação
// pra montar os links do WhatsApp.
export const getSegmentContacts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().min(1), segmento: z.enum(SEGMENTS) }).parse(d))
  .handler(async ({ data }) => {
    const tipoMap: Record<(typeof SEGMENTS)[number], ReportType> = {
      todos: "participantes", inadimplentes: "inadimplentes", sem_roupa: "sem_roupa", sem_tamanho: "sem_tamanho",
    };
    const result = await buildReport(data.event_id, tipoMap[data.segmento]);
    return result.rows
      .filter((r) => r.telefone)
      .map((r) => ({ nome: r.nome, telefone: r.telefone }));
  });

// Exportação em Excel de verdade (.xlsx) — devolve o arquivo em base64 pro
// navegador baixar (CSV é gerado direto no cliente, não precisa vir daqui).
export const exportReportExcel = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().min(1), tipo: z.enum(REPORT_TYPES) }).parse(d))
  .handler(async ({ data }) => {
    const result = await buildReport(data.event_id, data.tipo);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(result.title.slice(0, 30));
    sheet.addRow(result.columns.map((c) => c.replace(/_/g, " ").toUpperCase()));
    sheet.getRow(1).font = { bold: true };
    result.rows.forEach((r) => sheet.addRow(result.columns.map((c) => r[c] ?? "")));
    sheet.columns.forEach((col) => { col.width = 20; });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { base64, filename: `${result.title.toLowerCase().replace(/\s+/g, "-")}.xlsx` };
  });
