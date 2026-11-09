import { Router } from "express";
import rateLimit from "express-rate-limit";
import { UsageFeature } from "@prisma/client";
import { TARIFFS } from "../catalog";
import { translateWithProvider, translationAvailable } from "../translation-provider";
import { asyncHandler } from "../http";
import { requireAuth } from "../security";
import { InsufficientFundsError, debitWallet, refundUsage } from "../wallet";
import { textCostCents } from "../wallet-rules";

export const translateRouter = Router();

const MAX_CHARS = 10_000;

// Nombre o código de idioma: letras, números, espacios y signos simples.
// Sin saltos de línea, para que no pueda usarse como canal de inyección.
const LANGUAGE_PATTERN = /^[\p{L}\p{N} _\-().]{1,40}$/u;

const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
  message: { error: "Demasiadas traducciones seguidas. Espera un momento." },
});

// /translate es la ruta del servidor; /siliconflow/translate es la que usa
// el cliente actual. Ambas hacen exactamente lo mismo.
translateRouter.post(
  ["/translate", "/siliconflow/translate"],
  requireAuth,
  translateLimiter,
  asyncHandler(async (req, res) => {
    if (!translationAvailable()) {
      res.status(503).json({
        error: "El servicio de traducción no está disponible por ahora.",
      });
      return;
    }

    const text =
      typeof req.body?.text === "string" ? req.body.text.trim() : "";

    const target = String(
      req.body?.targetLanguage ?? req.body?.targetLang ?? ""
    ).trim();

    const source = String(
      req.body?.sourceLanguage ?? req.body?.sourceLang ?? "auto"
    ).trim();

    if (!text || text.length > MAX_CHARS) {
      res.status(400).json({
        error: `El texto debe contener entre 1 y ${MAX_CHARS} caracteres.`,
      });
      return;
    }

    if (!LANGUAGE_PATTERN.test(target) || !LANGUAGE_PATTERN.test(source)) {
      res.status(400).json({ error: "Indica idiomas válidos." });
      return;
    }

    // Cobro proporcional: tarifa por cada 1.000 caracteres, mínimo 1 centavo.
    const costCents = textCostCents(
      text.length,
      TARIFFS.textTranslatedCentsPer1kChars
    );

    let charge: { transactionId: string; balanceCents: number };

    try {
      charge = await debitWallet({
        userId: req.user!.id,
        amountCents: costCents,
        feature: UsageFeature.TEXT_TRANSLATION,
        metadata: { chars: text.length },
      });
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        res.status(402).json({
          error: "Saldo insuficiente. Recarga tu saldo para traducir.",
          requiredCents: costCents,
        });
        return;
      }
      throw error;
    }

    const translatedText = await translateWithProvider({ source, target, text });

    if (!translatedText) {
      // Si el proveedor falla, el cliente no paga.
      await refundUsage(charge.transactionId);

      res.status(502).json({
        error: "No se pudo completar la traducción. No se te cobró.",
      });
      return;
    }

    res.status(200).json({
      translatedText,
      sourceLanguage: source,
      targetLanguage: target,
      chargedCents: costCents,
      balanceCents: charge.balanceCents,
    });
  })
);
