import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1 } from "./db.server";
import { requireAuth, requireAdmin } from "./auth-middleware";

export type DocumentTemplate = {
  id: string;
  nome: string;
  conteudo: string;
  campos_extras: string;
  ativo: number;
};

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    return await q<DocumentTemplate>(`SELECT * FROM document_templates WHERE ativo = 1 ORDER BY nome`);
  });

export const listAllTemplates = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    return await q<DocumentTemplate>(`SELECT * FROM document_templates ORDER BY nome`);
  });

const TemplateSchema = z.object({
  nome: z.string().trim().min(1),
  conteudo: z.string().trim().min(1),
  campos_extras: z.array(z.string().trim().min(1)).default([]),
});

export const createTemplate = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => TemplateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = await q1<{ id: string }>(
      `INSERT INTO document_templates (nome, conteudo, campos_extras, criado_por) VALUES ($1,$2,$3,$4) RETURNING id`,
      [data.nome, data.conteudo, JSON.stringify(data.campos_extras), context.auth.userId],
    );
    return row;
  });

const UpdateTemplateSchema = TemplateSchema.partial().extend({ id: z.string().min(1), ativo: z.boolean().optional() });

export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => UpdateTemplateSchema.parse(d))
  .handler(async ({ data }) => {
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      if (k === "id" || v === undefined) continue;
      sets.push(`${k} = $${i++}`);
      vals.push(k === "campos_extras" ? JSON.stringify(v) : v);
    }
    if (sets.length === 0) return { ok: true };
    vals.push(data.id);
    await q1(`UPDATE document_templates SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    return { ok: true };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await q1(`DELETE FROM document_templates WHERE id = $1`, [data.id]);
    return { ok: true };
  });

function fmtDataCurta(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function fmtDataPorExtenso(iso: string): string {
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function renderTemplate(conteudo: string, member: any, extras: Record<string, string>): string {
  const hoje = new Date().toISOString().slice(0, 10);
  const valores: Record<string, string> = {
    "membro.nome": member.nome ?? "",
    "membro.cpf": member.cpf ?? "",
    "membro.email": member.email ?? "",
    "membro.telefone": member.telefone ?? "",
    "membro.endereco": member.endereco ?? "",
    "membro.cep": member.cep ?? "",
    "membro.data_nascimento": fmtDataCurta(member.data_nascimento),
    "membro.data_batismo": fmtDataCurta(member.data_batismo),
    "membro.data_recepcao": fmtDataCurta(member.data_recepcao),
    "membro.cargo": member.cargo ?? "",
    "congregacao.nome": member.congregacao_nome ?? "",
    "congregacao.endereco": member.congregacao_endereco ?? "",
    "congregacao.pastor": member.pastor_responsavel ?? "",
    "data_hoje": fmtDataCurta(hoje),
    "data_hoje_extenso": fmtDataPorExtenso(hoje),
  };
  for (const [k, v] of Object.entries(extras)) {
    valores[`extra.${k}`] = v ?? "";
  }
  return conteudo.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => (key in valores ? valores[key] : match));
}

export const gerarDocumento = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({
      templateId: z.string().min(1),
      participantId: z.string().min(1),
      extras: z.record(z.string()).default({}),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const template = await q1<DocumentTemplate>(`SELECT * FROM document_templates WHERE id = $1`, [data.templateId]);
    if (!template) throw new Error("Modelo não encontrado.");
    const member = await q1<any>(
      `SELECT p.*, c.nome AS congregacao_nome, c.endereco AS congregacao_endereco, c.pastor_responsavel
         FROM participants p LEFT JOIN congregations c ON c.id = p.congregation_id
        WHERE p.id = $1`,
      [data.participantId],
    );
    if (!member) throw new Error("Membro não encontrado.");

    const texto = renderTemplate(template.conteudo, member, data.extras);
    return { texto, member, templateNome: template.nome };
  });
