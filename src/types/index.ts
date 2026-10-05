export type LanguageCode =
  | 'es' | 'en' | 'zh' | 'ja' | 'fr' | 'de'
  | 'pt' | 'it' | 'ru' | 'ko' | 'ar' | 'hi';

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'es', name: 'Español (MX)', nativeName: 'Español (México)', flag: '🇲🇽' },
  { code: 'en', name: 'Inglés', nativeName: 'English', flag: '🇺🇸' },
  { code: 'zh', name: 'Chino Mandarín', nativeName: '中文 (简体)', flag: '🇨🇳' },
  { code: 'ja', name: 'Japonés', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'fr', name: 'Francés', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Alemán', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Portugués', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'it', name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Ruso', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ko', name: 'Coreano', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'Árabe', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
];

// ═══════════════════════════════════════════════
// FREEMIUM — Usuario gratuito
// ═══════════════════════════════════════════════
export interface FreemiumLimits {
  messagesPerDay: number;
  maxCharsPerMessage: number;
}

// ═══════════════════════════════════════════════
// B2C — Planes individuales (15d, 1m, 1y)
// ═══════════════════════════════════════════════
export type B2CPlanId = 'B2C_15D' | 'B2C_1M' | 'B2C_1Y';

export interface B2CPlan {
  id: B2CPlanId;
  name: string;
  durationDays: number;
  priceCents: number;
  currency: 'MXN' | 'USD';
  features: string[];
  limits: {
    messagesPerDay: number;
    voiceMinutes: number;
    videoMinutes: number;
    translations: number; // -1 = unlimited
  };
  active: boolean;
  startsAt?: string;
  expiresAt?: string;
  autoRenew?: boolean;
}

// ═══════════════════════════════════════════════
// B2B — Planes empresariales (15d, 1m, 1y)
// ═══════════════════════════════════════════════
export type B2BPlanId = 'B2B_15D' | 'B2B_1M' | 'B2B_1Y';

export interface B2BPlan {
  id: B2BPlanId;
  companyName?: string;
  users?: number;
  durationDays: number;
  priceCents: number;
  currency: 'MXN' | 'USD';
  features: string[];
  seats: number;
  adminPanel: boolean;
  statsEnabled: boolean;
  active: boolean;
  startsAt?: string;
  expiresAt?: string;
  autoRenew?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  preferredLanguage: LanguageCode;
  role: 'admin' | 'user' | 'b2b_owner' | 'b2b_member';
  isOnline?: boolean;
  orgId?: string;
  companyName?: string;
  // Suscripciones (solo una activa a la vez)
  freemium?: FreemiumLimits;
  subscriptionB2C?: B2CPlan | null;
  subscriptionB2B?: B2BPlan | null;
  bonusVoiceMinutes?: number;
}

export interface E2EEMessagePayload {
  cipherText: string;
  iv: string;
  salt: string;
  tag?: string;
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderLanguage: LanguageCode;
  timestamp: number;
  text: string;
  originalText?: string;
  translations?: Record<string, string>;
  skipTranslation?: boolean;
  isE2EE: boolean;
  encryptedPayload?: E2EEMessagePayload;
  isAudio?: boolean;
  audioDuration?: number;
  audioBase64?: string;
  aiModel?: string;
  translationAccuracy?: string;
  reactions?: Record<string, string[]>;
  module?: 'freemium' | 'b2c' | 'b2b'; // Trazabilidad
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  isE2EE: boolean;
  e2eeFingerprint?: string;
  defaultTopic?: string;
  participantIds?: string[];
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: number;
}

export type PaymentGateway = 'mercadopago' | 'stripe' | 'paypal';

export interface TopUpPackage {
  id: string;
  name: string;
  minutes: number;
  priceMxn: number;
  priceUsd: number;
  description: string;
  badge?: string;
}

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  is80Percent: boolean;
  isExhausted: boolean;
}

// Legacy - mantener compatibilidad con Vault
export type VaultPlanId = 'individual_20p' | 'individual_100p' | 'pack_10';
export type VaultTimerOption = '30m' | '1h' | '1h 30m' | '2h' | '2h 30m' | '3h';

export interface VaultPlan {
  id: VaultPlanId;
  name: string;
  pagesLimit?: number;
  deliveryTime: string;
  priceMxn: number;
  priceUsd: number;
  unitPriceMxn?: number;
  savingsMxn?: number;
  validityDays?: number;
  totalContracts?: number;
  badge?: string;
  description: string;
}

export interface VaultCertificate {
  id: string;
  documentName: string;
  destroyedAt: string;
  date: string;
  time: string;
  year: string;
  hash: string;
  shortHash: string;
  pages: number;
  timerSelected: string;
  packRemaining: string;
  cfdiFolio: string;
  status: string;
}

export type VaultStep =
  | 'overview' | 'step1_plan' | 'step2_upload'
  | 'step3_translating' | 'step4_download' | 'step5_destroyed';
