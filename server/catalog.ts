// ========================================================
// CATÁLOGO COMERCIAL — ÚNICA FUENTE DE VERDAD
// Todos los importes se guardan en CENTAVOS de MXN (enteros).
// priceMXN solo existe para mostrar al usuario.
// ========================================================

export const CURRENCY = "MXN" as const;

// El checkout real (sesión de pago + webhook) aún no existe.
// Mientras sea false, ningún plan ni recarga se presenta como comprable.
export const CHECKOUT_ENABLED = false;

// -------------------- Planes empresariales --------------------

export type B2BTierId = "BASIC" | "PROFESSIONAL" | "CORPORATE";

export type B2BTier = {
  id: B2BTierId;
  name: string;
  priceCents: number;
  priceMXN: number;
  durationDays: number;
  seats: number;
};

function tier(
  id: B2BTierId,
  name: string,
  priceMXN: number,
  seats: number
): B2BTier {
  return {
    id,
    name,
    priceCents: priceMXN * 100,
    priceMXN,
    durationDays: 30,
    seats,
  };
}

export const B2B_TIERS: Record<B2BTierId, B2BTier> = {
  BASIC: tier("BASIC", "Empresa Básica", 599, 5),
  PROFESSIONAL: tier("PROFESSIONAL", "Empresa Profesional", 999, 10),
  CORPORATE: tier("CORPORATE", "Empresa Corporativa", 2099, 25),
};

export function getB2BTier(value: unknown): B2BTier | null {
  if (typeof value !== "string") return null;
  return Object.prototype.hasOwnProperty.call(B2B_TIERS, value)
    ? B2B_TIERS[value as B2BTierId]
    : null;
}

// -------------------- Recargas de saldo --------------------
// Se asume 1 MXN pagado = 1 MXN de saldo. Cada paquete tiene vigencia:
// lo que no se consuma al vencer se pierde (ver wallet-rules.ts).

export type TopupPack = {
  id: string;
  priceCents: number;
  creditCents: number;
  priceMXN: number;
  creditMXN: number;
  validityDays: number;
};

function topup(mxn: number, validityDays: number): TopupPack {
  return {
    id: `TOPUP_${mxn}`,
    priceCents: mxn * 100,
    creditCents: mxn * 100,
    priceMXN: mxn,
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
// PROPUESTA pendiente de tu aprobación. El chat de texto en el mismo idioma
// es gratis y no aparece aquí. Hoy solo la traducción de texto está conectada;
// el resto queda definido para cuando existan audio, llamadas y video.

export const TARIFFS = {
  textTranslatedCentsPer1kChars: 100,
  audioSameLanguageCentsPerMin: 50,
  audioTranslatedCentsPerMin: 200,
  callSameLanguageCentsPerMin: 100,
  callTranslatedCentsPerMin: 600,
  videoSameLanguageCentsPerMin: 200,
  videoTranslatedCentsPerMin: 800,
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

// -------------------- Datos fiscales --------------------
// IVA en México es 16%. Se guarda como porcentaje, no como decimal.
// TAXPAYER_REGISTERED = false porque todavía no hay facturación real.
// No lo pongas en true hasta que tu contador te diga que ya estás dado de alta.

export const IVA_RATE_PERCENT = 16;

export const TAXPAYER_REGISTERED = false;
