import { User, Message, Channel, BillingCycle, PaymentGateway, LanguageCode } from '../types';

export const api = {
  // SiliconFlow Status
  async getSiliconFlowStatus(): Promise<{
    hasApiKey: boolean;
    defaultModel: string;
    audioModel: string;
    provider: string;
    accuracy: string;
  }> {
    const res = await fetch('/api/siliconflow/status');
    return res.json();
  },

  // Translate text
  async translate(text: string, targetLang: LanguageCode, sourceLang?: LanguageCode, model?: string): Promise<{
    translatedText: string;
    modelUsed: string;
    accuracy: string;
  }> {
    const res = await fetch('/api/siliconflow/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang, sourceLang, model }),
    });
    if (!res.ok) throw new Error('Translation failed');
    return res.json();
  },

  // Transcribe and translate audio
  async processAudio(audioBase64: string, targetLang: LanguageCode): Promise<{
    transcription: string;
    translatedText: string;
    modelUsed: string;
  }> {
    const res = await fetch('/api/siliconflow/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, targetLang }),
    });
    if (!res.ok) throw new Error('Audio processing failed');
    return res.json();
  },

  // Channels
  async getChannels(): Promise<Channel[]> {
    const res = await fetch('/api/chat/channels');
    const data = await res.json();
    return data.channels;
  },

  async createChannel(name: string, description: string, isE2EE = false): Promise<Channel> {
    const res = await fetch('/api/chat/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, isE2EE }),
    });
    const data = await res.json();
    return data.channel;
  },

  // Messages
  async getMessages(channelId: string): Promise<Message[]> {
    const res = await fetch(`/api/chat/messages?channelId=${encodeURIComponent(channelId)}`);
    const data = await res.json();
    return data.messages;
  },

  async sendMessage(messageData: Partial<Message>): Promise<Message> {
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData),
    });
    if (!res.ok) throw new Error('Failed to send message');
    const data = await res.json();
    return data.message;
  },

  async sendTyping(channelId: string, userId: string, userName: string, isTyping: boolean): Promise<void> {
    await fetch('/api/chat/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, userId, userName, isTyping }),
    });
  },

  async toggleReaction(messageId: string, emoji: string, userId: string): Promise<Record<string, string[]>> {
    const res = await fetch(`/api/chat/messages/${messageId}/reaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji, userId }),
    });
    const data = await res.json();
    return data.reactions;
  },

  // Auth
  async getUsers(): Promise<User[]> {
    const res = await fetch('/api/auth/users');
    const data = await res.json();
    return data.users;
  },

  async login(params: { email?: string; userId?: string }): Promise<{ user: User; token: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  async register(data: { name: string; email: string; preferredLanguage: LanguageCode; avatar?: string }): Promise<{ user: User; token: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  },

  // Subscriptions & Checkout
  async createCheckout(cycle: BillingCycle, gateway: PaymentGateway, userId: string) {
    const res = await fetch('/api/subscriptions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycle, gateway, userId }),
    });
    if (!res.ok) throw new Error('Checkout creation failed');
    return res.json();
  },

  async confirmSubscription(userId: string, cycle: BillingCycle, gateway: PaymentGateway, orderId: string): Promise<{
    success: boolean;
    user: User;
    message: string;
    expiresAt: string;
  }> {
    const res = await fetch('/api/subscriptions/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, cycle, gateway, orderId }),
    });
    if (!res.ok) throw new Error('Subscription confirmation failed');
    return res.json();
  },

  // Top-Up Microtransactions
  async createTopUpCheckout(topupId: string, gateway: PaymentGateway, userId: string) {
    const res = await fetch('/api/subscriptions/topup/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topupId, gateway, userId }),
    });
    if (!res.ok) throw new Error('Top-up checkout creation failed');
    return res.json();
  },

  async confirmTopUp(userId: string, topupId: string, orderId: string): Promise<{
    success: boolean;
    user: User;
    addedMinutes: number;
    totalBonusMinutes: number;
    message: string;
    orderId: string;
  }> {
    const res = await fetch('/api/subscriptions/topup/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, topupId, orderId }),
    });
    if (!res.ok) throw new Error('Top-up confirmation failed');
    return res.json();
  },

  // WebRTC E2EE Signaling
  async sendWebRTCSignal(signalData: {
    channelId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    targetUserId?: string;
    signalType: 'call_request' | 'call_accepted' | 'call_declined' | 'call_ended' | 'offer' | 'answer' | 'ice_candidate';
    callType: 'voice' | 'video';
    sdp?: any;
    candidate?: any;
    e2ee?: boolean;
    timestamp?: number;
  }) {
    const res = await fetch('/api/webrtc/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...signalData, timestamp: Date.now() }),
    });
    return res.json();
  },

  // ==========================================
  // JCV FĀNYÌ VAULT - Enterprise B2B API
  // ==========================================
  async getVaultPlans() {
    const res = await fetch('/api/vault/plans');
    return res.json();
  },

  async createVaultCheckout(planId: string, gateway = 'mercadopago', clientEmail?: string, rfc?: string) {
    const res = await fetch('/api/vault/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, gateway, clientEmail, rfc }),
    });
    if (!res.ok) throw new Error('Error al procesar orden de bóveda');
    return res.json();
  },

  async translateVaultContract(params: {
    documentName: string;
    content: string;
    sourceLang?: string;
    targetLang?: string;
    timerDuration?: string;
    planId?: string;
    pages?: number;
  }) {
    const res = await fetch('/api/vault/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error en traducción jurídica del contrato');
    }
    return res.json();
  },

  async getVaultCertificates() {
    const res = await fetch('/api/vault/certificates');
    const data = await res.json();
    return data.certificates;
  },

  async recordDestructionCertificate(params: {
    documentName: string;
    hash?: string;
    pages?: number;
    packRemaining?: string;
    timerSelected?: string;
  }) {
    const res = await fetch('/api/vault/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data.certificate;
  },
};
