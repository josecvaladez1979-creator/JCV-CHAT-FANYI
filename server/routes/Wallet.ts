import crypto from "node:crypto";
import { CreditTxType, Prisma, UsageFeature } from "@prisma/client";
import { prisma } from "./db";

// ========================================================
// SALDO Y LIBRO DE MOVIMIENTOS
// Reglas: el saldo nunca queda negativo, cada movimiento deja una
// fila en CreditTransaction, y una misma operación externa
// (provider + providerRef) no puede acreditarse dos veces.
// Todos los importes son enteros en centavos de MXN.
// ========================================================

type Db = Prisma.TransactionClient;

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

async function ensureWallet(tx: Db, userId: string) {
  return tx.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function getWalletBalanceCents(userId: string): Promise<number> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { balanceCents: true },
  });
  return wallet?.balanceCents ?? 0;
}

export type CreditResult = {
  duplicate: boolean;
  balanceCents: number | null;
  transactionId: string | null;
};

// Abona saldo. Es idempotente: repetir el mismo (provider, providerRef)
// devuelve duplicate = true y NO cambia el saldo.
export async function creditWallet(input: {
  userId: string;
  amountCents: number;
  type: "TOPUP" | "REFUND" | "ADJUSTMENT";
  provider: string;
  providerRef: string;
  feature?: UsageFeature;
  metadata?: Prisma.InputJsonValue;
}): Promise<CreditResult> {
  assertPositiveCents(input.amountCents);

  try {
    return await prisma.$transaction(async (tx) => {
      const wallet = await ensureWallet(tx, input.userId);

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: { increment: input.amountCents } },
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

// Descuenta saldo de forma atómica. Si no alcanza, lanza
// InsufficientFundsError y no se modifica nada.
export async function debitWallet(input: {
  userId: string;
  amountCents: number;
  feature: UsageFeature;
  metadata?: Prisma.InputJsonValue;
}): Promise<{ transactionId: string; balanceCents: number }> {
  assertPositiveCents(input.amountCents);

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(tx, input.userId);

    // La condición gte hace que dos descuentos simultáneos nunca
    // puedan dejar el saldo por debajo de cero.
    const result = await tx.wallet.updateMany({
      where: { id: wallet.id, balanceCents: { gte: input.amountCents } },
      data: { balanceCents: { decrement: input.amountCents } },
    });

    if (result.count !== 1) {
      throw new InsufficientFundsError();
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

    return { transactionId: row.id, balanceCents: after.balanceCents };
  });
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
