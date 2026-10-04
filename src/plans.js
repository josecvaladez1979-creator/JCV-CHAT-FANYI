// ===== MODELO DEFINITIVO: JCV CHAT ES GRATIS DE POR VIDA =====
// REGLA DE ORO: JCV CHAT nunca está sujeto a plan. Es gratis de por vida.
// El chat normal, llamadas, videollamadas y notas de voz son 100% ILIMITADOS Y GRATUITOS.
// Los planes o packs únicamente añaden TRADUCCIÓN IA multilingüe con Qwen3-32B.

export const PLAN_FREEMIUM = {
  id: "freemium_vida",
  nombre: "Plan Freemium de por vida",
  precio: 0,
  traducciones_incluidas: 0,
  chat_nativo: "ILIMITADO_GRATIS",
  llamadas_voz: "ILIMITADO_GRATIS", 
  videollamadas: "ILIMITADO_GRATIS",
  audio: "ILIMITADO_GRATIS",
  vigencia: "HASTA_QUE_LA_APP_DEJE_DE_EXISTIR"
};

export function getPlan() {
  if (typeof window === 'undefined') return PLAN_FREEMIUM;
  const storedPlan = localStorage.getItem('jcv_plan');
  if (!storedPlan || storedPlan === 'freemium' || storedPlan === 'free') {
    return PLAN_FREEMIUM;
  }
  try {
    return JSON.parse(storedPlan);
  } catch (e) {
    return PLAN_FREEMIUM;
  }
}

export function tienePackPagado() {
  if (typeof window === 'undefined') return false;
  const plan = localStorage.getItem('jcv_user_plan');
  const paidPlans = ['express', 'semanal', 'mensual', 'anual', 'pack_10', 'pack_b2b', 'individual_pro', 'b2b_vault'];
  return paidPlans.includes(plan || '');
}

export function traducirMensaje(mensaje, traducirConSiliconFlow) {
  if (getPlan().traducciones_incluidas === 0 && !tienePackPagado()) {
    return mensaje; // Devuelve mensaje original en su idioma natal, sin traducir
  }
  // Si tiene Pack 10, B2B, etc, ahí sí usa SiliconFlow 99%
  if (typeof traducirConSiliconFlow === 'function') {
    return traducirConSiliconFlow(mensaje);
  }
  return mensaje;
}

if (typeof window !== 'undefined') {
  window.PLAN_FREEMIUM = PLAN_FREEMIUM;
  window.getPlan = getPlan;
  window.tienePackPagado = tienePackPagado;
  window.traducirMensaje = traducirMensaje;
  window.traduccionActiva = tienePackPagado();
}
