// ========================================================
// CATÁLOGO COMERCIAL — ÚNICA FUENTE DE VERDAD
// Todos los importes se guardan en CENTAVOS de MXN (enteros).
// priceMXN solo existe para mostrar al usuario.
// ========================================================

export const CURRENCY = "MXN" as const;

// El checkout real (sesión de pago + webhook) aún no existe.
// Mientras sea false, ningún plan ni recarga se presenta como comprable.
export const CHECKOUT_ENABLED = false;

// -------------------- IVA --------------------
// Hoy NO estás registrado en el SAT, así que no puedes cobrar IVA ni emitir
// facturas (CFDI): mientras este interruptor sea false, los precios son finales
// y no se calcula ningún IVA. Cuando te registres y tu contador lo confirme,
// cámbialo a true. Entonces aplica (pendiente de confirmar con tu contador):
//  - Recargas de saldo (consumidores): el precio YA incluye IVA.
//  - Planes empresariales: el precio NO incluye IVA; se suma al cobrar.
export const TAXPAYER_REGISTERED = false;

export const IVA_RATE_PERCENT = 16;

// A partir de un total con IVA incluido, separa neto e IVA.
export function splitIncludedTax(totalCents: number): {
  netCents: number;
  ivaCents: number;
} {
  const netCents = Math.round((totalCents * 100) / (100 + IVA_RATE_PERCENT));
  return { netCents, ivaCents: totalCents - netCents };
}

// A partir de un neto sin IVA, suma el IVA.
export function addTax(netCents: number): {
  netCents: number;
  ivaCents: number;
  totalCents: number;
} {
  const ivaCents = Math.round((netCents * IVA_RATE_PERCENT) / 100);
  return { netCents, ivaCents, totalCents: netCents + ivaCents };
}

// -------------------- Planes empresariales --------------------
// Precio SIN IVA. Incluyen asientos, panel y $100 de saldo mensual de IA
// por asiento (valor de lista), para que el costo de IA tenga tope.
// Precios por asiento ≈ $200, $180 y $160 MXN al mes, en línea con el mercado
// (Teams Premium ≈ $187, Google Workspace ≈ $269, Zoom ≈ $411, DeepL ≈ $537).
// Los precios anteriores eran 599 / 999 / 2099. El saldo incluido se asigna
// al contratar; aún no hay checkout.

export type B2BTierId = "BASIC" | "PROFESSIONAL" | "CORPORATE";

export type B2BTier = {
  id: B2BTierId;
  name: string;
  priceCents: number; // sin IVA
  priceMXN: number; // sin IVA
  priceIncludesTax: false;
  ivaCents: number;
  totalCents: number; // con IVA
  durationDays: number;
  seats: number;
  includedBalanceCents: number;
};

function tier(
  id: B2BTierId,
  name: string,
  priceMXN: number,
  seats: number,
  includedBalanceMXN: number
): B2BTier {
  const { ivaCents, totalCents } = TAXPAYER_REGISTERED
    ? addTax(priceMXN * 100)
    : { ivaCents: 0, totalCents: priceMXN * 100 };

  return {
    id,
    name,
    priceCents: priceMXN * 100,
    priceMXN,
    priceIncludesTax: false,
    ivaCents,
    totalCents,
    durationDays: 30,
    seats,
    includedBalanceCents: includedBalanceMXN * 100,
  };
}

export const B2B_TIERS: Record<B2BTierId, B2BTier> = {
  BASIC: tier("BASIC", "Empresa Básica", 999, 5, 500),
  PROFESSIONAL: tier("PROFESSIONAL", "Empresa Profesional", 1799, 10, 1000),
  CORPORATE: tier("CORPORATE", "Empresa Corporativa", 3999, 25, 2500),
};

export function getB2BTier(value: unknown): B2BTier | null {
  if (typeof value !== "string") return null;
  return Object.prototype.hasOwnProperty.call(B2B_TIERS, value)
    ? B2B_TIERS[value as B2BTierId]
    : null;
}

// -------------------- Recargas de saldo --------------------
// Con TAXPAYER_REGISTERED = true el precio incluye IVA; con false es el precio final.
// Se asume 1 MXN pagado = 1 MXN de saldo.
// Cada paquete tiene vigencia: lo que no se consuma al vencer se pierde
// (ver wallet-rules.ts).

export type TopupPack = {
  id: string;
  priceCents: number; // precio final que paga el cliente
  priceMXN: number;
  priceIncludesTax: boolean;
  netCents: number;
  ivaCents: number;
  creditCents: number;
  creditMXN: number;
  validityDays: number;
};

function topup(mxn: number, validityDays: number): TopupPack {
  const priceCents = mxn * 100;
  const { netCents, ivaCents } = TAXPAYER_REGISTERED
    ? splitIncludedTax(priceCents)
    : { netCents: priceCents, ivaCents: 0 };

  return {
    id: `TOPUP_${mxn}`,
    priceCents,
    priceMXN: mxn,
    priceIncludesTax: TAXPAYER_REGISTERED,
    netCents,
    ivaCents,
    creditCents: priceCents,
    creditMXN: mxn,
    validityDays,
  };
}

export const WALLET_TOPUPS: Record<string, TopupPack> = {
  TOPUP_100: topup(100, 7), // 1 semana
  TOPUP_200: topup(200, 15), // 15 días
  TOPUP_500: topup(500, 30), // 1 mes
  TOPUP_1000: topup(1000, 60), // 2 meses
};

export function getTopup(value: unknown): TopupPack | null {
  if (typeof value !== "string") return null;
  return Object.prototype.hasOwnProperty.call(WALLET_TOPUPS, value)
    ? WALLET_TOPUPS[value]
    : null;
}

// Texto que la interfaz DEBE mostrar antes de pagar. La redacción final
// debe revisarla un abogado (normativa de consumo).
export const EXPIRY_NOTICE =
  "El saldo que no consumas antes de su vencimiento se pierde. Si recargas antes de que venza, el saldo que te quede se suma a tu nueva recarga y tu vigencia será la mayor entre la actual y la del nuevo paquete.";

export function packNotice(pack: TopupPack): string {
  return `Este paquete vence a los ${pack.validityDays} días de la compra. ${EXPIRY_NOTICE}`;
}

// -------------------- Tarifas de uso (centavos de MXN) --------------------
// Se descuentan del saldo (cuyo IVA ya se pagó al recargar).
// El chat de texto en el mismo idioma es gratis y no aparece aquí.
// Hoy solo la traducción de texto está conectada; el resto queda definido
// para cuando existan audio, llamadas y video.
//
// Referencia de costo de IA estimado (MXN): texto 0.004 por 1.000 caracteres,
// audio traducido 0.43/min, llamada traducida 1.37/min, video traducido 1.40/min.
// Hay que volver a medirlos con uso real cuando esas funciones existan.

export const TARIFFS = {
  textTranslatedCentsPer1kChars: 100,
  audioSameLanguageCentsPerMin: 50,
  audioTranslatedCentsPerMin: 250,
  callSameLanguageCentsPerMin: 100,
  callTranslatedCentsPerMin: 700,
  videoSameLanguageCentsPerMin: 200,
  videoTranslatedCentsPerMin: 900,
} as const;

// -------------------- Traducción de contratos --------------------
// Aún no existe la subida ni la extracción de texto; solo se define el
// esquema de cobro. Los tramos se miden en caracteres, no en páginas.

export const CONTRACT_TRANSLATION_ENABLED = false;

export const CONTRACT_TIERS = [
  { id: "CONTRACT_S", label: "1 a 2 páginas", maxChars: 6000, priceCents: 7900 },
  { id: "CONTRACT_M", label: "3 a 5 páginas", maxChars: 15000, priceCents: 14900 },
  { id: "CONTRACT_L", label: "6 a 10 páginas", maxChars: 30000, priceCents: 24900 },
] as const;

export function contractTierFor(chars: number) {
  if (!Number.isSafeInteger(chars) || chars <= 0) return null;
  return CONTRACT_TIERS.find((t) => chars <= t.maxChars) ?? null;
                              }
