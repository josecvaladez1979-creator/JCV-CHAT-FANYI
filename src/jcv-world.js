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

export function getLang(){ const s=localStorage.getItem('jcv_lang'); if(s) return s; const b=(navigator.language||'es').slice(0,2).toLowerCase(); return translations[b]?b:'es'; }
export function t(k){ const l=getLang(); return translations[l]?.[k] || translations['es']?.[k] || translations['en']?.[k] || k; }
export const setLang = (l)=>{ localStorage.setItem('jcv_lang',l); location.reload(); }
window.t=t; window.setLang=setLang;
document.documentElement.lang=getLang();

// ===== 2. LLAMADAS SIN PEDIR CADA VEZ =====
let localStream = null;

export function connectToRoom(stream, isVideo) {
  if (typeof window.onJcvConnectToRoom === 'function') {
    window.onJcvConnectToRoom(stream, isVideo);
  }
  const callScreen = document.getElementById('callScreen');
  if (callScreen) callScreen.style.display = 'block';
}
window.connectToRoom = connectToRoom;

window.startCall = async (isVideo) => {
  // Si ya tiene stream, conecta directo 
  if(localStream && localStream.active && localStream.getTracks().some(t => t.readyState === 'live')){
    connectToRoom(localStream, isVideo);
    return;
  }
  // Primera vez: pide 1 vez y guarda
  try{
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo? {facingMode:"user"} : false });
    localStorage.setItem('jcv_perm_granted','true');
    connectToRoom(localStream, isVideo);
  }catch(e){
    // Modal en su idioma
    const ok = confirm(t('micTitle') + "\n" + t('micText') + "\n\n" + t('allow') + "?");
    if(ok) window.startCall(isVideo);
  }
}
window.endCall = () => { 
  const cs = document.getElementById('callScreen');
  if (cs) cs.style.display='none'; 
  if (typeof window.onJcvEndCall === 'function') {
    window.onJcvEndCall();
  }
  /* NO detengas localStream para que la próxima entre directo */ 
}

// Auto-traducir botones al cargar
export function updateI18nElements() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
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

window.addEventListener('DOMContentLoaded', ()=>{
  updateI18nElements();
});

export { translations, localStream };
