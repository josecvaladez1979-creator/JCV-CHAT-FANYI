import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Planes } from './components/Planes';
import { E2EESettingsModal } from './components/E2EESettingsModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { AudioVoiceModal } from './components/AudioVoiceModal';
import { CallModal, ActiveCall } from './components/CallModal';
import { VaultView } from './components/VaultView';
import { LegalTermsModal } from './components/LegalTermsModal';
import { User, Channel, Message, LanguageCode } from './types';
import { api } from './services/api';
import { realtimeChat } from './services/sse';
import { playNotificationSound } from './utils/audio';

export default function App() {
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
  const [activeChannelId, setActiveChannelId] = useState<string>('chan-general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; userName: string }[]>([]);

  // App Mode: 'vault' (Enterprise B2B Document Translation & Ephemeral Vault) or 'chat' (Real-time Communications Suite)
  const [appMode, setAppMode] = useState<'vault' | 'chat'>('vault');

  // WebRTC Active Call state
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  // Passphrases map for E2EE channels (stored in localStorage)
  const [channelPassphrases, setChannelPassphrases] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('jcv_e2ee_passphrases');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      'chan-e2ee-secure': 'jcv-e2ee-fanyi-secret-2026',
    };
  });

  // SiliconFlow and model state
  const [siliconFlowStatus, setSiliconFlowStatus] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<string>('Qwen/Qwen3-32B-Instruct');

  // Modal open states
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isLegalTermsOpen, setIsLegalTermsOpen] = useState(false);
  const [isE2EESettingsOpen, setIsE2EESettingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [existingCallStream, setExistingCallStream] = useState<MediaStream | null>(null);

  // Sync /join/{ROOM_ID} from URL
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/join\/([^/]+)/);
    if (match && match[1]) {
      const rawRoom = decodeURIComponent(match[1]).trim();
      if (rawRoom) {
        const found = channels.find((c) => c.id === rawRoom || c.id === `chan-${rawRoom}` || c.name === rawRoom);
        if (found) {
          setActiveChannelId(found.id);
        } else if (channels.length > 0) {
          const newChan: Channel = {
            id: `chan-${rawRoom}`,
            name: rawRoom,
            description: `Sala compartida /join/${rawRoom}`,
            isPrivate: false,
            isE2EE: true,
          };
          setChannels((prev) => [...prev, newChan]);
          setActiveChannelId(newChan.id);
        }
      }
    }
  }, [channels]);

  // Hide banner permanently
  useEffect(() => {
    localStorage.setItem('jcv_hide_banner', 'true');
  }, []);

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

  // Initial data loading
  useEffect(() => {
    const initApp = async () => {
      try {
        // Fetch SiliconFlow status
        const sfStatus = await api.getSiliconFlowStatus();
        setSiliconFlowStatus(sfStatus);

        // Fetch users
        const fetchedUsers = await api.getUsers();
        setUsers(fetchedUsers);

        // If no current user, default to José Carlos (Admin & Founder)
        if (!currentUser && fetchedUsers.length > 0) {
          const defaultUser = fetchedUsers[0];
          setCurrentUser(defaultUser);
          setSelectedLanguage(defaultUser.preferredLanguage);
        }

        // Fetch channels
        const fetchedChannels = await api.getChannels();
        setChannels(fetchedChannels);
        if (fetchedChannels.length > 0 && !activeChannelId) {
          setActiveChannelId(fetchedChannels[0].id);
        }
      } catch (err) {
        console.error('App init error:', err);
      }
    };

    initApp();
  }, []);

  // Fetch messages when active channel changes
  useEffect(() => {
    if (!activeChannelId) return;

    const fetchChannelMessages = async () => {
      try {
        const msgs = await api.getMessages(activeChannelId);
        setMessages(msgs);
      } catch (err) {
        console.error('Error fetching messages for channel:', err);
      }
    };

    fetchChannelMessages();
  }, [activeChannelId]);

  // Setup Real-time SSE Connection
  useEffect(() => {
    realtimeChat.connect();

    // Listen to new messages
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

    // Listen to background translations
    const unsubMsgTrans = realtimeChat.on('message_translated', (data: { messageId: string; translations: Record<string, string> }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.messageId) {
            return {
              ...m,
              translations: {
                ...(m.translations || {}),
                ...data.translations,
              },
            };
          }
          return m;
        })
      );
    });

    // Listen to message reactions
    const unsubReaction = realtimeChat.on('message_reaction', (data: { messageId: string; reactions: Record<string, string[]> }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.messageId) {
            return { ...m, reactions: data.reactions };
          }
          return m;
        })
      );
    });

    // Listen to typing indicators
    const unsubTyping = realtimeChat.on('typing', (data: { channelId: string; userId: string; userName: string; isTyping: boolean }) => {
      if (data.channelId === activeChannelId && currentUser && data.userId !== currentUser.id) {
        setTypingUsers((prev) => {
          if (data.isTyping) {
            if (prev.some((u) => u.userId === data.userId)) return prev;
            return [...prev, { userId: data.userId, userName: data.userName }];
          } else {
            return prev.filter((u) => u.userId !== data.userId);
          }
        });
      }
    });

    // Listen to WebRTC signaling for calls
    const unsubWebRTC = realtimeChat.on('webrtc_signal', (signal: any) => {
      if (!currentUser || signal.senderId === currentUser.id) {
        return;
      }

      if (signal.signalType === 'call_request') {
        // Incoming call received
        playNotificationSound('receive');
        setActiveCall((prev) => {
          if (prev) return prev; // already in call
          return {
            channelId: signal.channelId,
            channelName: channels.find((c) => c.id === signal.channelId)?.name || 'Llamada E2EE',
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

    // Listen to newly created channels
    const unsubNewChan = realtimeChat.on('channel_created', (newChan: Channel) => {
      setChannels((prev) => {
        if (prev.some((c) => c.id === newChan.id)) return prev;
        return [...prev, newChan];
      });
    });

    // Listen to user status & updates
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

  // Handle start WebRTC Call (Voice or Video)
  const handleStartCall = async (type: 'voice' | 'video', targetUser?: User, stream?: MediaStream) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    if (stream) {
      setExistingCallStream(stream);
    }

    const channel = channels.find((c) => c.id === activeChannelId) || channels[0];
    const callName = targetUser ? targetUser.name : channel?.name || 'general-fānyì';

    playNotificationSound('send');

    setActiveCall({
      channelId: channel?.id || 'chan-general',
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

    // Broadcast call request to peers
    await api.sendWebRTCSignal({
      channelId: channel?.id || 'chan-general',
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      targetUserId: targetUser?.id,
      signalType: 'call_request',
      callType: type,
      e2ee: true,
    });
  };

  // Accept incoming call
  const handleAcceptCall = async () => {
    if (!activeCall || !currentUser) return;
    setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));

    await api.sendWebRTCSignal({
      channelId: activeCall.channelId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      signalType: 'call_accepted',
      callType: activeCall.callType,
    });
  };

  // End active call
  const handleEndCall = async () => {
    if (activeCall && currentUser) {
      await api.sendWebRTCSignal({
        channelId: activeCall.channelId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        signalType: 'call_ended',
        callType: activeCall.callType,
      });
    }
    setActiveCall(null);
  };

  // Connect global window handlers for jcv-world.js (persistent call connecting without prompt)
  useEffect(() => {
    (window as any).onJcvConnectToRoom = (stream: MediaStream, isVideo: boolean) => {
      handleStartCall(isVideo ? 'video' : 'voice', undefined, stream);
    };
    (window as any).onJcvEndCall = () => {
      handleEndCall();
    };
  }, [activeChannelId, currentUser, channels]);

  // Handle send message
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
      await api.sendMessage({
        channelId: activeChannelId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderLanguage: currentUser.preferredLanguage,
        text: params.text,
        isE2EE: params.isE2EE,
        encryptedPayload: params.encryptedPayload,
        isAudio: params.isAudio,
        audioBase64: params.audioBase64,
        audioDuration: params.audioDuration,
        skipTranslation: params.skipTranslation,
      });
    } catch (err: any) {
      console.error('Failed to send message:', err);
      alert('Error al enviar mensaje: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  // Handle typing event
  const handleTyping = (isTyping: boolean) => {
    if (currentUser && activeChannelId) {
      api.sendTyping(activeChannelId, currentUser.id, currentUser.name, isTyping);
    }
  };

  // Handle emoji reaction
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    try {
      const reactions = await api.toggleReaction(messageId, emoji, currentUser.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    } catch (err) {
      console.error('Reaction error:', err);
    }
  };

  // Quick switch user persona
  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    setSelectedLanguage(user.preferredLanguage);
  };

  // Create new channel
  const handleCreateChannel = async (name: string, description: string, isE2EE: boolean) => {
    try {
      const newChan = await api.createChannel(name, description, isE2EE);
      setChannels((prev) => [...prev, newChan]);
      setActiveChannelId(newChan.id);

      if (isE2EE) {
        setChannelPassphrases((prev) => ({
          ...prev,
          [newChan.id]: 'jcv-e2ee-key-' + Math.random().toString(36).substring(2, 8),
        }));
      }
    } catch (err: any) {
      console.error('Error creating channel:', err);
      alert('Error al crear canal: ' + err.message);
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];
  const activePassphrase = activeChannel ? channelPassphrases[activeChannel.id] || '' : '';

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f8fafc] flex flex-col font-sans select-none">
      {appMode === 'vault' ? (
        /* JCV FĀNYÌ VAULT - Enterprise B2B Document Translation & Ephemeral Vault */
        <VaultView
          onSwitchToChat={() => setAppMode('chat')}
          onOpenLegal={() => setIsLegalTermsOpen(true)}
        />
      ) : (
        /* Real-time Communications Suite */
        <>
          {/* Clean & Minimalist Navbar */}
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
            onLogout={() => setCurrentUser(null)}
            onSwitchToVault={() => setAppMode('vault')}
            onOpenLegal={() => setIsLegalTermsOpen(true)}
          />

          {/* Main App Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar */}
            <Sidebar
              channels={channels}
              activeChannelId={activeChannelId}
              onSelectChannel={setActiveChannelId}
              users={users}
              currentUser={currentUser}
              onSwitchUser={handleSwitchUser}
              onCreateChannel={handleCreateChannel}
              isMobileOpen={isMobileSidebarOpen}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
              onCallUser={(u, type) => handleStartCall(type, u)}
            />

            {/* Center Chat Area */}
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
              onOpenB2B={() => setAppMode('vault')}
            />
          </div>
        </>
      )}

      {/* WebRTC Voice & Video Call Overlay / Floating PiP */}
      <CallModal
        activeCall={activeCall}
        currentUser={currentUser}
        passphrase={activePassphrase}
        existingStream={existingCallStream}
        onEndCall={handleEndCall}
        onAcceptIncomingCall={handleAcceptCall}
      />

      {/* Pestaña Planes: B2C Pack 10 & B2B Bóveda Pack 10 */}
      <Planes
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        currentUser={currentUser}
        onOpenB2B={() => {
          setIsSubscriptionOpen(false);
          setAppMode('vault');
        }}
        onOpenLegal={() => {
          setIsSubscriptionOpen(false);
          setIsLegalTermsOpen(true);
        }}
        onSubscriptionUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
          setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
        }}
      />

      {/* E2EE Passphrase & Safety Numbers Modal */}
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

      {/* SiliconFlow Qwen Settings & Sandbox Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        siliconFlowStatus={siliconFlowStatus}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onOpenLegal={() => setIsLegalTermsOpen(true)}
      />

      {/* Walkie-Talkie Simultaneous Voice Translation Modal */}
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

      {/* Auth / Login Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        availableUsers={users}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setSelectedLanguage(user.preferredLanguage);
        }}
      />

      {/* Blindaje Legal & Prevención de Demandas (TyC 4 Cláusulas) */}
      <LegalTermsModal
        isOpen={isLegalTermsOpen}
        onClose={() => setIsLegalTermsOpen(false)}
      />
    </div>
  );
}
