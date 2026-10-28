import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// El seed ya no tiene credenciales por defecto. Exige ADMIN_EMAIL y
// ADMIN_PASSWORD explícitos, y en producción una confirmación adicional.

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_SEED_IN_PRODUCTION !== "yes"
  ) {
    throw new Error(
      "El seed no se ejecuta en producción sin ALLOW_SEED_IN_PRODUCTION=yes."
    );
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error("Define ADMIN_EMAIL con un correo válido.");
  }

  if (
    !adminPassword ||
    adminPassword.length < 12 ||
    Buffer.byteLength(adminPassword, "utf8") > 72
  ) {
    throw new Error(
      "Define ADMIN_PASSWORD con al menos 12 caracteres y un máximo de 72 bytes."
    );
  }

  if (["admin123456", "password1234"].includes(adminPassword)) {
    throw new Error("ADMIN_PASSWORD es una contraseña conocida. Elige otra.");
  }

  // Solo crea el administrador si no existe; nunca cambia una contraseña existente.
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Administrador JCV",
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: Role.ADMIN,
        preferredLanguage: "es",
        wallet: { create: {} },
      },
    });
    console.log("✅ Administrador creado.");
  } else {
    console.log("ℹ️ El administrador ya existe; no se modificó.");
  }

  // Canal general
  await prisma.channel.upsert({
    where: { name: "general-fānyì" },
    update: {},
    create: {
      name: "general-fānyì",
      description: "Sala global de traducción instantánea en tiempo real",
    },
  });
  console.log("✅ Canal general verificado.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
