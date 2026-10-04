import React, { useState } from 'react';
import {
  X,
  Check,
  ShieldCheck,
  Sparkles,
  CreditCard,
  Zap,
  Briefcase,
  ExternalLink,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { BillingCycle, PaymentGateway, User } from '../types';
import { api } from '../services/api';
import { resetQuota } from '../utils/quota';

interface PlanesProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSubscriptionUpdated: (updatedUser: User) => void;
  onOpenB2B?: () => void;
  onOpenLegal?: () => void;
}

export const Planes: React.FC<PlanesProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubscriptionUpdated,
  onOpenB2B,
  onOpenLegal,
}) => {
  const [selectedPack, setSelectedPack] = useState<'b2c_pack10' | 'b2b_pack10'>('b2c_pack10');
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('mercadopago');
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const gateways = [
    {
      id: 'mercadopago' as PaymentGateway,
      name: 'Mercado Pago',
      badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      iconText: 'MP',
      description: 'Tarjetas crédito/débito y saldo Mercado Pago',
    },
    {
      id: 'stripe' as PaymentGateway,
      name: 'Stripe',
      badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      iconText: 'Stripe',
      description: 'Tarjetas internacionales Visa, MC, Amex',
    },
    {
      id: 'paypal' as PaymentGateway,
      name: 'PayPal',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      iconText: 'PP',
      description: 'Saldo PayPal y tarjetas internacionales',
    },
  ];

  const handleStartCheckout = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setSuccessMessage(null);

    try {
      const cycle: BillingCycle = selectedPack === 'b2c_pack10' ? 'mensual' : 'anual';
      const data = await api.createCheckout(cycle, selectedGateway, currentUser.id);
      setCheckoutData(data);
    } catch (err: any) {
      console.error('Error starting checkout:', err);
      alert('Error al iniciar checkout: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAndActivate = async () => {
    if (!currentUser) return;
    setIsLoading(true);

    try {
      const cycle: BillingCycle = selectedPack === 'b2c_pack10' ? 'mensual' : 'anual';
      const res = await api.confirmSubscription(
        currentUser.id,
        cycle,
        selectedGateway,
        checkoutData?.orderId || `ord-${Date.now()}`
      );
      resetQuota(cycle);
      onSubscriptionUpdated(res.user);
      setSuccessMessage('¡Pack activado exitosamente!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Confirmation error:', err);
      alert('Error al confirmar activación: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Pestaña Planes: Packs de Traducción IA
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              JCV CHAT es <strong className="text-emerald-400">100% gratis de por vida</strong> en chat, voz y video. Los packs son exclusivamente para activar traducción IA SiliconFlow Qwen3-32B al 99%.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {successMessage ? (
            <div className="p-6 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">{successMessage}</h3>
              <p className="text-xs text-slate-300">
                Las traducciones IA están listas en tu cuenta.
              </p>
            </div>
          ) : (
            <>
              {/* 2 Main Packs: B2C Pack 10 & B2B Bóveda Pack 10 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. B2C Pack 10 */}
                <div
                  onClick={() => setSelectedPack('b2c_pack10')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedPack === 'b2c_pack10'
                      ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold font-mono">
                    Ahorra 40%
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 font-mono mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>B2C Pack 10</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">
                      B2C Pack 10 - 40%
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                      10 traducciones + 300min voz + 120min video con IA Qwen3-32B en tiempo real.
                    </p>

                    <div className="space-y-1.5 text-[11px] text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>10 traducciones completas con IA Qwen3-32B</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>300 minutos de llamadas de voz traducidas</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>120 minutos de videollamadas con traducción</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Cifrado E2EE grado militar AES-256</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-lg font-extrabold text-white">$499 MXN</span>
                      <span className="text-[11px] text-slate-400 block">$25 USD</span>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-xl font-bold ${
                        selectedPack === 'b2c_pack10'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {selectedPack === 'b2c_pack10' ? 'Seleccionado' : 'Elegir'}
                    </span>
                  </div>
                </div>

                {/* 2. B2B Bóveda Pack 10 */}
                <div
                  onClick={() => setSelectedPack('b2b_pack10')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedPack === 'b2b_pack10'
                      ? 'bg-amber-950/30 border-[#d4af37] ring-2 ring-amber-500/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold font-mono">
                    Empresarial
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 font-mono mb-1">
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>B2B Bóveda Pack 10</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">
                      B2B Bóveda Pack 10 (10 contratos con timer autodestrucción)
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                      10 Contratos con timer de autodestrucción, hash SHA-256 en blockchain y purga total.
                    </p>

                    <div className="space-y-1.5 text-[11px] text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>10 Contratos jurídicos con timer de autodestrucción</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>300 minutos de llamadas de revisión jurídica</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>120 minutos de videollamadas con notario/abogados</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Certificado digital probatorio con factura CFDI</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-lg font-extrabold text-[#d4af37]">$3,999 MXN</span>
                      <span className="text-[11px] text-slate-400 block">$199 USD</span>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-xl font-bold ${
                        selectedPack === 'b2b_pack10'
                          ? 'bg-[#d4af37] text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {selectedPack === 'b2b_pack10' ? 'Seleccionado' : 'Elegir'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Gateway Selector */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Método de Pago:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {gateways.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGateway(g.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                        selectedGateway === g.id
                          ? 'bg-slate-800 border-indigo-500 ring-1 ring-indigo-500/50'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${g.badgeColor}`}
                      >
                        {g.iconText}
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-white truncate">{g.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{g.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkout actions */}
              <div className="pt-2">
                {!checkoutData ? (
                  <button
                    onClick={handleStartCheckout}
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>
                      {isLoading
                        ? 'Generando enlace...'
                        : `Continuar a pago con ${selectedGateway === 'mercadopago' ? 'Mercado Pago' : selectedGateway === 'stripe' ? 'Stripe' : 'PayPal'}`}
                    </span>
                  </button>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Orden:</span>
                      <span className="font-mono text-white">{checkoutData.orderId}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={checkoutData.checkoutUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>Abrir Pasarela {checkoutData.gateway}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={handleConfirmAndActivate}
                        disabled={isLoading}
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        {isLoading ? 'Verificando...' : 'Confirmar y Activar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
