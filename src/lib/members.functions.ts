import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "crypto";
import { q, q1 } from "./db.server";
import { requireAuth, requireMembersAccess, requireCoordenador } from "./auth-middleware";

export type MemberRow = {
  id: string;
  nome: string;
  email: string;
  foto_url: string | null;
  telefone: string | null;
  cpf: string | null;
  estado_civil: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  congregacao: string | null;
  congregation_id: string | null;
  departamento: string | null;
  ministerio: string | null;
  data_nascimento: string | null;
  data_conversao: string | null;
  data_batismo: string | null;
  data_recepcao: string | null;
  sexo: "M" | "F" | null;
  cargo: string | null;
  situacao: "ATIVO" | "AFASTADO" | "CONGREGADO" | "VISITANTE";
  conjuge_id: string | null;
  responsavel_id: string | null;
  responsavel_pastoral_id: string | null;
  google_sub: string | null;
  grupo: "SENHORES" | "SENHORAS" | "JOVENS" | "CRIANCAS" | null;
};

function scopeCongregation(auth: { role: string; congregationId: string | null }) {
  return !["master", "admin"].includes(auth.role) ? auth.congregationId : null;
}

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({
      query: z.string().trim().optional(),
      congregation_id: z.string().nullable().optional(),
      situacao: z.string().optional(),
      orderBy: z.enum(["nome_asc", "nome_desc", "idade_asc", "idade_desc"]).optional(),
      novosMes: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const conditions: string[] = [];
    const vals: any[] = [];
    let i = 1;

    const scoped = scopeCongregation(context.auth);
    if (scoped) {
      conditions.push(`congregation_id = $${i++}`);
      vals.push(scoped);
    } else if (data.congregation_id !== undefined) {
      if (data.congregation_id === null) {
        conditions.push(`congregation_id IS NULL`);
      } else {
        conditions.push(`congregation_id = $${i++}`);
        vals.push(data.congregation_id);
      }
    }

    if (data.query) {
      conditions.push(`(nome LIKE $${i} OR email LIKE $${i} OR cpf LIKE $${i})`);
      vals.push(`%${data.query}%`);
      i++;
    }
    if (data.situacao) {
      conditions.push(`situacao = $${i++}`);
      vals.push(data.situacao);
    }

    if (data.novosMes) {
      const hoje2 = new Date();
      const mes2 = String(hoje2.getMonth() + 1).padStart(2, "0");
      const ano2 = String(hoje2.getFullYear());
      conditions.push(`strftime('%Y-%m', created_at) = '${ano2}-${mes2}'`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderClause = {
      nome_asc: "ORDER BY nome ASC",
      nome_desc: "ORDER BY nome DESC",
      idade_asc: "ORDER BY data_nascimento DESC",
      idade_desc: "ORDER BY data_nascimento ASC",
    }[data.orderBy ?? "nome_asc"] ?? "ORDER BY nome ASC";
    return await q<MemberRow>(`SELECT * FROM participants ${where} ${orderClause} LIMIT 500`, vals);
  });

export const getMember = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const member = await q1<MemberRow & { observacoes_pastorais: string | null }>(
      `SELECT * FROM participants WHERE id = $1`, [data.id],
    );
    if (!member) throw new Error("Membro nao encontrado.");

    const scoped = scopeCongregation(context.auth);
    if (scoped && member.congregation_id !== scoped) {
      throw new Error("Esse membro nao pertence a sua congregacao.");
    }

    const conjuge = member.conjuge_id
      ? await q1<{ id: string; nome: string }>(`SELECT id, nome FROM participants WHERE id = $1`, [member.conjuge_id])
      : null;
    const filhos = await q<{ id: string; nome: string; data_nascimento: string | null }>(
      `SELECT id, nome, data_nascimento FROM participants WHERE responsavel_id = $1`, [data.id],
    );
    const responsavelPastoral = member.responsavel_pastoral_id
      ? await q1<{ id: string; full_name: string }>(`SELECT id, full_name FROM app_users WHERE id = $1`, [member.responsavel_pastoral_id])
      : null;
    const isPastorRole = ["master", "admin", "coordenador"].includes(context.auth.role);
    const pastoralNotes = isPastorRole
      ? await q(`SELECT pcn.*, u.full_name AS registrado_por_nome
             FROM pastoral_care_notes pcn LEFT JOIN app_users u ON u.id = pcn.registrado_por
            WHERE pcn.participant_id = $1 ORDER BY pcn.created_at DESC`, [data.id])
      : [];
    return { member, conjuge, filhos, responsavelPastoral, pastoralNotes, canSeePastoralNotes: isPastorRole };
  });

export const listPossibleLeaders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const scoped = scopeCongregation(context.auth);
    if (scoped) {
      return await q<{ id: string; full_name: string; role: string }>(
        `SELECT id, full_name, role FROM app_users WHERE congregation_id = $1 AND active = 1 ORDER BY full_name`,
        [scoped],
      );
    }
    return await q<{ id: string; full_name: string; role: string }>(
      `SELECT id, full_name, role FROM app_users WHERE active = 1 ORDER BY full_name`,
    );
  });

const MemberSchema = z.object({
  nome: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal("")),
  telefone: z.string().trim().nullable().optional(),
  cpf: z.string().trim().nullable().optional(),
  estado_civil: z.enum(["SOLTEIRO", "CASADO", "DIVORCIADO", "VIUVO"]).optional(),
  endereco: z.string().trim().nullable().optional(),
  numero: z.string().trim().nullable().optional(),
  bairro: z.string().trim().nullable().optional(),
  cidade: z.string().trim().nullable().optional(),
  estado: z.string().trim().nullable().optional(),
  cep: z.string().trim().nullable().optional(),
  carta_mudanca_url: z.string().nullable().optional(),
  congregation_id: z.string().min(1).nullable().optional(),
  departamento: z.string().trim().nullable().optional(),
  ministerio: z.string().trim().optional(),
  data_nascimento: z.string().nullable().optional(),
  data_conversao: z.string().nullable().optional(),
  data_batismo: z.string().nullable().optional(),
  data_recepcao: z.string().nullable().optional(),
  sexo: z.enum(["M", "F"]).optional(),
  cargo: z.string().trim().nullable().optional(),
  situacao: z.enum(["ATIVO", "AFASTADO", "CONGREGADO", "VISITANTE"]).default("CONGREGADO"),
  conjuge_id: z.string().min(1).nullable().optional(),
  responsavel_id: z.string().min(1).nullable().optional(),
  responsavel_pastoral_id: z.string().min(1).nullable().optional(),
  grupo: z.enum(["SENHORES", "SENHORAS", "JOVENS", "CRIANCAS"]).nullable().optional(),
});

const CreateMemberSchema = MemberSchema.extend({
  cpf: z.string().trim().min(1, "CPF e obrigatorio"),
  nome: z.string().trim().min(1, "Nome e obrigatorio"),
  telefone: z.string().trim().min(1, "Telefone e obrigatorio"),
  endereco: z.string().trim().min(1, "Endereco e obrigatorio"),
  bairro: z.string().trim().min(1, "Bairro e obrigatorio"),
  cidade: z.string().trim().min(1, "Cidade e obrigatoria"),
  data_recepcao: z.string().trim().min(1, "Data da recepcao e obrigatoria").nullable().optional(),
});

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireMembersAccess])
  .inputValidator((d: unknown) => CreateMemberSchema.parse(d))
  .handler(async ({ data, context }) => {
    const existing = await q1(`SELECT id FROM participants WHERE lower(email) = lower($1)`, [data.email]);
    if (existing) throw new Error("Ja existe um membro cadastrado com esse e-mail.");

    const scoped = scopeCongregation(context.auth);
    const congregationId = scoped ?? data.congregation_id ?? null;

    const row = await q1<{ id: string }>(
      `INSERT INTO participants (id, nome, email, telefone, cpf, estado_civil, endereco, numero, bairro, cidade, estado, cep, congregation_id,
                                  departamento, data_nascimento, data_conversao, data_batismo,
                                  data_recepcao, sexo, cargo, situacao, conjuge_id, responsavel_id, responsavel_pastoral_id, grupo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING id`,
      [randomUUID(), data.nome, data.email, data.telefone || null, data.cpf || null, data.estado_civil || null,
       data.endereco || null, data.numero || null, data.bairro || null, data.cidade || null, data.estado || null, data.cep || null, congregationId, data.departamento || null,
       data.data_nascimento || null, data.data_conversao || null, data.data_batismo || null, data.data_recepcao || null,
       data.sexo || null, data.cargo || null, data.situacao, data.conjuge_id || null, data.responsavel_id || null,
       data.responsavel_pastoral_id || null, data.grupo || null],
    );
    return row;
  });

const UpdateMemberSchema = MemberSchema.partial().extend({ id: z.string().min(1) });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireMembersAccess])
  .inputValidator((d: unknown) => UpdateMemberSchema.parse(d))
  .handler(async ({ data, context }) => {
    const existing = await q1<MemberRow>(`SELECT * FROM participants WHERE id = $1`, [data.id]);
    if (!existing) throw new Error("Membro nao encontrado.");
    const scoped = scopeCongregation(context.auth);
    if (scoped && existing.congregation_id !== scoped) {
      throw new Error("Esse membro nao pertence a sua congregacao.");
    }

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      if (k === "id" || v === undefined) continue;
      if (k === "congregation_id" && scoped) continue;
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at = datetime('now')`);
    vals.push(data.id);
    await q1(`UPDATE participants SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    return { ok: true };
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireMembersAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const existing = await q1<MemberRow>(`SELECT * FROM participants WHERE id = $1`, [data.id]);
    if (!existing) return { ok: true };
    const scoped = scopeCongregation(context.auth);
    if (scoped && existing.congregation_id !== scoped) {
      throw new Error("Esse membro nao pertence a sua congregacao.");
    }
    await q1(`DELETE FROM participants WHERE id = $1`, [data.id]);
    return { ok: true };
  });

const PastoralNoteSchema = z.object({
  participant_id: z.string().min(1),
  tipo: z.enum(["VISITA", "ACONSELHAMENTO", "ACOMPANHAMENTO", "OBSERVACAO"]),
  descricao: z.string().trim().min(1),
});

export const addPastoralNote = createServerFn({ method: "POST" })
  .middleware([requireCoordenador])
  .inputValidator((d: unknown) => PastoralNoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await q1(
      `INSERT INTO pastoral_care_notes (participant_id, tipo, descricao, registrado_por) VALUES ($1,$2,$3,$4)`,
      [data.participant_id, data.tipo, data.descricao, context.auth.userId],
    );
    return { ok: true };
  });

export const getMemberStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ congregation_id: z.string().nullable().optional() }).optional().parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    let whereCongregation = "";
    if (scoped) {
      whereCongregation = `congregation_id = '${scoped}'`;
    } else if (data?.congregation_id !== undefined) {
      if (data.congregation_id === null) {
        whereCongregation = `congregation_id IS NULL`;
      } else {
        whereCongregation = `congregation_id = '${data.congregation_id}'`;
      }
    }
    const cond = whereCongregation ? `WHERE ${whereCongregation}` : "";

    const hoje = new Date();
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, "0");
    const anoAtual = String(hoje.getFullYear());
    const periodo = `${anoAtual}-${mesAtual}`;

    const situacoes = await q<{ situacao: string; c: number }>(
      `SELECT situacao, COUNT(*) AS c FROM participants ${cond} GROUP BY situacao`
    );
    const total = situacoes.reduce((s, r) => s + r.c, 0);
    const ativos = situacoes.find((r) => r.situacao === "ATIVO")?.c ?? 0;
    const afastados = situacoes.find((r) => r.situacao === "AFASTADO")?.c ?? 0;
    const congregados = situacoes.find((r) => r.situacao === "CONGREGADO")?.c ?? 0;

    const novosMes = (await q1<{ c: number }>(
      `SELECT COUNT(*) AS c FROM participants WHERE strftime('%Y-%m', created_at) = '${periodo}'${whereCongregation ? ` AND ${whereCongregation}` : ""}`
    )?.c) ?? 0;

    const sexos = await q<{ sexo: string | null; c: number }>(
      `SELECT sexo, COUNT(*) AS c FROM participants ${cond} GROUP BY sexo`
    );
    const masc = sexos.find((r) => r.sexo === "M")?.c ?? 0;
    const fem = sexos.find((r) => r.sexo === "F")?.c ?? 0;
    const semSexo = sexos.find((r) => !r.sexo)?.c ?? 0;

    const nascimentos = await q<{ data_nascimento: string | null }>(
      `SELECT data_nascimento FROM participants ${cond}`
    );
    const hojeCalc = new Date();
    const calcIdade = (nasc: string) => {
      const d = new Date(nasc + "T00:00:00");
      let idade = hojeCalc.getFullYear() - d.getFullYear();
      const m = hojeCalc.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && hojeCalc.getDate() < d.getDate())) idade--;
      return idade;
    };
    let criancas = 0, jovens = 0, adultos = 0, semIdade = 0;
    for (const r of nascimentos) {
      if (!r.data_nascimento) { semIdade++; continue; }
      const idade = calcIdade(r.data_nascimento);
      if (idade <= 12) criancas++;
      else if (idade <= 29) jovens++;
      else adultos++;
    }

    const aniversariantes = await q<{ id: string; nome: string; data_nascimento: string; departamento: string | null }>(
      `SELECT id, nome, data_nascimento, departamento FROM participants
        WHERE data_nascimento IS NOT NULL AND strftime('%m', data_nascimento) = '${mesAtual}'${whereCongregation ? ` AND ${whereCongregation}` : ""}
        ORDER BY strftime('%d', data_nascimento), nome`
    );

    // Membros cadastrados por mes (ultimos 12 meses)
    const mesesNomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const membrosPorMes: { mes: string; novos: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const anoM = d.getFullYear();
      const mesM = String(d.getMonth() + 1).padStart(2, "0");
      const periodo2 = `${anoM}-${mesM}`;
      const r = await q1<{ c: number }>(
        `SELECT COUNT(*) AS c FROM participants WHERE strftime('%Y-%m', created_at) = '${periodo2}'${whereCongregation ? ` AND ${whereCongregation}` : ""}`
      );
      membrosPorMes.push({ mes: `${mesesNomes[d.getMonth()]}/${String(anoM).slice(2)}`, novos: r?.c ?? 0 });
    }

    return {
      total,
      ativos,
      afastados,
      congregados,
      novosMes,
      sexoPizza: [
        { name: "Masculino", value: masc, fill: "#3b82f6" },
        { name: "Feminino", value: fem, fill: "#ec4899" },
        ...(semSexo > 0 ? [{ name: "Nao informado", value: semSexo, fill: "#94a3b8" }] : []),
      ],
      faixaPizza: [
        { name: "Criancas (0-12)", value: criancas, fill: "#f59e0b" },
        { name: "Jovens (13-29)", value: jovens, fill: "#10b981" },
        { name: "Adultos (30+)", value: adultos, fill: "#6366f1" },
        ...(semIdade > 0 ? [{ name: "Sem data", value: semIdade, fill: "#94a3b8" }] : []),
      ],
      aniversariantes,
      membrosPorMes,
    };
  });