import React from 'react';
import { Wallet, X, Sparkles } from 'lucide-react';

// Antes mostraba "cuota consumida" y packs viejos. Ahora avisa que no hay
// saldo para traducir. El chat en el mismo idioma sigue siendo gratis.
interface QuotaExhaustedModalProps {
  isOpen: boolean;
  onClose: () => void;
  balanceCents: number;
  expiresAt: string | null;
  onRecharge: () => void;
}

const mxn = (cents: number) =>
  (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export const QuotaExhaustedModal: React.FC<QuotaExhaustedModalProps> = ({
  isOpen,
  onClose,
  balanceCents,
  expiresAt,
  onRecharge,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#0f1117] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-semibold block">
              Saldo para traducir
            </span>
            <h3 className="text-base font-bold text-white leading-snug">
              {balanceCents > 0
                ? `Tu saldo es de ${mxn(balanceCents)}`
                : 'No tienes saldo para traducir'}
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs leading-relaxed">
          <p className="text-slate-200">
            {balanceCents > 0
              ? 'Tu saldo no alcanza para esta traducción.'
              : 'Tu mensaje se envió sin traducción.'}{' '}
            Chatear en tu mismo idioma es <strong className="text-emerald-400">gratis</strong>.
            La traducción con IA se paga con saldo.
          </p>
          {expiresAt && balanceCents > 0 && (
            <p className="text-slate-400">
              Tu saldo vence el{' '}
              {new Date(expiresAt).toLocaleDateString('es-MX', {
                timeZone: 'America/Mexico_City',
              })}
              . Lo que no uses antes se pierde.
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <button
            onClick={() => {
              onClose();
              onRecharge();
            }}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Recargar saldo</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium cursor-pointer"
          >
            Seguir chateando sin traducción
          </button>
        </div>
      </div>
    </div>
  );
};
