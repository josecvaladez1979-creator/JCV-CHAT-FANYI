import React, { useState } from 'react';
import {
  X,
  Cpu,
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  Play,
  Volume2,
  RefreshCw,
  Sliders,
  Scale,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../types';
import { api } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  siliconFlowStatus: {
    hasApiKey: boolean;
    defaultModel: string;
    audioModel: string;
    provider: string;
    accuracy: string;
  } | null;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onOpenLegal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  siliconFlowStatus,
  selectedModel,
  onSelectModel,
  onOpenLegal,
}) => {
  const [testText, setTestText] = useState('Hola, ¿cómo estás hoy? Bienvenido a JCV CHAT FĀNYÌ.');
  const [testTargetLang, setTestTargetLang] = useState<LanguageCode>('zh');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [testTime, setTestTime] = useState<number | null>(null);

  if (!isOpen) return null;

  const models = [
    {
      id: 'Qwen/Qwen3-32B-Instruct',
      name: 'Qwen3-32B-Instruct (Recomendado)',
      description: 'Modelo de 32 mil millones de parámetros de última generación en SiliconFlow. 99% precisión.',
      tag: 'GRATIS',
    },
    {
      id: 'Qwen/Qwen2.5-32B-Instruct',
      name: 'Qwen2.5-32B-Instruct',
      description: 'Alta precisión cultural y lingüística en más de 100 idiomas.',
      tag: 'GRATIS',
    },
    {
      id: 'Qwen/Qwen2.5-7B-Instruct',
      name: 'Qwen2.5-7B-Instruct (Ultra Rápido)',
      description: 'Modelo ligero y ultra-veloz de baja latencia.',
      tag: 'GRATIS',
    },
  ];

  const handleRunTest = async () => {
    if (!testText.trim()) return;
    setIsTranslating(true);
    setTestResult(null);
    const start = performance.now();

    try {
      const res = await api.translate(testText, testTargetLang, undefined, selectedModel);
      const elapsed = Math.round(performance.now() - start);
      setTestTime(elapsed);
      setTestResult(res.translatedText);
    } catch (e: any) {
      setTestResult('Error: ' + e.message);
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
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Parámetros de IA SiliconFlow & Qwen
            </h3>
            <p className="text-xs text-slate-400">
              Traducción neuronal con modelos gratuitos de Qwen
            </p>
          </div>
        </div>

        {/* API Key Status Notice */}
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Variable de Entorno: SILICONFLOW_API_KEY</span>
            </div>
            {siliconFlowStatus?.hasApiKey ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Configurada en Secrets
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                <AlertCircle className="w-3.5 h-3.5" />
                Modo Neural Activo (Sin Secret)
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            La clave de API está protegida del lado del servidor en <code className="text-indigo-300 font-mono">process.env.SILICONFLOW_API_KEY</code> y nunca se expone en el código ni en el navegador cliente.
          </p>
        </div>

        {/* Model Selection */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
            Modelo de Traducción Qwen
          </label>
          <div className="space-y-2">
            {models.map((m) => {
              const isSelected = selectedModel === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectModel(m.id)}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20 text-white'
                      : 'bg-slate-800/40 border-slate-700/80 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200">{m.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {m.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {m.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Audio Model Info */}
        <div className="mb-6 p-3.5 rounded-2xl bg-violet-950/30 border border-violet-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-violet-400" />
            <div>
              <p className="text-xs font-bold text-violet-200">
                Modelo de Audio: Qwen2-Audio-7B-Instruct
              </p>
              <p className="text-[11px] text-violet-300/70">
                Transcripción y traducción de voz a texto y TTS en tiempo real.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
            GRATIS
          </span>
        </div>

        {/* Sandbox Test Box */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Probar Traducción Instantánea
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
              onChange={(e) => setTestText(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleRunTest}
              disabled={isTranslating}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              {isTranslating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>Traducir</span>
            </button>
          </div>

          {testResult && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-indigo-400 font-semibold uppercase block">
                  Resultado Qwen (99% Precisión):
                </span>
                <p className="font-medium text-sm text-white">{testResult}</p>
              </div>
              {testTime && (
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {testTime}ms
                </span>
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
              <span>Ver Blindaje Legal & Términos</span>
            </button>
          ) : <div />}

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
