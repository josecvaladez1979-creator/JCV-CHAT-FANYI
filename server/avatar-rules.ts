// ========================================================
// FOTO DE PERFIL — reglas puras de validación
// Solo se aceptan JPEG, PNG y WebP. NUNCA SVG ni GIF: un SVG puede llevar código.
// El tipo se decide por los BYTES de la imagen, no por lo que diga quien la sube.
// ========================================================

export const MAX_AVATAR_BYTES = 80 * 1024;
const MAX_DATA_URL_CHARS = Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 200;

export type AvatarMime = "image/jpeg" | "image/png" | "image/webp";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_END = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]); // "IEND" + CRC

// Además de la firma del inicio, se revisa que el final sea el correcto:
// así se rechazan archivos truncados o mezclados con otra cosa.
export function detectImageMime(buf: Buffer): AvatarMime | null {
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return buf[buf.length - 2] === 0xff && buf[buf.length - 1] === 0xd9 ? "image/jpeg" : null;
  }
  if (buf.length >= 20 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return buf.subarray(buf.length - 8).equals(PNG_END) ? "image/png" : null;
  }
  if (buf.length >= 16 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return buf.readUInt32LE(4) === buf.length - 8 ? "image/webp" : null;
  }
  return null;
}

export function parseAvatarUpload(
  value: unknown
): { ok: true; mime: AvatarMime; bytes: Buffer } | { ok: false; error: string } {
  const invalid = { ok: false as const, error: "La imagen no es válida. Usa una foto JPG, PNG o WebP." };

  if (typeof value !== "string" || value.length === 0) return invalid;
  if (value.length > MAX_DATA_URL_CHARS) {
    return { ok: false, error: "La imagen es demasiado pesada (máximo 80 KB)." };
  }

  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return invalid;

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) return invalid;
  if (bytes.length > MAX_AVATAR_BYTES) {
    return { ok: false, error: "La imagen es demasiado pesada (máximo 80 KB)." };
  }

  const mime = detectImageMime(bytes);
  if (!mime || mime !== `image/${match[1]}`) return invalid;

  return { ok: true, mime, bytes };
}
