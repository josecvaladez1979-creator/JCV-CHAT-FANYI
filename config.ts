import "dotenv/config";
import crypto from "node:crypto";

// ========================================================
// CONFIGURACIÓN CENTRAL
// Ningún secreto está escrito en el código. En producción el
// servidor se niega a arrancar si falta un secreto o es débil.
// ========================================================

export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PRODUCTION = NODE_ENV === "production";
export const PORT = Number(process.env.PORT || 3000);
export const COMMIT_SHA = process.env.RENDER_GIT_COMMIT || "";

function readSecret(name: string): string {
  const value = process.env[name]?.trim();

  if (IS_PRODUCTION) {
    if (!value || value.length < 32) {
      throw new Error(
        `Configuración insegura: ${name} debe existir y tener al menos 32 caracteres.`
      );
    }
    return value;
  }

  if (value && value.length >= 32) {
    return value;
  }

  console.warn(
    `[config] ${name} no está definido. Se usa un secreto aleatorio temporal (solo desarrollo).`
  );
  return crypto.randomBytes(32).toString("hex");
}

export const ACCESS_SECRET = readSecret("JWT_ACCESS_SECRET");
export const REFRESH_SECRET = readSecret("JWT_REFRESH_SECRET");

if (IS_PRODUCTION && ACCESS_SECRET === REFRESH_SECRET) {
  throw new Error(
    "Configuración insegura: JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser distintos."
  );
}

function splitList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

const configuredOrigins = [
  ...splitList(process.env.CORS_ORIGINS),
  ...splitList(process.env.CLIENT_ORIGIN),
];

// En desarrollo se permiten los puertos locales habituales.
// En producción solo el mismo origen y los orígenes declarados.
export const ALLOWED_ORIGINS: string[] =
  configuredOrigins.length > 0 || IS_PRODUCTION
    ? configuredOrigins
    : ["http://localhost:5173", "http://localhost:3000"];

// Un valor cuenta como configurado si no está vacío y no es un marcador.
export function isConfigured(value: string | undefined): boolean {
  const v = value?.trim();
  if (!v) return false;
  if (v.includes("...")) return false;
  if (/^(tu-|cambia|changeme|your-)/i.test(v)) return false;
  return true;
}

function positiveInt(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// La traducción de pago está APAGADA por defecto. Para activarla
// el propietario define FEATURE_TRANSLATION=on y la tarifa.
export const FEATURE_TRANSLATION = process.env.FEATURE_TRANSLATION === "on";

// Tarifa decidida por el propietario, en centavos de MXN por cada
// bloque de 1.000 caracteres. No hay valor por defecto a propósito.
export const TRANSLATION_PRICE_CENTS_PER_1K = positiveInt(
  process.env.TRANSLATION_PRICE_CENTS_PER_1K_CHARS
);

export const SILICONFLOW_BASE_URL = (
  process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1"
).replace(/\/+$/, "");
