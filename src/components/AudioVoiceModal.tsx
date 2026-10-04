import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRightLeft,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../types';
import { VoiceRecorder, speakText } from '../utils/audio';
import { api } from '../services/api';

interface AudioVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLanguage: LanguageCode;
  onSendVoiceMessage?: (text: string, audioBase64: string, duration: number) => void;
}

export const AudioVoiceModal: React.FC<AudioVoiceModalProps> = ({
  isOpen,
  onClose,
  userLanguage,
  onSendVoiceMessage,
}) => {
  const [partnerLang, setPartnerLang] = useState<LanguageCode>('zh');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [waveform, setWaveform] = useState<number[]>(new Array(16).fill(0.1));
  const [activeSpeaker, setActiveSpeaker] = useState<'user' | 'partner'>('user');

  const recorderRef = useRef<VoiceRecorder | null>(null);

  if (!isOpen) return null;

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === userLanguage) || SUPPORTED_LANGUAGES[0];
  const partnerLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === partnerLang) || SUPPORTED_LANGUAGES[2];

  const handleStartRecording = async (speaker: 'user' | 'partner') => {
    try {
      setActiveSpeaker(speaker);
      setIsRecording(true);
      setTranscription('');
      setTranslation('');

      const recorder = new VoiceRecorder();
      recorderRef.current = recorder;

      await recorder.start((data) => {
        setWaveform(data);
      });
    } catch (e) {
      console.error('Error starting audio recording:', e);
      setIsRecording(false);
      alert('Por favor autoriza el uso del micrófono para usar la traducción de voz Qwen2-Audio.');
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;
    setIsRecording(false);
    setIsProcessing(true);

    try {
      const result = await recorderRef.current.stop();
      recorderRef.current = null;

      const targetLang = activeSpeaker === 'user' ? partnerLang : userLanguage;
      const sourceLang = activeSpeaker === 'user' ? userLanguage : partnerLang;

      // Call SiliconFlow audio / translate
      const audioRes = await api.processAudio(result.base64, targetLang);
      setTranscription(audioRes.transcription);

      const transRes = await api.translate(audioRes.transcription, targetLang, sourceLang);
      setTranslation(transRes.translatedText);

      // Pronounce translated audio out loud with speech synthesis
      speakText(transRes.translatedText, targetLang);

      // Optionally dispatch into current room chat
      if (onSendVoiceMessage) {
        onSendVoiceMessage(transRes.translatedText, result.base64, result.duration);
      }
    } catch (err: any) {
      console.error('Audio translation error:', err);
      setTranscription('Audio grabado');
      setTranslation('Error al procesar audio en SiliconFlow');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Traducción de Voz Simultánea
            </h3>
            <p className="text-xs text-slate-400">
              Impulsado por <strong className="text-indigo-400">Qwen2-Audio-7B</strong> en SiliconFlow
            </p>
          </div>
        </div>

        {/* Language selector bridge */}
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between mb-6">
          <div className="text-center flex-1">
            <span className="text-2xl block mb-1">{currentLangObj.flag}</span>
            <span className="text-xs font-bold text-slate-200 block">{currentLangObj.name}</span>
            <span className="text-[10px] text-indigo-400 font-semibold uppercase">Tú</span>
          </div>

          <div className="p-2 rounded-xl bg-slate-700/60 text-slate-300">
            <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="text-center flex-1">
            <div className="flex justify-center mb-1">
              <select
                value={partnerLang}
                onChange={(e) => setPartnerLang(e.target.value as LanguageCode)}
                className="text-xs bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-2 py-1 focus:outline-none"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs font-bold text-slate-200 block">{partnerLangObj.name}</span>
            <span className="text-[10px] text-violet-400 font-semibold uppercase">Interlocutor</span>
          </div>
        </div>

        {/* Live Audio Visualizer */}
        <div className="h-28 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-4 mb-6">
          {isRecording ? (
            <div className="w-full flex flex-col items-center gap-3">
              <div className="flex items-center gap-1.5 h-10 w-full justify-center">
                {waveform.map((h, i) => (
                  <div
                    key={i}
                    className="w-2 rounded-full bg-gradient-to-t from-violet-500 to-indigo-400 transition-all duration-75"
                    style={{ height: `${Math.max(15, h * 100)}%` }}
                  />
                ))}
              </div>
              <span className="text-xs font-mono text-rose-400 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Grabando voz con Qwen2-Audio... Suelta para traducir
              </span>
            </div>
          ) : isProcessing ? (
            <div className="flex flex-col items-center gap-2 text-indigo-400">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-xs font-semibold">Procesando audio y traduciendo al 99%...</span>
            </div>
          ) : (
            <div className="text-center space-y-1">
              {translation ? (
                <div>
                  <p className="text-xs text-slate-400">Transcripción: {transcription}</p>
                  <p className="text-sm font-bold text-emerald-300 mt-1">Traducción: {translation}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Mantén presionado el botón del idioma para hablar. La IA traducirá y pronunciará el audio de inmediato.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Two Walkie-Talkie Push-to-Talk Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onMouseDown={() => handleStartRecording('user')}
            onMouseUp={handleStopRecording}
            onTouchStart={() => handleStartRecording('user')}
            onTouchEnd={handleStopRecording}
            className={`py-4 px-3 rounded-2xl font-bold text-xs flex flex-col items-center gap-2 transition-all cursor-pointer select-none ${
              isRecording && activeSpeaker === 'user'
                ? 'bg-rose-600 text-white ring-4 ring-rose-500/30 scale-95'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
            }`}
          >
            <Mic className="w-5 h-5" />
            <span>Hablar en {currentLangObj.name}</span>
          </button>

          <button
            onMouseDown={() => handleStartRecording('partner')}
            onMouseUp={handleStopRecording}
            onTouchStart={() => handleStartRecording('partner')}
            onTouchEnd={handleStopRecording}
            className={`py-4 px-3 rounded-2xl font-bold text-xs flex flex-col items-center gap-2 transition-all cursor-pointer select-none ${
              isRecording && activeSpeaker === 'partner'
                ? 'bg-rose-600 text-white ring-4 ring-rose-500/30 scale-95'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30'
            }`}
          >
            <Volume2 className="w-5 h-5" />
            <span>Hablar en {partnerLangObj.name}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
