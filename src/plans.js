// ===== Compatibilidad: ya NO decide planes ni pagos =====
// Antes este archivo decidía en el navegador si alguien "tenía un pack pagado"
// leyendo localStorage, y cualquiera podía engañarlo desde las herramientas del
// navegador. Ahora el saldo y los cobros los lleva el servidor.
//
// Se conserva con los mismos nombres porque main.tsx lo importa y otros
// scripts podrían usar estas funciones. Cuando se revisen jcv-world.js e i18n.js
// se podrá borrar este archivo, junto con su importación en main.tsx.

export const PLAN_FREEMIUM = {
  id: "freemium",
  nombre: "Chat gratis en tu idioma",
  precio: 0,
  traducciones_incluidas: 0,
  chat_nativo: "GRATIS",
  llamadas_voz: "CON_SALDO",
  videollamadas: "CON_SALDO",
  audio: "CON_SALDO",
  vigencia: "SIN_VENCIMIENTO",
};

export function getPlan() {
  return PLAN_FREEMIUM;
}

// El navegador nunca decide si hay un pago: lo decide el servidor.
export function tienePackPagado() {
  return false;
}

// La traducción la hace el servidor según el saldo; aquí no se traduce nada.
export function traducirMensaje(mensaje) {
  return mensaje;
}

if (typeof window !== 'undefined') {
  window.PLAN_FREEMIUM = PLAN_FREEMIUM;
  window.getPlan = getPlan;
  window.tienePackPagado = tienePackPagado;
  window.traducirMensaje = traducirMensaje;
  window.traduccionActiva = false;
}
