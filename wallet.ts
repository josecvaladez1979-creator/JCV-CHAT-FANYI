import crypto from "node:crypto";
import { CreditTxType, Prisma, UsageFeature } from "@prisma/client";
import { prisma } from "./db";
import { isExpired, nextExpiry } from "./wallet-rules";

// ========================================================
// SALDO CON VIGENCIA Y LIBRO DE MOVIMIENTOS
// Reglas:
//  - El saldo nunca queda negativo.
//  - Cada movimiento deja una fila en CreditTransaction.
//  - Una misma operación externa (provider + providerRef) no se acredita dos veces.
//  - Si el saldo vence, lo no consumido se pierde y queda registrado (EXPIRY).
//  - Si recarga antes de vencer, el saldo restante se suma al paquete nuevo.
// Todos los importes son enteros en centavos de MXN.
// ========================================================

type Db = Prisma.TransactionClient;

type WalletRow = { id: string; balanceCents: number; expiresAt: Date | null };

const walletSelect = { id: true, balanceCents: true, expiresAt: true } as const;

export class InsufficientFundsError extends Error {
  constructor() {
    super("Saldo insuficiente.");
    this.name = "InsufficientFundsError";
  }
}

function assertPositiveCents(amountCents: number): void {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new RangeError("El importe debe ser un entero positivo en centavos.");
  }
}

function isDuplicateRef(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    JSON.stringify(error.meta?.target ?? "").includes("providerRef")
  );
}

// Obtiene (o crea) la cartera y, si el saldo ya venció, lo pone en cero
// dejando constancia en el libro. Usa una actualización condicional para que
// dos solicitudes simultáneas no registren el vencimiento dos veces.
async function loadFreshWallet(
  tx: Db,
  userId: string,
  now: Date
): Promise<WalletRow> {
  let wallet: WalletRow = await tx.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: walletSelect,
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const expiredAt = wallet.expiresAt;

    if (!expiredAt || !isExpired(expiredAt, now)) {
      return wallet;
    }

    const swapped = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        expiresAt: expiredAt,
        balanceCents: wallet.balanceCents,
      },
      data: { balanceCents: 0, expiresAt: null },
    });

    if (swapped.count === 1) {
      if (wallet.balanceCents > 0) {
        await tx.creditTransaction.create({
          data: {
            walletId: wallet.id,
            type: CreditTxType.EXPIRY,
            amountCents: -wallet.balanceCents,
            balanceAfterCents: 0,
            provider: "INTERNAL",
            providerRef: `expiry:${wallet.id}:${expiredAt.getTime()}`,
            metadata: { expiredAt: expiredAt.toISOString() },
          },
        });
      }
      return { id: wallet.id, balanceCents: 0, expiresAt: null };
    }

    wallet = await tx.wallet.findUniqueOrThrow({
      where: { id: wallet.id },
      select: walletSelect,
    });
  }

  throw new Error("No se pudo actualizar el saldo vencido. Inténtalo de nuevo.");
}

// Saldo que el usuario puede usar HOY (un saldo vencido cuenta como cero
// aunque todavía no se haya registrado el vencimiento en el libro).
export async function getWalletState(userId: string): Promise<{
  balanceCents: number;
  expiresAt: Date | null;
  expired: boolean;
}> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { balanceCents: true, expiresAt: true },
  });

  if (!wallet) {
    return { balanceCents: 0, expiresAt: null, expired: false };
  }

  const expired = isExpired(wallet.expiresAt, new Date());

  return {
    balanceCents: expired ? 0 : wallet.balanceCents,
    expiresAt: expired ? null : wallet.expiresAt,
    expired,
  };
}

export type CreditResult = {
  duplicate: boolean;
  balanceCents: number | null;
  transactionId: string | null;
};

// Abona saldo. Es idempotente: repetir el mismo (provider, providerRef)
// devuelve duplicate = true y NO cambia el saldo.
// - TOPUP exige validityDays y aplica la regla de vigencia.
// - REFUND conserva la vigencia actual (si no hay, da 1 día).
// - ADJUSTMENT solo puede dejar la cuenta sin vigencia si se indica validityDays.
export async function creditWallet(input: {
  userId: string;
  amountCents: number;
  type: "TOPUP" | "REFUND" | "ADJUSTMENT";
  provider: string;
  providerRef: string;
  validityDays?: number;
  feature?: UsageFeature;
  metadata?: Prisma.InputJsonValue;
}): Promise<CreditResult> {
  assertPositiveCents(input.amountCents);

  const validityDays =
    input.validityDays ?? (input.type === "REFUND" ? 1 : undefined);

  if (
    input.type === "TOPUP" &&
    (validityDays === undefined ||
      !Number.isInteger(validityDays) ||
      validityDays <= 0)
  ) {
    throw new RangeError("Una recarga requiere vigencia en días.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const now = new Date();
      const wallet = await loadFreshWallet(tx, input.userId, now);

      let expiresAt = wallet.expiresAt;

      if (input.type === "TOPUP") {
        expiresAt = nextExpiry(wallet.expiresAt, now, validityDays!);
      } else if (expiresAt === null) {
        if (validityDays === undefined) {
          throw new RangeError(
            "El abono requiere una vigencia porque la cuenta no tiene saldo vigente."
          );
        }
        expiresAt = nextExpiry(null, now, validityDays);
      }

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balanceCents: { increment: input.amountCents },
          expiresAt,
        },
        select: { balanceCents: true },
      });

      const row = await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          type: CreditTxType[input.type],
          amountCents: input.amountCents,
          balanceAfterCents: updated.balanceCents,
          provider: input.provider,
          providerRef: input.providerRef,
          feature: input.feature,
          metadata: input.metadata,
        },
        select: { id: true },
      });

      return {
        duplicate: false,
        balanceCents: updated.balanceCents,
        transactionId: row.id,
      };
    });
  } catch (error) {
    if (isDuplicateRef(error)) {
      return { duplicate: true, balanceCents: null, transactionId: null };
    }
    throw error;
  }
}

// Registra una recarga comprada. Lo llamará el webhook de pago verificado.
export async function applyTopupPurchase(input: {
  userId: string;
  packId: string;
  creditCents: number;
  validityDays: number;
  provider: string;
  providerRef: string;
}): Promise<CreditResult> {
  return creditWallet({
    userId: input.userId,
    amountCents: input.creditCents,
    type: "TOPUP",
    provider: input.provider,
    providerRef: input.providerRef,
    validityDays: input.validityDays,
    metadata: { packId: input.packId },
  });
}

type DebitOutcome =
  | { ok: true; transactionId: string; balanceCents: number }
  | { ok: false };

// Descuenta saldo de forma atómica. Si no alcanza (o el saldo venció),
// lanza InsufficientFundsError. El vencimiento ya aplicado se conserva.
export async function debitWallet(input: {
  userId: string;
  amountCents: number;
  feature: UsageFeature;
  metadata?: Prisma.InputJsonValue;
}): Promise<{ transactionId: string; balanceCents: number }> {
  assertPositiveCents(input.amountCents);

  const outcome = await prisma.$transaction(async (tx): Promise<DebitOutcome> => {
    const wallet = await loadFreshWallet(tx, input.userId, new Date());

    // La condición gte hace que dos descuentos simultáneos nunca
    // puedan dejar el saldo por debajo de cero.
    const result = await tx.wallet.updateMany({
      where: { id: wallet.id, balanceCents: { gte: input.amountCents } },
      data: { balanceCents: { decrement: input.amountCents } },
    });

    if (result.count !== 1) {
      return { ok: false };
    }

    const after = await tx.wallet.findUniqueOrThrow({
      where: { id: wallet.id },
      select: { balanceCents: true },
    });

    const row = await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        type: CreditTxType.USAGE,
        amountCents: -input.amountCents,
        balanceAfterCents: after.balanceCents,
        provider: "INTERNAL",
        providerRef: `usage:${crypto.randomUUID()}`,
        feature: input.feature,
        metadata: input.metadata,
      },
      select: { id: true },
    });

    return { ok: true, transactionId: row.id, balanceCents: after.balanceCents };
  });

  if (!outcome.ok) {
    throw new InsufficientFundsError();
  }

  return {
    transactionId: outcome.transactionId,
    balanceCents: outcome.balanceCents,
  };
}

// Devuelve un cargo anterior (por ejemplo, si el proveedor de IA falló).
// Es idempotente: un mismo cargo solo se reembolsa una vez.
export async function refundUsage(transactionId: string): Promise<CreditResult> {
  const original = await prisma.creditTransaction.findUnique({
    where: { id: transactionId },
    include: { wallet: { select: { userId: true } } },
  });

  if (
    !original ||
    original.type !== CreditTxType.USAGE ||
    original.amountCents >= 0 ||
    !original.wallet.userId
  ) {
    return { duplicate: false, balanceCents: null, transactionId: null };
  }

  return creditWallet({
    userId: original.wallet.userId,
    amountCents: -original.amountCents,
    type: "REFUND",
    provider: "INTERNAL",
    providerRef: `refund:${transactionId}`,
    feature: original.feature ?? undefined,
    metadata: { refundOf: transactionId },
  });
}
