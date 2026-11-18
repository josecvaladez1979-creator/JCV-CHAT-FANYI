import { TARIFFS } from "./catalog";
import { prisma } from "./db";
import { creditWallet } from "./wallet";

// ========================================================
// SALDO DE BIENVENIDA (prueba gratuita limitada)
// Apagado por defecto. Se enciende desde Render con variables de entorno:
//   WELCOME_CREDIT_MXN        pesos de bienvenida (0 o vacío = apagado, máximo 200)
//   WELCOME_CREDIT_DAYS       vigencia en días (1 a 30, por defecto 7)
//   WELCOME_CREDIT_DAILY_CAP  máximo de bienvenidas por día (1 a 5000, por defecto 200)
// Una sola vez por cuenta, vence solo, queda en el libro de movimientos y
// NO cuenta como venta (no es dinero cobrado).
// ========================================================

export const MAX_WELCOME_MXN = 200;

type Env = Record<string, string | undefined>;

export type WelcomeConfig = { cents: number; days: number; dailyCap: number };

function intInRange(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export function welcomeConfig(env: Env = process.env): WelcomeConfig | null {
  const raw = env.WELCOME_CREDIT_MXN?.trim();
  if (!raw) return null;

  const mxn = Number(raw);
  if (!Number.isFinite(mxn) || mxn <= 0 || mxn > MAX_WELCOME_MXN) return null;

  return {
    cents: Math.round(mxn * 100),
    days: intInRange(env.WELCOME_CREDIT_DAYS, 7, 1, 30),
    dailyCap: intInRange(env.WELCOME_CREDIT_DAILY_CAP, 200, 1, 5000),
  };
}

// Lo que se anuncia al público: pesos, días y su equivalente en caracteres.
export function welcomeOffer(env: Env = process.env) {
  const config = welcomeConfig(env);
  if (!config) return null;

  return {
    mxn: config.cents / 100,
    days: config.days,
    chars: Math.floor((config.cents * 1000) / TARIFFS.textTranslatedCentsPer1kChars),
  };
}

// Medianoche de hoy en hora de México (UTC-6), como instante UTC.
function startOfMexicoDay(now: Date): Date {
  const mx = new Date(now.getTime() - 6 * 3600_000);
  return new Date(Date.UTC(mx.getUTCFullYear(), mx.getUTCMonth(), mx.getUTCDate(), 6));
}

export type WelcomeResult = "granted" | "disabled" | "already" | "cap_reached";

export async function grantWelcomeCredit(
  userId: string,
  now: Date = new Date(),
  env: Env = process.env
): Promise<WelcomeResult> {
  const config = welcomeConfig(env);
  if (!config) return "disabled";

  const grantedToday = await prisma.creditTransaction.count({
    where: { provider: "PROMO", createdAt: { gte: startOfMexicoDay(now) } },
  });
  if (grantedToday >= config.dailyCap) return "cap_reached";

  const result = await creditWallet({
    userId,
    amountCents: config.cents,
    type: "ADJUSTMENT",
    provider: "PROMO",
    providerRef: `welcome:${userId}`, // una sola vez por cuenta
    validityDays: config.days,
    metadata: { kind: "welcome" },
  });

  return result.duplicate ? "already" : "granted";
}
