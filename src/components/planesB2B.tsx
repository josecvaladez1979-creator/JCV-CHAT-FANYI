import React, { useState, useEffect } from 'react';
import { X, Check, CreditCard, Briefcase, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import type { PaymentGateway, User } from '../types';

interface PlanesB2BProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSubscriptionUpdated: (user: User) => void;
}

export const PlanesB2B: React.FC<PlanesB2BProps> = ({ isOpen, onClose, currentUser, onSubscriptionUpdated }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('B2B_1M');
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('stripe');
  const [loading, setLoading] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      api.getB2BPlans().then((data) => setPlans(data.plans || [])).catch(console.error);
    }
  }, [isOpen]);

  const handleCheckout = async () => {
    if (!currentUser) return;
    if (!companyName.trim()) {
      alert('Ingresa el nombre de tu empresa');
      return;
    }
    setLoading(true);
    try {
      const data = await api.createB2BCheckout(companyName.trim(), selectedPlanId as any, selectedGateway);
      setCheckoutData(data);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-950 p-4 flex items-center justify-between border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-400" />
            Planes B2B — Empresas
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="text-sm font-semibold text-slate-300 block mb-2">Nombre de tu empresa:</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Mi Empresa SA de CV"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-amber-500 outline-none"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedPlanId === plan.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="text-3xl font-black text-amber-400 mt-2">
                  ${(plan.priceCents / 100).toFixed(2)}
                  <span className="text-sm font-normal text-slate-400"> USD</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">{plan.durationDays} días · {plan.seats} usuarios</p>
                <ul className="mt-4 space-y-2">
                  {plan.features?.map((f: string) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
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
              {['stripe', 'paypal', 'mercadopago'].map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGateway(g as PaymentGateway)}
                  className={`p-3 rounded-xl border transition-all ${
                    selectedGateway === g ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800'
                  }`}
                >
                  <p className="text-xs text-white capitalize">{g}</p>
                </button>
              ))}
            </div>
          </div>

          {!checkoutData ? (
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CreditCard className="w-5 h-5" />
              {loading ? 'Generando...' : 'Contratar plan empresarial'}
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <p className="text-xs text-slate-400">Orden: <span className="font-mono text-white">{checkoutData.orderId}</span></p>
              <a
                href={checkoutData.url}
                target="_blank"
                rel="noreferrer"
                className="block py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-center"
              >
                Pagar <ExternalLink className="inline w-4 h-4 ml-1" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
