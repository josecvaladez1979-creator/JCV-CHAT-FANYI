import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type DeleteResult =
  | { ok: true; channelId: string; channel: { id: string; isPrivate: boolean } | null }
  | { ok: false; error: "not_found" | "forbidden" };

// Cada quien borra SUS mensajes; un administrador puede borrar cualquiera.
// Es un borrado real (no se oculta): así sí se libera espacio. Las reacciones
// del mensaje se borran solas.
export async function deleteMessage(actorId: string, messageId: unknown): Promise<DeleteResult> {
  if (typeof messageId !== "string" || messageId.length === 0 || messageId.length > 100) {
    return { ok: false, error: "not_found" };
  }

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, channelId: true, senderId: true },
  });
  if (!msg) return { ok: false, error: "not_found" };

  if (msg.senderId !== actorId) {
    // El rol se vuelve a leer de la base: un token viejo no da permisos.
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
    if (!actor || actor.role !== "ADMIN") return { ok: false, error: "forbidden" };
  }

  try {
    await prisma.message.delete({ where: { id: msg.id } });
  } catch (error) {
    // P2025: otra solicitud ya lo había borrado. Para quien pide, el resultado es el mismo.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")) {
      throw error;
    }
  }

  const channel = await prisma.channel.findUnique({
    where: { id: msg.channelId },
    select: { id: true, isPrivate: true },
  });

  return { ok: true, channelId: msg.channelId, channel };
}
