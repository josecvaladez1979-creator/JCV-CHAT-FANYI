import type { B2CPlan, B2BPlan, B2CPlanId, B2BPlanId } from '../types';

// ═══════════════════════════════════════════════
// PLANES B2C — Clientes individuales
// Separados completamente de B2B
// ═══════════════════════════════════════════════
export const B2C_PLANS: Record<B2CPlanId, B2CPlan> = {
  B2C_15D: {
    id: 'B2C_15D',
    name: 'B2C 15 días',
    durationDays: 15,
    priceCents: 299,
    currency: 'MXN',
    features: [
      'Traducción ilimitada con IA Qwen3-32B',
      '120 minutos de llamadas de voz',
      '120 minutos de videollamadas',
      'Cifrado E2EE AES-256',
      '1 usuario',
    ],
    limits: {
      messagesPerDay: -1, // ilimitado
      voiceMinutes: 120,
      videoMinutes: 120,
      translations: -1,
    },
    active: true,
  },
  B2C_1M: {
    id: 'B2C_1M',
    name: 'B2C 1 mes',
    durationDays: 30,
    priceCents: 599,
    currency: 'MXN,
    features: [
      'Todo lo del plan 15 días',
      '300 minutos de llamadas de voz',
      '300 minutos de videollamadas',
      'Soporte prioritario',
      'Historial completo',
    ],
    limits: {
      messagesPerDay: -1,
      voiceMinutes: 300,
      videoMinutes: 300,
      translations: -1,
    },
    active: true,
  },
  B2C_1Y: {
    id: 'B2C_1Y',
    name: 'B2C 1 año',
    durationDays: 365,
    priceCents: 3,999,
    currency: 'MXN,
    features: [
      'Todo lo del plan mensual',
      '4200 minutos anuales de voz',
      'Ahorro del 33%',
      'Acceso anticipado a funciones',
      'Soporte 24/7',
    ],
    limits: {
      messagesPerDay: -1,
      voiceMinutes: 4200,
      videoMinutes: 4200,
      translations: -1,
    },
    active: true,
  },
};

// ═══════════════════════════════════════════════
// PLANES B2B — Empresas (completamente separado)
// ═══════════════════════════════════════════════
export const B2B_PLANS: Record<B2BPlanId, B2BPlan> = {
  B2B_15D: {
    id: 'B2B_15D',
    durationDays: 15,
    priceCents: 2999,
    currency: 'USD',
    features: [
      '5 usuarios (seats)',
      'Panel administrativo',
      'Estadísticas de uso',
      'Facturación empresarial',
      'Cifrado E2EE grado militar',
    ],
    seats: 5,
    adminPanel: true,
    statsEnabled: true,
    active: true,
  },
  B2B_1M: {
    id: 'B2B_1M',
    durationDays: 30,
    priceCents: 5999,
    currency: 'USD',
    features: [
      '10 usuarios (seats)',
      'Gestión de empleados',
      'Facturación con CFDI',
      'Reportes mensuales',
      'Soporte empresarial',
    ],
    seats: 10,
    adminPanel: true,
    statsEnabled: true,
    active: true,
  },
  B2B_1Y: {
    id: 'B2B_1Y',
    durationDays: 365,
    priceCents: 59999,
    currency: 'USD',
    features: [
      '25 usuarios (seats)',
      'Todo lo del plan mensual',
      'Ahorro anual significativo',
      'Contratos Vault Limitados',
      'Account manager dedicado',
    ],
    seats: 25,
    adminPanel: true,
    statsEnabled: true,
    active: true,
  },
};

// ═══════════════════════════════════════════════
// FREEMIUM — Usuario gratuito
// ═══════════════════════════════════════════════
export const FREEMIUM_CONFIG = {
  messagesPerDay: 20,
  maxCharsPerMessage: 500,
  features: [
    'Chat en el mismo idioma',
    '20 traducciones/día (máx 500 caracteres)',
    'Sin herramientas premium',
    'Sin llamadas de voz traducidas',
  ],
};
