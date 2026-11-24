import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../http";
import { messageStats, purgeOlderThan } from "../message-retention";
import { createRecoveryLink } from "../recovery-service";
import { requireAdmin } from "../security";

// Rutas de administrador: recuperar cuentas y limpiar mensajes.
export const adminUsersRouter = Router();

const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
  message: { error: "Demasiadas acciones de administrador. Espera un poco." },
});

function baseUrl(req: { protocol: string; get(name: string): string | undefined }): string {
  return process.env.APP_URL?.trim() || `${req.protocol}://${req.get("host")}`;
}

adminUsersRouter.post(
  "/users/recovery-link",
  requireAdmin,
  adminLimiter,
  asyncHandler(async (req, res) => {
    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Escribe el correo con el que se registró la cuenta." });
      return;
    }

    const result = await createRecoveryLink({
      email,
      adminId: req.user!.id,
      baseUrl: baseUrl(req),
    });

    if (!result.ok) {
      res.status(404).json({ error: "No existe una cuenta con ese correo." });
      return;
    }

    console.log(`[admin] enlace de recuperación generado (administrador ${req.user!.id.slice(0, 6)}…)`);
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json({
      link: result.link,
      expiresAt: result.expiresAt.toISOString(),
      email: result.email,
      name: result.name,
    });
  })
);

adminUsersRouter.get(
  "/messages/stats",
  requireAdmin,
  adminLimiter,
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days);
    const stats = await messageStats({
      days: Number.isInteger(days) && days >= 1 && days <= 3650 ? days : undefined,
    });
    res.status(200).json(stats);
  })
);

adminUsersRouter.post(
  "/messages/purge",
  requireAdmin,
  adminLimiter,
  asyncHandler(async (req, res) => {
    const days = Number(req.body?.days);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      res.status(400).json({ error: "Los días deben ser un número entero entre 1 y 3650." });
      return;
    }
    if (req.body?.confirm !== true) {
      res.status(400).json({ error: "Falta la confirmación del borrado." });
      return;
    }

    const result = await purgeOlderThan(days);
    console.log(`[admin] borrado manual: ${result.deleted} mensaje(s) con más de ${days} días`);
    res.status(200).json(result);
  })
);
