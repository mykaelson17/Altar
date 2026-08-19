import { createServerFn } from "@tanstack/react-start";
import { q, q1 } from "./db.server";
import { requireAuth } from "./auth-middleware";

export const getPastorDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // Quem não é Pastor Presidente só vê os números da própria congregação.
    const scoped = !["master", "admin"].includes(context.auth.role) ? context.auth.congregationId : null;
    const condMembros = scoped ? `AND congregation_id = $1` : "";
    const condFinance = scoped ? `AND congregation_id = $2` : "";
    const valsMembros1 = scoped ? [scoped] : [];

    const membrosAtivos = await q1<{ c: number }>(
      `SELECT COUNT(*) AS c FROM participants WHERE situacao = 'ATIVO' ${condMembros}`, valsMembros1,
    );
    const totalMembros = await q1<{ c: number }>(
      `SELECT COUNT(*) AS c FROM participants WHERE 1=1 ${condMembros}`, valsMembros1,
    );

    const hoje = new Date();
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, "0");
    const anoAtual = String(hoje.getFullYear());
    const periodo = `${anoAtual}-${mesAtual}`;

    const novosConvertidos = await q1<{ c: number }>(
      `SELECT COUNT(*) AS c FROM participants WHERE strftime('%Y-%m', data_conversao) = $1 ${scoped ? `AND congregation_id = $2` : ""}`,
      scoped ? [periodo, scoped] : [periodo],
    );

    const ofertasDoMes = await q1<{ v: number }>(
      `SELECT COALESCE(SUM(valor),0) AS v FROM finance_transactions WHERE tipo = 'ENTRADA' AND strftime('%Y-%m', data) = $1 ${scoped ? `AND congregation_id = $2` : ""}`,
      scoped ? [periodo, scoped] : [periodo],
    );
    const despesasDoMes = await q1<{ v: number }>(
      `SELECT COALESCE(SUM(valor),0) AS v FROM finance_transactions WHERE tipo = 'SAIDA' AND strftime('%Y-%m', data) = $1 ${scoped ? `AND congregation_id = $2` : ""}`,
      scoped ? [periodo, scoped] : [periodo],
    );

    const situacoes = q<{ situacao: string; c: number }>(
      `SELECT situacao, COUNT(*) AS c FROM participants WHERE 1=1 ${condMembros} GROUP BY situacao`, valsMembros1,
    );

    // Aniversariantes do mês (dia/mês, independente do ano de nascimento).
    const aniversariantes = q<{ id: string; nome: string; data_nascimento: string }>(
      `SELECT id, nome, data_nascimento FROM participants
        WHERE data_nascimento IS NOT NULL AND strftime('%m', data_nascimento) = $1 ${scoped ? `AND congregation_id = $2` : ""}
        ORDER BY strftime('%d', data_nascimento)`,
      scoped ? [mesAtual, scoped] : [mesAtual],
    );

    const eventosAtivos = await q1<{ c: number }>(`SELECT COUNT(*) AS c FROM events WHERE status = 'ATIVO'`);

    // Faixa etária geral de todos os membros (não só por evento).
    const idades = q<{ data_nascimento: string | null }>(
      `SELECT data_nascimento FROM participants WHERE 1=1 ${condMembros}`, valsMembros1,
    );
    const hojeCalc = new Date();
    const calcIdade = (nasc: string) => {
      const d = new Date(nasc);
      let idade = hojeCalc.getFullYear() - d.getFullYear();
      const m = hojeCalc.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && hojeCalc.getDate() < d.getDate())) idade--;
      return idade;
    };
    const faixas = [
      { label: "0-12", min: 0, max: 12 }, { label: "13-17", min: 13, max: 17 }, { label: "18-25", min: 18, max: 25 },
      { label: "26-40", min: 26, max: 40 }, { label: "41-60", min: 41, max: 60 }, { label: "61+", min: 61, max: 999 },
    ];
    const faixaEtaria = faixas.map((f) => ({
      faixa: f.label,
      quantidade: idades.filter((r) => {
        if (!r.data_nascimento) return false;
        const idade = calcIdade(r.data_nascimento);
        return idade >= f.min && idade <= f.max;
      }).length,
    }));

    // Só faz sentido pra quem é de uma congregação específica (é quem envia).
    const pendenteEnvio = scoped
      ? await q1<{ c: number }>(
          `SELECT COUNT(*) AS c FROM finance_transactions WHERE congregation_id = $1 AND prestacao_conta_id IS NULL`,
          [scoped],
        )
      : null;

    return {
      membrosAtivos: membrosAtivos?.c ?? 0,
      totalMembros: totalMembros?.c ?? 0,
      novosConvertidos: novosConvertidos?.c ?? 0,
      ofertasDoMes: ofertasDoMes?.v ?? 0,
      despesasDoMes: despesasDoMes?.v ?? 0,
      situacoes,
      aniversariantes,
      faixaEtaria,
      eventosAtivos: eventosAtivos?.c ?? 0,
      lancamentosPendentesEnvio: pendenteEnvio?.c ?? null,
      isCongregationScoped: !!scoped,
    };
  });
