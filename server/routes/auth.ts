import crypto from "node:crypto";
import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler } from "../http";
import {
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  clearRefreshCookie,
  hashToken,
  requireAuth,
  setRefreshCookie,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../security";

export const authRouter = Router();

const BCRYPT_COST = 12;

// Idiomas que acepta la interfaz (coincide con SUPPORTED_LANGUAGES del frontend).
const LANGUAGE_CODES = [
  "es", "en", "zh", "ja", "fr", "de", "pt", "it", "ru", "ko", "ar", "hi",
];

// La interfaz usa roles en minúsculas y nombres propios de empresa.
const CLIENT_ROLE: Record<Role, string> = {
  USER: "user",
  ADMIN: "admin",
  ORG_OWNER: "b2b_owner",
  ORG_MEMBER: "b2b_member",
};

type ClientUserSource = {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string | null;
  avatar: string | null;
  preferredLanguage: string;
};

// Forma de usuario que espera el frontend. Nunca incluye el hash de contraseña.
function toClientUser(u: ClientUserSource) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: CLIENT_ROLE[u.role],
    orgId: u.orgId ?? undefined,
    avatar: u.avatar ?? "",
    preferredLanguage: u.preferredLanguage,
  };
}

// Hash de relleno: si el correo no existe se compara igualmente contra
// este hash, para que el tiempo de respuesta no revele qué cuentas existen.
const DUMMY_HASH = bcrypt.hashSync(
  crypto.randomBytes(16).toString("hex"),
  BCRYPT_COST
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de autenticación. Espera unos minutos.",
  },
});

// Límite adicional por combinación IP + correo contra adivinación de contraseñas.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase().slice(0, 254)
        : "";
    return `${req.ip ?? "unknown"}|${email}`;
  },
  message: {
    error: "Demasiados intentos para esta cuenta. Espera unos minutos.",
  },
});

type SessionUser = {
  id: string;
  email: string;
  role: Role;
  orgId: string | null;
};

// Emite el token de acceso y un token de renovación nuevo, guardando
// el hash de este último para poder rotarlo y revocarlo.
async function issueSession(res: Response, user: SessionUser): Promise<string> {
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
  });

  const { token, expiresAt } = signRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt },
  });

  setRefreshCookie(res, token);

  return accessToken;
}

// -------------------- Registro --------------------

authRouter.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!name || name.length > 100) {
      res.status(400).json({ error: "Introduce un nombre válido." });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      res
        .status(400)
        .json({ error: "Introduce un correo electrónico válido." });
      return;
    }

    // bcrypt solo procesa los primeros 72 bytes, por eso ese es el máximo.
    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      res.status(400).json({
        error: "La contraseña debe tener al menos 12 caracteres y un máximo de 72 bytes.",
      });
      return;
    }

    const requestedLanguage = req.body?.preferredLanguage;
    const preferredLanguage =
      typeof requestedLanguage === "string" &&
      LANGUAGE_CODES.includes(requestedLanguage)
        ? requestedLanguage
        : "es";

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    let user: SessionUser & {
      name: string;
      avatar: string | null;
      preferredLanguage: string;
    };

    try {
      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          preferredLanguage,
          wallet: { create: {} },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          orgId: true,
          avatar: true,
          preferredLanguage: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        res
          .status(409)
          .json({ error: "No se pudo crear la cuenta con esos datos." });
        return;
      }
      throw error;
    }

    const accessToken = await issueSession(res, user);

    res.status(201).json({
      message: "Cuenta creada correctamente.",
      user: toClientUser(user),
      accessToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TTL_SECONDS,
    });
  })
);

// -------------------- Inicio de sesión --------------------

authRouter.post(
  "/login",
  authLimiter,
  loginLimiter,
  asyncHandler(async (req, res) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      res.status(400).json({ error: "Introduce tu correo y contraseña." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Siempre se ejecuta una comparación bcrypt, exista o no la cuenta.
    const matches = await bcrypt.compare(
      password.slice(0, 1024),
      user?.passwordHash ?? DUMMY_HASH
    );

    if (!user || !matches) {
      res.status(401).json({ error: "Correo o contraseña incorrectos." });
      return;
    }

    const accessToken = await issueSession(res, {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
    });

    res.status(200).json({
      message: "Sesión iniciada correctamente.",
      user: toClientUser(user),
      accessToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TTL_SECONDS,
    });
  })
);

// -------------------- Renovación (con rotación) --------------------

// Si llegan dos renovaciones casi a la vez (dos pestañas), la segunda no
// debe cerrar todas las sesiones. Solo se considera robo cuando se reutiliza
// un token revocado hace más de este margen.
const REUSE_GRACE_MS = 30_000;

authRouter.post(
  "/refresh",
  authLimiter,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];

    if (typeof token !== "string" || token.length === 0) {
      res
        .status(401)
        .json({ error: "La sesión debe renovarse iniciando sesión." });
      return;
    }

    const verified = verifyRefreshToken(token);

    if (!verified) {
      clearRefreshCookie(res);
      res.status(401).json({ error: "Token de renovación inválido." });
      return;
    }

    const tokenHash = hashToken(token);
    const now = new Date();

    const user = await prisma.$transaction(async (tx) => {
      // Revoca el token presentado. Solo una solicitud puede lograrlo.
      const revoked = await tx.refreshToken.updateMany({
        where: {
          tokenHash,
          userId: verified.userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (revoked.count !== 1) {
        const existing = await tx.refreshToken.findUnique({
          where: { tokenHash },
          select: { revokedAt: true },
        });

        if (
          existing?.revokedAt &&
          now.getTime() - existing.revokedAt.getTime() > REUSE_GRACE_MS
        ) {
          // Reutilización de un token ya rotado: posible robo.
          await tx.refreshToken.updateMany({
            where: { userId: verified.userId, revokedAt: null },
            data: { revokedAt: now },
          });
        }

        return null;
      }

      return tx.user.findUnique({
        where: { id: verified.userId },
        select: { id: true, email: true, role: true, orgId: true },
      });
    });

    if (!user) {
      clearRefreshCookie(res);
      res
        .status(401)
        .json({ error: "La sesión ha vencido. Inicia sesión nuevamente." });
      return;
    }

    const accessToken = await issueSession(res, user);

    res.status(200).json({
      accessToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TTL_SECONDS,
    });
  })
);

// -------------------- Cierre de sesión --------------------

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];

    if (typeof token === "string" && token.length > 0) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    clearRefreshCookie(res);

    res.status(200).json({ message: "Sesión cerrada en este dispositivo." });
  })
);

authRouter.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.refreshToken.updateMany({
      where: { userId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    clearRefreshCookie(res);

    res.status(200).json({ message: "Sesión cerrada en todos los dispositivos." });
  })
);

// -------------------- Usuario actual --------------------

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        orgId: true,
        avatar: true,
        preferredLanguage: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }

    res.status(200).json({ user: toClientUser(user) });
  })
);
