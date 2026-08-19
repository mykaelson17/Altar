import { q1 } from "./db.server";

export async function checkLicenseBlocked(): Promise<boolean> {
  const row = await q1<{ status: string; vencimento: string }>(`SELECT status, vencimento FROM license WHERE id = 1`);
  if (!row) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(row.vencimento + "T00:00:00");
  const diasRestantes = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  return diasRestantes < 0 || row.status === "CANCELADA";
}
