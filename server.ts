
import "dotenv/config";

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { MercadoPagoConfig } from "mercadopago";
import { PrismaClient, Role } from "@prisma/client";

// ========================================================
// JCV CHAT FĀNYÌ
// BLOQUE 1 — CONFIGURACIÓN, SEGURIDAD Y PLANES
// ========================================================

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

app.disable("x-powered-by");

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

// ========================================================
// 1. VALIDACIÓN DE VARIABLES DE ENTORNO
// ========================================================

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (
  IS_PRODUCTION &&
  (!JWT_ACCESS_SECRET ||
    !JWT_REFRESH_SECRET ||
    JWT_ACCESS_SECRET.length < 32 ||
    JWT_REFRESH_SECRET.length < 32)
) {
  throw new Error(
    "Configuración insegura: define JWT_ACCESS_SECRET y JWT_REFRESH_SECRET con secretos independientes de al menos 32 caracteres."
  );
}

const ACCESS_SECRET =
  JWT_ACCESS_SECRET || "DEV_ONLY_ACCESS_SECRET_CHANGE_ME_32_CHARS";

const REFRESH_SECRET =
  JWT_REFRESH_SECRET || "DEV_ONLY_REFRESH_SECRET_CHANGE_ME_32_CHARS";

// ========================================================
// 2. CORS Y SEGURIDAD HTTP
// ========================================================

const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "http://localhost:5173,http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Permite solicitudes sin Origin, como ciertos clientes
      // de servidor. Los navegadores siguen sujetos a CORS.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// IMPORTANTE:
// Las rutas de webhook que necesitan el cuerpo original
// deben declararse ANTES de express.json().
// La ruta de Stripe se registrará en el bloque de pagos.

app.use(cookieParser());

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "100kb",
  })
);

// ========================================================
// 3. LIMITADORES DE SOLICITUDES
// ========================================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Demasiadas solicitudes. Inténtalo de nuevo más tarde.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de autenticación. Espera unos minutos.",
  },
});

app.use("/api", apiLimiter);

// ========================================================
// 4. TIPOS DE AUTENTICACIÓN
// ========================================================

type AuthUser = {
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

// ========================================================
// 


 // ========================================================
 // JCV CHAT FĀNYÌ
 // BLOQUE 2 — AUTENTICACIÓN Y USUARIOS
 // ========================================================

// --------------------------------------------------------
// 1. REGISTRO DE CUENTA
// --------------------------------------------------------

app.post(
  "/api/auth/register",
  authLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const name =
        typeof req.body?.name === "string"
          ? req.body.name.trim()
          : "";

      const email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";

      const password =
        typeof req.body?.password === "string"
          ? req.body.password
          : "";

      if (!name || name.length > 100) {
        res.status(400).json({
          error: "Introduce un nombre válido.",
        });
        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
      ) {
        res.status(400).json({
          error: "Introduce un correo electrónico válido.",
        });
        return;
      }

      if (password.length < 12 || password.length > 128) {
        res.status(400).json({
          error: "La contraseña debe tener entre 12 y 128 caracteres.",
        });
        return;
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        res.status(409).json({
          error: "No se pudo crear la cuenta con esos datos.",
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = signAccessToken(authUser);
      const refreshToken = signRefreshToken(user.id);

      setRefreshCookie(res, refreshToken);

      res.status(201).json({
        message: "Cuenta creada correctamente.",
        user,
        accessToken,
        tokenType: "Bearer",
        expiresIn: 900,
      });
    } catch (error) {
      console.error("Error en registro:", error);

      res.status(500).json({
        error: "No se pudo completar el registro.",
      });
    }
  }
);

// --------------------------------------------------------
// 2. INICIO DE SESIÓN
// --------------------------------------------------------

app.post(
  "/api/auth/login",
  authLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";

      const password =
        typeof req.body?.password === "string"
          ? req.body.password
          : "";

      if (!email || !password) {
        res.status(400).json({
          error: "Introduce tu correo y contraseña.",
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      // Nunca se permite iniciar sesión proporcionando
      // solamente un ID o un correo electrónico.
      const passwordHash =
        user &&
        "passwordHash" in user &&
        typeof user.passwordHash === "string"
          ? user.passwordHash
          : null;

      const passwordMatches = passwordHash
        ? await bcrypt.compare(password, passwordHash)
        : false;

      if (!user || !passwordMatches) {
        res.status(401).json({
          error: "Correo o contraseña incorrectos.",
        });
        return;
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        orgId:
          "orgId" in user && typeof user.orgId === "string"
            ? user.orgId
            : null,
      };

      const accessToken = signAccessToken(authUser);
      const refreshToken = signRefreshToken(user.id);

      setRefreshCookie(res, refreshToken);

      res.status(200).json({
        message: "Sesión iniciada correctamente.",
        user: {
          id: user.id,
          name:
            "name" in user && typeof user.name === "string"
              ? user.name
              : "",
          email: user.email,
          role: user.role,
        },
        accessToken,
        tokenType: "Bearer",
        expiresIn: 900,
      });
    } catch (error) {
      console.error("Error en inicio de sesión:", error);

      res.status(500).json({
        error: "No se pudo iniciar sesión.",
      });
    }
  }
);

// --------------------------------------------------------
// 3. RENOVACIÓN DEL TOKEN
// --------------------------------------------------------

app.post(
  "/api/auth/refresh",
  authLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshToken = req.cookies?.jcv_refresh;

      if (
        typeof refreshToken !== "string" ||
        refreshToken.length === 0
      ) {
        res.status(401).json({
          error: "La sesión debe renovarse iniciando sesión.",
        });
        return;
      }

      const payload = jwt.verify(
        refreshToken,
        REFRESH_SECRET,
        {
          issuer: "jcv-chat-fanyi",
          audience: "jcv-chat-fanyi-client",
        }
      ) as jwt.JwtPayload;

      if (
        payload.tokenType !== "refresh" ||
        typeof payload.sub !== "string"
      ) {
        clearRefreshCookie(res);

        res.status(401).json({
          error: "Token de renovación inválido.",
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        clearRefreshCookie(res);

        res.status(401).json({
          error: "La cuenta ya no está disponible.",
        });
        return;
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        orgId:
          "orgId" in user && typeof user.orgId === "string"
            ? user.orgId
            : null,
      };

      const newAccessToken = signAccessToken(authUser);
      const newRefreshToken = signRefreshToken(user.id);

      setRefreshCookie(res, newRefreshToken);

      res.status(200).json({
        accessToken: newAccessToken,
        tokenType: "Bearer",
        expiresIn: 900,
      });
    } catch {
      clearRefreshCookie(res);

      res.status(401).json({
        error: "La sesión ha vencido. Inicia sesión nuevamente.",
      });
    }
  }
);

// --------------------------------------------------------
// 4. CIERRE DE SESIÓN
// --------------------------------------------------------

app.post(
  "/api/auth/logout",
  (_req: Request, res: Response): void => {
    clearRefreshCookie(res);

    res.status(200).json({
      message: "Sesión cerrada en este dispositivo.",
    });
  }
);

// --------------------------------------------------------
// 5. CONSULTAR EL USUARIO AUTENTICADO
// --------------------------------------------------------

app.get(
  "/api/auth/me",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        res.status(404).json({
          error: "Usuario no encontrado.",
        });
        return;
      }

      res.status(200).json({ user });
    } catch (error) {
      console.error("Error consultando usuario:", error);

      res.status(500).json({
        error: "No se pudo consultar la cuenta.",
      });
    }
  }
);

// --------------------------------------------------------
// 6. FIN DEL BLOQUE 2
// El listado administrativo de usuarios se añadirá
// únicamente como ruta protegida en el bloque de admin.
// ========================================================


 // ========================================================
 // JCV CHAT FĀNYÌ
 // BLOQUE 3 — PLANES B2C/B2B Y BASE DE PAGOS
 // ========================================================

// --------------------------------------------------------
// 1. CONSULTA PÚBLICA DE PLANES B2C
// --------------------------------------------------------

app.get(
  "/api/b2c/plans",
  (_req: Request, res: Response): void => {
    res.status(200).json({
      currency: PAYMENT_CURRENCY,
      plans: Object.values(B2C_PLANS).map((plan) => ({
        ...plan,
        // Un plan sin precio definido no se puede comprar.
        purchasable:
          typeof plan.priceMXN === "number" &&
          Number.isFinite(plan.priceMXN) &&
          plan.priceMXN > 0,
      })),
    });
  }
);

// --------------------------------------------------------
// 2. CONSULTA PÚBLICA DE PLANES B2B
// --------------------------------------------------------

app.get(
  "/api/b2b/plans",
  (_req: Request, res: Response): void => {
    res.status(200).json({
      currency: PAYMENT_CURRENCY,
      billingPeriod: "month",
      plans: Object.values(B2B_TIERS).map((plan) => ({
        ...plan,
        purchasable: plan.priceMXN > 0,
      })),
    });
  }
);

// --------------------------------------------------------
// 3. CONSULTA DE RECARGAS PARA IA
// --------------------------------------------------------

app.get(
  "/api/ai-wallet/topups",
  requireAuth,
  (_req: Request, res: Response): void => {
    res.status(200).json({
      currency: PAYMENT_CURRENCY,
      topups: Object.values(AI_WALLET_TOPUPS),
      note:
        "Las cantidades son recargas de saldo, no tarifas por minuto.",
    });
  }
);

// --------------------------------------------------------
// 4. VALIDACIÓN CENTRAL DE PLANES EMPRESARIALES
// --------------------------------------------------------


const B2B_TIERS = {
  BASIC: {
    id: "BASIC",
    name: "Empresa Básica",
    priceMXN: 599,
    durationDays: 30,
    seats: 5,
  },
  PROFESSIONAL: {
    id: "PROFESSIONAL",
    name: "Empresa Profesional",
    priceMXN: 999,
    durationDays: 30,
    seats: 10,
  },
  CORPORATE: {
    id: "CORPORATE",
    name: "Empresa Corporativa",
    priceMXN: 2099,
    durationDays: 30,
    seats: 25,
  },
} as const;

// --------------------------------------------------------
// 5. VALIDACIÓN DE CONFIGURACIÓN DE STRIPE
// --------------------------------------------------------

function getStripePriceId(planId: string): string | null {
  const envKey = `STRIPE_PRICE_${planId}`;
  const value = process.env[envKey]?.trim();

  if (!value || !value.startsWith("price_")) {
    return null;
  }

  return value;
}

// --------------------------------------------------------
// 6. PREPARACIÓN DE CHECKOUT B2B
// --------------------------------------------------------

// Esta ruta valida el plan y la configuración, pero no crea
// todavía una sesión de pago. Para activar el checkout hay
// que conectar el plan con el modelo real de Prisma,
// el usuario autenticado y la organización correspondiente.

app.post(
  "/api/b2b/checkout/validate",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tier = getB2BTier(req.body?.tierId);

      if (!tier) {
        res.status(400).json({
          error: "El plan empresarial seleccionado no es válido.",
        });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({
          error: "Debes iniciar sesión.",
        });
        return;
      }

      const priceId = getStripePriceId(tier.id);

      if (!priceId) {
        res.status(503).json({
          error:
            "El precio de este plan todavía no está configurado en Stripe.",
          planId: tier.id,
        });
        return;
      }

      if (!getStripe()) {
        res.status(503).json({
          error: "El proveedor de pagos no está configurado.",
        });
        return;
      }

      res.status(200).json({
        valid: true,
        plan: {
          id: tier.id,
          name: tier.name,
          priceMXN: tier.priceMXN,
          seats: tier.seats,
          durationDays: tier.durationDays,
        },
        paymentProvider: "stripe",
        checkoutReady: true,
        message:
          "El plan y su precio están configurados. La creación del checkout requiere la integración con la suscripción y organización de Prisma.",
      });
    } catch (error) {
      console.error("Error validando checkout B2B:", error);

      res.status(500).json({
        error: "No se pudo validar el pago.",
      });
    }
  }
);

// --------------------------------------------------------
// 7. ESTADO DE LOS PROVEEDORES DE PAGO
// --------------------------------------------------------

app.get(
  "/api/payments/providers",
  (_req: Request, res: Response): void => {
    res.status(200).json({
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      mercadoPago: Boolean(
        process.env.MERCADOPAGO_ACCESS_TOKEN
      ),
      paypal: Boolean(
        process.env.PAYPAL_CLIENT_ID &&
        process.env.PAYPAL_CLIENT_SECRET
      ),
      currency: PAYMENT_CURRENCY,
    });
  }
);

// ========================================================
// FIN DEL BLOQUE 3
// El checkout real, las suscripciones y los webhooks deben
// conectarse con los modelos y campos reales de Prisma.
// No marcar pagos como pagados desde el navegador.
// ========================================================


 // ========================================================
 // JCV CHAT FĀNYÌ
 // BLOQUE 4 — CHAT, ESTADO DE IA Y ARRANQUE
 // ========================================================

// --------------------------------------------------------
// 1. ESTADO DEL PROVEEDOR DE IA
// --------------------------------------------------------

app.get(
  "/api/siliconflow/status",
  (_req: Request, res: Response): void => {
    const configured = Boolean(
      process.env.SILICONFLOW_API_KEY
    );

    res.status(200).json({
      provider: "SiliconFlow",
      configured,
      model:
        process.env.TEXT_MODEL ||
        "Qwen/Qwen3-32B-Instruct",
      message: configured
        ? "El proveedor está configurado."
        : "Falta configurar SILICONFLOW_API_KEY.",
    });
  }
);

// --------------------------------------------------------
// 2. TRADUCCIÓN MEDIANTE SILICONFLOW
// --------------------------------------------------------

app.post(
  "/api/translate",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const text =
        typeof req.body?.text === "string"
          ? req.body.text.trim()
          : "";

      const targetLanguage =
        typeof req.body?.targetLanguage === "string"
          ? req.body.targetLanguage.trim()
          : "";

      const sourceLanguage =
        typeof req.body?.sourceLanguage === "string"
          ? req.body.sourceLanguage.trim()
          : "auto";

      if (!text || text.length > 10000) {
        res.status(400).json({
          error: "El texto debe contener entre 1 y 10000 caracteres.",
        });
        return;
      }

      if (!targetLanguage || targetLanguage.length > 80) {
        res.status(400).json({
          error: "Indica un idioma de destino válido.",
        });
        return;
      }

      const apiKey = process.env.SILICONFLOW_API_KEY;

      if (!apiKey) {
        res.status(503).json({
          error: "El servicio de traducción no está configurado.",
        });
        return;
      }

      const model =
        process.env.TEXT_MODEL ||
        "Qwen/Qwen3-32B-Instruct";

      const response = await fetch(
        "https://api.siliconflow.cn/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content:
                  "Eres un traductor profesional. Traduce con precisión al idioma de destino, conserva el significado, el tono y el formato. No añadas explicaciones ni inventes contenido.",
              },
              {
                role: "user",
                content:
                  `Idioma de origen: ${sourceLanguage}\n` +
                  `Idioma de destino: ${targetLanguage}\n\n` +
                  `Texto que debes traducir:\n${text}`,
              },
            ],
          }),
          signal: AbortSignal.timeout(45000),
        }
      );

      if (!response.ok) {
        console.error(
          "Error del proveedor de traducción:",
          response.status
        );

        res.status(502).json({
          error: "El proveedor de traducción no pudo completar la solicitud.",
        });
        return;
      }

      const result = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const translatedText =
        result.choices?.[0]?.message?.content?.trim();

      if (!translatedText) {
        res.status(502).json({
          error: "El proveedor no devolvió una traducción válida.",
        });
        return;
      }

      res.status(200).json({
        translatedText,
        sourceLanguage,
        targetLanguage,
        model,
      });
    } catch (error) {
      console.error("Error de traducción:", error);

      res.status(500).json({
        error: "No se pudo completar la traducción.",
      });
    }
  }
);

// --------------------------------------------------------
// 3. CUOTA FREEMIUM
// --------------------------------------------------------

// Esta ruta devuelve los límites generales del producto.
// El contador real de uso diario debe conectarse a Prisma
// y comprobarse también al enviar cada mensaje.

app.get(
  "/api/freemium/limits",
  requireAuth,
  (_req: Request, res: Response): void => {
    res.status(200).json({
      messagesPerDay: FREEMIUM_LIMIT.messagesPerDay,
      maxCharsPerMessage: FREEMIUM_LIMIT.maxCharsPerMessage,
    });
  }
);

// --------------------------------------------------------
// 4. RUTA DE INFORMACIÓN DEL SERVICIO
// --------------------------------------------------------

app.get(
  "/api",
  (_req: Request, res: Response): void => {
    res.status(200).json({
      name: "JCV CHAT FĀNYÌ",
      status: "online",
      version: "1.0.0",
      features: {
        chat: true,
        translation: Boolean(
          process.env.SILICONFLOW_API_KEY
        ),
        b2bPlans: [
          "BASIC",
          "PROFESSIONAL",
          "CORPORATE",
        ],
      },
    });
  }
);

// --------------------------------------------------------
// 5. MANEJO GENERAL DE ERRORES
// --------------------------------------------------------

app.use(
  (
    error: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    console.error("Error no controlado en Express:", error.message);

    if (res.headersSent) {
      return;
    }

    res.status(500).json({
      error: "Se produjo un error interno del servidor.",
    });
  }
);

// --------------------------------------------------------
// 6. ARRANQUE DEL SERVIDOR
// --------------------------------------------------------

async function startServer(): Promise<void> {
  await prisma.$connect();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `JCV CHAT FĀNYÌ escuchando en el puerto ${PORT}`
    );
    console.log(`Entorno: ${NODE_ENV}`);
  });
}

startServer().catch(async (error: unknown) => {
  console.error("No se pudo iniciar JCV CHAT FĀNYÌ:", error);

  await prisma.$disconnect().catch(() => undefined);

  process.exit(1);
});
