import { User, Message, Channel, PaymentGateway, LanguageCode, B2CPlanId, B2BPlanId } from '../types';

class ApiClient {
  private baseUrl = '';
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opts.headers as Record<string, string>),
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, { ...opts, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || 'Request failed');
    }
    return res.status === 204 ? (undefined as T) : res.json();
  }

  // ─── SiliconFlow ───────────────────────────────────────
  getSiliconFlowStatus() {
    return this.request<{ hasApiKey: boolean; defaultModel: string; audioModel: string; provider: string; accuracy: string }>('/api/siliconflow/status');
  }

  translate(text: string, targetLang: LanguageCode, sourceLang?: LanguageCode, model?: string) {
    return this.request<{ translatedText: string; modelUsed: string; accuracy: string }>('/api/siliconflow/translate', {
      method: 'POST', body: JSON.stringify({ text, targetLang, sourceLang, model }),
    });
  }

  processAudio(audioBase64: string, targetLang: LanguageCode) {
    return this.request<{ transcription: string; translatedText: string; modelUsed: string }>('/api/siliconflow/audio', {
      method: 'POST', body: JSON.stringify({ audioBase64, targetLang }),
    });
  }

  // ─── Channels ──────────────────────────────────────────
  async getChannels() {
    const data = await this.request<{ channels: Channel[] }>('/api/chat/channels');
    return data.channels;
  }

  async createChannel(name: string, description: string, isE2EE = false) {
    const data = await this.request<{ channel: Channel }>('/api/chat/channels', {
      method: 'POST', body: JSON.stringify({ name, description, isE2EE }),
    });
    return data.channel;
  }

  // ─── Messages ──────────────────────────────────────────
  async getMessages(channelId: string) {
    const data = await this.request<{ messages: Message[] }>(`/api/chat/messages?channelId=${encodeURIComponent(channelId)}`);
    return data.messages;
  }

  sendMessage(messageData: Partial<Message>) {
    return this.request<{ message: Message }>('/api/chat/messages', {
      method: 'POST', body: JSON.stringify(messageData),
    });
  }

  // ─── Auth ──────────────────────────────────────────────
  async getUsers() {
    const data = await this.request<{ users: User[] }>('/api/auth/users');
    return data.users;
  }

  async login(params: { email?: string; password?: string; userId?: string }) {
    const res = await this.request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify(params),
    });
    this.setAccessToken(res.token);
    return res;
  }

  async register(data: { name: string; email: string; password: string; preferredLanguage: LanguageCode; avatar?: string }) {
    const res = await this.request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST', body: JSON.stringify(data),
    });
    this.setAccessToken(res.token);
    return res;
  }

  // ─── FREEMIUM ──────────────────────────────────────────
  getFreemiumQuota() {
    return this.request<{ used: number; limit: number; remaining: number }>('/api/freemium/quota');
  }

  // ─── B2C ───────────────────────────────────────────────
  getB2CPlans() {
    return this.request<{ plans: import('../types').B2CPlan[] }>('/api/b2c/plans');
  }

  getB2CSubscription() {
    return this.request<{ subscription: import('../types').B2CPlan | null }>('/api/b2c/subscription');
  }

  createB2CCheckout(planId: B2CPlanId, gateway: PaymentGateway) {
    return this.request<{ url: string; orderId: string }>('/api/b2c/checkout', {
      method: 'POST', body: JSON.stringify({ planId, gateway }),
    });
  }

  confirmB2CSubscription(orderId: string) {
    return this.request<{ user: User }>('/api/b2c/confirm', {
      method: 'POST', body: JSON.stringify({ orderId }),
    });
  }

  cancelB2C() {
    return this.request<{ success: boolean }>('/api/b2c/cancel', { method: 'POST' });
  }

  // ─── B2B ───────────────────────────────────────────────
  getB2BPlans() {
    return this.request<{ plans: import('../types').B2BPlan[] }>('/api/b2b/plans');
  }

  getB2BDashboard() {
    return this.request<{ companyName: string; employees: User[]; subscription: import('../types').B2BPlan | null }>('/api/b2b/dashboard');
  }

  createB2BCheckout(companyName: string, planId: B2BPlanId, gateway: PaymentGateway) {
    return this.request<{ url: string; orderId: string }>('/api/b2b/checkout', {
      method: 'POST', body: JSON.stringify({ companyName, planId, gateway }),
    });
  }

  confirmB2BSubscription(orderId: string) {
    return this.request<{ user: User }>('/api/b2b/confirm', {
      method: 'POST', body: JSON.stringify({ orderId }),
    });
  }

  addB2BEmployee(data: { name: string; email: string; password: string }) {
    return this.request<{ employee: User }>('/api/b2b/employees', {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  removeB2BEmployee(employeeId: string) {
    return this.request<void>(`/api/b2b/employees/${employeeId}`, { method: 'DELETE' });
  }

  getB2BStats() {
    return this.request<{ messages: number; users: number; translations: number }>('/api/b2b/stats');
  }

  // ─── Vault (legacy) ────────────────────────────────────
  getVaultPlans() { return this.request('/api/vault/plans'); }
  createVaultCheckout(planId: string, gateway = 'mercadopago', clientEmail?: string, rfc?: string) {
    return this.request('/api/vault/checkout', {
      method: 'POST', body: JSON.stringify({ planId, gateway, clientEmail, rfc }),
    });
  }
  translateVaultContract(params: { documentName: string; content: string; sourceLang?: string; targetLang?: string; timerDuration?: string; planId?: string; pages?: number }) {
    return this.request('/api/vault/translate', { method: 'POST', body: JSON.stringify(params) });
  }
  async getVaultCertificates() {
    const data = await this.request<{ certificates: import('../types').VaultCertificate[] }>('/api/vault/certificates');
    return data.certificates;
  }

  // ─── WebRTC ────────────────────────────────────────────
  sendWebRTCSignal(signalData: any) {
    return this.request('/api/webrtc/signal', {
      method: 'POST', body: JSON.stringify({ ...signalData, timestamp: Date.now() }),
    });
  }

  // ─── Legacy (compatibilidad) ──────────────────────────
  async createCheckout(cycle: string, gateway: PaymentGateway, userId: string) {
    // Mapeo legacy: 'mensual' -> B2C_1M, 'anual' -> B2B_1Y
    if (cycle === 'mensual' || cycle === '1m') {
      return this.createB2CCheckout('B2C_1M', gateway);
    }
    if (cycle === 'anual' || cycle === '1y') {
      return this.createB2BCheckout('', 'B2B_1Y', gateway);
    }
    return this.createB2CCheckout('B2C_15D', gateway);
  }

  async confirmSubscription(userId: string, cycle: string, gateway: PaymentGateway, orderId: string) {
    if (cycle === 'mensual' || cycle === '1m') {
      return this.confirmB2CSubscription(orderId);
    }
    if (cycle === 'anual' || cycle === '1y') {
      return this.confirmB2BSubscription(orderId);
    }
    return this.confirmB2CSubscription(orderId);
  }
}

export const api = new ApiClient();
