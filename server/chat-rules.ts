// ========================================================
// REGLAS PURAS DEL CHAT (sin base de datos ni red)
// ========================================================

// Idiomas de la interfaz (coincide con SUPPORTED_LANGUAGES del frontend).
export const LANGUAGE_CODES = [
  "es", "en", "zh", "ja", "fr", "de", "pt", "it", "ru", "ko", "ar", "pl",
] as const;

// Las notas de voz aún no tienen cobro ni traducción de audio. Apagadas para que
// nadie pueda llenar la base de datos con audios sin costo.
export const AUDIO_MESSAGES_ENABLED = false;

export const MAX_TEXT_CHARS = 4000;
export const MAX_CHANNEL_NAME = 60;
export const MAX_CHANNEL_DESCRIPTION = 200;
export const MAX_AUDIO_BASE64_CHARS = 1_500_000;
export const MAX_AUDIO_SECONDS = 300;
export const MAX_CIPHER_CHARS = 12_000;

export const LANGUAGE_NAMES: Record<string, string> = {
  es: "Español", en: "Inglés", zh: "Chino simplificado", ja: "Japonés",
  fr: "Francés", de: "Alemán", pt: "Portugués", it: "Italiano",
  ru: "Ruso", ko: "Coreano", ar: "Árabe", pl: "Polaco",
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}

export function isLanguageCode(value: unknown): value is string {
  return typeof value === "string" && (LANGUAGE_CODES as readonly string[]).includes(value);
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// Letras, números, espacios y . _ - (incluye acentos y macrones: "general-fānyì").
const CHANNEL_NAME = /^[\p{L}\p{N} _.\-]+$/u;

export function parseChannelInput(body: any): Result<{
  name: string;
  description: string | null;
  isE2EE: boolean;
  isPrivate: boolean;
}> {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > MAX_CHANNEL_NAME || !CHANNEL_NAME.test(name)) {
    return { ok: false, error: "El nombre del canal debe tener entre 1 y 60 letras, números, espacios, puntos o guiones." };
  }

  let description: string | null = null;
  if (body?.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string" || body.description.length > MAX_CHANNEL_DESCRIPTION) {
      return { ok: false, error: "La descripción es demasiado larga." };
    }
    description = body.description.trim() || null;
  }

  return {
    ok: true,
    value: {
      name,
      description,
      isE2EE: body?.isE2EE === true,
      isPrivate: body?.isPrivate === true,
    },
  };
}

export type EncryptedPayload = {
  cipherText: string;
  iv: string;
  salt: string;
  tag?: string;
};

function parseEncryptedPayload(value: any): EncryptedPayload | null {
  if (!value || typeof value !== "object") return null;
  const { cipherText, iv, salt, tag } = value;
  if (typeof cipherText !== "string" || cipherText.length === 0 || cipherText.length > MAX_CIPHER_CHARS) return null;
  if (typeof iv !== "string" || iv.length === 0 || iv.length > 128) return null;
  if (typeof salt !== "string" || salt.length === 0 || salt.length > 128) return null;
  if (tag !== undefined && (typeof tag !== "string" || tag.length > 128)) return null;
  return tag === undefined ? { cipherText, iv, salt } : { cipherText, iv, salt, tag };
}

export type MessageInput = {
  text: string;
  isE2EE: boolean;
  encryptedPayload: EncryptedPayload | null;
  isAudio: boolean;
  audioBase64: string | null;
  audioDuration: number | null;
};

// Valida un mensaje. Quién lo envía lo decide el servidor, nunca este cuerpo.
export function parseMessageInput(body: any, channelIsE2EE: boolean): Result<MessageInput> {
  const isE2EE = body?.isE2EE === true;
  const isAudio = body?.isAudio === true;

  if (channelIsE2EE && !isE2EE) {
    return { ok: false, error: "Este canal exige mensajes cifrados." };
  }

  if (isE2EE) {
    if (isAudio) {
      return { ok: false, error: "Los audios cifrados aún no están disponibles." };
    }
    const payload = parseEncryptedPayload(body?.encryptedPayload);
    if (!payload) {
      return { ok: false, error: "El mensaje cifrado no es válido." };
    }
    // Un mensaje cifrado NUNCA conserva el texto en claro, aunque el cliente lo envíe.
    return {
      ok: true,
      value: { text: "", isE2EE: true, encryptedPayload: payload, isAudio: false, audioBase64: null, audioDuration: null },
    };
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length > MAX_TEXT_CHARS) {
    return { ok: false, error: `El mensaje no puede pasar de ${MAX_TEXT_CHARS} caracteres.` };
  }

  let audioBase64: string | null = null;
  let audioDuration: number | null = null;

  if (isAudio) {
    const audio = body?.audioBase64;
    if (typeof audio !== "string" || audio.length === 0 || audio.length > MAX_AUDIO_BASE64_CHARS) {
      return { ok: false, error: "El audio no es válido o es demasiado grande." };
    }
    if (!/^(data:audio\/[a-z0-9.+-]+;base64,)?[A-Za-z0-9+/=]+$/i.test(audio)) {
      return { ok: false, error: "El audio no tiene un formato válido." };
    }
    const duration = Number(body?.audioDuration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_AUDIO_SECONDS) {
      return { ok: false, error: "La duración del audio no es válida." };
    }
    audioBase64 = audio;
    audioDuration = duration;
  } else if (text.length === 0) {
    return { ok: false, error: "Escribe un mensaje." };
  }

  return {
    ok: true,
    value: { text, isE2EE: false, encryptedPayload: null, isAudio, audioBase64, audioDuration },
  };
}

// Solo emojis (con modificadores, uniones y banderas). Nada de letras ni etiquetas.
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f|\p{Regional_Indicator})+$/u;

export function isValidEmoji(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 16 && EMOJI.test(value);
}

// Idiomas a los que hay que traducir: los de los demás miembros, sin repetir
// y sin el del remitente.
export function targetLanguages(memberLanguages: string[], senderLanguage: string): string[] {
  const out: string[] = [];
  for (const lang of memberLanguages) {
    if (isLanguageCode(lang) && lang !== senderLanguage && !out.includes(lang)) {
      out.push(lang);
    }
  }
  return out;
}

export function groupReactions(rows: { emoji: string; userId: string }[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const r of rows) {
    (map[r.emoji] ??= []).push(r.userId);
  }
  return map;
}

export type MessageRow = {
  id: string;
  channelId: string;
  senderId: string;
  text: string;
  originalText: string | null;
  translations: unknown;
  sourceLanguage: string;
  isE2EE: boolean;
  encryptedPayload: unknown;
  isAudio: boolean;
  audioDuration: number | null;
  audioBase64: string | null;
  createdAt: Date;
};

// Forma de mensaje que espera el frontend.
export function serializeMessage(
  row: MessageRow,
  sender: { name: string; avatar: string | null },
  reactions: Record<string, string[]> = {}
) {
  const translations =
    row.translations && typeof row.translations === "object" && !Array.isArray(row.translations)
      ? (row.translations as Record<string, string>)
      : undefined;

  return {
    id: row.id,
    channelId: row.channelId,
    senderId: row.senderId,
    senderName: sender.name,
    senderAvatar: sender.avatar ?? "",
    senderLanguage: row.sourceLanguage,
    timestamp: row.createdAt.getTime(),
    text: row.text,
    originalText: row.originalText ?? undefined,
    translations,
    isE2EE: row.isE2EE,
    encryptedPayload: row.isE2EE ? (row.encryptedPayload ?? undefined) : undefined,
    isAudio: row.isAudio || undefined,
    audioDuration: row.audioDuration ?? undefined,
    audioBase64: row.audioBase64 ?? undefined,
    reactions,
  };
    }
