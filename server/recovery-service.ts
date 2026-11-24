import bcrypt from "bcryptjs";
import { prisma } from "./db";
import {
  RESET_TOKEN_TTL_MS,
  buildResetLink,
  generateResetToken,
  hashResetToken,
  isWellFormedToken,
  resetState,
} from "./recovery-rules";

const BCRYPT_COST = 12; // el mismo que usa el registro

export type RecoveryLinkResult =
  | { ok: true; link: string; expiresAt: Date; email: string; name: string }
  | { ok: false; error: "not_found" };

// Lo usa el administrador. Una cuenta solo puede tener UN enlace vigente:
// al generar uno nuevo, los anteriores dejan de servir.
export async function createRecoveryLink(params: {
  email: string;
  adminId: string;
  baseUrl: string;
  now?: Date;
}): Promise<RecoveryLinkResult> {
  const now = params.now ?? new Date();

  const user = await prisma.user.findUnique({
    where: { email: params.email },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { ok: false, error: "not_found" };

  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: now },
  });

  const token = generateResetToken();
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt,
      createdById: params.adminId,
    },
  });

  return {
    ok: true,
    link: buildResetLink(params.baseUrl, token),
    expiresAt,
    email: user.email,
    name: user.name,
  };
}

export type ResetOutcome = "ok" | "invalid";

// Lo usa la persona con el enlace. Cualquier fallo responde igual ("invalid"):
// no se revela si el enlace existió, venció o ya se usó.
export async function resetPasswordWithToken(
  token: unknown,
  newPassword: string,
  now: Date = new Date()
): Promise<ResetOutcome> {
  if (!isWellFormedToken(token)) return "invalid";

  const row = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!row || resetState(row, now) !== "valid") return "invalid";

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  return prisma.$transaction(async (tx) => {
    // Se "reclama" el enlace de forma atómica: si dos intentos llegan a la vez,
    // solo uno puede usarlo.
    const claimed = await tx.passwordReset.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return "invalid" as const;

    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });

    // Se cierran todas las sesiones abiertas de esa cuenta.
    await tx.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: now },
    });

    // Y cualquier otro enlace pendiente deja de servir.
    await tx.passwordReset.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: now },
    });

    return "ok" as const;
  });
}
