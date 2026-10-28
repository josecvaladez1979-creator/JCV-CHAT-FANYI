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
// Se asume 1 MXN pagado = 1 MXN de saldo. Si quieres bonificaciones,
// se cambia creditCents aquí y en ningún otro sitio.

export type TopupPack = {
  id: string;
  priceCents: number;
  creditCents: number;
  priceMXN: number;
  creditMXN: number;
};

function topup(mxn: number): TopupPack {
  return {
    id: `TOPUP_${mxn}`,
    priceCents: mxn * 100,
    creditCents: mxn * 100,
    priceMXN: mxn,
    creditMXN: mxn,
  };
}

export const WALLET_TOPUPS: Record<string, TopupPack> = {
  TOPUP_100: topup(100),
  TOPUP_200: topup(200),
  TOPUP_500: topup(500),
  TOPUP_1000: topup(1000),
};

export function getTopup(value: unknown): TopupPack | null {
  if (typeof value !== "string") return null;
  return Object.prototype.hasOwnProperty.call(WALLET_TOPUPS, value)
    ? WALLET_TOPUPS[value]
    : null;
  }

// --- ROUTER PARA server.ts ---
import type { FastifyInstance } from "fastify";

export const catalogRouter = async (app: FastifyInstance) => {
  app.get("/catalog", async () => {
    return {
      currency: CURRENCY,
      checkoutEnabled: CHECKOUT_ENABLED,
      tiers: B2B_TIERS,
      topups: WALLET_TOPUPS,
    };
  });
};
