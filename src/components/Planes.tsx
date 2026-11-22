import React, { useEffect, useState } from 'react';
import { X, Check, Sparkles, CreditCard, Briefcase, Clock } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';

// Se conservan las mismas propiedades que usa App.tsx.
interface PlanesProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSubscriptionUpdated?: (updatedUser: User) => void;
  onOpenB2B?: () => void;
  onOpenLegal?: () => void;
}

type Pack = {
  id: string;
  priceCents: number;
  creditCents: number;
  validityDays: number;
  priceIncludesTax: boolean;
  purchasable: boolean;
  notice: string;
};

type Pricing = {
  tariffs: Record<string, number>;
  topups: Pack[];
  expiryNotice: string;
};

type WalletView = { balanceCents: number; expiresAt: string | null; daysLeft: number };

const mxn = (cents: number) =>
  (cents / 100).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });

function validityLabel(days: number): string {
  if (days === 7) return '1 semana';
  if (days === 15) return '15 días';
  if (days === 30) return '1 mes';
  if (days === 60) return '2 meses';
  return `${days} días`;
}

// Solo la traducción de texto está disponible hoy; lo demás se anuncia como próximo.
const TARIFF_ROWS: { key: string; label: string; unit: string; available: boolean }[] = [
  { key: 'textTranslatedCentsPer1kChars', label: 'Texto traducido', unit: 'por 1,000 caracteres', available: true },
  { key: 'audioSameLanguageCentsPerMin', label: 'Audio, mismo idioma', unit: 'por minuto', available: false },
  { key: 'audioTranslatedCentsPerMin', label: 'Audio traducido', unit: 'por minuto', available: false },
  { key: 'callSameLanguageCentsPerMin', label: 'Llamada, mismo idioma', unit: 'por minuto', available: false },
  { key: 'callTranslatedCentsPerMin', label: 'Llamada traducida', unit: 'por minuto', available: false },
  { key: 'videoSameLanguageCentsPerMin', label: 'Videollamada, mismo idioma', unit: 'por minuto', available: false },
  { key: 'videoTranslatedCentsPerMin', label: 'Videollamada traducida', unit: 'por minuto', available: false },
];

export const Planes: React.FC<PlanesProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenLegal,
}) => {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [companyPlans, setCompanyPlans] = useState<any[]>([]);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      try {
        const [p, b] = await Promise.all([
          api.getPricing(),
          api.getB2BPlans().catch(() => ({ plans: [] })),
        ]);
        if (cancelled) return;
        setPricing(p);
        setCompanyPlans(b.plans || []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'No se pudieron cargar los precios.');
      }

      if (currentUser) {
        try {
          const w = await api.getWallet();
          if (!cancelled) {
            setWallet({
              balanceCents: w.balanceCents,
              expiresAt: w.expiresAt,
              daysLeft: w.daysLeft,
            });
          }
        } catch {
          // El saldo es informativo: si falla, la pantalla sigue funcionando.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentUser?.id]);

  if (!isOpen) return null;

  const pack = pricing?.topups.find((p) => p.id === selected) || null;
  const canPay = Boolean(pack && pack.purchasable && accepted && !loading);
  const returnedFromPayment =
    typeof window !== 'undefined' && window.location.search.includes('checkout=success');

  const handlePay = async () => {
    if (!pack) return;
    if (!currentUser) {
      setError('Inicia sesión para recargar saldo.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.createTopupCheckout(pack.id, accepted);
      if (typeof data?.url === 'string' && data.url.startsWith('https://')) {
        window.location.href = data.url;
      } else {
        throw new Error('No se recibió una dirección de pago válida.');
      }
    } catch (e: any) {
      setError(e.message || 'No se pudo iniciar el pago.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Recargar saldo
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Chatear en tu mismo idioma es <strong className="text-emerald-400">gratis</strong>.
              La traducción con IA se paga con saldo.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {returnedFromPayment && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-200">
              Gracias. Tu saldo se actualiza en cuanto se confirma el pago; puede tardar unos segundos.
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {wallet && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-3">
              <span>
                Tu saldo: <strong className="text-white">{mxn(wallet.balanceCents)}</strong>
              </span>
              {wallet.balanceCents > 0 && wallet.expiresAt && (
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  vence en {wallet.daysLeft} días
                </span>
              )}
            </div>
          )}

          {/* Paquetes */}
          <div className="grid grid-cols-2 gap-3">
            {(pricing?.topups || []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelected(p.id);
                  setAccepted(false);
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  selected === p.id
                    ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-lg font-extrabold text-white">{mxn(p.priceCents)}</div>
                <div className="text-[11px] text-slate-400">
                  {p.priceIncludesTax ? 'IVA incluido' : 'MXN'}
                </div>
                <div className="mt-2 text-xs text-emerald-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Vigencia: {validityLabel(p.validityDays)}
                </div>
              </button>
            ))}
          </div>

          {/* Aviso de vencimiento y pago */}
          {pack && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3">
              <p className="text-xs text-slate-200 leading-relaxed">{pack.notice}</p>

              <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Entiendo que el saldo que no use antes de su vencimiento se pierde.
                </span>
              </label>

              <button
                onClick={handlePay}
                disabled={!canPay}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {!pack.purchasable
                    ? 'Los pagos estarán disponibles pronto'
                    : loading
                      ? 'Generando pago...'
                      : `Pagar ${mxn(pack.priceCents)} con tarjeta`}
                </span>
              </button>
            </div>
          )}

          {/* Tarifas */}
          {pricing && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300">Lo que cuesta cada cosa</h3>
              <div className="rounded-2xl border border-slate-800 divide-y divide-slate-800 text-xs">
                <div className="flex items-center justify-between px-3 py-2 text-slate-200">
                  <span>Chat de texto en tu idioma</span>
                  <strong className="text-emerald-400">Gratis</strong>
                </div>
                {TARIFF_ROWS.filter((r) => typeof pricing.tariffs[r.key] === 'number').map((r) => (
                  <div key={r.key} className="flex items-center justify-between px-3 py-2 text-slate-300">
                    <span>
                      {r.label}
                      {!r.available && (
                        <em className="ml-2 text-[10px] not-italic text-amber-300">próximamente</em>
                      )}
                    </span>
                    <span className="text-slate-400">
                      {mxn(pricing.tariffs[r.key])} {r.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empresas */}
          {companyPlans.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                Planes para empresas <em className="text-[10px] not-italic text-amber-300">próximamente</em>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {companyPlans.map((plan) => (
                  <div key={plan.id} className="p-3 rounded-2xl border border-slate-800 bg-slate-900/60 text-xs space-y-1">
                    <div className="font-bold text-white">{plan.name}</div>
                    <div className="text-slate-200">
                      {mxn(plan.priceCents)} <span className="text-slate-400">al mes</span>
                      {plan.priceIncludesTax === false && plan.ivaCents > 0 && (
                        <span className="text-slate-400"> + IVA</span>
                      )}
                    </div>
                    <div className="text-slate-400">Hasta {plan.seats} usuarios</div>
                    <div className="text-slate-400">
                      Incluye {mxn(plan.includedBalanceCents)} de saldo de IA al mes
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {onOpenLegal && (
            <button
              type="button"
              onClick={onOpenLegal}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              <Check className="inline w-3 h-3 mr-1" />
              Términos y aviso de privacidad
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
