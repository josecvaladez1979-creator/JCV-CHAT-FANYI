
import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  CreditCard,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import type { PaymentGateway, User } from '../types';

interface PlanesB2BProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSubscriptionUpdated: (user: User) => void;
}

interface B2BPlan {
  id: 'BASIC' | 'PROFESSIONAL' | 'CORPORATE';
  name: string;
  priceMXN: number;
  durationDays: number;
  seats: number;
  features: string[];
}

const DEFAULT_B2B_PLANS: B2BPlan[] = [
  {
    id: 'BASIC',
    name: 'Empresa Básica',
    priceMXN: 599,
    durationDays: 30,
    seats: 5,
    features: [
      'Hasta 5 usuarios',
      'Facturación mensual',
      'Herramientas empresariales',
    ],
  },
  {
    id: 'PROFESSIONAL',
    name: 'Empresa Profesional',
    priceMXN: 999,
    durationDays: 30,
    seats: 10,
    features: [
      'Hasta 10 usuarios',
      'Facturación mensual',
      'Herramientas empresariales',
      'Mayor capacidad de equipo',
    ],
  },
  {
    id: 'CORPORATE',
    name: 'Empresa Corporativa',
    priceMXN: 2099,
    durationDays: 30,
    seats: 25,
    features: [
      'Hasta 25 usuarios',
      'Facturación mensual',
      'Herramientas empresariales',
      'Capacidad ampliada de equipo',
    ],
  },
];

const VALID_PLAN_IDS = new Set([
  'BASIC',
  'PROFESSIONAL',
  'CORPORATE',
]);

export const PlanesB2B: React.FC<PlanesB2BProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubscriptionUpdated,
}) => {
  const [plans, setPlans] =
    useState<B2BPlan[]>(DEFAULT_B2B_PLANS);
  const [companyName, setCompanyName] = useState('');
  const [selectedPlanId, setSelectedPlanId] =
    useState<B2BPlan['id']>('BASIC');
  const [selectedGateway, setSelectedGateway] =
    useState<PaymentGateway>('stripe');
  const [loading, setLoading] = useState(false);
  const [checkoutData, setCheckoutData] =
    useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    api
      .getB2BPlans()
      .then((data) => {
        if (cancelled || !Array.isArray(data.plans)) return;

        const receivedPlans = data.plans
          .filter((plan: any) => VALID_PLAN_IDS.has(plan.id))
          .map((plan: any) => {
            const fallback = DEFAULT_B2B_PLANS.find(
              (item) => item.id === plan.id
            )!;

            return {
              ...fallback,
              ...plan,
              priceMXN: Number(
                plan.priceMXN ??
                (plan.priceCents != null
                  ? plan.priceCents / 100
                  : fallback.priceMXN)
              ),
              durationDays: 30,
              seats: fallback.seats,
            } as B2BPlan;
          });

        if (receivedPlans.length > 0) {
          setPlans(receivedPlans);
        }
      })
      .catch((error) => {
        console.error(
          'No se pudieron cargar los planes B2B:',
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleCheckout = async () => {
    if (!currentUser) {
      alert('Inicia sesión para contratar un plan empresarial.');
      return;
    }

    if (!companyName.trim()) {
      alert('Ingresa el nombre de tu empresa.');
      return;
    }

    setLoading(true);

    try {
      const data = await api.createB2BCheckout(
        companyName.trim(),
        selectedPlanId as any,
        selectedGateway
      );

      if (data?.url) {
        setCheckoutData(data);
      } else {
        alert(
          data?.message ||
          'El servidor todavía no ha generado un enlace de pago. Revisa la configuración del backend.'
        );
      }
    } catch (err: any) {
      alert('Error al preparar el pago: ' + (err?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-slate-950 p-4 flex items-center justify-between border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-400" />
            Planes B2B — Empresas
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-2 hover:bg-slate-800 rounded-lg text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="text-sm font-semibold text-slate-300 block mb-2">
              Nombre de tu empresa:
            </label>

            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Mi Empresa SA de CV"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-amber-500 outline-none"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <button
                type="button"
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                aria-pressed={selectedPlanId === plan.id}
                className={`text-left p-5 rounded-2xl border-2 transition-all ${
                  selectedPlanId === plan.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <h3 className="text-lg font-bold text-white">
                  {plan.name}
                </h3>

                <p className="text-3xl font-black text-amber-400 mt-2">
                  ${plan.priceMXN.toLocaleString('es-MX')}
                  <span className="text-sm font-normal text-slate-400">
                    {' '}MXN
                  </span>
                </p>

                <p className="text-xs text-slate-400 mt-1">
                  Mensual · Hasta {plan.seats} usuarios
                </p>

                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-slate-300"
                    >
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-300 mb-2">
              Método de pago:
            </p>

            <div className="grid grid-cols-3 gap-2">
              {(['stripe', 'paypal', 'mercadopago'] as PaymentGateway[]).map(
                (gateway) => (
                  <button
                    type="button"
                    key={gateway}
                    onClick={() => setSelectedGateway(gateway)}
                    className={`p-3 rounded-xl border transition-all ${
                      selectedGateway === gateway
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-800'
                    }`}
                  >
                    <span className="text-xs text-white capitalize">
                      {gateway === 'mercadopago'
                        ? 'Mercado Pago'
                        : gateway}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          {!checkoutData ? (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading || !currentUser}
              className="w-full py-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CreditCard className="w-5 h-5" />
              {loading
                ? 'Preparando pago...'
                : 'Contratar plan empresarial'}
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <p className="text-xs text-slate-400">
                Orden:{' '}
                <span className="font-mono text-white">
                  {checkoutData.orderId || 'Pendiente'}
                </span>
              </p>

              <a
                href={checkoutData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-center"
              >
                Continuar al pago
                <ExternalLink className="inline w-4 h-4 ml-1" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
