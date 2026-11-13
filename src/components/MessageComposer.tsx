import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../types';
import { VoiceRecorder, playNotificationSound } from '../utils/audio';
import { t } from '../jcv-world.js';

// Las notas de voz todavía no tienen traducción de audio ni cobro, y el
// servidor las rechaza. Se conserva el código para cuando existan.
const VOICE_NOTES_ENABLED = false;

interface MessageComposerProps {
  onSendMessage: (params: {
    text: string;
    isE2EE: boolean;
    isAudio?: boolean;
    audioBase64?: string;
    audioDuration?: number;
  }) => Promise<void>;
  senderLanguage: LanguageCode;
  isChannelE2EE: boolean;
  onTyping: (isTyping: boolean) => void;
  isSending: boolean;
  e2eeEnabled: boolean;
  onToggleE2EE: () => void;
}

// "🇲🇽 Español (MX)" según el idioma de TU cuenta (el que usan las traducciones).
function myLanguageLabel(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  return lang ? `${lang.flag} ${lang.name}` : code.toUpperCase();
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  senderLanguage,
  isChannelE2EE,
  onTyping,
  isSending,
  e2eeEnabled,
  onToggleE2EE,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(16).fill(0.1));
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const typingTimerRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    onTyping(true);

    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || isSending) return;

    setInputText('');
    onTyping(false);
    playNotificationSound('send');

    await onSendMessage({
      text: textToSend,
      isE2EE: isChannelE2EE || e2eeEnabled,
    });

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // ---- Notas de voz (apagadas hasta que existan en el servidor) ----

  const startRecording = async () => {
    if (!VOICE_NOTES_ENABLED) return;

    try {
      const recorder = new VoiceRecorder();
      recorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

      await recorder.start((normalizedData) => {
        setWaveformData(normalizedData);
      });
    } catch (err) {
      console.error('Error starting audio recording:', err);
      setIsRecording(false);
      clearInterval(timerRef.current);
      alert('Por favor permite el acceso al micrófono para grabar notas de voz.');
    }
  };

  const stopAndSendRecording = async () => {
    if (!recorderRef.current || !isRecording) return;
    setIsRecording(false);
    clearInterval(timerRef.current);
    setIsProcessingAudio(true);

    try {
      const result = await recorderRef.current.stop();
      if (result.base64) {
        playNotificationSound('send');
        await onSendMessage({
          text: `[Nota de voz: ${result.duration}s]`,
          isE2EE: isChannelE2EE || e2eeEnabled,
          isAudio: true,
          audioBase64: result.base64,
          audioDuration: result.duration,
        });
      }
    } catch (e) {
      console.error('Error stopping recording:', e);
    } finally {
      setIsProcessingAudio(false);
      setRecordDuration(0);
      recorderRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordDuration(0);
  };

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(typingTimerRef.current);
    };
  }, []);

  return (
    <div className="p-3 bg-slate-900 border-t border-slate-800">
      {/* Barra superior: cifrado e idioma */}
      <div className="flex items-center justify-between text-xs px-2 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleE2EE}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${
              isChannelE2EE || e2eeEnabled
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
            }`}
            title="Cifrado de extremo a extremo"
          >
            {isChannelE2EE || e2eeEnabled ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cifrado activado</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                <span>Activar cifrado</span>
              </>
            )}
          </button>

          <span className="text-slate-600 hidden sm:inline">•</span>

          {/* Qué se cobra y qué no */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Tu idioma: gratis · Traducir con IA usa saldo</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
          <span id="myLang" className="text-slate-300 font-medium">
            Tu idioma: {myLanguageLabel(senderLanguage)}
          </span>
        </div>
      </div>

      {isRecording ? (
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-rose-950/40 border border-rose-800/60 shadow-lg animate-pulse">
          <div className="flex items-center gap-2 text-rose-400 font-mono text-xs shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span>0:{recordDuration.toString().padStart(2, '0')}</span>
          </div>

          <div className="flex-1 flex items-center justify-center gap-1 h-7 px-2">
            {waveformData.map((val, i) => (
              <div
                key={i}
                className="w-1.5 bg-rose-400 rounded-full transition-all duration-75"
                style={{ height: `${Math.max(15, val * 100)}%` }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={cancelRecording}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-900/40 transition-colors"
              title="Cancelar grabación"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={stopAndSendRecording}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Enviar audio</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="relative flex items-end gap-2 bg-slate-800/90 border border-slate-700/80 rounded-2xl p-2 focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            maxLength={4000}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            data-i18n="write"
            placeholder={t('write')}
            className="flex-1 bg-transparent border-0 text-slate-100 placeholder-slate-500 text-xs sm:text-sm px-2 py-1.5 focus:outline-none resize-none max-h-32 min-h-[36px]"
          />

          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            <button
              type="button"
              onClick={startRecording}
              disabled={!VOICE_NOTES_ENABLED || isProcessingAudio}
              className={`p-2 rounded-xl transition-colors ${
                VOICE_NOTES_ENABLED
                  ? 'text-slate-400 hover:text-indigo-300 hover:bg-slate-700/80 cursor-pointer'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title={VOICE_NOTES_ENABLED ? 'Grabar nota de voz' : 'Notas de voz: próximamente'}
              aria-label="Notas de voz"
            >
              {isProcessingAudio ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() || isSending}
              className={`p-2 rounded-xl transition-all ${
                inputText.trim() && !isSending
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/30 cursor-pointer scale-100'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
              title="Enviar mensaje (Enter)"
              aria-label="Enviar mensaje"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
