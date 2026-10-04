export type LanguageCode =
  | 'es'
  | 'en'
  | 'zh'
  | 'ja'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'ru'
  | 'ko'
  | 'ar'
  | 'hi';

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

export type B2CPlanType = 'freemium' | 'free' | 'express' | 'semanal' | 'mensual' | 'anual';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  preferredLanguage: LanguageCode;
  role: 'admin' | 'user';
  isOnline?: boolean;
  subscriptionPlan?: 'freemium' | 'free' | 'express' | 'semanal' | 'mensual' | 'anual' | 'pro_15d' | 'pro_1m' | 'pro_1y';
  subscriptionStatus?: 'active' | 'trial' | 'expired';
  subscriptionExpiresAt?: string;
  subscriptionGateway?: 'mercadopago' | 'stripe' | 'paypal';
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
  // Raw or decrypted message
  text: string;
  // Original text before translation
  originalText?: string;
  // Target translation cache map: [languageCode]: translatedText
  translations?: Record<string, string>;
  skipTranslation?: boolean;
  // E2EE data
  isE2EE: boolean;
  encryptedPayload?: E2EEMessagePayload;
  // Audio voice note
  isAudio?: boolean;
  audioDuration?: number; // seconds
  audioBase64?: string;
  // Model used for translation
  aiModel?: string;
  translationAccuracy?: string;
  reactions?: Record<string, string[]>; // emoji: userIds[]
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

export type BillingCycle = 'express' | 'mensual' | 'anual' | 'semanal' | '15d' | '1m' | '1y';
export type PaymentGateway = 'mercadopago' | 'stripe' | 'paypal';

export type TopUpPackageId = 'topup_mini' | 'topup_pro';

export interface TopUpPackage {
  id: TopUpPackageId;
  name: string;
  minutes: number;
  priceMxn: number;
  priceUsd: number;
  description: string;
  badge?: string;
}

export interface PlanPricing {
  cycle: BillingCycle;
  cycleLabel: string;
  days: number;
  priceUsd: number;
  priceMxn: number;
  savingsLabel?: string;
  description: string;
  features: string[];
  translationsLimit: number;
  callMinutesLimit: number;
  videoMinutesLimit: number;
  pdfDocumentsLimit?: number;
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
  | 'overview'
  | 'step1_plan'
  | 'step2_upload'
  | 'step3_translating'
  | 'step4_download'
  | 'step5_destroyed';

