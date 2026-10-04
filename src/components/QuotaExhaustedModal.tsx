import React from 'react';
import {
  AlertTriangle,
  Lock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  X,
  CreditCard,
  Briefcase,
} from 'lucide-react';
import { B2CPlanType, QuotaStatus } from '../types';
import { B2C_PLAN_LIMITS } from '../utils/quota';

interface QuotaExhaustedModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: B2CPlanType;
  quotaStatus: QuotaStatus;
  onUpgradePlan: () => void;
  onUpgradeToB2B: () => void;
}

export const QuotaExhaustedModal: React.FC<QuotaExhaustedModalProps> = ({
  isOpen,
  onClose,
  planId,
  quotaStatus,
  onUpgradePlan,
  onUpgradeToB2B,
}) => {
  if (!isOpen) return null;

  const planInfo = B2C_PLAN_LIMITS[planId] || B2C_PLAN_LIMITS.mensual;
  const translationDisplay = planInfo.isUnlimitedTranslations
    ? 'Traducción de texto ilimitada'
    : `${planInfo.translationsLimit} traducciones`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0f1117] border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Cerrar y continuar chateando en mi propio idioma"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon & Badge */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-semibold block">
              CUOTA DE TRADUCCIÓN CONSUMIDA (100%)
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
              Límite alcanzado - Tu plan {planInfo.label} incluye {planInfo.translationsLimit} traducciones. Compra Pack 10 y ahorra 40%
            </h3>
          </div>
        </div>

        {/* Core Message as requested */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs leading-relaxed">
          <p className="text-slate-200 font-medium">
            Límite alcanzado - Tu plan <strong className="text-amber-400">{planInfo.label}</strong> incluye{' '}
            <strong className="text-white">{planInfo.translationsLimit} traducciones</strong>. Compra Pack 10 y ahorra 40%.
          </p>

          <p className="text-emerald-400 font-mono text-[11px] pt-1 border-t border-slate-800">
            ✓ Puedes seguir en el chat normal sin traducciones solo en tu propio idioma gratuito. Las llamadas de voz y videollamadas nunca se restringen, únicamente se restringen las traducciones hasta que renueves tu plan.
          </p>
        </div>

        {/* B2B Upgrade Offer */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 border border-amber-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 font-mono">
              <Briefcase className="w-4 h-4 text-amber-400" />
              <span>Bóveda B2B Pack 10</span>
            </span>
            <span className="text-[10px] font-mono text-black font-extrabold bg-[#d4af37] px-2 py-0.5 rounded-full">
              Ahorra 40%
            </span>
          </div>
          <p className="text-[11px] text-slate-300">
            Compra Pack 10 y ahorra 40%. 10 contratos jurídicos con su propio timer de autodestrucción, 300 min de llamadas y 120 min de video para revisión legal.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            onClick={() => {
              onClose();
              onUpgradePlan();
            }}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-xs tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>B2C - Compra Pack 10 y ahorra 40% - Incluye 10 traducciones + 300min voz + 120min video</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onUpgradeToB2B();
            }}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-xs tracking-wide bg-[#d4af37] hover:bg-[#c59b27] text-black shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Briefcase className="w-4 h-4 shrink-0" />
            <span>B2B - Bóveda Pack 10 (10 Contratos con timer de autodestrucción)</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium cursor-pointer"
          >
            Continuar en chat normal (en mi idioma, sin traducción IA)
          </button>
        </div>
      </div>
    </div>
  );
};
