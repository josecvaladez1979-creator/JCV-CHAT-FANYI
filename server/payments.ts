import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { getTopup } from "../catalog";
import { prisma } from "../db";
import { asyncHandler } from "../http";
import { requireAuth } from "../security";
import {
  CheckoutUnavailableError,
  checkoutReady,
  createTopupCheckout,
  handleStripeWebhook,
} from "../stripe-payments";

export const paymentsRouter = Router();

const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
  message: { error: "Demasiados intentos de pago. Espera un momento." },
});

// Crea la sesión de pago de una recarga. NO acredita nada: el saldo solo
// se acredita cuando llega el webhook firmado.
paymentsRouter.post(
  "/wallet/checkout",
  requireAuth,
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    if (req.body?.acceptExpiryTerms !== true) {
      res.status(400).json({
        error: "Debes aceptar que el saldo no consumido se pierde al vencer.",
      });
      return;
    }

    const pack = getTopup(req.body?.packId);
    if (!pack) {
      res.status(400).json({ error: "Paquete de recarga inválido." });
      return;
    }

    if (!checkoutReady()) {
      res.status(503).json({ error: "Los pagos aún no están disponibles." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { email: true },
    });
    if (!user) {
      res.status(401).json({ error: "Debes iniciar sesión." });
      return;
    }

    try {
      const { url } = await createTopupCheckout({
        userId: req.user!.id,
        email: user.email,
        packId: pack.id,
      });
      res.status(200).json({ url });
    } catch (error) {
      if (error instanceof CheckoutUnavailableError) {
        res.status(503).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

// Se monta en server.ts con express.raw() ANTES de express.json(): la firma
// de Stripe se calcula sobre el cuerpo original, byte por byte.
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const { status, body } = await handleStripeWebhook(
      req.body,
      req.headers["stripe-signature"]
    );
    res.status(status).json(body);
  } catch {
    res.status(500).json({ error: "Reintentar." });
  }
}
