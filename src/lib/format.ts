export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

export const fmtBRL = (n: number | null | undefined) =>
  BRL.format(Number.isFinite(Number(n)) ? Number(n) : 0);

export const fmtPct = (n: number | null | undefined, digits = 1) =>
  `${((Number(n) || 0) * 100).toFixed(digits)}%`;

/** Formato compacto pra rótulos de gráfico: R$ 12,3k / R$ 1,2mi */
export function fmtBRLCompact(n: number | null | undefined): string {
  const v = Number.isFinite(Number(n)) ? Number(n) : 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return "R$ " + (v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "mi";
  if (abs >= 1_000) return "R$ " + (v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k";
  return fmtBRL(v);
}

export const MONTHS_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export const MONTHS_SHORT_PT = [
  "Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez",
];

/** ISO week-of-month (1..5), based on Monday weeks. */
export function weekOfMonth(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDate();
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7; // Mon=0
  return Math.ceil((day + firstWeekday) / 7);
}

export function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
