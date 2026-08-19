import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1 } from "./db.server";
import { requireAuth } from "./auth-middleware";

function scopeCongregation(auth: { role: string; congregationId: string | null }) {
  return !["master", "admin"].includes(auth.role) ? auth.congregationId : null;
}

async function verificarTurmaNoEscopo(turmaId: string, scoped: string | null) {
  if (!scoped) return;
  const turma = await q1<{ congregation_id: string | null }>(`SELECT congregation_id FROM ebd_turmas WHERE id = $1`, [turmaId]);
  if (!turma) throw new Error("Turma não encontrada.");
  if (turma.congregation_id !== scoped) throw new Error("Essa turma não pertence à sua congregação.");
}

export const listTurmas = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ congregation_id: z.string().optional(), ano: z.number().int().optional(), trimestre: z.number().int().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const filtro = scoped ?? data.congregation_id;
    const ano = data.ano ?? new Date().getFullYear();
    const trimestre = data.trimestre ?? Math.floor(new Date().getMonth() / 3) + 1;

    let queryStr = `SELECT t.*, p.nome AS professor_nome FROM ebd_turmas t LEFT JOIN participants p ON p.id = t.professor_id`;
    let params: any[] = [];
    if (filtro === "__none") {
      queryStr += " WHERE t.congregation_id IS NULL";
    } else if (filtro && filtro !== "__todas") {
      queryStr += " WHERE t.congregation_id = $1";
      params.push(filtro);
    }
    queryStr += " ORDER BY t.nome";
    const turmas = await q(queryStr, params);
    const ids = turmas.map((t: any) => t.id);
    if (ids.length === 0) return turmas.map((t: any) => ({ ...t, totalAlunos: 0 }));
    const placeholders = ids.map((_: any, i: number) => `$${i + 1}`).join(",");
    const counts = q<{ turma_id: string; c: number }>(`SELECT turma_id, COUNT(*) AS c FROM ebd_alunos WHERE turma_id IN (${placeholders}) AND ano = ${ano} AND trimestre = ${trimestre} GROUP BY turma_id`, ids);
    const map = new Map(counts.map((c) => [c.turma_id, c.c]));
    return turmas.map((t: any) => ({ ...t, totalAlunos: map.get(t.id) ?? 0 }));
  });

const TurmaSchema = z.object({
  nome: z.string().trim().min(1),
  professor_id: z.string().min(1).nullable().optional(),
  congregation_id: z.string().min(1).nullable().optional(),
});

export const createTurma = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => TurmaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const congregationId = scoped ?? data.congregation_id ?? null;
    const row = await q1<{ id: string }>(
      `INSERT INTO ebd_turmas (nome, professor_id, congregation_id) VALUES ($1,$2,$3) RETURNING id`,
      [data.nome, data.professor_id || null, congregationId],
    );
    return row;
  });

const UpdateTurmaSchema = z.object({
  id: z.string().min(1),
  nome: z.string().trim().min(1).optional(),
  professor_id: z.string().min(1).nullable().optional(),
});

export const updateTurma = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateTurmaSchema.parse(d))
  .handler(async ({ data, context }) => {
    await verificarTurmaNoEscopo(data.id, scopeCongregation(context.auth));
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      if (k === "id" || v === undefined) continue;
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
    if (sets.length === 0) return { ok: true };
    vals.push(data.id);
    await q1(`UPDATE ebd_turmas SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    return { ok: true };
  });

export const deleteTurma = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await verificarTurmaNoEscopo(data.id, scopeCongregation(context.auth));
    await q1(`DELETE FROM ebd_turmas WHERE id = $1`, [data.id]);
    return { ok: true };
  });

export const getTurmaDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), ano: z.number().int().optional(), trimestre: z.number().int().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await verificarTurmaNoEscopo(data.id, scopeCongregation(context.auth));
    const ano = data.ano ?? new Date().getFullYear();
    const trimestre = data.trimestre ?? Math.floor(new Date().getMonth() / 3) + 1;

    const turma = await q1<any>(`SELECT t.*, p.nome AS professor_nome FROM ebd_turmas t LEFT JOIN participants p ON p.id = t.professor_id WHERE t.id = $1`, [data.id]);
    if (!turma) throw new Error("Turma não encontrada.");
    const alunos = q(
      `SELECT ea.id AS matricula_id, p.id AS participant_id, p.nome, p.telefone
         FROM ebd_alunos ea JOIN participants p ON p.id = ea.participant_id
        WHERE ea.turma_id = $1 AND ea.ano = $2 AND ea.trimestre = $3 ORDER BY p.nome`,
      [data.id, ano, trimestre],
    );
    return { turma, alunos };
  });

export const addAluno = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ turma_id: z.string().min(1), participant_id: z.string().min(1), ano: z.number().int().optional(), trimestre: z.number().int().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await verificarTurmaNoEscopo(data.turma_id, scopeCongregation(context.auth));
    const ano = data.ano ?? new Date().getFullYear();
    const trimestre = data.trimestre ?? Math.floor(new Date().getMonth() / 3) + 1;

    const existing = await q1(`SELECT id FROM ebd_alunos WHERE turma_id = $1 AND participant_id = $2 AND ano = $3 AND trimestre = $4`, [data.turma_id, data.participant_id, ano, trimestre]);
    if (existing) throw new Error("Esse aluno já está matriculado nessa turma para este trimestre.");
    await q1(`INSERT INTO ebd_alunos (turma_id, participant_id, ano, trimestre) VALUES ($1,$2,$3,$4)`, [data.turma_id, data.participant_id, ano, trimestre]);
    return { ok: true };
  });

export const removeAluno = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ matriculaId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const matricula = await q1<{ turma_id: string }>(`SELECT turma_id FROM ebd_alunos WHERE id = $1`, [data.matriculaId]);
    if (matricula) await verificarTurmaNoEscopo(matricula.turma_id, scopeCongregation(context.auth));
    await q1(`DELETE FROM ebd_alunos WHERE id = $1`, [data.matriculaId]);
    return { ok: true };
  });

export const copiarAlunosTrimestreAnterior = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ turma_id: z.string().min(1), ano: z.number().int(), trimestre: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    await verificarTurmaNoEscopo(data.turma_id, scopeCongregation(context.auth));
    let anoAnt = data.ano;
    let triAnt = data.trimestre - 1;
    if (triAnt === 0) {
      triAnt = 4;
      anoAnt -= 1;
    }
    
    // Pega alunos do trimestre anterior
    const alunosAnteriores = await q<{participant_id: string}>(`SELECT participant_id FROM ebd_alunos WHERE turma_id = $1 AND ano = $2 AND trimestre = $3`, [data.turma_id, anoAnt, triAnt]);
    if (alunosAnteriores.length === 0) throw new Error("O trimestre anterior não tem alunos matriculados para copiar.");
    
    let count = 0;
    for (const a of alunosAnteriores) {
      const existing = await q1(`SELECT id FROM ebd_alunos WHERE turma_id = $1 AND participant_id = $2 AND ano = $3 AND trimestre = $4`, [data.turma_id, a.participant_id, data.ano, data.trimestre]);
      if (!existing) {
        await q1(`INSERT INTO ebd_alunos (turma_id, participant_id, ano, trimestre) VALUES ($1,$2,$3,$4)`, [data.turma_id, a.participant_id, data.ano, data.trimestre]);
        count++;
      }
    }
    return { ok: true, copiados: count };
  });

export const getFrequenciaDoDia = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ turmaId: z.string().min(1), data: z.string().min(1), ano: z.number().int().optional(), trimestre: z.number().int().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await verificarTurmaNoEscopo(data.turmaId, scopeCongregation(context.auth));
    const ano = data.ano ?? new Date().getFullYear();
    const trimestre = data.trimestre ?? Math.floor(new Date().getMonth() / 3) + 1;
    
    return q(
      `SELECT ea.participant_id, p.nome,
              COALESCE((SELECT presente FROM ebd_frequencia f WHERE f.turma_id = ea.turma_id AND f.participant_id = ea.participant_id AND f.data = $1), 0) AS presente
         FROM ebd_alunos ea JOIN participants p ON p.id = ea.participant_id
        WHERE ea.turma_id = $2 AND ea.ano = $3 AND ea.trimestre = $4 ORDER BY p.nome`,
      [data.data, data.turmaId, ano, trimestre],
    );
  });

export const salvarFrequencia = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({
      turmaId: z.string().min(1),
      data: z.string().min(1),
      presencas: z.array(z.object({ participant_id: z.string().min(1), presente: z.boolean() })),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await verificarTurmaNoEscopo(data.turmaId, scopeCongregation(context.auth));
    
    const todayStr = new Date().toISOString().slice(0, 10);
    if (data.data > todayStr) {
      throw new Error("Não é possível salvar a chamada para datas futuras.");
    }

    for (const p of data.presencas) {
      await q1(
        `INSERT INTO ebd_frequencia (turma_id, participant_id, data, presente) VALUES ($1,$2,$3,$4)
         ON CONFLICT (turma_id, participant_id, data) DO UPDATE SET presente = EXCLUDED.presente`,
        [data.turmaId, p.participant_id, data.data, p.presente ? 1 : 0],
      );
    }
    return { ok: true };
  });

export const getFrequenciaHistorico = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ turmaId: z.string().min(1), ano: z.number().int(), trimestre: z.number().int().min(1).max(4) }).parse(d))
  .handler(async ({ data, context }) => {
    await verificarTurmaNoEscopo(data.turmaId, scopeCongregation(context.auth));
    
    // Calcula o mês inicial e final do trimestre
    const mesInicial = (data.trimestre - 1) * 3 + 1;
    const mesFinal = data.trimestre * 3;
    
    // Formata YYYY-MM
    const dataInicial = `${data.ano}-${String(mesInicial).padStart(2, "0")}-01`;
    const dataFinal = `${data.ano}-${String(mesFinal).padStart(2, "0")}-31`;

    return q<{ data: string; total: number; presentes: number }>(
      `SELECT data, COUNT(*) AS total, SUM(presente) AS presentes
         FROM ebd_frequencia 
        WHERE turma_id = $1 AND data >= $2 AND data <= $3
        GROUP BY data ORDER BY data DESC`,
      [data.turmaId, dataInicial, dataFinal],
    );
  });

export const getFrequenciaHistoricoGeral = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ congregation_id: z.string().optional() }).parse(d || {}))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const reqFiltro = scoped ?? data.congregation_id;
    const { query, params } = applyCongregationFilter(reqFiltro,
      `SELECT f.data, COUNT(f.id) AS total, SUM(f.presente) AS presentes
         FROM ebd_frequencia f
         JOIN ebd_turmas t ON t.id = f.turma_id
        WHERE 1=1 {{COND_TURMA}}
        GROUP BY f.data 
        ORDER BY f.data DESC 
        LIMIT 10`,
      []
    );
    return q<{ data: string; total: number; presentes: number }>(query, params);
  });

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Estatísticas / gráficos / relatórios
// ---------------------------------------------------------------------------

function applyCongregationFilter(reqFiltro: string | null | undefined, baseQuery: string, params: any[]) {
  if (reqFiltro === "__none") {
    return { query: baseQuery.replace("{{COND_TURMA}}", "AND t.congregation_id IS NULL").replace("{{COND_WHERE}}", "WHERE congregation_id IS NULL"), params };
  } else if (reqFiltro && reqFiltro !== "__todas") {
    params.push(reqFiltro);
    const pIdx = "$" + params.length;
    return { query: baseQuery.replace("{{COND_TURMA}}", `AND t.congregation_id = ${pIdx}`).replace("{{COND_WHERE}}", `WHERE congregation_id = ${pIdx}`), params };
  }
  return { query: baseQuery.replace("{{COND_TURMA}}", "").replace("{{COND_WHERE}}", ""), params };
}

export const getFrequenciaResumoDoDia = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ data: z.string().min(1), congregation_id: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const reqFiltro = scoped ?? data.congregation_id;
    
    // Extrair ano e trimestre da data
    const dObj = new Date(data.data + "T00:00:00");
    const ano = dObj.getFullYear();
    const trimestre = Math.floor(dObj.getMonth() / 3) + 1;

    const { query, params } = applyCongregationFilter(reqFiltro,
      `SELECT t.id AS turma_id, t.nome,
              (SELECT COUNT(*) FROM ebd_alunos a WHERE a.turma_id = t.id AND a.ano = $1 AND a.trimestre = $2) AS inscritos,
              (SELECT COALESCE(SUM(presente),0) FROM ebd_frequencia f WHERE f.turma_id = t.id AND f.data = $3) AS presentes
         FROM ebd_turmas t
        WHERE 1=1 {{COND_TURMA}}`,
      [ano, trimestre, data.data]
    );
    return q<{ turma_id: string; nome: string; inscritos: number; presentes: number }>(query, params);
  });


export const getFrequenciaPorTurmaGeral = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ congregation_id: z.string().optional(), ano: z.number().int().optional(), trimestre: z.number().int().optional() }).parse(d || {}))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const reqFiltro = scoped ?? data.congregation_id;
    const ano = data.ano ?? new Date().getFullYear();
    const trimestre = data.trimestre ?? Math.floor(new Date().getMonth() / 3) + 1;
    const mesInicial = (trimestre - 1) * 3 + 1;
    const mesFinal = trimestre * 3;
    const dataInicial = `${ano}-${String(mesInicial).padStart(2, "0")}-01`;
    const dataFinal = `${ano}-${String(mesFinal).padStart(2, "0")}-31`;

    const { query, params } = applyCongregationFilter(reqFiltro,
      `SELECT t.id AS turma_id, t.nome,
              COUNT(f.id) AS total, COALESCE(SUM(f.presente),0) AS presentes
         FROM ebd_turmas t
         LEFT JOIN ebd_frequencia f ON f.turma_id = t.id AND f.data >= $1 AND f.data <= $2
        WHERE 1=1 {{COND_TURMA}}
        GROUP BY t.id, t.nome
        ORDER BY presentes DESC`,
      [dataInicial, dataFinal]
    );
    return q<{ turma_id: string; nome: string; total: number; presentes: number }>(query, params);
  });

export const getInscritosPresentesPorTurma = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ mes: z.number().int().min(1).max(12), ano: z.number().int(), congregation_id: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const reqFiltro = scoped ?? data.congregation_id;
    const { query: turmasQuery, params: turmasParams } = applyCongregationFilter(reqFiltro,
      `SELECT t.id AS turma_id, t.nome, (SELECT COUNT(*) FROM ebd_alunos a WHERE a.turma_id = t.id AND a.ano = $1) AS inscritos
         FROM ebd_turmas t WHERE 1=1 {{COND_TURMA}}`,
      [data.ano]
    );
    const turmas = q<{ turma_id: string; nome: string; inscritos: number }>(turmasQuery, turmasParams);

    const mm = String(data.mes).padStart(2, "0");
    const periodo = `${data.ano}-${mm}`;
    const { query: presencasQuery, params: presencasParams } = applyCongregationFilter(reqFiltro,
      `SELECT f.turma_id, f.data, SUM(f.presente) AS presentes
         FROM ebd_frequencia f JOIN ebd_turmas t ON t.id = f.turma_id
        WHERE strftime('%Y-%m', f.data) = $1 {{COND_TURMA}}
        GROUP BY f.turma_id, f.data`,
      [periodo]
    );
    const presencasPorTurma = q<{ turma_id: string; data: string; presentes: number }>(presencasQuery, presencasParams);

    return turmas.map((t) => {
      const chamadasDaTurma = presencasPorTurma.filter((p) => p.turma_id === t.turma_id);
      const mediaPresentes = chamadasDaTurma.length > 0
        ? chamadasDaTurma.reduce((s, c) => s + c.presentes, 0) / chamadasDaTurma.length
        : 0;
      return { turma_id: t.turma_id, nome: t.nome, inscritos: t.inscritos, mediaPresentes: Math.round(mediaPresentes * 10) / 10 };
    });
  });

export const getFrequenciaSemanal = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ congregation_id: z.string().optional(), ano: z.number().int().optional(), trimestre: z.number().int().optional() }).parse(d || {}))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const reqFiltro = scoped ?? data.congregation_id;
    const ano = data.ano ?? new Date().getFullYear();
    const trimestre = data.trimestre ?? Math.floor(new Date().getMonth() / 3) + 1;
    const mesInicial = (trimestre - 1) * 3 + 1;
    const mesFinal = trimestre * 3;
    const dataInicial = `${ano}-${String(mesInicial).padStart(2, "0")}-01`;
    const dataFinal = `${ano}-${String(mesFinal).padStart(2, "0")}-31`;

    const { query, params } = applyCongregationFilter(reqFiltro,
      `SELECT t.nome AS turma_nome, f.data, SUM(f.presente) AS presentes 
         FROM ebd_frequencia f
         JOIN ebd_turmas t ON t.id = f.turma_id
        WHERE f.data >= $1 AND f.data <= $2 {{COND_TURMA}}
        GROUP BY t.id, t.nome, f.data 
        ORDER BY f.data`,
      [dataInicial, dataFinal]
    );
    const chamadas = q<{ turma_nome: string; data: string; presentes: number }>(query, params);

    const semanas = new Map<string, Record<string, any>>();
    
    for (const c of chamadas) {
      const d = new Date(c.data + "T00:00:00");
      const diaSemana = (d.getDay() + 6) % 7;
      const inicioSemana = new Date(d);
      inicioSemana.setDate(d.getDate() - diaSemana);
      const chave = inicioSemana.toISOString().slice(0, 10);
      
      if (!semanas.has(chave)) {
        semanas.set(chave, { semana: chave });
      }
      const entry = semanas.get(chave)!;
      entry[c.turma_nome] = (entry[c.turma_nome] ?? 0) + c.presentes;
    }
    
    return [...semanas.values()].sort((a, b) => a.semana.localeCompare(b.semana));
  });

export const getTopMembrosPresenca = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ congregation_id: z.string().optional(), ano: z.number().int().optional(), trimestre: z.number().int().optional() }).parse(d || {}))
  .handler(async ({ data, context }) => {
    const scoped = scopeCongregation(context.auth);
    const reqFiltro = scoped ?? data.congregation_id;
    const ano = data.ano ?? new Date().getFullYear();
    const trimestre = data.trimestre ?? Math.floor(new Date().getMonth() / 3) + 1;
    const mesInicial = (trimestre - 1) * 3 + 1;
    const mesFinal = trimestre * 3;
    const dataInicial = `${ano}-${String(mesInicial).padStart(2, "0")}-01`;
    const dataFinal = `${ano}-${String(mesFinal).padStart(2, "0")}-31`;

    const { query, params } = applyCongregationFilter(reqFiltro,
      `SELECT f.participant_id, p.nome, SUM(f.presente) AS total_presencas
         FROM ebd_frequencia f
         JOIN participants p ON p.id = f.participant_id
         JOIN ebd_turmas t ON t.id = f.turma_id
        WHERE f.data >= $1 AND f.data <= $2 {{COND_TURMA}}
        GROUP BY f.participant_id, p.nome
       HAVING SUM(f.presente) > 0
        ORDER BY total_presencas DESC
        LIMIT 10`,
      [dataInicial, dataFinal]
    );
    return q<{ participant_id: string; nome: string; total_presencas: number }>(query, params);
  });

// Relatório (Documentos): top 10 de CADA turma — agrupado, pronto pra
// imprimir junto com o resumo geral de turmas.
export const getTopMembrosPorTurma = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const scoped = scopeCongregation(context.auth);
    const { query, params } = applyCongregationFilter(scoped, `SELECT id, nome FROM ebd_turmas t WHERE 1=1 {{COND_TURMA}} ORDER BY nome`, []);
    const turmas = q<{ id: string; nome: string }>(query, params);

    const resultado = [];
    for (const turma of turmas) {
      const top = q<{ participant_id: string; nome: string; total_presencas: number }>(
        `SELECT f.participant_id, p.nome, SUM(f.presente) AS total_presencas
           FROM ebd_frequencia f JOIN participants p ON p.id = f.participant_id
          WHERE f.turma_id = $1
          GROUP BY f.participant_id, p.nome
         HAVING SUM(f.presente) > 0
          ORDER BY total_presencas DESC
          LIMIT 10`,
        [turma.id],
      );
      if (top.length > 0) resultado.push({ turma_id: turma.id, turma_nome: turma.nome, top });
    }
    return resultado;
  });

// Resumo geral pro relatório de Documentos — visão consolidada de todas
// as turmas do escopo: inscritos, total de chamadas, presença acumulada.
export const getResumoTurmasRelatorio = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const scoped = scopeCongregation(context.auth);
    const cond = turmaScopeCondition(scoped);
    const vals = scoped ? [scoped] : [];
    return q<{ turma_id: string; nome: string; professor_nome: string | null; inscritos: number; totalChamadas: number; presentes: number }>(
      `SELECT t.id AS turma_id, t.nome, prof.nome AS professor_nome,
              (SELECT COUNT(*) FROM ebd_alunos a WHERE a.turma_id = t.id) AS inscritos,
              COUNT(f.id) AS totalChamadas,
              COALESCE(SUM(f.presente),0) AS presentes
         FROM ebd_turmas t
         LEFT JOIN participants prof ON prof.id = t.professor_id
         LEFT JOIN ebd_frequencia f ON f.turma_id = t.id
        WHERE 1=1 ${cond}
        GROUP BY t.id, t.nome, prof.nome
        ORDER BY t.nome`,
      vals,
    );
  });

