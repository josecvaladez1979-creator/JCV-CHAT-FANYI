import { Router } from "express";
import { isConfigured } from "../config";
import {
  B2B_TIERS,
  CHECKOUT_ENABLED,
  CONTRACT_TIERS,
  CONTRACT_TRANSLATION_ENABLED,
  CURRENCY,
  EXPIRY_NOTICE,
  TARIFFS,
  WALLET_TOPUPS,
  getB2BTier,
  packNotice,
} from "../catalog";
import { asyncHandler } from "../http";
import { requireAuth } from "../security";
import { getWalletState } from "../wallet";

export const catalogRouter = Router();

function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return isConfigured(key) && key!.startsWith("sk_");
}

function stripePriceConfigured(tierId: string): boolean {
  const value = process.env[`STRIPE_PRICE_${tierId}`]?.trim();
  return isConfigured(value) && value!.startsWith("price_");
}

// -------------------- Planes empresariales (público) --------------------

catalogRouter.get("/b2b/plans", (_req, res) => {
  res.status(200).json({
    currency: CURRENCY,
    billingPeriod: "month",
    plans: Object.values(B2B_TIERS).map((plan) => ({
      ...plan,
      // Solo es comprable cuando existe un checkout real y su precio en el proveedor.
      purchasable: CHECKOUT_ENABLED && stripePriceConfigured(plan.id),
    })),
  });
});

// Verificación previa. NO crea ninguna sesión de pago ni cobra nada.
catalogRouter.post("/b2b/checkout/validate", requireAuth, (req, res) => {
  const tier = getB2BTier(req.body?.tierId ?? req.body?.planId);

  if (!tier) {
    res
      .status(400)
      .json({ error: "El plan empresarial seleccionado no es válido." });
    return;
  }

  if (!stripePriceConfigured(tier.id)) {
    res.status(503).json({
      error: "El precio de este plan todavía no está configurado en Stripe.",
      planId: tier.id,
    });
    return;
  }

  if (!stripeConfigured()) {
    res
      .status(503)
      .json({ error: "El proveedor de pagos no está configurado." });
    return;
  }

  res.status(200).json({
    planValid: true,
    plan: tier,
    paymentProvider: "stripe",
    paymentConfigured: true,
    checkoutSessionCreated: false,
    checkoutEnabled: CHECKOUT_ENABLED,
    message:
      "El plan y su precio son válidos. Aún no se ha creado ningún pago ni suscripción.",
  });
});

// -------------------- Estado de proveedores (público) --------------------

catalogRouter.get("/payments/providers", (_req, res) => {
  res.status(200).json({
    stripe: stripeConfigured(),
    mercadoPago: isConfigured(process.env.MERCADOPAGO_ACCESS_TOKEN),
    paypal:
      isConfigured(process.env.PAYPAL_CLIENT_ID) &&
      isConfigured(process.env.PAYPAL_CLIENT_SECRET),
    currency: CURRENCY,
    checkoutEnabled: CHECKOUT_ENABLED,
  });
});

// -------------------- Precios públicos --------------------

catalogRouter.get("/pricing", (_req, res) => {
  res.status(200).json({
    currency: CURRENCY,
    free: ["Chat de texto en el mismo idioma"],
    tariffs: TARIFFS,
    topups: Object.values(WALLET_TOPUPS).map((pack) => ({
      ...pack,
      purchasable: CHECKOUT_ENABLED,
      notice: packNotice(pack),
    })),
    expiryNotice: EXPIRY_NOTICE,
    contracts: {
      available: CONTRACT_TRANSLATION_ENABLED,
      tiers: CONTRACT_TIERS,
    },
  });
});

// -------------------- Recargas y saldo --------------------

catalogRouter.get("/ai-wallet/topups", requireAuth, (_req, res) => {
  res.status(200).json({
    currency: CURRENCY,
    topups: Object.values(WALLET_TOPUPS).map((pack) => ({
      ...pack,
      purchasable: CHECKOUT_ENABLED,
      notice: packNotice(pack),
    })),
    expiryNotice: EXPIRY_NOTICE,
    note: "Las cantidades son recargas de saldo en pesos, no tarifas por minuto.",
  });
});

catalogRouter.get(
  "/wallet",
  requireAuth,
  asyncHandler(async (req, res) => {
    const state = await getWalletState(req.user!.id);

    const daysLeft = state.expiresAt
      ? Math.max(
          0,
          Math.ceil((state.expiresAt.getTime() - Date.now()) / 86_400_000)
        )
      : 0;

    res.status(200).json({
      currency: CURRENCY,
      balanceCents: state.balanceCents,
      balanceMXN: state.balanceCents / 100,
      expiresAt: state.expiresAt ? state.expiresAt.toISOString() : null,
      daysLeft,
      expired: state.expired,
      notice: state.balanceCents > 0 ? EXPIRY_NOTICE : null,
    });
  })
);
