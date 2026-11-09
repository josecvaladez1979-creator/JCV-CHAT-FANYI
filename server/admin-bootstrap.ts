import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "./db";

// Recuperación de la cuenta de administrador SIN correo ni consola.
// Si defines en Render ADMIN_BOOTSTRAP_EMAIL y ADMIN_BOOTSTRAP_PASSWORD,
// al arrancar el servidor esa cuenta queda como ADMIN con esa contraseña
// (se crea si no existe; si existe, se le cambia la contraseña y se cierran
// sus sesiones abiertas). Después de entrar, BORRA las dos variables.
export async function bootstrapAdminFromEnv(): Promise<void> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email && !password) return;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("[bootstrap] ADMIN_BOOTSTRAP_EMAIL no es un correo válido. No se hizo nada.");
    return;
  }
  if (!password || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    console.error("[bootstrap] ADMIN_BOOTSTRAP_PASSWORD debe tener 12 o más caracteres y máximo 72 bytes. No se hizo nada.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: Role.ADMIN },
    });
    await prisma.refreshToken.updateMany({
      where: { userId: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } else {
    await prisma.user.create({
      data: {
        email,
        name: "Administrador",
        passwordHash,
        role: Role.ADMIN,
        preferredLanguage: "es",
        wallet: { create: {} },
      },
    });
  }

  console.log("[bootstrap] Cuenta de administrador lista. BORRA ADMIN_BOOTSTRAP_EMAIL y ADMIN_BOOTSTRAP_PASSWORD de Render.");
}
