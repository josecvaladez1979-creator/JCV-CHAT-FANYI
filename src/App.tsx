import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Planes } from './components/Planes';
import { E2EESettingsModal } from './components/E2EESettingsModal';
import   SettingsModal from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { AudioVoiceModal } from './components/AudioVoiceModal';
import { CallModal, ActiveCall } from './components/CallModal';
import { LegalTermsModal } from './components/LegalTermsModal';
import { User, Channel, Message, LanguageCode } from './types';
import { api } from './services/api';
import { realtimeChat } from './services/sse';
import { playNotificationSound } from './utils/audio';

// Las llamadas y videollamadas aún no tienen servidor. Mientras sea false no se
// abre una llamada que nunca conectaría. El código se conserva para cuando existan.
const CALLS_ENABLED = false;

// Clave aleatoria fuerte para un canal cifrado (antes: 6 caracteres de Math.random).
function generatePassphrase(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export default function App() {
  // El perfil guardado solo sirve para pintar rápido: la sesión real se verifica
  // con el servidor al abrir (ver más abajo).
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('jcv_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(() => {
    return currentUser?.preferredLanguage || 'es';
  });

  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; userName: string }[]>([]);

  // WebRTC Active Call state
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  // Claves de los canales cifrados. Viven solo en este dispositivo.
  const [channelPassphrases, setChannelPassphrases] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('jcv_e2ee_passphrases');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {};
  });

  const [siliconFlowStatus, setSiliconFlowStatus] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<string>('default');

  // Modal open states
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isLegalTermsOpen, setIsLegalTermsOpen] = useState(false);
  const [isE2EESettingsOpen, setIsE2EESettingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [existingCallStream, setExistingCallStream] = useState<MediaStream | null>(null);

  const lastTypingRef = useRef(0);

  // Sync current user to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('jcv_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('jcv_user');
    }
  }, [currentUser]);

  // Sync passphrases to localStorage
  useEffect(() => {
    localStorage.setItem('jcv_e2ee_passphrases', JSON.stringify(channelPassphrases));
  }, [channelPassphrases]);

  // 1) Verificar la sesión con el servidor al abrir la app.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = await api.getMe();
        if (cancelled) return;
        setCurrentUser(me);
        setSelectedLanguage((me.preferredLanguage as LanguageCode) || 'es');
      } catch (err: any) {
        if (cancelled) return;
        // Solo se cierra la sesión si el servidor dice que no hay una válida.
        // Si fue un problema de red, se conserva lo que había.
        if (err?.status === 401) {
          setCurrentUser(null);
          setIsAuthOpen(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Con sesión: cargar personas y canales, y entrar al canal del enlace /join/...
  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;

    (async () => {
      try {
        setSiliconFlowStatus(await api.getSiliconFlowStatus());
      } catch (e) {
        // informativo
      }

      try {
        const peers = await api.getUsers();
        if (!cancelled) setUsers(peers);
      } catch (e) {
        // el chat funciona sin la lista
      }

      try {
        let list: Channel[] = await api.getChannels();
        let joinedId: string | null = null;

        const match = window.location.pathname.match(/\/join\/([^/]+)/);
        if (match && match[1]) {
          try {
            const joined: Channel = await api.joinChannel(decodeURIComponent(match[1]).trim());
            joinedId = joined.id;
            if (!list.some((c) => c.id === joined.id)) list = [...list, joined];
            window.history.replaceState(null, '', '/');
          } catch (e) {
            console.error('No se pudo entrar al canal del enlace:', e);
          }
        }

        if (cancelled) return;
        setChannels(list);
        setActiveChannelId((prev) => {
          if (joinedId) return joinedId;
          if (prev && list.some((c) => c.id === prev)) return prev;
          return list[0]?.id ?? '';
        });
      } catch (err) {
        console.error('Error cargando los canales:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  // 3) Mensajes del canal activo.
  useEffect(() => {
    if (!currentUser?.id || !activeChannelId) return;
    let cancelled = false;

    setMessages([]);
    setTypingUsers([]);

    (async () => {
      try {
        const msgs = await api.getMessages(activeChannelId);
        if (!cancelled) setMessages(msgs);
      } catch (err) {
        console.error('Error cargando los mensajes:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeChannelId, currentUser?.id]);

  // 4) Conexión en tiempo real: solo con sesión.
  useEffect(() => {
    if (currentUser?.id) {
      realtimeChat.connect();
    } else {
      realtimeChat.disconnect();
    }
  }, [currentUser?.id]);

  // 5) Eventos en tiempo real.
  useEffect(() => {
    const unsubNewMsg = realtimeChat.on('new_message', (newMsg: Message) => {
      if (newMsg.channelId === activeChannelId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        if (currentUser && newMsg.senderId !== currentUser.id) {
          playNotificationSound('receive');
        }
      }
    });

    const unsubMsgTrans = realtimeChat.on(
      'message_translated',
      (data: { messageId: string; translations: Record<string, string> }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? { ...m, translations: { ...(m.translations || {}), ...data.translations } }
              : m
          )
        );
      }
    );

    const unsubReaction = realtimeChat.on(
      'message_reaction',
      (data: { messageId: string; reactions: Record<string, string[]> }) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    );

    const unsubTyping = realtimeChat.on(
      'typing',
      (data: { channelId: string; userId: string; userName: string; isTyping: boolean }) => {
        if (data.channelId === activeChannelId && currentUser && data.userId !== currentUser.id) {
          setTypingUsers((prev) => {
            if (data.isTyping) {
              if (prev.some((u) => u.userId === data.userId)) return prev;
              return [...prev, { userId: data.userId, userName: data.userName }];
            }
            return prev.filter((u) => u.userId !== data.userId);
          });
        }
      }
    );

    const unsubWebRTC = realtimeChat.on('webrtc_signal', (signal: any) => {
      if (!CALLS_ENABLED || !currentUser || signal.senderId === currentUser.id) {
        return;
      }

      if (signal.signalType === 'call_request') {
        playNotificationSound('receive');
        setActiveCall((prev) => {
          if (prev) return prev;
          return {
            channelId: signal.channelId,
            channelName: channels.find((c) => c.id === signal.channelId)?.name || 'Llamada',
            callType: signal.callType || 'voice',
            isCaller: false,
            status: 'incoming',
            caller: {
              id: signal.senderId,
              name: signal.senderName,
              avatar: signal.senderAvatar,
            },
          };
        });
      } else if (signal.signalType === 'call_accepted') {
        setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));
      } else if (signal.signalType === 'call_declined' || signal.signalType === 'call_ended') {
        setActiveCall(null);
      }
    });

    const unsubNewChan = realtimeChat.on('channel_created', (newChan: Channel) => {
      setChannels((prev) => {
        if (prev.some((c) => c.id === newChan.id)) return prev;
        return [...prev, newChan];
      });
    });

    const unsubUserUpdated = realtimeChat.on('user_updated', (updatedUser: User) => {
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
      if (currentUser && currentUser.id === updatedUser.id) {
        setCurrentUser(updatedUser);
      }
    });

    return () => {
      unsubNewMsg();
      unsubMsgTrans();
      unsubReaction();
      unsubTyping();
      unsubWebRTC();
      unsubNewChan();
      unsubUserUpdated();
    };
  }, [activeChannelId, currentUser, channels]);

  // ---------------- Llamadas (apagadas hasta que exista su servidor) ----------------

  const handleStartCall = async (type: 'voice' | 'video', targetUser?: User, stream?: MediaStream) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    if (!CALLS_ENABLED) {
      alert('Las llamadas y videollamadas estarán disponibles pronto.');
      return;
    }

    if (stream) {
      setExistingCallStream(stream);
    }

    const channel = channels.find((c) => c.id === activeChannelId) || channels[0];
    const callName = targetUser ? targetUser.name : channel?.name || 'Llamada';

    playNotificationSound('send');

    setActiveCall({
      channelId: channel?.id || '',
      channelName: callName,
      callType: type,
      isCaller: true,
      status: 'connected',
      caller: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
      },
      targetUser,
    });

    try {
      await api.sendWebRTCSignal({
        channelId: channel?.id || '',
        targetUserId: targetUser?.id,
        signalType: 'call_request',
        callType: type,
        e2ee: true,
      });
    } catch (err) {
      console.error('No se pudo iniciar la llamada:', err);
      setActiveCall(null);
    }
  };

  const handleAcceptCall = async () => {
    if (!activeCall || !currentUser) return;
    setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));

    try {
      await api.sendWebRTCSignal({
        channelId: activeCall.channelId,
        signalType: 'call_accepted',
        callType: activeCall.callType,
      });
    } catch (err) {
      console.error('No se pudo aceptar la llamada:', err);
    }
  };

  const handleEndCall = async () => {
    if (activeCall && currentUser) {
      try {
        await api.sendWebRTCSignal({
          channelId: activeCall.channelId,
          signalType: 'call_ended',
          callType: activeCall.callType,
        });
      } catch (err) {
        // la llamada se cierra de todos modos
      }
    }
    setActiveCall(null);
  };

  // Manejadores globales para jcv-world.js
  useEffect(() => {
    (window as any).onJcvConnectToRoom = (stream: MediaStream, isVideo: boolean) => {
      handleStartCall(isVideo ? 'video' : 'voice', undefined, stream);
    };
    (window as any).onJcvEndCall = () => {
      handleEndCall();
    };
  }, [activeChannelId, currentUser, channels]);

  // ---------------- Mensajes ----------------

  // Quién envía lo decide el servidor con la sesión; aquí solo va el contenido.
  const handleSendMessage = async (params: {
    text: string;
    isE2EE: boolean;
    isAudio?: boolean;
    audioBase64?: string;
    audioDuration?: number;
    encryptedPayload?: any;
    skipTranslation?: boolean;
  }) => {
    if (!currentUser || !activeChannelId) return;
    setIsSending(true);

    try {
      const sent = await api.sendMessage({
        channelId: activeChannelId,
        text: params.text,
        isE2EE: params.isE2EE,
        encryptedPayload: params.encryptedPayload,
        isAudio: params.isAudio,
        audioBase64: params.audioBase64,
        audioDuration: params.audioDuration,
      });

      if (sent && sent.id) {
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      alert('Error al enviar mensaje: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  // "Está escribiendo": máximo un aviso cada 3 segundos.
  const handleTyping = (isTyping: boolean) => {
    if (!currentUser || !activeChannelId) return;

    const now = Date.now();
    if (isTyping && now - lastTypingRef.current < 3000) return;
    lastTypingRef.current = isTyping ? now : 0;

    api.sendTyping(activeChannelId, isTyping).catch(() => {});
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    try {
      const reactions = await api.toggleReaction(messageId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    } catch (err) {
      console.error('Reaction error:', err);
    }
  };

  const handleCreateChannel = async (name: string, description: string, isE2EE: boolean) => {
    try {
      const newChan: Channel = await api.createChannel(name, description, isE2EE);
      setChannels((prev) => (prev.some((c) => c.id === newChan.id) ? prev : [...prev, newChan]));
      setActiveChannelId(newChan.id);

      if (isE2EE) {
        setChannelPassphrases((prev) => ({ ...prev, [newChan.id]: generatePassphrase() }));
      }
    } catch (err: any) {
      console.error('Error creating channel:', err);
      alert('Error al crear canal: ' + err.message);
    }
  };

  // Cierra la sesión también en el servidor.
  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // se cierra localmente de todos modos
    }
    realtimeChat.disconnect();
    setCurrentUser(null);
    setMessages([]);
    setChannels([]);
    setUsers([]);
    setActiveChannelId('');
    setIsAuthOpen(true);
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];
  const activePassphrase = activeChannel ? channelPassphrases[activeChannel.id] || '' : '';

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f8fafc] flex flex-col font-sans select-none">
      <Navbar
        currentUser={currentUser}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
        activeChannelName={activeChannel?.name || 'general-fānyì'}
        isE2EEEnabled={Boolean(activeChannel?.isE2EE)}
        onStartVoiceCall={() => handleStartCall('voice')}
        onStartVideoCall={() => handleStartCall('video')}
        onOpenE2EESettings={() => setIsE2EESettingsOpen(true)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onOpenLegal={() => setIsLegalTermsOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={setActiveChannelId}
          users={users}
          currentUser={currentUser}
          onSwitchUser={() => {
            /* Cambiar de persona ya no existe: cada quien entra con su cuenta. */
          }}
          onCreateChannel={handleCreateChannel}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onCallUser={(u, type) => handleStartCall(type, u)}
        />

        <ChatArea
          channel={activeChannel}
          messages={messages}
          currentUser={currentUser}
          viewerLanguage={selectedLanguage}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenE2EESettings={() => setIsE2EESettingsOpen(true)}
          channelPassphrase={activePassphrase}
          isSending={isSending}
          onSendMessage={handleSendMessage}
          typingUsers={typingUsers}
          onTyping={handleTyping}
          onReaction={handleReaction}
          onStartVoiceCall={() => handleStartCall('voice')}
          onStartVideoCall={() => handleStartCall('video')}
          onOpenSubscription={() => setIsSubscriptionOpen(true)}
        />
      </div>

      <CallModal
        activeCall={activeCall}
        currentUser={currentUser}
        passphrase={activePassphrase}
        existingStream={existingCallStream}
        onEndCall={handleEndCall}
        onAcceptIncomingCall={handleAcceptCall}
      />

      <Planes
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        currentUser={currentUser}
        onOpenLegal={() => {
          setIsSubscriptionOpen(false);
          setIsLegalTermsOpen(true);
        }}
      />

      <E2EESettingsModal
        isOpen={isE2EESettingsOpen}
        onClose={() => setIsE2EESettingsOpen(false)}
        channelName={activeChannel?.name || 'Canal'}
        currentPassphrase={activePassphrase}
        onSavePassphrase={(newKey) => {
          if (activeChannel) {
            setChannelPassphrases((prev) => ({
              ...prev,
              [activeChannel.id]: newKey,
            }));
          }
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        siliconFlowStatus={siliconFlowStatus}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onOpenLegal={() => setIsLegalTermsOpen(true)}
      />

      <AudioVoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        userLanguage={currentUser?.preferredLanguage || 'es'}
        onSendVoiceMessage={(text, audioBase64, duration) => {
          handleSendMessage({
            text,
            isE2EE: Boolean(activeChannel?.isE2EE),
            isAudio: true,
            audioBase64,
            audioDuration: duration,
          });
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setSelectedLanguage((user.preferredLanguage as LanguageCode) || 'es');
        }}
      />

      {/* NOTA: el final de este archivo se reconstruyó; compáralo con el tuyo. */}
      <LegalTermsModal isOpen={isLegalTermsOpen} onClose={() => setIsLegalTermsOpen(false)} />
    </div>
  );
}
