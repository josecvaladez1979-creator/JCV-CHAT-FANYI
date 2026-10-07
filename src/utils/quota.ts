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
// ═══════════════════════════════════════════════
// B2B VAULT — Pack 10 Contratos (JCV FĀNYÌ VAULT)
// ═══════════════════════════════════════════════

/**
 * Retorna cuántos contratos quedan en el Pack 10 B2B
 * Se inicializa con 10 si es la primera vez
 */
export function getB2BPack10Remaining(): number {
  const stored = localStorage.getItem('jcv_b2b_pack10_remaining');
  if (stored === null) {
    // Primera vez: inicializar con 10 contratos
    localStorage.setItem('jcv_b2b_pack10_remaining', '10');
    return 10;
  }
  const value = parseInt(stored, 10);
  return isNaN(value) ? 10 : value;
}

/**
 * Consume 1 contrato del Pack 10 B2B
 * Retorna el nuevo estado { remaining: number }
 */
export function consumeB2BPack10Contract(): { remaining: number } {
  const current = getB2BPack10Remaining();
  const newRemaining = Math.max(0, current - 1);
  localStorage.setItem('jcv_b2b_pack10_remaining', String(newRemaining));
  console.log(`📄 B2B Pack 10: contrato consumido, quedan ${newRemaining}`);
  return { remaining: newRemaining };
}

/**
 * Resetear el contador del Pack 10 (usado al renovar/comprar de nuevo)
 */
export function resetB2BPack10(): void {
  localStorage.setItem('jcv_b2b_pack10_remaining', '10');
}
==> Cloning from https://github.com/josecvaladez1979-creator/JCV-CHAT-FANYI
==> Checking out commit 42e22fc5b1e2feeb34718a0b04d0a2f996035469 in branch main
==> Using Node.js version 24.21.0 (default)
==> Docs on specifying a Node.js version: https://render.com/docs/node-version
==> Running build command 'yarn install; yarn build'...
yarn install v1.22.22
info No lockfile found.
[1/4] Resolving packages...
warning @google/genai > google-auth-library > gaxios > node-fetch > fetch-blob > node-domexception@1.0.0: Use your platform's native DOMException instead
warning mercadopago > uuid@9.0.1: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).
[2/4] Fetching packages...
[3/4] Linking dependencies...
warning " > autoprefixer@10.6.1" has unmet peer dependency "postcss@^8.1.0".
[4/4] Building fresh packages...
success Saved lockfile.
Done in 19.62s.
yarn run v1.22.22
$ vite build
vite v5.4.21 building for production...
transforming...
✓ 1699 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   2.07 kB │ gzip:  0.95 kB
dist/assets/index-BvHKDBZI.css   84.22 kB │ gzip: 12.02 kB
dist/assets/index-DA2nZdbP.js   325.07 kB │ gzip: 91.24 kB
✓ built in 8.37s
Done in 8.68s.
==> Uploading build...
==> Uploaded in 3.5s. Compression took 1.0s
==> Build successful 🎉
==> Deploying...
==> Setting WEB_CONCURRENCY=1 by default, based on available CPUs in the instance
==> Running 'yarn start'
yarn run v1.22.22
$ NODE_ENV=production tsx server.ts
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

Error: Transform failed with 1 error:
/opt/render/project/src/server.ts:532:30: ERROR: Unterminated string literal
    at failureErrorWithLog (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:1752:15)
    at /opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:1019:50
    at responseCallbacks.<computed> (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:886:9)
    at handleIncomingPacket (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:941:12)
    at Socket.readFromStdout (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:864:7)
    at Socket.emit (node:events:514:28)
    at addChunk (node:internal/streams/readable:568:12)
    at readableAddChunkPushByteMode (node:internal/streams/readable:519:3)
    at Readable.push (node:internal/streams/readable:399:5)
    at Pipe.onStreamRead (node:internal/stream_base_commons:189:23) {
  name: 'TransformError'
}

Node.js v24.21.0
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
==> Exited with status 1
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
==> Running 'yarn start'
yarn run v1.22.22
$ NODE_ENV=production tsx server.ts
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

Error: Transform failed with 1 error:
/opt/render/project/src/server.ts:532:30: ERROR: Unterminated string literal
    at failureErrorWithLog (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:1752:15)
    at /opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:1019:50
    at responseCallbacks.<computed> (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:886:9)
    at handleIncomingPacket (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:941:12)
    at Socket.readFromStdout (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:864:7)
    at Socket.emit (node:events:514:28)
    at addChunk (node:internal/streams/readable:568:12)
    at readableAddChunkPushByteMode (node:internal/streams/readable:519:3)
    at Readable.push (node:internal/streams/readable:399:5)
    at Pipe.onStreamRead (node:internal/stream_base_commons:189:23) {
  name: 'TransformError'
}

Node.js v24.21.0
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
==> Running 'yarn start'
yarn run v1.22.22
$ NODE_ENV=production tsx server.ts
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

Error: Transform failed with 1 error:
/opt/render/project/src/server.ts:532:30: ERROR: Unterminated string literal
    at failureErrorWithLog (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:1752:15)
    at /opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:1019:50
    at responseCallbacks.<computed> (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:886:9)
    at handleIncomingPacket (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:941:12)
    at Socket.readFromStdout (/opt/render/project/src/node_modules/tsx/node_modules/esbuild/lib/main.js:864:7)
    at Socket.emit (node:events:514:28)
    at addChunk (node:internal/streams/readable:568:12)
    at readableAddChunkPushByteMode (node:internal/streams/readable:519:3)
    at Readable.push (node:internal/streams/readable:399:5)
    at Pipe.onStreamRead (node:internal/stream_base_commons:189:23) {
  name: 'TransformError'
}

Node.js v24.21.0
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
==> No open ports detected, continuing to scan...
==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
