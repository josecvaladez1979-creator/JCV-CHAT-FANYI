import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@jcv.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

  // Crear admin si no existe
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Administrador JCV',
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: Role.ADMIN,
        preferredLanguage: 'es',
      },
    });
    console.log(`✅ Admin creado: ${adminEmail}`);
  }

  // Activar todos los planes por defecto
  const plans = ['B2C_15D', 'B2C_1M', 'B2C_1Y', 'B2B_15D', 'B2B_1M', 'B2B_1Y'];
  for (const planId of plans) {
    await prisma.planConfig.upsert({
      where: { planId },
      update: {},
      create: { planId, active: true },
    });
  }
  console.log(`✅ ${plans.length} planes activados`);

  // Crear canal general
  await prisma.channel.upsert({
    where: { name: 'general-fānyì' },
    update: {},
    create: {
      name: 'general-fānyì',
      description: 'Sala global de traducción instantánea en tiempo real',
    },
  });
  console.log('✅ Canal general creado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
