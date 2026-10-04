import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  ShieldCheck,
  Sparkles,
  Play,
  Pause,
  Repeat,
  Smile,
  CheckCheck,
  Lock,
} from 'lucide-react';
import { Message, User, LanguageCode, SUPPORTED_LANGUAGES } from '../types';
import { speakText } from '../utils/audio';

interface MessageItemProps {
  message: Message;
  currentUser: User | null;
  viewerLanguage: LanguageCode;
  isDecrypted: boolean;
  decryptedContent?: string;
  decryptionError?: boolean;
  onReaction: (messageId: string, emoji: string) => void;
  onRequestTranslate?: (messageId: string, targetLang: LanguageCode) => void;
  onOpenE2EEConfig?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUser,
  viewerLanguage,
  isDecrypted,
  decryptedContent,
  decryptionError,
  onReaction,
  onRequestTranslate,
  onOpenE2EEConfig,
}) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSpeakingTTS, setIsSpeakingTTS] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isMe = currentUser?.id === message.senderId;

  // Determine what text to display:
  // If E2EE and not decrypted yet:
  let displayText = message.text;
  if (message.isE2EE) {
    if (decryptedContent) {
      displayText = decryptedContent;
    } else if (!isDecrypted) {
      displayText = '[Mensaje Cifrado con E2EE]';
    }
  }

  // Determine translation:
  // If sender's language is different from viewer's language, check if translation is available
  const translations = message.translations;
  const translatedText = (translations && translations[viewerLanguage]) ? translations[viewerLanguage] : null;

  const activeText = showOriginal
    ? (message.originalText || displayText)
    : (translatedText || displayText);

  const isTranslated = !showOriginal && Boolean(translatedText) && message.senderLanguage !== viewerLanguage;

  const getLangFlag = (code: string) => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.flag || '🌐';
  };

  const getLangName = (code: string) => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || code;
  };

  const handleTTS = async () => {
    if (isSpeakingTTS) {
      window.speechSynthesis?.cancel();
      setIsSpeakingTTS(false);
      return;
    }

    try {
      setIsSpeakingTTS(true);
      const langToSpeak = isTranslated ? viewerLanguage : message.senderLanguage;
      await speakText(activeText, langToSpeak);
    } catch (e) {
      console.warn('TTS error:', e);
    } finally {
      setIsSpeakingTTS(false);
    }
  };

  const handlePlayAudioNote = () => {
    if (!message.audioBase64) return;
    if (isPlayingAudio) {
      setIsPlayingAudio(false);
      return;
    }

    const audio = new Audio(message.audioBase64);
    setIsPlayingAudio(true);
    audio.play();
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => setIsPlayingAudio(false);
  };

  const emojis = ['👍', '❤️', '👏', '🔥', '💡', '🚀'];

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex gap-3 px-4 py-2 group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Sender Avatar */}
      <div className="relative shrink-0">
        <img
          src={message.senderAvatar}
          alt={message.senderName}
          className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-800"
        />
        <span
          className="absolute -bottom-1 -right-1 text-xs"
          title={`Idioma nativo: ${getLangName(message.senderLanguage)}`}
        >
          {getLangFlag(message.senderLanguage)}
        </span>
      </div>

      {/* Message Content Bubble */}
      <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end text-right' : 'items-start text-left'}`}>
        {/* Sender meta */}
        <div className={`flex items-center gap-1.5 text-xs ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="font-semibold text-slate-300 text-[11px]">{message.senderName}</span>
          <span className="text-[10px] text-slate-500">{formattedTime}</span>

          {message.isE2EE && (
            <span
              className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              title="Cifrado Punto a Punto AES-256-GCM"
            >
              <ShieldCheck className="w-2.5 h-2.5" />
              <span>E2EE</span>
            </span>
          )}

          {isTranslated && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-medium">
              <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
              <span>99%</span>
            </span>
          )}
        </div>

        {/* Message Box */}
        <div
          className={`relative rounded-2xl p-3 text-xs sm:text-sm transition-all shadow-sm ${
            isMe
              ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-tr-md'
              : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-md'
          }`}
        >
          {/* E2EE Decryption Failed Warning */}
          {message.isE2EE && decryptionError && (
            <div className="mb-2 p-2 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>Mensaje cifrado con otra clave.</span>
              </div>
              {onOpenE2EEConfig && (
                <button
                  onClick={onOpenE2EEConfig}
                  className="underline text-[11px] font-bold text-rose-300 hover:text-white"
                >
                  Configurar clave
                </button>
              )}
            </div>
          )}

          {/* Audio Note Player if message is audio */}
          {message.isAudio && (
            <div className="mb-2 flex items-center gap-3 p-2 rounded-xl bg-black/20 border border-white/10">
              <button
                onClick={handlePlayAudioNote}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                title="Reproducir nota de voz"
              >
                {isPlayingAudio ? (
                  <Pause className="w-4 h-4 text-white" />
                ) : (
                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                )}
              </button>

              <div className="flex-1">
                {/* Visualizer bars */}
                <div className="flex items-center gap-0.5 h-5">
                  {[40, 75, 55, 90, 60, 85, 45, 95, 70, 50, 80, 65, 90, 45, 80].map((h, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all ${
                        isPlayingAudio
                          ? 'bg-indigo-300 animate-pulse'
                          : isMe
                          ? 'bg-indigo-200/60'
                          : 'bg-slate-400'
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>

              {message.audioDuration && (
                <span className="text-[11px] font-mono opacity-80">
                  0:{message.audioDuration.toString().padStart(2, '0')}
                </span>
              )}
            </div>
          )}

          {/* Main Text Content */}
          <div className="leading-relaxed whitespace-pre-wrap break-words">
            {activeText}
          </div>

          {/* Translated / Original toggle & TTS controls */}
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2">
              {translatedText && message.senderLanguage !== viewerLanguage && (
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className={`text-[11px] font-medium underline-offset-2 hover:underline transition-opacity flex items-center gap-1 ${
                    isMe ? 'text-indigo-200' : 'text-indigo-400'
                  }`}
                >
                  <Repeat className="w-3 h-3" />
                  <span>
                    {showOriginal
                      ? `Ver traducido (${getLangFlag(viewerLanguage)} ${getLangName(viewerLanguage)})`
                      : `Ver original (${getLangFlag(message.senderLanguage)} ${getLangName(message.senderLanguage)})`}
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Text-to-Speech button */}
              <button
                onClick={handleTTS}
                className={`p-1 rounded-md transition-colors ${
                  isSpeakingTTS
                    ? 'text-amber-300 bg-amber-500/20'
                    : isMe
                    ? 'hover:bg-white/20 text-indigo-100'
                    : 'hover:bg-slate-700 text-slate-300'
                }`}
                title={isSpeakingTTS ? 'Detener voz' : 'Escuchar pronunciación (TTS Qwen)'}
              >
                {isSpeakingTTS ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {/* Emoji reaction button */}
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-1 rounded-md transition-colors ${
                  isMe ? 'hover:bg-white/20 text-indigo-100' : 'hover:bg-slate-700 text-slate-300'
                }`}
                title="Reaccionar con emoji"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Emoji Picker Popup */}
          {showEmojiPicker && (
            <div
              className={`absolute bottom-full mb-1 z-20 flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-700 shadow-xl ${
                isMe ? 'right-0' : 'left-0'
              }`}
            >
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    if (currentUser) onReaction(message.id, emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1.5 text-base hover:bg-slate-800 rounded-lg transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Existing Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(message.reactions).map(([emoji, usersArr]) => {
              if (!usersArr || usersArr.length === 0) return null;
              const hasReacted = currentUser && usersArr.includes(currentUser.id);
              return (
                <button
                  key={emoji}
                  onClick={() => currentUser && onReaction(message.id, emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    hasReacted
                      ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px] font-bold">{usersArr.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
