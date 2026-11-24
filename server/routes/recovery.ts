import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../http";
import { validateNewPassword } from "../recovery-rules";
import { resetPasswordWithToken } from "../recovery-service";

// Ruta pública: la usa quien recibe el enlace de recuperación.
export const recoveryRouter = Router();

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos." },
});

recoveryRouter.post(
  "/reset-password",
  resetLimiter,
  asyncHandler(async (req, res) => {
    const password = validateNewPassword(req.body?.password);
    if (!password.ok) {
      res.status(400).json({ error: password.error });
      return;
    }

    const outcome = await resetPasswordWithToken(req.body?.token, password.value);
    if (outcome !== "ok") {
      res.status(400).json({ error: "El enlace no es válido o ya venció. Pide uno nuevo a soporte." });
      return;
    }

    res.status(200).json({ message: "Tu contraseña se cambió. Ya puedes iniciar sesión." });
  })
);
