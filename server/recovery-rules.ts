import crypto from "node:crypto";

// ========================================================
// RECUPERACIÓN DE CUENTA — reglas puras (sin base de datos)
// El enlace lo genera el administrador y se lo entrega al usuario por su correo
// registrado. Sirve UNA vez y vence en 1 hora. En la base solo se guarda el
// resumen (hash) del enlace: si alguien viera la base, no podría usarlo.
// ========================================================

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const MIN_PASSWORD_CHARS = 12;
export const MAX_PASSWORD_BYTES = 72; // límite real de bcrypt

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex"); // 64 caracteres, 256 bits
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isWellFormedToken(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export type ResetState = "valid" | "used" | "expired";

export function resetState(
  row: { expiresAt: Date; usedAt: Date | null },
  now: Date
): ResetState {
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export function buildResetLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/?reset=${token}`;
}

export function validateNewPassword(
  value: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: "Escribe tu nueva contraseña." };
  }
  if (value.length < MIN_PASSWORD_CHARS) {
    return { ok: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD_CHARS} caracteres.` };
  }
  if (Buffer.byteLength(value, "utf8") > MAX_PASSWORD_BYTES) {
    return { ok: false, error: `La contraseña es demasiado larga (máximo ${MAX_PASSWORD_BYTES} bytes).` };
  }
  return { ok: true, value };
}
