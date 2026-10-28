import crypto from "node:crypto";
import type {
  CookieOptions,
  NextFunction,
  Request,
  Response,
} from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { ACCESS_SECRET, IS_PRODUCTION, REFRESH_SECRET } from "./config";
import { prisma } from "./db";

// ========================================================
// SESIONES: TOKENS, COOKIES Y MIDDLEWARES DE ACCESO
// ========================================================

export type AuthUser = {
  id: string;
  email?: string;
  role?: Role;
  orgId?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const ISSUER = "jcv-chat-fanyi";
const AUDIENCE = "jcv-chat-fanyi-client";

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REFRESH_COOKIE = "jcv_refresh";

// -------------------- Tokens --------------------

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      orgId: user.orgId ?? null,
      tokenType: "access",
    },
    ACCESS_SECRET,
    {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: ACCESS_TTL_SECONDS,
      issuer: ISSUER,
      audience: AUDIENCE,
    }
  );
}

// Cada token de renovación es único (jwtid) y su hash se guarda
// en la base de datos para poder rotarlo y revocarlo.
export function signRefreshToken(userId: string): {
  token: string;
  expiresAt: Date;
} {
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  const token = jwt.sign({ tokenType: "refresh" }, REFRESH_SECRET, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: Math.floor(REFRESH_TTL_MS / 1000),
    issuer: ISSUER,
    audience: AUDIENCE,
    jwtid: crypto.randomUUID(),
  });

  return { token, expiresAt };
}

export function verifyRefreshToken(
  token: string
): { userId: string } | null {
  try {
    const payload = jwt.verify(token, REFRESH_SECRET, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as jwt.JwtPayload;

    if (payload.tokenType !== "refresh" || typeof payload.sub !== "string") {
      return null;
    }

    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// -------------------- Cookie de renovación --------------------

const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "strict",
  path: "/api/auth",
};

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieBase,
    maxAge: REFRESH_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, cookieBase);
}

// -------------------- Middlewares --------------------

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authorization = req.headers.authorization;

  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    res.status(401).json({ error: "Debes iniciar sesión." });
    return;
  }

  const token = authorization.replace(/^Bearer\s+/i, "");

  try {
    const payload = jwt.verify(token, ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as jwt.JwtPayload;

    if (payload.tokenType !== "access" || typeof payload.sub !== "string") {
      res.status(401).json({ error: "Token de acceso inválido." });
      return;
    }

    req.user = {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      role:
        typeof payload.role === "string" ? (payload.role as Role) : undefined,
      orgId: typeof payload.orgId === "string" ? payload.orgId : null,
    };

    next();
  } catch {
    res
      .status(401)
      .json({ error: "La sesión ha vencido. Inicia sesión nuevamente." });
  }
}

// El rol se vuelve a leer de la base de datos: un token de 15 minutos
// no debe seguir dando permisos de administrador a quien ya no lo es.
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  requireAuth(req, res, () => {
    prisma.user
      .findUnique({
        where: { id: req.user!.id },
        select: { role: true },
      })
      .then((user) => {
        if (!user || user.role !== Role.ADMIN) {
          res.status(403).json({ error: "No tienes permiso para esta acción." });
          return;
        }
        next();
      })
      .catch(next);
  });
}
