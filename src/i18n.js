// Forzar MX la primera vez
if (typeof window !== 'undefined' && !localStorage.getItem('jcv_lang')) {
  localStorage.setItem('jcv_lang', 'es');
}

// ===== 1. IDIOMAS MUNDIAL AUTOMÁTICO =====
const translations = {
  "es": { call: "📞 Llamar", videoCall: "📹 Videollamada", encrypted: "Cifrado de extremo a extremo •", micTitle: "🎙️ ¿Permitir micrófono?", micText: "Para llamada cifrada. No se guarda, se borra en 3h.", allow: "Permitir", cancel: "Cancelar", write: "Escribe tu mensaje cifrado", end: "Colgar" },
  "en": { call: "📞 Call", videoCall: "📹 Video call", encrypted: "End-to-end encrypted •", micTitle: "🎙️ Allow microphone?", micText: "For encrypted call. Not stored, deleted in 3h.", allow: "Allow", cancel: "Cancel", write: "Type encrypted message", end: "End" },
  "ru": { call: "📞 Вызов", videoCall: "📹 Видеовызов", encrypted: "Сквозное шифрование •", micTitle: "🎙️ Разрешить микрофон?", micText: "Для зашифрованного звонка. Удаляется через 3ч.", allow: "Разрешить", cancel: "Отмена", write: "Сообщение", end: "Завершить" },
  "zh": { call: "📞 通话", videoCall: "📹 视频通话", encrypted: "端到端加密 •", micTitle: "🎙️ 允许麦克风？", micText: "加密通话需要。3小时后删除。", allow: "允许", cancel: "取消", write: "输入消息", end: "挂断" },
  "fa": { call: "📞 تماس", videoCall: "📹 تماس تصویری", encrypted: "رمزگذاری سرتاسری •", micTitle: "🎙️ اجازه میکروفون؟", micText: "برای تماس امن. بعد ۳ ساعت پاک می شود.", allow: "اجازه", cancel: "لغو", write: "پیام", end: "پایان" },
  "ar": { call: "📞 اتصال", videoCall: "📹 فيديو", encrypted: "تشفير تام •", micTitle: "🎙️ السماح بالميكروفون؟", micText: "للمكالمة المشفرة. يحذف بعد 3 ساعات.", allow: "السماح", cancel: "إلغاء", write: "رسالة", end: "إنهاء" },
  "fr": { call: "📞 Appeler", videoCall: "📹 Vidéo", encrypted: "Chiffrement bout à bout •", micTitle: "🎙️ Autoriser micro?", micText: "Pour appel chiffré. Supprimé en 3h.", allow: "Autoriser", cancel: "Annuler", write: "Message", end: "Raccrocher" },
  "sw": { call: "📞 Piga", videoCall: "📹 Video", encrypted: "Usimbaji salama •", micTitle: "🎙️ Ruhusu maiki?", micText: "Kwa simu salama. Inafutwa baada ya 3h.", allow: "Ruhusu", cancel: "Ghairi", write: "Ujumbe", end: "Kata" },
  "pt": { call: "📞 Ligar", videoCall: "📹 Vídeo", encrypted: "Criptografia ponta a ponta •", micTitle: "🎙️ Permitir microfone?", micText: "Para chamada segura. Apaga em 3h.", allow: "Permitir", cancel: "Cancelar", write: "Mensagem", end: "Desligar" }
};

export function getLang() {
  const s = localStorage.getItem('jcv_lang');
  if (s) return s;
  const b = (navigator.language || 'es').slice(0, 2).toLowerCase();
  return translations[b] ? b : 'es';
}

export function t(k) {
  const l = getLang();
  return translations[l]?.[k] || translations['es']?.[k] || translations['en']?.[k] || k;
}

export const setLang = (l) => {
  localStorage.setItem('jcv_lang', l);
  location.reload();
};

if (typeof window !== 'undefined') {
  window.t = t;
  window.setLang = setLang;
  if (document.documentElement) {
    document.documentElement.lang = getLang();
  }
}

export { translations };
