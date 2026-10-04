import React, { useEffect, useRef, useState } from 'react';
import {
  Hash,
  ShieldCheck,
  ShieldAlert,
  Users,
  Menu,
  Key,
  Sparkles,
  Lock,
  Info,
  Phone,
  Video,
  AlertTriangle,
  Link2,
  Check,
  Briefcase,
} from 'lucide-react';
import { Message, Channel, User, LanguageCode } from '../types';
import { MessageItem } from './MessageItem';
import { MessageComposer } from './MessageComposer';
import { decryptE2EE, encryptE2EE } from '../utils/crypto';
import { api } from '../services/api';
import { checkQuotaStatus, incrementTranslationQuota, normalizePlan } from '../utils/quota';
import { QuotaExhaustedModal } from './QuotaExhaustedModal';
import { t } from '../jcv-world.js';
import { PLAN_FREEMIUM, tienePackPagado } from '../plans.js';

interface ChatAreaProps {
  channel: Channel | undefined;
  messages: Message[];
  currentUser: User | null;
  viewerLanguage: LanguageCode;
  onOpenMobileSidebar: () => void;
  onOpenE2EESettings: () => void;
  channelPassphrase: string;
  isSending: boolean;
  onSendMessage: (params: {
    text: string;
    isE2EE: boolean;
    isAudio?: boolean;
    audioBase64?: string;
    audioDuration?: number;
    encryptedPayload?: any;
    skipTranslation?: boolean;
  }) => Promise<void>;
  typingUsers: { userId: string; userName: string }[];
  onTyping: (isTyping: boolean) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onStartVoiceCall?: () => void;
  onStartVideoCall?: () => void;
  onOpenSubscription?: () => void;
  onOpenB2B?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  channel,
  messages,
  currentUser,
  viewerLanguage,
  onOpenMobileSidebar,
  onOpenE2EESettings,
  channelPassphrase,
  isSending,
  onSendMessage,
  typingUsers,
  onTyping,
  onReaction,
  onStartVoiceCall,
  onStartVideoCall,
  onOpenSubscription,
  onOpenB2B,
}) => {
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const [decryptionErrors, setDecryptionErrors] = useState<Record<string, boolean>>({});
  const [e2eeEnabled, setE2eeEnabled] = useState(channel?.isE2EE || false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Quota status state
  const userPlan = normalizePlan(currentUser?.subscriptionPlan);
  const [quotaStatus, setQuotaStatus] = useState(() => checkQuotaStatus(userPlan));
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [copiedJoinLink, setCopiedJoinLink] = useState(false);

  const handleCopyJoinLink = () => {
    if (!channel) return;
    const url = `${window.location.origin}/join/${channel.id}`;
    navigator.clipboard.writeText(url);
    setCopiedJoinLink(true);
    setTimeout(() => setCopiedJoinLink(false), 2000);
  };

  useEffect(() => {
    setQuotaStatus(checkQuotaStatus(userPlan));
  }, [messages.length, userPlan]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  // Sync channel E2EE state
  useEffect(() => {
    if (channel) {
      setE2eeEnabled(channel.isE2EE);
    }
  }, [channel]);

  // Attempt decryption of E2EE messages whenever messages or passphrase change
  useEffect(() => {
    const decryptAll = async () => {
      const newDecrypted: Record<string, string> = {};
      const newErrors: Record<string, boolean> = {};

      for (const msg of messages) {
        if (msg.isE2EE && msg.encryptedPayload) {
          try {
            if (channelPassphrase) {
              const plain = await decryptE2EE(msg.encryptedPayload, channelPassphrase);
              newDecrypted[msg.id] = plain;
            } else {
              newErrors[msg.id] = true;
            }
          } catch (e) {
            newErrors[msg.id] = true;
          }
        }
      }

      setDecryptedMap(newDecrypted);
      setDecryptionErrors(newErrors);
    };

    decryptAll();
  }, [messages, channelPassphrase]);

  // Handle composer submission with client-side E2EE encryption if enabled
  const handleComposerSend = async (params: {
    text: string;
    isE2EE: boolean;
    isAudio?: boolean;
    audioBase64?: string;
    audioDuration?: number;
  }) => {
    let encryptedPayload: any = undefined;

    if (params.isE2EE) {
      if (!channelPassphrase) {
        alert('Por favor configura una clave de cifrado E2EE antes de enviar mensajes cifrados.');
        onOpenE2EESettings();
        return;
      }

      try {
        encryptedPayload = await encryptE2EE(params.text, channelPassphrase);
      } catch (err) {
        console.error('Error encrypting message:', err);
        alert('Error al cifrar el mensaje con AES-256');
        return;
      }
    }

    let shouldSkipTranslation = false;

    // Translation logic:
    // REGLA DE ORO: JCV CHAT nunca está sujeto a plan. Es gratis de por vida.
    // El chat normal siempre funciona 100% libre. Solo la traducción IA se activa con planes o packs.
    if (!params.isE2EE && params.text.trim().length > 0) {
      if (quotaStatus.isExhausted || (!tienePackPagado() && quotaStatus.limit === 0)) {
        // NO BLOQUEES NADA - Solo desactiva traducción. El chat sigue 100% activo.
        shouldSkipTranslation = true;
        (window as any).traduccionActiva = false;
      } else {
        const updated = incrementTranslationQuota(userPlan);
        setQuotaStatus(updated);
      }
    }

    await onSendMessage({
      ...params,
      encryptedPayload,
      skipTranslation: shouldSkipTranslation,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden">
      {/* Channel Header */}
      <div className="h-14 px-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 truncate">
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>

          {channel?.isE2EE ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <Hash className="w-5 h-5 text-indigo-400 shrink-0" />
          )}

          <div className="truncate">
            <h2 className="text-sm font-bold text-slate-100 truncate flex items-center gap-2">
              <span>{channel?.name || 'Canal'}</span>
              {channel?.isE2EE && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  AES-256 E2EE
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              {channel?.description || 'Canal de traducción'}
            </p>
          </div>
        </div>

        {/* Right header actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quota Tracker Badge */}
          <button
            onClick={() => setShowQuotaModal(true)}
            className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-xl border transition-colors cursor-pointer bg-[#0a1a0a] text-[#00ff88] border-[#00ff88]/40 hover:border-[#00ff88]"
            title={`Traducción IA: ${quotaStatus.used}/${quotaStatus.limit} (Haz clic para comprar traducción)`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00ff88]" />
            <span>Traducción IA:</span>
            <strong className="text-[#00ff88]">
              {quotaStatus.used}/{quotaStatus.limit}
            </strong>
          </button>

          {/* Call Voice Button with data-i18n and persistent startCall */}
          <button
            data-i18n="call"
            onClick={() => {
              if (typeof (window as any).startCall === 'function') {
                (window as any).startCall(false);
              } else if (onStartVoiceCall) {
                onStartVoiceCall();
              }
            }}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-emerald-400 border border-slate-700/80 hover:border-emerald-500/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm text-xs font-semibold"
            title={t('call')}
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('call')}</span>
          </button>

          {/* Video Call Button with data-i18n and persistent startCall */}
          <button
            data-i18n="videoCall"
            onClick={() => {
              if (typeof (window as any).startCall === 'function') {
                (window as any).startCall(true);
              } else if (onStartVideoCall) {
                onStartVideoCall();
              }
            }}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-indigo-400 border border-slate-700/80 hover:border-indigo-500/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm text-xs font-semibold"
            title={t('videoCall')}
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('videoCall')}</span>
          </button>

          {/* Share /join/{ROOM_ID} Button */}
          {channel && (
            <button
              onClick={handleCopyJoinLink}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-amber-300 border border-slate-700/80 hover:border-amber-500/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm text-xs font-semibold"
              title={`Copiar enlace directo: /join/${channel.id}`}
            >
              {copiedJoinLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
              <span className="hidden md:inline font-mono text-[11px]">
                {copiedJoinLink ? '¡Copiado!' : `/join/${channel.id.replace('chan-', '')}`}
              </span>
            </button>
          )}

          {channel?.isE2EE && (
            <button
              onClick={onOpenE2EESettings}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/60 transition-colors"
              title="Configurar o cambiar clave de cifrado E2EE"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clave E2EE</span>
            </button>
          )}
        </div>
      </div>

      {/* ANUNCIO DESACTIVADO - JCV CHAT ES GRATIS PARA SIEMPRE */}
      {/* Sin banners en medio: estilo limpio WhatsApp */}

      {/* Quota Exhausted Modal */}
      <QuotaExhaustedModal
        isOpen={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
        planId={userPlan}
        quotaStatus={quotaStatus}
        onUpgradePlan={onOpenSubscription || (() => {})}
        onUpgradeToB2B={onOpenB2B || (() => {})}
      />

      {/* Message Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-1">
        {/* Welcome Channel Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 text-center my-4 max-w-xl mx-auto space-y-1.5">
          <div className="inline-flex p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 mb-1">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">
            Bienvenido al canal #{channel?.name}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Escribe en tu idioma natal. La IA gratuita <strong className="text-indigo-300">Qwen3-32B</strong> en SiliconFlow traducirá cada mensaje al idioma nativo de cada usuario con un 99% de precisión en tiempo real.
          </p>
          {channel?.isE2EE && (
            <div className="mt-2 text-[11px] text-emerald-400 flex items-center justify-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Esta sala cuenta con Cifrado de Extremo a Extremo AES-256 habilitado.</span>
            </div>
          )}
        </div>

        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            currentUser={currentUser}
            viewerLanguage={viewerLanguage}
            isDecrypted={Boolean(decryptedMap[msg.id])}
            decryptedContent={decryptedMap[msg.id]}
            decryptionError={Boolean(decryptionErrors[msg.id])}
            onReaction={onReaction}
            onOpenE2EEConfig={onOpenE2EESettings}
          />
        ))}

        {/* Typing indicator bubble */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
            </div>
            <span>
              {typingUsers.map((u) => u.userName).join(', ')}{' '}
              {typingUsers.length === 1 ? 'está escribiendo...' : 'están escribiendo...'}
            </span>
          </div>
        )}
      </div>

      {/* Message Composer */}
      <MessageComposer
        onSendMessage={handleComposerSend}
        senderLanguage={currentUser?.preferredLanguage || 'es'}
        isChannelE2EE={Boolean(channel?.isE2EE)}
        onTyping={onTyping}
        isSending={isSending}
        e2eeEnabled={e2eeEnabled}
        onToggleE2EE={() => setE2eeEnabled(!e2eeEnabled)}
      />
    </div>
  );
};
