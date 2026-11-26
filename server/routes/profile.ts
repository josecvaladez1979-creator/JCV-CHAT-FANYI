import { Router } from "express";
import rateLimit from "express-rate-limit";
import { parseAvatarUpload } from "../avatar-rules";
import { asyncHandler } from "../http";
import { getAvatar, removeAvatar, saveAvatar } from "../profile-service";
import { requireAuth } from "../security";
import { toClientUser } from "./auth";

export const profileRouter = Router();

const changeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
  message: { error: "Has cambiado tu foto muchas veces. Inténtalo más tarde." },
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes." },
});

// Pública: una etiqueta <img> no puede enviar la sesión. La dirección lleva el
// identificador de la persona (no adivinable) y solo muestra la foto que ella subió.
profileRouter.get(
  "/avatars/:id",
  readLimiter,
  asyncHandler(async (req, res) => {
    const avatar = await getAvatar(req.params.id);
    if (!avatar) {
      res.status(404).end();
      return;
    }

    res.setHeader("Content-Type", avatar.mime);
    // La dirección cambia con cada foto nueva (?v=), así que puede guardarse mucho tiempo.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.status(200).send(avatar.data);
  })
);

profileRouter.put(
  "/profile/avatar",
  requireAuth,
  changeLimiter,
  asyncHandler(async (req, res) => {
    const parsed = parseAvatarUpload(req.body?.image);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const user = await saveAvatar(req.user!.id, parsed.bytes, parsed.mime);
    res.status(200).json({ user: toClientUser(user) });
  })
);

profileRouter.delete(
  "/profile/avatar",
  requireAuth,
  changeLimiter,
  asyncHandler(async (req, res) => {
    const user = await removeAvatar(req.user!.id);
    res.status(200).json({ user: toClientUser(user) });
  })
);
