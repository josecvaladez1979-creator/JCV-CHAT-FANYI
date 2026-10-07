import { B2CPlanType, QuotaStatus, TopUpPackage } from '../types';

// ═══════════════════════════════════════════════
// DEFINICIONES DE PLANES Y CUOTAS
// ═══════════════════════════════════════════════

export interface PlanQuotaDefinition {
  id: B2CPlanType;
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

export interface StoredQuota {
  translationsUsed: number;
  callMinutesUsed: number;
  videoMinutesUsed: number;
  bonusVoiceMinutes: number;
  pdfDocumentsUsed: number;
  lastUpdated: number;
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

export const B2C_PLAN_LIMITS: Record<B2CPlanType, PlanQuotaDefinition> = {
  freemium: {
    id: 'freemium',
    label: 'Plan Freemium de por vida',
    priceMxn: 0,
    priceUsd: 0,
    days: 36500,
    translationsLimit: 20,
    isUnlimitedTranslations: false,
    voiceMinutesLimit: 0,
    badge: 'De por vida',
    description: 'Chat gratis de por vida. 20 traducciones IA por dia.',
  },
  free: {
    id: 'free',
    label: 'Plan Freemium de por vida',
    priceMxn: 0,
    priceUsd: 0,
    days: 36500,
    translationsLimit: 20,
    isUnlimitedTranslations: false,
    voiceMinutesLimit: 0,
    badge: 'De por vida',
    description: 'Chat gratis de por vida. 20 traducciones IA por dia.',
  },
  express: {
    id: 'express',
    label: 'Plan Express (15 dias)',
    priceMxn: 299,
    priceUsd: 15.0,
    days: 15,
    translationsLimit: -1,
    isUnlimitedTranslations: true,
    voiceMinutesLimit: 120,
    badge: '15 dias',
    description: '120 minutos de voz y traduccion de chat ilimitada.',
  },
  semanal: {
    id: 'semanal',
    label: 'Plan Express (15 dias)',
    priceMxn: 299,
    priceUsd: 15.0,
    days: 15,
    translationsLimit: -1,
    isUnlimitedTranslations: true,
    voiceMinutesLimit: 120,
    badge: '15 dias',
    description: '120 minutos de voz y traduccion de chat ilimitada.',
  },
  mensual: {
    id: 'mensual',
    label: 'Plan Mensual (30 dias)',
    priceMxn: 499,
    priceUsd: 25.0,
    days: 30,
    translationsLimit: -1,
    isUnlimitedTranslations: true,
    voiceMinutesLimit: 300,
    badge: 'MAS POPULAR',
    description: '300 minutos de voz y traduccion de chat ilimitada.',
  },
  anual: {
    id: 'anual',
    label: 'Plan Anual (365 dias)',
    priceMxn: 3999,
    priceUsd: 199.0,
    days: 365,
    translationsLimit: -1,
    isUnlimitedTranslations: true,
    voiceMinutesLimit: 4200,
    badge: 'MEJOR VALOR',
    savings: 'Ahorro del 33%',
    description: '4200 minutos anuales de voz y traduccion ilimitada.',
  },
};

export const PLAN_LIMITS = B2C_PLAN_LIMITS;

// ═══════════════════════════════════════════════
// ALMACENAMIENTO LOCAL DE CUOTAS
// ═══════════════════════════════════════════════

const QUOTA_STORAGE_KEY = 'jcv_quota_';

export function getStoredQuota(plan: B2CPlanType): StoredQuota {
  try {
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY + plan);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredQuota;
      const today = new Date().toISOString().slice(0, 10);
      const storedDay = localStorage.getItem('jcv_quota_day');
      if (storedDay !== today) {
        parsed.translationsUsed = 0;
      }
      return parsed;
    }
  } catch (e) {
    // ignore parse errors
  }
  return {
    translationsUsed: 0,
    callMinutesUsed: 0,
    videoMinutesUsed: 0,
    bonusVoiceMinutes: 0,
    pdfDocumentsUsed: 0,
    lastUpdated: Date.now(),
  };
}

export function saveStoredQuota(plan: B2CPlanType, quota: StoredQuota): void {
  localStorage.setItem(QUOTA_STORAGE_KEY + plan, JSON.stringify(quota));
}

// ═══════════════════════════════════════════════
// NORMALIZACION DE PLANES
// ═══════════════════════════════════════════════

export function normalizePlan(planInput?: string): B2CPlanType {
  if (!planInput) return 'freemium';
  const map: Record<string, B2CPlanType> = {
    freemium: 'freemium',
    free: 'free',
    express: 'express',
    semanal: 'semanal',
    '15d': 'express',
    pro_15d: 'express',
    mensual: 'mensual',
    '1m': 'mensual',
    pro_1m: 'mensual',
    anual: 'anual',
    '1y': 'anual',
    pro_1y: 'anual',
    FREEMIUM: 'freemium',
    B2C_15D: 'express',
    B2C_1M: 'mensual',
    B2C_1Y: 'anual',
  };
  return map[planInput] || 'freemium';
}

// ═══════════════════════════════════════════════
// ESTADO DE CUOTAS
// ═══════════════════════════════════════════════

export function checkQuotaStatus(planInput?: string): QuotaStatus {
  const plan = normalizePlan(planInput);
  const limits = B2C_PLAN_LIMITS[plan];
  const quota = getStoredQuota(plan);

  if (limits.isUnlimitedTranslations) {
    return {
      used: quota.translationsUsed,
      limit: 999999,
      remaining: 999999,
      percent: 0,
      is80Percent: false,
      isExhausted: false,
    };
  }

  const used = quota.translationsUsed;
  const limit = limits.translationsLimit;
  const remaining = Math.max(0, limit - used);
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const is80Percent = percent >= 80 && percent < 100;
  const isExhausted = used >= limit;

  return { used, limit, remaining, percent, is80Percent, isExhausted };
}

export function checkVoiceQuotaStatus(planInput?: string): {
  usedMinutes: number;
  totalLimit: number;
  remainingMinutes: number;
  percent: number;
  is80Percent: boolean;
  isExhausted: boolean;
  bonusMinutes: number;
} {
  const plan = normalizePlan(planInput);
  const limits = B2C_PLAN_LIMITS[plan];
  const quota = getStoredQuota(plan);

  const usedMinutes = quota.callMinutesUsed + quota.videoMinutesUsed;
  const totalLimit = limits.voiceMinutesLimit + (quota.bonusVoiceMinutes || 0);

  if (totalLimit === 0) {
    return {
      usedMinutes,
      totalLimit: 0,
      remainingMinutes: 0,
      percent: 100,
      is80Percent: false,
      isExhausted: true,
      bonusMinutes: 0,
    };
  }

  const remainingMinutes = Math.max(0, totalLimit - usedMinutes);
  const percent = Math.min(100, Math.round((usedMinutes / totalLimit) * 100));
  const is80Percent = percent >= 80 && percent < 100;
  const isExhausted = usedMinutes >= totalLimit;

  return {
    usedMinutes,
    totalLimit,
    remainingMinutes,
    percent,
    is80Percent,
    isExhausted,
    bonusMinutes: quota.bonusVoiceMinutes || 0,
  };
}

// ═══════════════════════════════════════════════
// INCREMENTOS DE CUOTA
// ═══════════════════════════════════════════════

export function incrementTranslationQuota(planInput?: string): QuotaStatus {
  const plan = normalizePlan(planInput);
  const quota = getStoredQuota(plan);
  quota.translationsUsed += 1;
  quota.lastUpdated = Date.now();
  localStorage.setItem('jcv_quota_day', new Date().toISOString().slice(0, 10));
  saveStoredQuota(plan, quota);
  return checkQuotaStatus(plan);
}

export function incrementCallQuota(
  planInput: string | undefined,
  durationSeconds: number,
  callType: 'voice' | 'video'
): void {
  const plan = normalizePlan(planInput);
  const minutes = Math.ceil(durationSeconds / 60);
  if (minutes <= 0) return;

  const quota = getStoredQuota(plan);
  if (callType === 'video') {
    quota.videoMinutesUsed += minutes;
  } else {
    quota.callMinutesUsed += minutes;
  }
  quota.lastUpdated = Date.now();
  saveStoredQuota(plan, quota);
}

// ═══════════════════════════════════════════════
// B2B VAULT - PACK 10 CONTRATOS
// ═══════════════════════════════════════════════

export function getB2BPack10Remaining(): number {
  const stored = localStorage.getItem('jcv_b2b_pack10_remaining');
  if (stored === null) {
    localStorage.setItem('jcv_b2b_pack10_remaining', '10');
    return 10;
  }
  const value = parseInt(stored, 10);
  return isNaN(value) ? 10 : value;
}

export function consumeB2BPack10Contract(): { remaining: number } {
  const current = getB2BPack10Remaining();
  const newRemaining = Math.max(0, current - 1);
  localStorage.setItem('jcv_b2b_pack10_remaining', String(newRemaining));
  return { remaining: newRemaining };
}

export function resetB2BPack10(): void {
  localStorage.setItem('jcv_b2b_pack10_remaining', '10');
}

// ═══════════════════════════════════════════════
// RESET GENERAL Y UTILIDADES
// ═══════════════════════════════════════════════

export function resetQuota(planInput?: string): void {
  const plan = normalizePlan(planInput);
  saveStoredQuota(plan, {
    translationsUsed: 0,
    callMinutesUsed: 0,
    videoMinutesUsed: 0,
    bonusVoiceMinutes: 0,
    pdfDocumentsUsed: 0,
    lastUpdated: Date.now(),
  });
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
