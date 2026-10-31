// ========================================================
// REGLAS PURAS DEL SALDO (sin base de datos, fáciles de probar)
// ========================================================

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Un saldo vence en el instante exacto de su fecha de vencimiento.
export function isExpired(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

// Nueva fecha de vencimiento al recargar:
// - Si el saldo anterior ya venció, empieza de cero con la vigencia del paquete.
// - Si sigue vigente, se queda con la MAYOR entre la fecha actual y la del paquete
//   (comprar un paquete corto nunca acorta un saldo con más vigencia).
export function nextExpiry(
  current: Date | null,
  now: Date,
  validityDays: number
): Date {
  if (!Number.isInteger(validityDays) || validityDays <= 0) {
    throw new RangeError("La vigencia debe ser un número entero de días.");
  }

  const fromPack = new Date(now.getTime() + validityDays * MS_PER_DAY);

  if (
    current !== null &&
    current.getTime() > now.getTime() &&
    current.getTime() > fromPack.getTime()
  ) {
    return current;
  }

  return fromPack;
}

// Costo proporcional por caracteres, en centavos enteros.
// Mínimo 1 centavo. Aritmética entera para no depender de decimales.
export function textCostCents(chars: number, centsPer1kChars: number): number {
  if (!Number.isSafeInteger(chars) || chars <= 0) {
    throw new RangeError("La cantidad de caracteres debe ser un entero positivo.");
  }
  if (!Number.isSafeInteger(centsPer1kChars) || centsPer1kChars <= 0) {
    throw new RangeError("La tarifa debe ser un entero positivo en centavos.");
  }

  const numerator = chars * centsPer1kChars;
  return Math.max(1, Math.floor((numerator + 999) / 1000));
}
