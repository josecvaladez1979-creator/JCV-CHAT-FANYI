import { B2CPlanId, QuotaStatus, TopUpPackage } from '../types';

export interface PlanQuotaDefinition {
  id: B2CPlanId | 'FREEMIUM';
  label: string;
  priceMxn: number;
  priceUsd: number;
  days: number;
  translationsLimit: number;
  isUnlimitedTranslations: boolean;
  voiceMinutesLimit: number;
  badge?: string;
  savings?: string;
  description: string;
}

export const TOP_UP_PACKAGES: TopUpPackage[] = [
  {
    id: 'topup_mini',
    name: 'Paquete Mini',
    minutes: 60,
    priceMxn: 99,
    priceUsd: 5.0,
    description: '60 minutos extra de llamadas y clonación de voz.',
    badge: 'Popular',
  },
  {
    id: 'topup_pro',
    name: 'Paquete Pro',
    minutes: 200,
    priceMxn: 249,
    priceUsd: 12.5,
    description: '200 minutos extra de llamadas y clonación de voz.',
    badge: 'Mejor Valor',
  },
];

export const PLAN_LIMITS: Record<B2CPlanId | 'FREEMIUM', PlanQuotaDefinition> = {
  FREEMIUM: {
    id: 'FREEMIUM',
    label: 'Plan Freemium',
    priceMxn: 0,
    priceUsd: 0,
    days: 36500,
    translationsLimit: 10, // ← FIX: antes era 0, ahora 10 mensajes/día
    isUnlimitedTranslations: false,
    voiceMinutesLimit: 0,
    badge: 'Gratis',
    description: 'Chat gratuito con 10 traducciones/día. Sin herramientas premium.',
  },
  B2C_15D: {
    id: 'B2C_15D',
    label: 'B2C 15 días',
    priceMxn: 299,
    priceUsd: 15.0,
    days: 15,
    translationsLimit: -1,
    isUnlimitedTranslations: true,
    voiceMinutesLimit: 120,
    badge: '15 días',
    description: 'Traducción ilimitada + 120 min de voz.',
  },
  B2C_1M: {
    id: 'B2C_1M',
    label: 'B2C 1 mes',
    priceMxn: 499,
    priceUsd: 25.0,
    days: 30,
    translationsLimit: -1,
    isUnlimitedTranslations: true,
    voiceMinutesLimit: 300,
    badge: 'MÁS POPULAR',
    description: 'Traducción ilimitada + 300 min de voz.',
  },
  B2C_1Y: {
    id: 'B2C_1Y',
    label: 'B2C 1 año',
    priceMxn: 3999,
    priceUsd: 199.0,
    days: 365,
    translationsLimit: -1,
    isUnlimitedTranslations: true,
    voiceMinutesLimit: 4200,
    badge: 'MEJOR VALOR',
    savings: 'Ahorro del 33%',
    description: 'Traducción ilimitada + 4200 min de voz anuales.',
  },
};

export function checkQuotaStatus(planInput?: string, usedTranslations: number = 0): QuotaStatus {
  const plan = (planInput || 'FREEMIUM') as B2CPlanId | 'FREEMIUM';
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREEMIUM;

  if (limits.isUnlimitedTranslations) {
    return {
      used: usedTranslations,
      limit: 999999,
      remaining: 999999,
      percent: 0,
      is80Percent: false,
      isExhausted: false,
    };
  }

  // Freemium: límite real de 20 mensajes/día
  const used = usedTranslations;
  const limit = limits.translationsLimit;
  const remaining = Math.max(0, limit - used);
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const is80Percent = percent >= 80 && percent < 100;
  const isExhausted = used >= limit; // ← FIX: antes siempre era true

  return { used, limit, remaining, percent, is80Percent, isExhausted };
}

export function checkVoiceQuotaStatus(planInput?: string, usedMinutes: number = 0, bonusMinutes: number = 0) {
  const plan = (planInput || 'FREEMIUM') as B2CPlanId | 'FREEMIUM';
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREEMIUM;
  const totalLimit = limits.voiceMinutesLimit + bonusMinutes;

  if (totalLimit === 0) {
    return { usedMinutes: usedMinutes, totalLimit: 0, remainingMinutes: 0, percent: 100, is80Percent: false, isExhausted: true, bonusMinutes: 0 };
  }

  const remainingMinutes = Math.max(0, totalLimit - usedMinutes);
  const percent = Math.min(100, Math.round((usedMinutes / totalLimit) * 100));
  const is80Percent = percent >= 80 && percent < 100;
  const isExhausted = usedMinutes >= totalLimit;

  return { usedMinutes, totalLimit, remainingMinutes, percent, is80Percent, isExhausted, bonusMinutes };
}

export function resetQuota(): void {
  // La cuota ahora se maneja en el backend (por día)
  localStorage.removeItem('jcv_quota_translations');
  localStorage.removeItem('jcv_quota_day');
}

export function incrementTranslation(): number {
  const today = new Date().toISOString().slice(0, 10);
  const storedDay = localStorage.getItem('jcv_quota_day');
  let used = 0;
  if (storedDay === today) {
    used = parseInt(localStorage.getItem('jcv_quota_translations') || '0', 10);
  }
  used += 1;
  localStorage.setItem('jcv_quota_day', today);
  localStorage.setItem('jcv_quota_translations', String(used));
  return used;
}

export function getTodayTranslations(): number {
  const today = new Date().toISOString().slice(0, 10);
  const storedDay = localStorage.getItem('jcv_quota_day');
  if (storedDay !== today) return 0;
  return parseInt(localStorage.getItem('jcv_quota_translations') || '0', 10);
}
export { PLAN_LIMITS as B2C_PLAN_LIMITS }; // Alias para compatibilidad

// ═══════════════════════════════════════════════
// FUNCIONES DE COMPATIBILIDAD (usadas por ChatArea.tsx)
// ═══════════════════════════════════════════════

/**
 * Normaliza el plan del usuario a un ID válido de PLAN_LIMITS
 * Mapea planes legacy (pro_15d, pro_1m, etc) a los nuevos (B2C_15D, B2C_1M, etc)
 */
export function normalizePlan(planInput?: string): B2CPlanId | 'FREEMIUM' {
  if (!planInput) return 'FREEMIUM';

  // Mapeo de planes legacy a nuevos
  const planMap: Record<string, B2CPlanId | 'FREEMIUM'> = {
    'freemium': 'FREEMIUM',
    'free': 'FREEMIUM',
    'express': 'B2C_15D',
    'semanal': 'B2C_15D',
    '15d': 'B2C_15D',
    'pro_15d': 'B2C_15D',
    'mensual': 'B2C_1M',
    '1m': 'B2C_1M',
    'pro_1m': 'B2C_1M',
    'anual': 'B2C_1Y',
    '1y': 'B2C_1Y',
    'pro_1y': 'B2C_1Y',
    'B2C_15D': 'B2C_15D',
    'B2C_1M': 'B2C_1M',
    'B2C_1Y': 'B2C_1Y',
  };

  return planMap[planInput] || 'FREEMIUM';
}

/**
 * Incrementa el contador de traducciones y retorna el nuevo estado de quota
 * Usado por ChatArea.tsx cuando el usuario envía un mensaje
 */
export function incrementTranslationQuota(planInput?: string): QuotaStatus {
  const plan = normalizePlan(planInput);
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREEMIUM;

  // Incrementar contador en localStorage
  const today = new Date().toISOString().slice(0, 10);
  const storedDay = localStorage.getItem('jcv_quota_day');
  let used = 0;

  if (storedDay === today) {
    used = parseInt(localStorage.getItem('jcv_quota_translations') || '0', 10);
  }

  used += 1;
  localStorage.setItem('jcv_quota_day', today);
  localStorage.setItem('jcv_quota_translations', String(used));

  // Retornar el nuevo estado de quota
  if (limits.isUnlimitedTranslations) {
    return {
      used,
      limit: 999999,
      remaining: 999999,
      percent: 0,
      is80Percent: false,
      isExhausted: false,
    };
  }

  const limit = limits.translationsLimit;
  const remaining = Math.max(0, limit - used);
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const is80Percent = percent >= 80 && percent < 100;
  const isExhausted = used >= limit;

  return { used, limit, remaining, percent, is80Percent, isExhausted };
      }
/**
 * Incrementa el contador de minutos de llamadas (voz o video)
 * Usado por CallModal.tsx cuando el usuario cuelga una llamada
 */
export function incrementCallQuota(
  planInput: string | undefined,
  durationSeconds: number,
  callType: 'voice' | 'video'
): void {
  const plan = normalizePlan(planInput);

  // Convertir segundos a minutos (redondeando hacia arriba)
  const minutes = Math.ceil(durationSeconds / 60);
  if (minutes <= 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const storedDay = localStorage.getItem('jcv_quota_day');

  let callMinutesUsed = 0;
  let videoMinutesUsed = 0;

  if (storedDay === today) {
    callMinutesUsed = parseInt(localStorage.getItem('jcv_quota_call_minutes') || '0', 10);
    videoMinutesUsed = parseInt(localStorage.getItem('jcv_quota_video_minutes') || '0', 10);
  } else {
    // Nuevo día, inicializar contadores
    localStorage.setItem('jcv_quota_day', today);
  }

  // Incrementar según el tipo de llamada
  if (callType === 'video') {
    videoMinutesUsed += minutes;
    localStorage.setItem('jcv_quota_video_minutes', String(videoMinutesUsed));
  } else {
    callMinutesUsed += minutes;
    localStorage.setItem('jcv_quota_call_minutes', String(callMinutesUsed));
  }

  console.log(`📞 Call quota updated: +${minutes} min (${callType}) | Total: ${callMinutesUsed + videoMinutesUsed} min`);
}
