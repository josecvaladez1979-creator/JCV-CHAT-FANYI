import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  MAX_CONNECTIONS_PER_USER,
  MAX_CONNECTIONS_TOTAL,
  hub,
  tickets,
} from "../chat-hub";
import {
  AUDIO_MESSAGES_ENABLED,
  isValidEmoji,
  parseChannelInput,
  parseMessageInput,
} from "../chat-rules";
import {
  createChannel,
  createMessage,
  emitToChannel,
  ensureMember,
  getAccessibleChannel,
  getUserName,
  joinChannelById,
  listMessages,
  listPeers,
  listVisibleChannels,
  runTranslationJob,
  serializeChannel,
  toggleReaction,
} from "../chat-service";
import { asyncHandler } from "../http";
import { requireAuth } from "../security";

// El chat es gratis: estos límites solo frenan abusos, por usuario.
export const chatRouter = Router();

function perUser(windowMs: number, limit: number, error: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
    message: { error },
  });
}

const readLimiter = perUser(60_000, 120, "Demasiadas consultas. Espera un momento.");
const messageLimiter = perUser(10_000, 15, "Estás enviando mensajes muy rápido. Espera unos segundos.");
const typingLimiter = perUser(60_000, 90, "Demasiados avisos de escritura.");
const channelLimiter = perUser(60 * 60_000, 10, "Has creado demasiados canales. Inténtalo más tarde.");
const ticketLimiter = perUser(60_000, 30, "Demasiadas conexiones. Espera un momento.");

// -------------------- Tiempo real (SSE) --------------------
// Se autentica con un boleto de un solo uso porque EventSource no admite cabeceras.

chatRouter.get("/stream", (req, res) => {
  const ticket = typeof req.query.ticket === "string" ? req.query.ticket : "";
  const userId = tickets.consume(ticket);

  if (!userId) {
    res.status(401).json({ error: "Boleto inválido o vencido." });
    return;
  }

  if (
    hub.count() >= MAX_CONNECTIONS_TOTAL ||
    hub.countForUser(userId) >= MAX_CONNECTIONS_PER_USER
  ) {
    res.status(503).json({ error: "Demasiadas conexiones abiertas." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");

  const conn = hub.add(userId, res);
  hub.sendTo(conn, "connected", { userId });

  req.on("close", () => hub.remove(conn.id));
});

// -------------------- Todo lo demás exige sesión --------------------

chatRouter.use(requireAuth);

chatRouter.post("/stream-ticket", ticketLimiter, (req, res) => {
  res.status(200).json({ ticket: tickets.issue(req.user!.id), expiresIn: 30 });
});

chatRouter.get(
  "/channels",
  readLimiter,
  asyncHandler(async (req, res) => {
    const channels = await listVisibleChannels(req.user!.id);
    res.status(200).json({ channels: channels.map(serializeChannel) });
  })
);

chatRouter.post(
  "/channels",
  channelLimiter,
  asyncHandler(async (req, res) => {
    const parsed = parseChannelInput(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const result = await createChannel(req.user!.id, parsed.value);
    if (!result.ok) {
      res.status(result.error === "exists" ? 409 : 429).json({
        error:
          result.error === "exists"
            ? "Ya existe un canal con ese nombre."
            : "Llegaste al máximo de canales que puedes crear.",
      });
      return;
    }

    const channel = serializeChannel(result.channel);

    // Un canal privado solo se anuncia a su creador.
    if (result.channel.isPrivate) {
      hub.broadcast("channel_created", channel, new Set([req.user!.id]));
    } else {
      hub.broadcast("channel_created", channel, null);
    }

    res.status(201).json({ channel });
  })
);

chatRouter.post(
  "/channels/:id/join",
  readLimiter,
  asyncHandler(async (req, res) => {
    const channel = await joinChannelById(req.user!.id, req.params.id);
    if (!channel) {
      res.status(404).json({ error: "Canal no encontrado." });
      return;
    }
    res.status(200).json({ channel: serializeChannel(channel) });
  })
);

chatRouter.get(
  "/messages",
  readLimiter,
  asyncHandler(async (req, res) => {
    const channel = await getAccessibleChannel(req.query.channelId, req.user!.id);
    if (!channel) {
      res.status(404).json({ error: "Canal no encontrado." });
      return;
    }

    let before: Date | undefined;
    if (typeof req.query.before === "string") {
      before = new Date(req.query.before);
      if (Number.isNaN(before.getTime())) {
        res.status(400).json({ error: "La fecha no es válida." });
        return;
      }
    }

    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;

    // Quien abre un canal pasa a ser miembro (así recibe sus traducciones).
    await ensureMember(channel.id, req.user!.id);

    const messages = await listMessages(channel.id, {
      before,
      limit: Number.isFinite(limit) ? limit : 100,
    });
    res.status(200).json({ messages });
  })
);

chatRouter.post(
  "/messages",
  messageLimiter,
  asyncHandler(async (req, res) => {
    const channel = await getAccessibleChannel(req.body?.channelId, req.user!.id);
    if (!channel) {
      res.status(404).json({ error: "Canal no encontrado." });
      return;
    }

    if (req.body?.isAudio === true && !AUDIO_MESSAGES_ENABLED) {
      res.status(400).json({ error: "Las notas de voz estarán disponibles pronto." });
      return;
    }

    // Se ignoran senderId, senderName, etc. del cuerpo: manda la sesión.
    const parsed = parseMessageInput(req.body, channel.isE2EE);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const { id, message } = await createMessage(req.user!.id, channel, parsed.value);

    await emitToChannel(channel, "new_message", message);

    // La traducción corre aparte: el mensaje ya se entregó.
    if (!parsed.value.isE2EE && !parsed.value.isAudio) {
      runTranslationJob(id).catch((error) =>
        console.error("[chat] Error en la traducción:", error instanceof Error ? error.message : error)
      );
    }

    res.status(201).json({ message });
  })
);

chatRouter.post(
  "/messages/:id/reactions",
  messageLimiter,
  asyncHandler(async (req, res) => {
    if (!isValidEmoji(req.body?.emoji)) {
      res.status(400).json({ error: "Emoji no válido." });
      return;
    }

    const result = await toggleReaction(req.user!.id, req.params.id, req.body.emoji);
    if (!result) {
      res.status(404).json({ error: "Mensaje no encontrado." });
      return;
    }

    await emitToChannel(result.channel, "message_reaction", {
      messageId: req.params.id,
      reactions: result.reactions,
    });

    res.status(200).json({ reactions: result.reactions });
  })
);

chatRouter.post(
  "/typing",
  typingLimiter,
  asyncHandler(async (req, res) => {
    const channel = await getAccessibleChannel(req.body?.channelId, req.user!.id);
    if (!channel) {
      res.status(404).json({ error: "Canal no encontrado." });
      return;
    }

    const userName = await getUserName(req.user!.id);
    if (userName) {
      await emitToChannel(channel, "typing", {
        channelId: channel.id,
        userId: req.user!.id,
        userName,
        isTyping: req.body?.isTyping === true,
      });
    }

    res.status(204).end();
  })
);

chatRouter.get(
  "/users",
  readLimiter,
  asyncHandler(async (req, res) => {
    res.status(200).json({ users: await listPeers(req.user!.id) });
  })
);
