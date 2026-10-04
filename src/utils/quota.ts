import { B2CPlanType, QuotaStatus, TopUpPackage } from '../types';

export interface PlanQuotaDefinition {
  id: B2CPlanType;
  label: string;
  priceMxn: number;
  priceUsd: number;
  days: number;
  translationsLimit: number; // -1 means unlimited
  isUnlimitedTranslations: boolean;
  voiceMinutesLimit: number; // Voice translation & cloning minutes cap
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

export const B2C_PLAN_LIMITS: Record<B2CPlanType, PlanQuotaDefinition> = {
  freemium: {
    id: 'freemium',
    label: 'Plan Freemium de por vida',
    priceMxn: 0,
    priceUsd: 0,
    days: 36500, // lifetime
    translationsLimit: 0,
    isUnlimitedTranslations: false,
    voiceMinutesLimit: 0,
    badge: 'De por vida',
    description: 'Chat, audio y llamadas normales en su mismo idioma. CERO% traducciones.',
  },
  free: {
    id: 'free',
    label: 'Plan Freemium de por vida',
    priceMxn: 0,
    priceUsd: 0,
    days: 36500,
    translationsLimit: 0,
    isUnlimitedTranslations: false,
    voiceMinutesLimit: 0,
    badge: 'De por vida',
    description: 'Chat, audio y llamadas normales en su mismo idioma. CERO% traducciones.',
  },
  express: {
    id: 'express',
    label: 'Plan Express (15 días)',
    priceMxn: 299,
    priceUsd: 15.0,
    days: 15,
    translationsLimit: -1,
    isUnlimitedTranslations: true,
    voiceMinutesLimit: 120, // 2 hours
    badge: '15 días',
    description: '120 minutos de voz (llamadas/clonación) y traducción de chat de texto ilimitado.',
  },
  semanal: {
    id: 'semanal',
    label: 'Plan Express (15 días)',
    priceMxn: 299,
    priceUsd: 15.0,
    days: 15,
    translationsLimit: -1,
    isUnlimitedTranslations: true,
    voiceMinutesLimit: 120,
    badge: '15 días',
    description: '120 minutos de voz (llamadas/clonación) y traducción de chat de texto ilimitado.',
  },
  mensual: {
    id: 'mensual',
    label: 'Plan Mensual (30 días)',
    priceMxn: 499,
    priceUsd: 25.0,
    days: 30,
    translationsLimit: -1,
    isUnlimitedTranslations: true,
    voiceMinutesLimit: 300, // 5 hours
    badge: 'MÁS POPULAR',
    description: '300 minutos de voz (5 horas) y traducción de chat de texto ilimitado.',
  },
  anual: {
    id: 'anual',
    label: 'Plan Anual (365 días)',
    priceMxn: 3999,
    priceUsd: 199.0,
    days: 365,
    translationsLimit: -1,
    isUnlimitedTranslations: true,
    voiceMinutesLimit: 4200, // 70 hours (~350 min/mo)
    badge: 'MEJOR VALOR',
    savings: 'Ahorro del 33%',
    description: '4,200 minutos anuales de voz (70 hrs) y traducción de chat de texto ilimitado.',
  },
};

export function normalizePlan(plan?: string): B2CPlanType {
  if (!plan) return 'mensual';
  const clean = plan.toLowerCase().trim();
  if (clean === 'express' || clean === 'pro_15d' || clean === '15d' || clean === 'semanal') return 'express';
  if (clean === 'mensual' || clean === 'pro_1m' || clean === '1m') return 'mensual';
  if (clean === 'anual' || clean === 'pro_1y' || clean === '1y') return 'anual';
  if (clean === 'freemium' || clean === 'free') return 'freemium';
  return 'mensual';
}

export interface StoredQuota {
  translationsUsed: number;
  callMinutesUsed: number;
  videoMinutesUsed: number;
  bonusVoiceMinutes: number;
  pdfDocumentsUsed: number;
  lastUpdated: number;
}

export function getQuotaStorageKey(plan: B2CPlanType): string {
  return `jcv_quota_${plan}`;
}

export function getStoredQuota(planInput?: string): StoredQuota {
  const plan = normalizePlan(planInput);
  const key = getQuotaStorageKey(plan);
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        translationsUsed: Number(parsed.translationsUsed) || 0,
        callMinutesUsed: Number(parsed.callMinutesUsed) || 0,
        videoMinutesUsed: Number(parsed.videoMinutesUsed) || 0,
        bonusVoiceMinutes: Number(parsed.bonusVoiceMinutes) || 0,
        pdfDocumentsUsed: Number(parsed.pdfDocumentsUsed) || 0,
        lastUpdated: Number(parsed.lastUpdated) || Date.now(),
      };
    } catch (e) {
      // ignore
    }
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

export function saveStoredQuota(planInput: string | undefined, data: StoredQuota): void {
  const plan = normalizePlan(planInput);
  const key = getQuotaStorageKey(plan);
  localStorage.setItem(key, JSON.stringify(data));
}

// Check translation quota status (Paid plans have unlimited text translation; freemium has 0)
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

  // Freemium: 0 translations allowed
  const used = quota.translationsUsed;
  const limit = limits.translationsLimit;
  const isExhausted = true;

  return {
    used,
    limit,
    remaining: 0,
    percent: 100,
    is80Percent: false,
    isExhausted,
  };
}

// Check voice minutes quota (includes bonus minutes from top-ups)
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

export function incrementTranslationQuota(planInput?: string): QuotaStatus {
  const plan = normalizePlan(planInput);
  const quota = getStoredQuota(plan);
  quota.translationsUsed += 1;
  quota.lastUpdated = Date.now();
  saveStoredQuota(plan, quota);
  return checkQuotaStatus(plan);
}

export function incrementCallQuota(
  planInput: string | undefined,
  durationSeconds: number,
  type: 'voice' | 'video'
): void {
  const plan = normalizePlan(planInput);
  const quota = getStoredQuota(plan);
  const addedMinutes = Math.ceil(durationSeconds / 60);

  if (type === 'video') {
    quota.videoMinutesUsed += addedMinutes;
  } else {
    quota.callMinutesUsed += addedMinutes;
  }
  quota.lastUpdated = Date.now();
  saveStoredQuota(plan, quota);
}

// Add top-up voice minutes (60 min or 200 min)
export function addTopUpMinutes(planInput: string | undefined, minutes: number): StoredQuota {
  const plan = normalizePlan(planInput);
  const quota = getStoredQuota(plan);
  quota.bonusVoiceMinutes = (quota.bonusVoiceMinutes || 0) + minutes;
  quota.lastUpdated = Date.now();
  saveStoredQuota(plan, quota);
  return quota;
}

// ==========================================
// B2B PACK 10 QUOTA
// ==========================================
export function getB2BPack10Remaining(): number {
  const raw = localStorage.getItem('jcv_quota_pack_10');
  if (raw !== null) {
    const val = parseInt(raw, 10);
    return isNaN(val) ? 10 : Math.max(0, val);
  }
  return 10;
}

export function consumeB2BPack10Contract(): { remaining: number; total: number } {
  const current = getB2BPack10Remaining();
  const next = Math.max(0, current - 1);
  localStorage.setItem('jcv_quota_pack_10', next.toString());
  return { remaining: next, total: 10 };
}

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
