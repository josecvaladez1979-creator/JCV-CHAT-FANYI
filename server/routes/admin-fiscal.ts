import { Router, type Request, type Response } from "express";
import { CfdiStatus, ExpenseCategory, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler } from "../http";
import { listExpenses, listSales } from "../fiscal-records";
import {
  centsToMxn,
  formatMexicoDateTime,
  isValidRfc,
  monthRange,
  summarizeMonth,
  toCsv,
} from "../fiscal-rules";
import { requireAdmin } from "../security";

// Control fiscal para tu contador. Solo administradores.
// Este módulo ordena datos; NO calcula ni declara impuestos.
export const adminFiscalRouter = Router();

adminFiscalRouter.use(requireAdmin);

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function readMonth(req: Request, res: Response): string | null {
  const month =
    typeof req.query.month === "string"
      ? req.query.month
      : formatMexicoDateTime(new Date()).slice(0, 7);
  try {
    monthRange(month);
    return month;
  } catch {
    res.status(400).json({ error: "El mes debe tener el formato AAAA-MM." });
    return null;
  }
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length > 0 && t.length <= max ? t : undefined;
}

function pesos(value: unknown, fallback?: number): number | undefined {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return undefined;
  return Math.round(n * 100);
}

adminFiscalRouter.get(
  "/fiscal/summary",
  asyncHandler(async (req, res) => {
    const month = readMonth(req, res);
    if (!month) return;

    const [sales, expenses] = await Promise.all([listSales(month), listExpenses(month)]);

    res.status(200).json({
      month,
      currency: "MXN",
      ...summarizeMonth(sales, expenses),
      note: "Datos de apoyo para tu contador. No son una declaración de impuestos.",
    });
  })
);

adminFiscalRouter.get(
  "/fiscal/sales",
  asyncHandler(async (req, res) => {
    const month = readMonth(req, res);
    if (!month) return;

    const sales = await listSales(month);

    if (req.query.format === "csv") {
      const rows: (string | number | boolean | null)[][] = [
        [
          "Fecha de cobro (México)", "Tipo", "Pasarela", "Referencia de pago",
          "Cliente", "RFC cliente", "Correo", "Subtotal sin IVA", "IVA",
          "Total cobrado", "Comisión pasarela", "Estado CFDI", "UUID CFDI",
          "Folio", "Fecha CFDI", "Factura global", "Método de pago",
          "Registrado en el SAT al vender",
        ],
        ...sales.map((s) => [
          formatMexicoDateTime(s.paidAt), s.kind, s.provider, s.providerRef,
          s.customerName ?? "", s.customerRfc ?? "", s.customerEmail ?? "",
          centsToMxn(s.netCents), centsToMxn(s.ivaCents), centsToMxn(s.totalCents),
          s.gatewayFeeCents === null ? "" : centsToMxn(s.gatewayFeeCents),
          s.cfdiStatus, s.cfdiUuid ?? "", s.cfdiFolio ?? "",
          s.cfdiIssuedAt ? formatMexicoDateTime(s.cfdiIssuedAt) : "",
          s.globalInvoiceRef ?? "", s.paymentMethod ?? "", s.taxpayerRegistered,
        ]),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="ventas-${month}.csv"`);
      res.status(200).send(toCsv(rows));
      return;
    }

    res.status(200).json({ month, sales });
  })
);

adminFiscalRouter.get(
  "/fiscal/expenses",
  asyncHandler(async (req, res) => {
    const month = readMonth(req, res);
    if (!month) return;

    const expenses = await listExpenses(month);

    if (req.query.format === "csv") {
      const rows: (string | number | boolean | null)[][] = [
        [
          "Fecha (México)", "Proveedor", "Concepto", "Categoría", "Moneda",
          "Importe original", "Tipo de cambio", "Importe MXN", "IVA", "Con CFDI",
          "UUID CFDI", "Nota",
        ],
        ...expenses.map((e) => [
          formatMexicoDateTime(e.spentAt), e.supplier, e.concept, e.category,
          e.currency, e.originalCents === null ? "" : centsToMxn(e.originalCents),
          e.fxRate ?? "", centsToMxn(e.amountMxnCents), centsToMxn(e.ivaCents),
          e.hasCfdi, e.cfdiUuid ?? "", e.receiptNote ?? "",
        ]),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="gastos-${month}.csv"`);
      res.status(200).send(toCsv(rows));
      return;
    }

    res.status(200).json({ month, expenses });
  })
);

adminFiscalRouter.post(
  "/fiscal/expenses",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const spentAt = new Date(String(body.spentAt));
    const supplier = text(body.supplier, 120);
    const concept = text(body.concept, 200);
    const category = Object.values(ExpenseCategory).includes(body.category)
      ? (body.category as ExpenseCategory)
      : undefined;
    const currency = /^[A-Z]{3}$/.test(String(body.currency ?? "MXN"))
      ? String(body.currency ?? "MXN")
      : undefined;
    const amountMxnCents = pesos(body.amountMxn);
    const ivaCents = pesos(body.ivaMxn, 0);
    const originalCents = pesos(body.originalAmount);
    const fxRate = body.fxRate === undefined || body.fxRate === "" ? undefined : Number(body.fxRate);
    const cfdiUuid = body.cfdiUuid ? String(body.cfdiUuid) : undefined;

    if (
      Number.isNaN(spentAt.getTime()) || !supplier || !concept || !category ||
      !currency || amountMxnCents === undefined || ivaCents === undefined ||
      (fxRate !== undefined && (!Number.isFinite(fxRate) || fxRate <= 0)) ||
      (cfdiUuid !== undefined && !UUID.test(cfdiUuid))
    ) {
      res.status(400).json({ error: "Revisa los datos del gasto." });
      return;
    }

    const expense = await prisma.expenseRecord.create({
      data: {
        spentAt, supplier, concept, category, currency,
        originalCents, fxRate, amountMxnCents, ivaCents,
        hasCfdi: body.hasCfdi === true,
        cfdiUuid,
        receiptNote: text(body.receiptNote, 300),
        createdBy: req.user!.id,
      },
    });

    res.status(201).json({ expense });
  })
);

// Completa los datos de una venta: factura (CFDI), RFC del cliente, comisión.
adminFiscalRouter.patch(
  "/fiscal/sales/:id",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const data: Prisma.SaleRecordUpdateInput = {};

    if (body.customerRfc !== undefined) {
      const rfc = String(body.customerRfc).trim().toUpperCase();
      if (!isValidRfc(rfc)) {
        res.status(400).json({ error: "El RFC no tiene un formato válido." });
        return;
      }
      data.customerRfc = rfc;
    }
    if (body.customerName !== undefined) data.customerName = text(body.customerName, 200);
    if (body.globalInvoiceRef !== undefined) data.globalInvoiceRef = text(body.globalInvoiceRef, 100);
    if (body.cfdiFolio !== undefined) data.cfdiFolio = text(body.cfdiFolio, 60);

    if (body.gatewayFeeMxn !== undefined) {
      const fee = pesos(body.gatewayFeeMxn);
      if (fee === undefined) {
        res.status(400).json({ error: "La comisión no es válida." });
        return;
      }
      data.gatewayFeeCents = fee;
    }

    if (body.cfdiStatus !== undefined) {
      if (!Object.values(CfdiStatus).includes(body.cfdiStatus)) {
        res.status(400).json({ error: "Estado de CFDI inválido." });
        return;
      }
      data.cfdiStatus = body.cfdiStatus as CfdiStatus;

      if (body.cfdiStatus === CfdiStatus.ISSUED) {
        if (!UUID.test(String(body.cfdiUuid ?? ""))) {
          res.status(400).json({ error: "Una factura emitida requiere su UUID." });
          return;
        }
        data.cfdiUuid = String(body.cfdiUuid);
        const issuedAt = body.cfdiIssuedAt ? new Date(String(body.cfdiIssuedAt)) : new Date();
        if (Number.isNaN(issuedAt.getTime())) {
          res.status(400).json({ error: "La fecha de la factura no es válida." });
          return;
        }
        data.cfdiIssuedAt = issuedAt;
      }
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No hay cambios que guardar." });
      return;
    }

    try {
      const sale = await prisma.saleRecord.update({ where: { id: req.params.id }, data });
      console.log(`[fiscal] ${req.user!.id} actualizó la venta ${sale.id}`);
      res.status(200).json({ sale });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          res.status(409).json({ error: "Ese UUID de factura ya está registrado." });
          return;
        }
        if (error.code === "P2025") {
          res.status(404).json({ error: "Venta no encontrada." });
          return;
        }
      }
      throw error;
    }
  })
);

// Eventos de pago que llegaron pero NO se pudieron acreditar (importe distinto,
// usuario inexistente, etc.). Requieren revisión manual.
adminFiscalRouter.get(
  "/webhooks/attention",
  asyncHandler(async (_req, res) => {
    const events = await prisma.webhookEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, provider: true, eventId: true, type: true, payload: true, createdAt: true },
    });
    res.status(200).json({ events });
  })
);
