// ========================================================
// REGLAS PURAS DEL CONTROL FISCAL (sin base de datos)
// Este módulo NO calcula impuestos: solo ordena los datos que
// tu contador necesita (ventas cobradas, IVA, facturas, gastos).
// ========================================================

// Zona horaria fiscal: Ciudad de México, UTC-6 todo el año (sin horario de verano).
const MEXICO_UTC_OFFSET_HOURS = 6;

// Rango [inicio, fin) de un mes calendario en hora de México. month = "2026-10".
export function monthRange(month: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) {
    throw new RangeError("El mes debe tener el formato AAAA-MM.");
  }

  const year = Number(match[1]);
  const m = Number(match[2]);

  return {
    start: new Date(Date.UTC(year, m - 1, 1, MEXICO_UTC_OFFSET_HOURS)),
    end: new Date(Date.UTC(year, m, 1, MEXICO_UTC_OFFSET_HOURS)),
  };
}

// Separa subtotal e IVA de lo que el cliente pagó. Si no estás registrado
// en el SAT no se calcula IVA: todo el importe es subtotal.
export function splitPaidAmount(
  totalCents: number,
  registered: boolean,
  ratePercent: number
): { netCents: number; ivaCents: number } {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new RangeError("El total debe ser un entero positivo en centavos.");
  }

  if (!registered) {
    return { netCents: totalCents, ivaCents: 0 };
  }

  const netCents = Math.round((totalCents * 100) / (100 + ratePercent));
  return { netCents, ivaCents: totalCents - netCents };
}

// Validación de FORMATO (no consulta al SAT). Acepta los RFC genéricos
// de público en general y de extranjero.
export function isValidRfc(rfc: string): boolean {
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc.trim().toUpperCase());
}

export function centsToMxn(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

// Fecha en hora de México, "2026-10-31 14:05:00".
export function formatMexicoDateTime(date: Date): string {
  return new Date(date.getTime() - MEXICO_UTC_OFFSET_HOURS * 3600_000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

type CsvCell = string | number | boolean | null | undefined;

// CSV para Excel (con BOM). Los textos que empiezan con = + - @ se
// neutralizan para que una hoja de cálculo no los ejecute como fórmula
// (inyección de fórmulas). Los números se escriben tal cual.
export function toCsv(rows: CsvCell[][]): string {
  const cell = (value: CsvCell): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "sí" : "no";

    let text = value;
    if (/^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export type SaleLike = {
  kind: string;
  totalCents: number;
  netCents: number;
  ivaCents: number;
  gatewayFeeCents: number | null;
  cfdiStatus: string;
};

export type ExpenseLike = { amountMxnCents: number; ivaCents: number };

// Resumen mensual para tu contador. Los reembolsos entran con importes
// negativos, así que los totales ya vienen netos de reembolsos.
export function summarizeMonth(sales: SaleLike[], expenses: ExpenseLike[]) {
  const byKind: Record<string, { count: number; totalCents: number }> = {};
  let totalCents = 0;
  let netCents = 0;
  let ivaCents = 0;
  let gatewayFeesCents = 0;
  let refundsCents = 0;
  let salesCount = 0;
  let refundsCount = 0;
  let cfdiPending = 0;

  for (const s of sales) {
    totalCents += s.totalCents;
    netCents += s.netCents;
    ivaCents += s.ivaCents;
    gatewayFeesCents += s.gatewayFeeCents ?? 0;

    const bucket = (byKind[s.kind] ??= { count: 0, totalCents: 0 });
    bucket.count += 1;
    bucket.totalCents += s.totalCents;

    if (s.kind === "REFUND") {
      refundsCount += 1;
      refundsCents += s.totalCents;
    } else {
      salesCount += 1;
      if (s.cfdiStatus === "PENDING") cfdiPending += 1;
    }
  }

  return {
    sales: {
      count: salesCount,
      refundsCount,
      refundsCents,
      totalCents,
      netCents,
      ivaCents,
      gatewayFeesCents,
      byKind,
    },
    cfdiPending,
    expenses: {
      count: expenses.length,
      totalCents: expenses.reduce((a, e) => a + e.amountMxnCents, 0),
      ivaCents: expenses.reduce((a, e) => a + e.ivaCents, 0),
    },
  };
}
