import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWED_ORIGINS, IS_PRODUCTION, NODE_ENV, PORT } from "./server/config";
import { hub, startChatTimers } from "./server/chat-hub";
import { ensureDefaultChannel } from "./server/chat-service";
import { prisma } from "./server/db";
import { bootstrapAdminFromEnv } from "./server/admin-bootstrap";
import { adminFiscalRouter } from "./server/routes/admin-fiscal";
import { authRouter } from "./server/routes/auth";
import { chatRouter } from "./server/routes/chat";
import { catalogRouter } from "./server/routes/store";
import { paymentsRouter, stripeWebhookHandler } from "./server/routes/payments";
import { systemRouter } from "./server/routes/system";
import { translateRouter } from "./server/routes/translate";

// ========================================================
// JCV CHAT FĀNYÌ — SERVIDOR
// Este archivo solo ensambla. La lógica vive en ./server/*
// ========================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.disable("x-powered-by");

// Render está detrás de un proxy: necesario para ver la IP real del cliente.
if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS: se permite el mismo origen (la propia app) y los orígenes declarados
// en CORS_ORIGINS. Los demás simplemente no reciben cabeceras CORS.
app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const selfOrigin = `${IS_PRODUCTION ? "https" : "http"}://${req.headers.host}`;
    const allowed =
      !origin || origin === selfOrigin || ALLOWED_ORIGINS.includes(origin);

    callback(null, { origin: allowed, credentials: true });
  })
);

// Webhook de Stripe: necesita el cuerpo ORIGINAL (la firma se calcula sobre él),
// por eso va ANTES de express.json() y de cualquier limitador de /api.
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json", limit: "1mb" }),
  stripeWebhookHandler
);

app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Inténtalo de nuevo más tarde." },
  // El chat tiene sus propios límites por usuario (más justos que uno por IP).
  skip: (req) => req.originalUrl.startsWith("/api/chat/"),
});

app.use("/api", apiLimiter);

// -------------------- Rutas --------------------

app.use(systemRouter);
app.use("/api/auth", authRouter);
app.use("/api", catalogRouter);
app.use("/api", translateRouter);
app.use("/api/chat", chatRouter);
app.use("/api", paymentsRouter);
app.use("/api/admin", adminFiscalRouter);

// Cualquier otra ruta de la API responde JSON, nunca HTML.
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Ruta no encontrada." });
});

// -------------------- Frontend (Vite) --------------------

const distPath = path.join(__dirname, "dist");
const indexFile = path.join(distPath, "index.html");

if (fs.existsSync(indexFile)) {
  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );

  app.get(/^\/(?!api\/).*/, (_req: Request, res: Response) => {
    res.sendFile(indexFile);
  });
} else {
  console.warn(
    "[server] No se encontró dist/index.html. Ejecuta `npm run build` para servir la interfaz."
  );
}

// -------------------- Errores --------------------

app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    const status =
      typeof (error as { status?: unknown })?.status === "number"
        ? (error as { status: number }).status
        : 500;

    if (status >= 400 && status < 500) {
      res.status(status).json({
        error:
          status === 413
            ? "La solicitud es demasiado grande."
            : "Solicitud inválida.",
      });
      return;
    }

    console.error("Error no controlado en Express:");
    if (error instanceof Error) {
      console.error(error.name, error.message, error.stack);
    } else {
      console.error(error);
    }

    if (res.headersSent) return;

    res.status(500).json({ error: "Se produjo un error interno del servidor." });
  }
);

// -------------------- Arranque y apagado ordenado --------------------

async function startServer(): Promise<void> {
  await prisma.$connect();

  try {
    await bootstrapAdminFromEnv();
    await ensureDefaultChannel();
  } catch (error) {
    console.error("[inicio] No se pudo preparar el administrador o el canal general:", error);
  }

  const stopChatTimers = startChatTimers();

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`JCV CHAT FĀNYÌ escuchando en el puerto ${PORT}`);
    console.log(`Entorno: ${NODE_ENV}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} recibido. Cerrando servidor...`);
    stopChatTimers();
    hub.closeAll(); // las conexiones de tiempo real impedirían cerrar el servidor
    server.close(() => {
      prisma.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch(async (error: unknown) => {
  console.error("No se pudo iniciar JCV CHAT FĀNYÌ:", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
