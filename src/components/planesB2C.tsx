import React, { useState, useEffect } from 'react';
import { X, Check, CreditCard, Sparkles, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import type { PaymentGateway, User } from '../types';

interface PlanesB2CProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSubscriptionUpdated: (user: User) => void;
}

export const PlanesB2C: React.FC<PlanesB2CProps> = ({ isOpen, onClose, currentUser, onSubscriptionUpdated }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('B2C_1M');
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('stripe');
  const [loading, setLoading] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getB2CPlans().then((data) => setPlans(data.plans || [])).catch(console.error);
    }
  }, [isOpen]);

  const handleCheckout = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await api.createB2CCheckout(selectedPlanId as any, selectedGateway);
      setCheckoutData(data);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const gateways: { id: PaymentGateway; name: string; icon: string }[] = [
    { id: 'stripe', name: 'Stripe', icon: '💳' },
    { id: 'paypal', name: 'PayPal', icon: '🅿️' },
    { id: 'mercadopago', name: 'Mercado Pago', icon: '🟦' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-950 p-4 flex items-center justify-between border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Planes B2C — Usuarios Individuales
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {success ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white">¡Suscripción activada!</h3>
              <p className="text-slate-400 mt-2">Recibirás confirmación por email.</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                      selectedPlanId === plan.id
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    <p className="text-3xl font-black text-indigo-400 mt-2">
                      ${(plan.priceCents / 100).toFixed(2)}
                      <span className="text-sm font-normal text-slate-400"> USD</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{plan.durationDays} días</p>
                    <ul className="mt-4 space-y-2">
                      {plan.features?.map((f: string) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-300 mb-2">Método de pago:</p>
                <div className="grid grid-cols-3 gap-2">
                  {gateways.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGateway(g.id)}
                      className={`p-3 rounded-xl border transition-all ${
                        selectedGateway === g.id
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-2xl">{g.icon}</span>
                      <p className="text-xs text-white mt-1">{g.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {!checkoutData ? (
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CreditCard className="w-5 h-5" />
                  {loading ? 'Generando...' : 'Continuar al pago'}
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <p className="text-xs text-slate-400">Orden: <span className="font-mono text-white">{checkoutData.orderId}</span></p>
                  <a
                    href={checkoutData.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-center"
                  >
                    Abrir pasarela de pago <ExternalLink className="inline w-4 h-4 ml-1" />
                  </a>
                  <p className="text-xs text-center text-slate-400">
                    Tras pagar, la suscripción se activa automáticamente vía webhook.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
