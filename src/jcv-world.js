// Textos de la interfaz en varios idiomas y utilidades de idioma.
// Antes este archivo también pedía el micrófono con avisos falsos ("llamada
// cifrada, se borra en 3h") y abría llamadas que no existen. Eso se quitó: las
// llamadas se rehacerán cuando exista su servidor.

// Forzar español la primera vez
if (typeof window !== 'undefined' && !localStorage.getItem('jcv_lang')) {
  localStorage.setItem('jcv_lang', 'es');
}

// ===== Idiomas de la interfaz =====
// Cubre tus 12 idiomas de traducción (es, en, zh, ja, fr, de, pt, it, ru, ko, ar, pl)
// y conserva farsi y suajili. Una clave que falte en un idioma se muestra en español.
const translations = {
  es: { call: "📞 Llamar", videoCall: "📹 Videollamada", encrypted: "Cifrado de extremo a extremo •", micTitle: "🎙️ ¿Permitir micrófono?", micText: "Para hacer llamadas necesitamos usar tu micrófono.", allow: "Permitir", cancel: "Cancelar", write: "Escribe tu mensaje", end: "Colgar" },
  en: { call: "📞 Call", videoCall: "📹 Video call", encrypted: "End-to-end encrypted •", micTitle: "🎙️ Allow microphone?", micText: "To make calls we need to use your microphone.", allow: "Allow", cancel: "Cancel", write: "Type your message", end: "End" },
  ru: { call: "📞 Вызов", videoCall: "📹 Видеовызов", encrypted: "Сквозное шифрование •", allow: "Разрешить", cancel: "Отмена", write: "Сообщение", end: "Завершить" },
  zh: { call: "📞 通话", videoCall: "📹 视频通话", encrypted: "端到端加密 •", allow: "允许", cancel: "取消", write: "输入消息", end: "挂断" },
  fa: { call: "📞 تماس", videoCall: "📹 تماس تصویری", encrypted: "رمزگذاری سرتاسری •", allow: "اجازه", cancel: "لغو", write: "پیام", end: "پایان" },
  ar: { call: "📞 اتصال", videoCall: "📹 فيديو", encrypted: "تشفير تام •", allow: "السماح", cancel: "إلغاء", write: "رسالة", end: "إنهاء" },
  fr: { call: "📞 Appeler", videoCall: "📹 Vidéo", encrypted: "Chiffrement bout à bout •", allow: "Autoriser", cancel: "Annuler", write: "Message", end: "Raccrocher" },
  sw: { call: "📞 Piga", videoCall: "📹 Video", encrypted: "Usimbaji salama •", allow: "Ruhusu", cancel: "Ghairi", write: "Ujumbe", end: "Kata" },
  pt: { call: "📞 Ligar", videoCall: "📹 Vídeo", encrypted: "Criptografia ponta a ponta •", allow: "Permitir", cancel: "Cancelar", write: "Mensagem", end: "Desligar" },
  de: { call: "📞 Anrufen", videoCall: "📹 Videoanruf", encrypted: "Ende-zu-Ende-verschlüsselt •", allow: "Erlauben", cancel: "Abbrechen", write: "Nachricht schreiben", end: "Auflegen" },
  ja: { call: "📞 通話", videoCall: "📹 ビデオ通話", encrypted: "エンドツーエンド暗号化 •", allow: "許可", cancel: "キャンセル", write: "メッセージを入力", end: "切る" },
  it: { call: "📞 Chiama", videoCall: "📹 Videochiamata", encrypted: "Crittografia end-to-end •", allow: "Consenti", cancel: "Annulla", write: "Scrivi un messaggio", end: "Termina" },
  ko: { call: "📞 전화", videoCall: "📹 영상 통화", encrypted: "종단 간 암호화 •", allow: "허용", cancel: "취소", write: "메시지 입력", end: "종료" },
  pl: { call: "📞 Zadzwoń", videoCall: "📹 Połączenie wideo", encrypted: "Szyfrowanie end-to-end •", allow: "Zezwól", cancel: "Anuluj", write: "Napisz wiadomość", end: "Rozłącz" },
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

// ===== Compatibilidad =====
// Se conservan estos nombres por si otros archivos los importan. Las llamadas
// (permiso de micrófono, conexión) ya no viven aquí.
export const localStream = null;

export function connectToRoom() {
  // Sin efecto: las llamadas aún no están disponibles.
}

// Traduce los elementos con data-i18n al cargar la página.
export function updateI18nElements() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) {
      const translated = t(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translated;
      } else {
        el.textContent = translated;
      }
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    updateI18nElements();
  });
}

export { translations };
