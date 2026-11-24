import { prisma } from "./db";

// ========================================================
// RETENCIÓN DE MENSAJES — para que la base no crezca sin límite
// Automático: define MESSAGE_RETENTION_DAYS en Render (1 a 3650).
// Vacío = apagado (no se borra nada solo).
// ========================================================

type Env = Record<string, string | undefined>;

export const PURGE_BATCH = 1000;
export const PURGE_MAX_BATCHES = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export function retentionDays(env: Env = process.env): number | null {
  const raw = env.MESSAGE_RETENTION_DAYS?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 3650 ? n : null;
}

// Borra por lotes para no bloquear la base. Si hay más que un tope por vuelta,
// avisa (capped) y sigue en la siguiente.
export async function purgeOlderThan(
  days: number,
  options: { now?: Date; batchSize?: number; maxBatches?: number } = {}
): Promise<{ deleted: number; capped: boolean }> {
  if (!Number.isInteger(days) || days < 1) throw new Error("Los días deben ser un número entero de 1 o más.");

  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  const batchSize = options.batchSize ?? PURGE_BATCH;
  const maxBatches = options.maxBatches ?? PURGE_MAX_BATCHES;

  let deleted = 0;
  for (let i = 0; i < maxBatches; i++) {
    const rows = await prisma.message.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: batchSize,
    });
    if (rows.length === 0) return { deleted, capped: false };

    const result = await prisma.message.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    deleted += result.count;

    if (rows.length < batchSize) return { deleted, capped: false };
  }
  return { deleted, capped: true };
}

export async function messageStats(options: { days?: number; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS);

  const [total, older30, older90, olderThanDays] = await Promise.all([
    prisma.message.count(),
    prisma.message.count({ where: { createdAt: { lt: before(30) } } }),
    prisma.message.count({ where: { createdAt: { lt: before(90) } } }),
    options.days ? prisma.message.count({ where: { createdAt: { lt: before(options.days) } } }) : Promise.resolve(null),
  ]);

  // Tamaño real de la tabla en el disco (incluye sus índices).
  let bytes: number | null = null;
  try {
    const rows = await prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_total_relation_size('"Message"') AS size`;
    bytes = Number(rows[0]?.size ?? 0);
  } catch {
    bytes = null;
  }

  return { total, older30, older90, olderThanDays, bytes };
}

// Tarea automática: una primera vuelta 2 minutos después de arrancar y luego cada 6 horas.
export function startRetentionJob(): () => void {
  const days = retentionDays();
  if (days === null) {
    console.log("[retención] apagada (MESSAGE_RETENTION_DAYS está vacío)");
    return () => {};
  }
  console.log(`[retención] activa: se borran los mensajes con más de ${days} días`);

  const run = () => {
    purgeOlderThan(days)
      .then((r) => {
        if (r.deleted > 0) {
          console.log(`[retención] ${r.deleted} mensaje(s) borrados${r.capped ? " (quedan más; sigue en la próxima vuelta)" : ""}`);
        }
      })
      .catch((error) => console.error("[retención] error:", error instanceof Error ? error.message : error));
  };

  const first = setTimeout(run, 2 * 60_000);
  const timer = setInterval(run, 6 * 60 * 60_000);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
