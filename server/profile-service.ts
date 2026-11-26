import { prisma } from "./db";

// Lo que se devuelve al navegador para pintar a la persona.
const CLIENT_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  orgId: true,
  avatar: true,
  preferredLanguage: true,
} as const;

// La dirección lleva ?v=... : al cambiar la foto cambia la dirección, y así el
// navegador de todos pide la nueva en lugar de usar la vieja guardada.
export function avatarUrl(userId: string, version: number = Date.now()): string {
  return `/api/avatars/${userId}?v=${version}`;
}

export async function saveAvatar(userId: string, bytes: Buffer, mime: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { avatarData: bytes, avatarMime: mime, avatar: avatarUrl(userId) },
    select: CLIENT_SELECT,
  });
}

export async function removeAvatar(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { avatarData: null, avatarMime: null, avatar: null },
    select: CLIENT_SELECT,
  });
}

export async function getAvatar(userId: unknown): Promise<{ data: Buffer; mime: string } | null> {
  if (typeof userId !== "string" || userId.length === 0 || userId.length > 100) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarData: true, avatarMime: true },
  });
  if (!user?.avatarData || !user.avatarMime) return null;

  return { data: Buffer.from(user.avatarData), mime: user.avatarMime };
}
