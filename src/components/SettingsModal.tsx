import React, { useEffect, useState } from 'react';
import {
  X,
  Cpu,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
  RefreshCw,
  Scale,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../types';
import { api } from '../services/api';

// Se conservan las mismas propiedades que usa App.tsx. El modelo de IA ya no
// se elige desde el navegador: lo decide el servidor.
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  siliconFlowStatus?: any;
  selectedModel?: string;
  onSelectModel?: (model: string) => void;
  onOpenLegal?: () => void;
}

const mxn = (cents: number) =>
  (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  siliconFlowStatus,
  onOpenLegal,
}) => {
  const [testText, setTestText] = useState('Hola, ¿cómo estás hoy? Bienvenido a JCV CHAT FĀNYÌ.');
  const [testTargetLang, setTestTargetLang] = useState<LanguageCode>('en');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [testTime, setTestTime] = useState<number | null>(null);
  const [centsPer1k, setCentsPer1k] = useState<number | null>(null);

  // La tarifa se lee del servidor para mostrar siempre el precio vigente.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    api
      .getPricing()
      .then((p: any) => {
        if (!cancelled && typeof p?.tariffs?.textTranslatedCentsPer1kChars === 'number') {
          setCentsPer1k(p.tariffs.textTranslatedCentsPer1kChars);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // El servidor informa si la traducción está lista (activada y configurada).
  const available = Boolean(siliconFlowStatus?.enabled && siliconFlowStatus?.configured);

  const estimatedCents =
    centsPer1k !== null && testText.trim().length > 0
      ? Math.max(1, Math.ceil((testText.trim().length * centsPer1k) / 1000))
      : null;

  const handleRunTest = async () => {
    if (!testText.trim()) return;
    setIsTranslating(true);
    setTestResult(null);
    setTestError(null);
    const start = performance.now();

    try {
      const res = await api.translate(testText, testTargetLang);
      setTestTime(Math.round(performance.now() - start));
      setTestResult(res.translatedText);
    } catch (e: any) {
      setTestError(e.message || 'No se pudo traducir.');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-7 shadow-2xl relative my-6">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Traducción con IA</h3>
            <p className="text-xs text-slate-400">Estado del servicio y prueba rápida</p>
          </div>
        </div>

        {/* Estado real del servicio */}
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">Traducción automática</span>
            {available ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Disponible
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                <AlertCircle className="w-3.5 h-3.5" />
                No disponible por ahora
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Chatear en tu mismo idioma es gratis. Traducir con IA se paga con saldo
            {centsPer1k !== null && <> ({mxn(centsPer1k)} por cada 1,000 caracteres)</>}. Las
            traducciones son automáticas y pueden tener errores.
          </p>
        </div>

        {/* Prueba */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Probar una traducción
            </span>
            <select
              value={testTargetLang}
              onChange={(e) => setTestTargetLang(e.target.value as LanguageCode)}
              className="text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={testText}
              maxLength={500}
              onChange={(e) => setTestText(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleRunTest}
              disabled={isTranslating || !available}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              {isTranslating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Traducir</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-500">
            La prueba se cobra de tu saldo
            {estimatedCents !== null && <> (unos {mxn(estimatedCents)})</>}.
          </p>

          {testError && (
            <div role="alert" className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              {testError}
            </div>
          )}

          {testResult && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-indigo-400 font-semibold uppercase block">
                  Resultado
                </span>
                <p className="font-medium text-sm text-white">{testResult}</p>
              </div>
              {testTime !== null && (
                <span className="text-[10px] text-slate-400 font-mono shrink-0">{testTime} ms</span>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
          {onOpenLegal ? (
            <button
              onClick={() => {
                onClose();
                onOpenLegal();
              }}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline flex items-center gap-1.5 cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Términos y aviso de privacidad</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-colors cursor-pointer"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};
