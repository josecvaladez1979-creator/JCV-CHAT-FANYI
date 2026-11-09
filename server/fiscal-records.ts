import { CfdiStatus, Prisma, SaleKind } from "@prisma/client";
import { IVA_RATE_PERCENT, TAXPAYER_REGISTERED } from "./catalog";
import { prisma } from "./db";
import { monthRange, splitPaidAmount } from "./fiscal-rules";

// ========================================================
// REGISTROS FISCALES (ventas y gastos) PARA TU CONTADOR
// No borra nada ni calcula impuestos. Las correcciones se hacen
// con nuevos registros (por ejemplo, un reembolso negativo).
// ========================================================

type Db = Prisma.TransactionClient;

// Registra una venta COBRADA. Se llama dentro de la misma transacción que
// acredita el saldo, para que nunca exista una sin la otra.
export async function recordSaleTx(
  tx: Db,
  input: {
    kind: SaleKind;
    provider: string;
    providerRef: string;
    totalCents: number;
    userId?: string;
    orgId?: string;
    customerName?: string;
    customerEmail?: string;
    customerRfc?: string;
    paymentMethod?: string;
    paidAt?: Date;
    metadata?: Prisma.InputJsonValue;
  }
): Promise<{ id: string }> {
  const { netCents, ivaCents } = splitPaidAmount(
    input.totalCents,
    TAXPAYER_REGISTERED,
    IVA_RATE_PERCENT
  );

  return tx.saleRecord.create({
    data: {
      kind: input.kind,
      provider: input.provider,
      providerRef: input.providerRef,
      userId: input.userId,
      orgId: input.orgId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerRfc: input.customerRfc,
      currency: "MXN",
      netCents,
      ivaCents,
      totalCents: input.totalCents,
      taxpayerRegistered: TAXPAYER_REGISTERED,
      paymentMethod: input.paymentMethod,
      paidAt: input.paidAt ?? new Date(),
      // Antes de registrarte en el SAT no hay factura que emitir.
      cfdiStatus: TAXPAYER_REGISTERED
        ? CfdiStatus.PENDING
        : CfdiStatus.NOT_APPLICABLE,
      metadata: input.metadata,
    },
    select: { id: true },
  });
}

export async function listSales(month: string) {
  const { start, end } = monthRange(month);
  return prisma.saleRecord.findMany({
    where: { paidAt: { gte: start, lt: end } },
    orderBy: { paidAt: "asc" },
  });
}

export async function listExpenses(month: string) {
  const { start, end } = monthRange(month);
  return prisma.expenseRecord.findMany({
    where: { spentAt: { gte: start, lt: end } },
    orderBy: { spentAt: "asc" },
  });
      }
