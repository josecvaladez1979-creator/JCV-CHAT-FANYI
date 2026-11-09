import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { CHECKOUT_ENABLED, getTopup } from "./catalog";
import { isConfigured } from "./config";
import { prisma } from "./db";
import { applyTopupPurchase } from "./wallet";

// ========================================================
// PAGOS CON STRIPE (recargas de saldo)
// Está APAGADO mientras CHECKOUT_ENABLED sea false en catalog.ts.
// Regla de oro: el saldo SOLO se acredita cuando llega un webhook con firma
// válida, con el importe exacto del paquete. La página de éxito no cuenta.
// ========================================================

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!isConfigured(key) || !key!.startsWith("sk_")) return null;
  if (!client) client = new Stripe(key!);
  return client;
}

// Dirección pública de tu app (para volver del pago). Debe ser https.
export function appBaseUrl(): string | null {
  const raw = process.env.APP_URL?.trim();
  if (!isConfigured(raw)) return null;
  try {
    const url = new URL(raw!);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function checkoutReady(): boolean {
  return CHECKOUT_ENABLED && getStripe() !== null && appBaseUrl() !== null;
}

export class CheckoutUnavailableError extends Error {
  constructor() {
    super("Los pagos aún no están disponibles.");
    this.name = "CheckoutUnavailableError";
  }
}

// El importe SIEMPRE sale del catálogo del servidor, nunca del cliente.
export async function createTopupCheckout(input: {
  userId: string;
  email?: string;
  packId: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const base = appBaseUrl();
  const pack = getTopup(input.packId);

  if (!CHECKOUT_ENABLED || !stripe || !base) {
    throw new CheckoutUnavailableError();
  }
  if (!pack) {
    throw new RangeError("Paquete de recarga inválido.");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "mxn",
          unit_amount: pack.priceCents,
          product_data: {
            name: `Recarga de saldo $${pack.priceMXN} MXN`,
            description: `Vigencia: ${pack.validityDays} días`,
          },
        },
      },
    ],
    client_reference_id: input.userId,
    customer_email: input.email,
    metadata: {
      kind: "TOPUP",
      packId: pack.id,
      userId: input.userId,
      terms: "expiry-v1",
    },
    payment_intent_data: {
      metadata: { kind: "TOPUP", packId: pack.id, userId: input.userId },
    },
    success_url: `${base}/?checkout=success`,
    cancel_url: `${base}/?checkout=cancel`,
  });

  if (!session.url) {
    throw new Error("Stripe no devolvió la dirección de pago.");
  }

  return { url: session.url };
}

// -------------------- Webhook --------------------

export type StripeEventLike = {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, any> };
};

export type ProcessResult = {
  status: "processed" | "duplicate" | "ignored" | "rejected";
  reason?: string;
};

const HANDLED_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

// Solo se guardan datos mínimos del evento (sin datos personales).
function slimPayload(event: StripeEventLike, outcome?: string): Prisma.InputJsonObject {
  const object = event.data?.object ?? {};
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    objectId: typeof object.id === "string" ? object.id : null,
    amount: typeof object.amount_total === "number" ? object.amount_total : null,
    currency: typeof object.currency === "string" ? object.currency : null,
    ...(outcome ? { outcome } : {}),
  };
}

const eventKey = (eventId: string) => ({
  provider_eventId: { provider: "STRIPE", eventId },
});

// Reclama el evento: si ya se procesó, no se vuelve a hacer nada.
async function claimEvent(event: StripeEventLike): Promise<"new" | "retry" | "duplicate"> {
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "STRIPE",
        eventId: event.id,
        type: event.type,
        payload: slimPayload(event),
      },
    });
    return "new";
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.webhookEvent.findUnique({
        where: eventKey(event.id),
        select: { processedAt: true },
      });
      return existing?.processedAt ? "duplicate" : "retry";
    }
    throw error;
  }
}

async function markProcessed(event: StripeEventLike, outcome: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: eventKey(event.id),
    data: { processedAt: new Date(), payload: slimPayload(event, outcome) },
  });
}

// Un evento rechazado NO se marca como procesado: queda en la lista de
// "requiere atención" del panel para revisarlo a mano.
async function markRejected(event: StripeEventLike, reason: string): Promise<void> {
  console.error(`[stripe] Evento ${event.id} rechazado: ${reason}`);
  await prisma.webhookEvent.update({
    where: eventKey(event.id),
    data: { payload: slimPayload(event, `rejected:${reason}`) },
  });
}

export async function processStripeEvent(event: StripeEventLike): Promise<ProcessResult> {
  const claim = await claimEvent(event);
  if (claim === "duplicate") {
    return { status: "duplicate" };
  }

  if (!HANDLED_TYPES.has(event.type)) {
    await markProcessed(event, "ignored:type");
    return { status: "ignored", reason: "type" };
  }

  const session = event.data?.object ?? {};
  const metadata = (session.metadata ?? {}) as Record<string, unknown>;

  // Otros productos (planes empresariales, etc.) no se manejan aquí.
  if (metadata.kind !== "TOPUP") {
    await markProcessed(event, "ignored:not_topup");
    return { status: "ignored", reason: "not_topup" };
  }

  // Pago aún no confirmado (métodos asíncronos): se espera el siguiente evento.
  if (session.payment_status !== "paid") {
    await markProcessed(event, "ignored:waiting_payment");
    return { status: "ignored", reason: "waiting_payment" };
  }

  const pack = getTopup(metadata.packId);
  if (!pack) {
    await markRejected(event, "unknown_pack");
    return { status: "rejected", reason: "unknown_pack" };
  }

  if (session.currency !== "mxn" || session.amount_total !== pack.priceCents) {
    await markRejected(event, "amount_mismatch");
    return { status: "rejected", reason: "amount_mismatch" };
  }

  const userId = metadata.userId;
  if (typeof userId !== "string" || userId !== session.client_reference_id) {
    await markRejected(event, "user_mismatch");
    return { status: "rejected", reason: "user_mismatch" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    await markRejected(event, "user_not_found");
    return { status: "rejected", reason: "user_not_found" };
  }

  const paymentRef =
    typeof session.payment_intent === "string" ? session.payment_intent : session.id;

  if (typeof paymentRef !== "string" || !paymentRef) {
    await markRejected(event, "missing_payment_ref");
    return { status: "rejected", reason: "missing_payment_ref" };
  }

  const result = await applyTopupPurchase({
    userId: user.id,
    packId: pack.id,
    creditCents: pack.creditCents,
    validityDays: pack.validityDays,
    provider: "STRIPE",
    providerRef: paymentRef,
    paidCents: session.amount_total,
    customer: {
      name: session.customer_details?.name ?? user.name,
      email: session.customer_details?.email ?? user.email,
    },
    paymentMethod: "card",
    metadata: { stripeSessionId: session.id ?? null, terms: String(metadata.terms ?? "") },
  });

  await markProcessed(event, result.duplicate ? "duplicate_payment" : "credited");
  return { status: result.duplicate ? "duplicate" : "processed" };
}

// Verifica la firma y procesa. Devuelve el código HTTP y el cuerpo.
export async function handleStripeWebhook(
  rawBody: unknown,
  signature: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !isConfigured(secret)) {
    return { status: 503, body: { error: "Webhook no configurado." } };
  }

  if (
    typeof signature !== "string" ||
    !(rawBody instanceof Buffer || typeof rawBody === "string")
  ) {
    return { status: 400, body: { error: "Solicitud inválida." } };
  }

  let event: StripeEventLike;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret!) as unknown as StripeEventLike;
  } catch {
    return { status: 400, body: { error: "Firma inválida." } };
  }

  try {
    const result = await processStripeEvent(event);
    return { status: 200, body: { received: true, status: result.status } };
  } catch (error) {
    // 500 hace que Stripe reintente el evento más tarde.
    console.error(
      "[stripe] Error procesando el evento:",
      error instanceof Error ? error.message : error
    );
    return { status: 500, body: { error: "Reintentar." } };
  }
  }
