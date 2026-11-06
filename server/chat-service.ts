import { Prisma, UsageFeature } from "@prisma/client";
import { TARIFFS } from "./catalog";
import { hub } from "./chat-hub";
import {
  groupReactions,
  languageName,
  serializeMessage,
  targetLanguages,
  type MessageInput,
} from "./chat-rules";
import { prisma } from "./db";
import { translateWithProvider, translationAvailable } from "./translation-provider";
import { InsufficientFundsError, debitWallet, refundUsage } from "./wallet";
import { textCostCents } from "./wallet-rules";

// ========================================================
// SERVICIO DEL CHAT
// El chat de texto en el mismo idioma es GRATIS: aquí no se cobra nada por
// enviar, leer o reaccionar. Solo la traducción con IA se cobra del saldo.
// Quién envía lo decide siempre el servidor (la sesión), nunca el cuerpo.
// ========================================================

export const DEFAULT_CHANNEL_NAME = "general-fānyì";
export const MAX_CHANNELS_PER_USER = 20;
export const MAX_REACTIONS_PER_USER_PER_MESSAGE = 10;

const channelSelect = {
  id: true,
  name: true,
  description: true,
  isPrivate: true,
  isE2EE: true,
  createdAt: true,
} as const;

export type ChannelRow = {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  isE2EE: boolean;
  createdAt: Date;
};

export function serializeChannel(c: ChannelRow) {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    isPrivate: c.isPrivate,
    isE2EE: c.isE2EE,
    createdAt: c.createdAt.getTime(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

// -------------------- Canales --------------------

export async function ensureDefaultChannel(): Promise<void> {
  await prisma.channel.upsert({
    where: { name: DEFAULT_CHANNEL_NAME },
    update: {},
    create: {
      name: DEFAULT_CHANNEL_NAME,
      description: "Sala global de traducción en tiempo real",
      isPrivate: false,
      isE2EE: false,
    },
  });
}

// Públicos para todos; privados solo para sus miembros.
export async function listVisibleChannels(userId: string): Promise<ChannelRow[]> {
  return prisma.channel.findMany({
    where: { OR: [{ isPrivate: false }, { members: { some: { userId } } }] },
    select: channelSelect,
    orderBy: { createdAt: "asc" },
  });
}

// Devuelve el canal solo si el usuario puede entrar. Un canal privado ajeno
// responde igual que uno inexistente (no se revela que existe).
export async function getAccessibleChannel(
  channelId: unknown,
  userId: string
): Promise<ChannelRow | null> {
  if (typeof channelId !== "string" || channelId.length === 0 || channelId.length > 100) {
    return null;
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: channelSelect,
  });
  if (!channel) return null;
  if (!channel.isPrivate) return channel;

  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { id: true },
  });
  return member ? channel : null;
}

export async function ensureMember(channelId: string, userId: string): Promise<void> {
  try {
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      update: {},
      create: { channelId, userId },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error; // otra solicitud ya lo agregó
  }
}

export async function createChannel(
  userId: string,
  input: { name: string; description: string | null; isE2EE: boolean; isPrivate: boolean }
): Promise<{ ok: true; channel: ChannelRow } | { ok: false; error: "exists" | "limit" }> {
  const owned = await prisma.channel.count({ where: { createdById: userId } });
  if (owned >= MAX_CHANNELS_PER_USER) {
    return { ok: false, error: "limit" };
  }

  try {
    const channel = await prisma.channel.create({
      data: {
        name: input.name,
        description: input.description,
        isPrivate: input.isPrivate,
        isE2EE: input.isE2EE,
        createdById: userId,
        members: { create: { userId } },
      },
      select: channelSelect,
    });
    return { ok: true, channel };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "exists" };
    throw error;
  }
}

// Entrar por enlace: el identificador del canal funciona como invitación.
export async function joinChannelById(
  userId: string,
  channelId: unknown
): Promise<ChannelRow | null> {
  if (typeof channelId !== "string" || channelId.length === 0 || channelId.length > 100) {
    return null;
  }
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: channelSelect,
  });
  if (!channel) return null;
  await ensureMember(channel.id, userId);
  return channel;
}

async function memberIds(channelId: string): Promise<string[]> {
  const rows = await prisma.channelMember.findMany({
    where: { channelId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

// A quién se le avisa en tiempo real de lo que ocurre en un canal.
export async function emitToChannel(
  channel: Pick<ChannelRow, "id" | "isPrivate">,
  event: string,
  data: unknown
): Promise<void> {
  const audience = channel.isPrivate ? new Set(await memberIds(channel.id)) : null;
  hub.broadcast(event, data, audience);
}

// -------------------- Mensajes --------------------

export async function listMessages(
  channelId: string,
  options: { before?: Date; limit?: number } = {}
) {
  const take = Math.min(Math.max(Math.trunc(options.limit ?? 100), 1), 200);

  const rows = await prisma.message.findMany({
    where: {
      channelId,
      ...(options.before ? { createdAt: { lt: options.before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      sender: { select: { name: true, avatar: true } },
      reactionRecords: { select: { emoji: true, userId: true } },
    },
  });

  return rows
    .reverse()
    .map((r) => serializeMessage(r, r.sender, groupReactions(r.reactionRecords)));
}

export async function createMessage(
  userId: string,
  channel: ChannelRow,
  input: MessageInput
) {
  const sender = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, avatar: true, preferredLanguage: true },
  });
  if (!sender) throw new Error("Usuario inexistente.");

  const row = await prisma.message.create({
    data: {
      channelId: channel.id,
      senderId: userId,
      text: input.text,
      originalText: input.isE2EE ? null : input.text,
      sourceLanguage: sender.preferredLanguage,
      isE2EE: input.isE2EE,
      encryptedPayload: input.encryptedPayload ?? undefined,
      isAudio: input.isAudio,
      audioDuration: input.audioDuration,
      audioBase64: input.audioBase64,
    },
  });

  await ensureMember(channel.id, userId);

  return { id: row.id, message: serializeMessage(row, sender, {}) };
}

export async function toggleReaction(userId: string, messageId: string, emoji: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, channelId: true },
  });
  if (!message) return null;

  const channel = await getAccessibleChannel(message.channelId, userId);
  if (!channel) return null;

  try {
    const mine = await prisma.messageReaction.count({ where: { messageId, userId } });
    const already = await prisma.messageReaction.count({ where: { messageId, userId, emoji } });

    if (already > 0) {
      await prisma.messageReaction.deleteMany({ where: { messageId, userId, emoji } });
    } else if (mine < MAX_REACTIONS_PER_USER_PER_MESSAGE) {
      await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
    }
  } catch (error) {
    if (!isUniqueViolation(error)) throw error; // doble clic simultáneo
  }

  const rows = await prisma.messageReaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
  });

  return { channel, reactions: groupReactions(rows) };
}

// -------------------- Personas --------------------

// Solo se listan las personas de los canales a los que puedes entrar.
// Nunca se exponen correos ni datos de contacto.
export async function listPeers(userId: string) {
  const channels = await listVisibleChannels(userId);
  const ids = channels.map((c) => c.id);

  const users = await prisma.user.findMany({
    where: { channelMemberships: { some: { channelId: { in: ids } } } },
    select: { id: true, name: true, avatar: true, preferredLanguage: true },
    take: 500,
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    avatar: u.avatar ?? "",
    preferredLanguage: u.preferredLanguage,
    role: "user",
  }));
}

const nameCache = new Map<string, { name: string; expires: number }>();

export async function getUserName(userId: string): Promise<string | null> {
  const hit = nameCache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.name;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) return null;

  if (nameCache.size > 5000) nameCache.clear();
  nameCache.set(userId, { name: user.name, expires: Date.now() + 10 * 60_000 });
  return user.name;
}

// -------------------- Traducción automática --------------------
// El REMITENTE paga una sola vez por mensaje (según su longitud), sin importar
// a cuántos idiomas se traduzca: para ti el costo de IA por idioma es mínimo.
// Si el proveedor falla por completo, se le devuelve el cobro.

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export type TranslationDeps = {
  available?: () => boolean;
  translate?: typeof translateWithProvider;
};

export type TranslationOutcome =
  | { status: "unavailable" | "skipped" | "no_targets" | "no_balance" | "failed" }
  | { status: "done"; languages: string[] };

export async function runTranslationJob(
  messageId: string,
  deps: TranslationDeps = {}
): Promise<TranslationOutcome> {
  const available = deps.available ?? translationAvailable;
  const translate = deps.translate ?? translateWithProvider;

  if (!available()) return { status: "unavailable" };

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      channelId: true,
      senderId: true,
      text: true,
      isE2EE: true,
      isAudio: true,
      sourceLanguage: true,
      translations: true,
    },
  });
  if (!msg || msg.isE2EE || msg.isAudio || !msg.text) return { status: "skipped" };

  const channel = await prisma.channel.findUnique({
    where: { id: msg.channelId },
    select: channelSelect,
  });
  if (!channel) return { status: "skipped" };

  const members = await prisma.user.findMany({
    where: { channelMemberships: { some: { channelId: msg.channelId } } },
    select: { preferredLanguage: true },
  });
  const targets = targetLanguages(members.map((m) => m.preferredLanguage), msg.sourceLanguage);
  if (targets.length === 0) return { status: "no_targets" };

  const cost = textCostCents(msg.text.length, TARIFFS.textTranslatedCentsPer1kChars);

  let charge: { transactionId: string; balanceCents: number };
  try {
    charge = await debitWallet({
      userId: msg.senderId,
      amountCents: cost,
      feature: UsageFeature.TEXT_TRANSLATION,
      metadata: { messageId, chars: msg.text.length, languages: targets.length },
    });
  } catch (error) {
    if (error instanceof InsufficientFundsError) return { status: "no_balance" };
    throw error;
  }

  const results = await mapLimit(targets, 4, async (lang) => ({
    lang,
    text: await translate({
      source: languageName(msg.sourceLanguage),
      target: languageName(lang),
      text: msg.text,
    }),
  }));

  const translations: Record<string, string> = {};
  for (const r of results) {
    if (r.text) translations[r.lang] = r.text;
  }

  if (Object.keys(translations).length === 0) {
    await refundUsage(charge.transactionId);
    return { status: "failed" };
  }

  const existing =
    msg.translations && typeof msg.translations === "object" && !Array.isArray(msg.translations)
      ? (msg.translations as Record<string, string>)
      : {};

  await prisma.message.update({
    where: { id: msg.id },
    data: { translations: { ...existing, ...translations } },
  });

  await emitToChannel(channel, "message_translated", { messageId: msg.id, translations });

  return { status: "done", languages: Object.keys(translations) };
}
