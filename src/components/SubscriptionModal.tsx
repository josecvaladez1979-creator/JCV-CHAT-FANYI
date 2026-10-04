import React, { useState } from 'react';
import {
  X,
  Check,
  ShieldCheck,
  Sparkles,
  CreditCard,
  Zap,
  ArrowRight,
  ExternalLink,
  Lock,
  RefreshCw,
  Phone,
  Scale,
  PlusCircle,
  Clock,
} from 'lucide-react';
import { BillingCycle, PaymentGateway, User, TopUpPackageId } from '../types';
import { api } from '../services/api';
import { resetQuota, addTopUpMinutes, TOP_UP_PACKAGES } from '../utils/quota';
import { LegalTermsModal } from './LegalTermsModal';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSubscriptionUpdated: (updatedUser: User) => void;
  onOpenB2B?: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubscriptionUpdated,
  onOpenB2B,
}) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'topup'>('plans');
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('mensual');
  const [selectedTopUp, setSelectedTopUp] = useState<TopUpPackageId>('topup_mini');
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('mercadopago');
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(true);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [topupCheckoutData, setTopupCheckoutData] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const cycles = [
    {
      id: 'express' as BillingCycle,
      label: 'Plan Express',
      subtitle: '$299 MXN / 15 días',
      priceUsd: 15.0,
      priceMxn: 299,
      period: 'por 15 días',
      badge: '15 días',
      minutesVoice: 120,
      features: [
        'Traducción de chat de texto ilimitado',
        '120 minutos (2 hrs) de traducción y clonación de voz',
        'Voz a texto y TTS con Qwen2-Audio-7B',
        'Cifrado E2EE punto a punto AES-256',
        'Salas y canales multilingües ilimitados',
      ],
    },
    {
      id: 'mensual' as BillingCycle,
      label: 'Plan Mensual',
      subtitle: '$499 MXN / 30 días',
      priceUsd: 25.0,
      priceMxn: 499,
      period: 'por mes',
      badge: 'MÁS POPULAR',
      popular: true,
      minutesVoice: 300,
      features: [
        'Traducción de chat de texto ilimitado',
        '300 minutos (5 hrs) de traducción y clonación de voz',
        'Voz a texto y TTS con Qwen2-Audio-7B',
        'Cifrado E2EE punto a punto AES-256',
        'Salas y canales multilingües ilimitados',
      ],
    },
    {
      id: 'anual' as BillingCycle,
      label: 'Plan Anual',
      subtitle: '$3,999 MXN / año',
      priceUsd: 199.0,
      priceMxn: 3999,
      period: 'por año',
      badge: 'MEJOR VALOR',
      savings: 'Ahorro del 33%',
      minutesVoice: 4200,
      features: [
        'Traducción de chat de texto ilimitado',
        '4,200 minutos anuales (70 hrs / ~350 min/mes) de voz',
        'Voz a texto y TTS con Qwen2-Audio-7B',
        'Cifrado E2EE punto a punto AES-256',
        'Salas y canales multilingües ilimitados',
      ],
    },
  ];

  const gateways = [
    {
      id: 'mercadopago' as PaymentGateway,
      name: 'Mercado Pago',
      description: 'Checkout Pro, Tarjetas débito/crédito, transferencias y saldo MP',
      badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      iconText: 'MP',
    },
    {
      id: 'stripe' as PaymentGateway,
      name: 'Stripe',
      description: 'Tarjetas internacionales Visa, Mastercard, American Express',
      badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      iconText: 'Stripe',
    },
    {
      id: 'paypal' as PaymentGateway,
      name: 'PayPal',
      description: 'Saldo PayPal, Pay in 4 y tarjetas internacionales',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      iconText: 'PP',
    },
  ];

  const currentTier = cycles.find((c) => c.id === selectedCycle) || cycles[1];
  const currentTopUp = TOP_UP_PACKAGES.find((t) => t.id === selectedTopUp) || TOP_UP_PACKAGES[0];

  const handleStartCheckout = async () => {
    if (!currentUser) return;
    if (!acceptedTerms) {
      alert('Debes aceptar los Términos y Condiciones y el Blindaje Legal antes de continuar.');
      return;
    }

    setIsLoading(true);
    setSuccessMessage(null);

    try {
      if (activeTab === 'plans') {
        const data = await api.createCheckout(selectedCycle, selectedGateway, currentUser.id);
        setCheckoutData(data);
      } else {
        const data = await api.createTopUpCheckout(selectedTopUp, selectedGateway, currentUser.id);
        setTopupCheckoutData(data);
      }
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
      if (activeTab === 'plans' && checkoutData) {
        const res = await api.confirmSubscription(
          currentUser.id,
          selectedCycle,
          selectedGateway,
          checkoutData.orderId
        );
        resetQuota(selectedCycle);
        onSubscriptionUpdated(res.user);
        setSuccessMessage(`¡Plan ${res.user.subscriptionPlan?.toUpperCase()} activado exitosamente!`);
        setTimeout(() => {
          onClose();
        }, 1800);
      } else if (activeTab === 'topup' && topupCheckoutData) {
        const res = await api.confirmTopUp(
          currentUser.id,
          selectedTopUp,
          topupCheckoutData.orderId
        );
        addTopUpMinutes(currentUser.subscriptionPlan, res.addedMinutes);
        onSubscriptionUpdated(res.user);
        setSuccessMessage(`¡Recarga de ${res.addedMinutes} minutos acreditada a tu cuenta!`);
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err: any) {
      console.error('Confirmation error:', err);
      alert('Error al confirmar: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl max-h-[92vh] bg-[#0c0e14] border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl overflow-y-auto text-slate-100 flex flex-col">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#d4af37]">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-semibold block">
                JCV CHAT FĀNYÌ • SUITE MULTILINGÜE E2EE
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Planes y Recargas Comerciales
              </h2>
            </div>
          </div>

          {/* Mode Tabs: Planes vs Recargas Top-Ups */}
          <div className="flex rounded-2xl bg-slate-900/90 border border-slate-800 p-1 mb-5">
            <button
              onClick={() => {
                setActiveTab('plans');
                setCheckoutData(null);
                setTopupCheckoutData(null);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'plans'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Planes de Suscripción (15d / 1m / 1y)</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('topup');
                setCheckoutData(null);
                setTopupCheckoutData(null);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'topup'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Paquetes de Recarga (Top-Ups)</span>
            </button>
          </div>

          {/* TAB 1: PLANES DE SUSCRIPCIÓN */}
          {activeTab === 'plans' && (
            <div className="space-y-5">
              {/* Step 1: Select Plan */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                  1. Elige tu Plan Comercial
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {cycles.map((c) => {
                    const isSelected = selectedCycle === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCycle(c.id);
                          setCheckoutData(null);
                        }}
                        className={`relative p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800/90 border-[#d4af37] ring-2 ring-amber-500/20 text-white shadow-lg'
                            : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        {c.badge && (
                          <span
                            className={`absolute -top-2.5 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isSelected
                                ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {c.badge}
                          </span>
                        )}

                        <div className="font-bold text-slate-100 text-sm">{c.label}</div>
                        <div className="text-[11px] text-slate-400 mb-2">{c.subtitle}</div>

                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl font-extrabold text-white">
                            ${c.priceMxn}
                          </span>
                          <span className="text-xs text-amber-400 font-mono">MXN</span>
                        </div>

                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          (${c.priceUsd} USD)
                        </div>

                        <div className="mt-2 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{c.minutesVoice} min voz</span>
                        </div>

                        {c.savings && (
                          <div className="mt-2 text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                            {c.savings}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DYNAMIC TEXT CONTAINER FOR PAYMENT INTERFACE AS SPECIFIED */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3 font-mono">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between border-b border-slate-800 pb-2">
                  <span>LO QUE INCLUYE TU PLAN JCV CHAT FĀNYÌ:</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {currentTier.label}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-200">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      {selectedCycle === 'mensual' && 'Traducción 99%  en SiliconFlow'}
                      {selectedCycle === 'express' && 'Traducción 99% en SiliconFlow.'}
                      {selectedCycle === 'anual' && 'Traducción 99%en SiliconFlow.'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Voz a texto y TTS.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Cifrado E2EE punto a punto AES-256</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Salas y canales multilingües ilimitados</span>
                  </div>
                  <div className="flex items-start gap-2 font-bold text-amber-300">
                    <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      {selectedCycle === 'mensual' &&
                        'Incluye 300 minutos de traducción y clonación de voz al mes'}
                      {selectedCycle === 'express' &&
                        'Incluye 120 minutos de traducción y clonación de voz por el periodo'}
                      {selectedCycle === 'anual' &&
                        'Incluye 4,200 minutos anuales de traducción y clonación de voz.'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-900 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Chat de texto con IA: <strong className="text-white">Ilimitado</strong></span>
                  <span>Freemium sin traducción: <strong className="text-emerald-400">Gratuito de por vida</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PAQUETES DE RECARGA (TOP-UPS) */}
          {activeTab === 'topup' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-1.5">
                <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 font-mono">
                  <PlusCircle className="w-4 h-4 text-indigo-400" />
                  <span>SISTEMA DE MICROTRANSACCIONES (TOP-UPS DE TIEMPO)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  ¿Agotaste tus minutos de voz antes del fin de tu periodo? Realiza una microcompra para añadir saldo de tiempo inmediatamente sin alterar tu ciclo de facturación principal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                  1. Selecciona Paquete de Recarga
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TOP_UP_PACKAGES.map((t) => {
                    const isSelected = selectedTopUp === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTopUp(t.id);
                          setTopupCheckoutData(null);
                        }}
                        className={`relative p-5 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800/90 border-indigo-500 ring-2 ring-indigo-500/30 text-white shadow-xl'
                            : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-semibold block mb-1">
                          {t.badge}
                        </span>
                        <div className="font-bold text-base text-white">{t.name}</div>
                        <p className="text-xs text-slate-400 mt-1 mb-3">{t.description}</p>

                        <div className="flex items-baseline justify-between border-t border-slate-800 pt-2">
                          <span className="text-xl font-extrabold text-white">
                            ${t.priceMxn} <span className="text-xs text-indigo-400 font-mono">MXN</span>
                          </span>
                          <span className="text-xs text-emerald-400 font-bold font-mono">
                            +{t.minutes} Minutos
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Select Gateway (Mercado Pago, Stripe, PayPal) */}
          <div className="mt-5 mb-5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
              2. Pasarela de Pago Oficial
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {gateways.map((g) => {
                const isSelected = selectedGateway === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelectedGateway(g.id);
                      setCheckoutData(null);
                      setTopupCheckoutData(null);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-amber-500 ring-2 ring-amber-500/20 text-white'
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-200">{g.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${g.badgeColor}`}>
                        {g.iconText}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {g.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legal Terms Acceptance Checkbox & Modal Trigger */}
          <div className="p-3.5 rounded-2xl bg-[#121520] border border-amber-500/30 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500/30 cursor-pointer"
              />
              <span className="text-slate-300">
                Acepto los <strong className="text-amber-400">Términos y Condiciones</strong> y el{' '}
                <strong className="text-white">Blindaje Legal</strong> (IA, Peritaje, Biometría y Fānyì Vault).
              </span>
            </label>

            <button
              type="button"
              onClick={() => setIsLegalModalOpen(true)}
              className="text-amber-400 hover:text-amber-300 font-bold underline font-mono text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Ver 4 Cláusulas Legales</span>
            </button>
          </div>

          {/* Action Button & Checkout View */}
          {(!checkoutData && !topupCheckoutData) ? (
            <button
              onClick={handleStartCheckout}
              disabled={isLoading || !acceptedTerms}
              className={`w-full py-4 px-4 rounded-2xl font-extrabold text-sm shadow-xl transition-all flex items-center justify-center gap-2 ${
                acceptedTerms
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/25 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Procesando solicitud...</span>
                </>
              ) : (
                <>
                  <span>
                    {activeTab === 'plans'
                      ? `Pagar ${currentTier.label} ($${currentTier.priceMxn} MXN) con ${selectedGateway.toUpperCase()}`
                      : `Comprar ${currentTopUp.name} ($${currentTopUp.priceMxn} MXN) con ${selectedGateway.toUpperCase()}`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            /* Active Order Confirmation Box */
            <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/50 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs text-slate-400 block font-mono">Orden Generada:</span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {checkoutData?.orderId || topupCheckoutData?.orderId}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-mono">Total:</span>
                  <span className="text-base font-extrabold text-white">
                    ${checkoutData?.amountMxn || topupCheckoutData?.amountMxn} MXN (${checkoutData?.amountUsd || topupCheckoutData?.amountUsd} USD)
                  </span>
                </div>
              </div>

              {successMessage ? (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs font-bold text-center">
                  {successMessage}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleConfirmAndActivate}
                    disabled={isLoading}
                    className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirmar Pago y Activar (Simulador)</span>
                  </button>

                  <a
                    href={checkoutData?.checkoutUrl || topupCheckoutData?.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Portal {selectedGateway.toUpperCase()}</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Freemium & B2B Footnotes */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
            <span>
              Plan Freemium: Chat y llamadas de voz libres en tu mismo idioma (0% traducciones).
            </span>

            {onOpenB2B && (
              <button
                onClick={() => {
                  onClose();
                  onOpenB2B();
                }}
                className="text-[#d4af37] hover:underline font-bold"
              >
                ¿Bóveda Jurídica de Contratos B2B? Entrar a Vault
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Legal Terms Modal */}
      <LegalTermsModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        onAccept={() => setAcceptedTerms(true)}
        accepted={acceptedTerms}
      />
    </>
  );
};
