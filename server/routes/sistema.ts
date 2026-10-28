import { Router } from "express";
import { COMMIT_SHA, FEATURE_TRANSLATION, isConfigured } from "../config";
import { B2B_TIERS } from "../catalog";
import { prisma } from "../db";

export const systemRouter = Router();

// Vivacidad: no toca la base de datos.
systemRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Preparación: comprueba la base de datos y expone el commit desplegado.
systemRouter.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "ok", commit: COMMIT_SHA || null });
  } catch {
    res.status(503).json({ status: "degraded", db: "error" });
  }
});

systemRouter.get("/api", (_req, res) => {
  res.status(200).json({
    name: "JCV CHAT FĀNYÌ",
    status: "online",
    version: process.env.npm_package_version || "unknown",
    features: {
      translation:
        FEATURE_TRANSLATION && isConfigured(process.env.SILICONFLOW_API_KEY),
      b2bPlans: Object.keys(B2B_TIERS),
    },
  });
});

systemRouter.get("/api/siliconflow/status", (_req, res) => {
  const configured = isConfigured(process.env.SILICONFLOW_API_KEY);

  res.status(200).json({
    provider: "SiliconFlow",
    configured,
    enabled: FEATURE_TRANSLATION,
    message: configured
      ? "El proveedor está configurado."
      : "Falta configurar SILICONFLOW_API_KEY.",
  });
});
