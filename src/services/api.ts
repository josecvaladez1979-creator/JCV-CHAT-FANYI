const TOKEN_KEY = 'jcv_token';
const USER_KEY = 'jcv_user';

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

async function reauth(): Promise<boolean> {
  try {
    const saved = localStorage.getItem(USER_KEY);
    if (!saved) return false;
    const user = JSON.parse(saved);
    if (!user || !user.id) return false;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: user.id }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data && data.token) { setToken(data.token); return true; }
    return false;
  } catch { return false; }
}

async function request(path: string, opts: RequestInit = {}, allowReauth = true): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  let res = await fetch(path, { ...opts, headers, credentials: 'include' });

  if (res.status === 401 && allowReauth) {
    const ok = await reauth();
    if (ok) {
      headers['Authorization'] = 'Bearer ' + getToken();
      res = await fetch(path, { ...opts, headers, credentials: 'include' });
    }
  }
  return res;
}

async function jsonOrThrow(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || fallback);
  return data;
}

export const api = {
  async getSiliconFlowStatus() {
    const res = await request('/api/siliconflow/status');
    return res.json();
  },

  async translate(text: string, targetLang: string, sourceLang?: string, model?: string) {
    const res = await request('/api/siliconflow/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang, sourceLang, model }),
    });
    return jsonOrThrow(res, 'Translation failed');
  },

  async processAudio(audioBase64: string, targetLang: string) {
    const res = await request('/api/siliconflow/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, targetLang }),
    });
    return jsonOrThrow(res, 'Audio processing failed');
  },

  async getChannels() {
    const res = await request('/api/chat/channels');
    const data = await res.json();
    return data.channels;
  },

  async createChannel(name: string, description: string, isE2EE = false) {
    const res = await request('/api/chat/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, isE2EE }),
    });
    const data = await res.json();
    return data.channel;
  },

  async getMessages(channelId: string) {
    const res = await request('/api/chat/messages?channelId=' + encodeURIComponent(channelId));
    const data = await res.json();
    return data.messages;
  },

  async sendMessage(messageData: any) {
    const res = await request('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData),
    });
    const data = await jsonOrThrow(res, 'Failed to send message');
    return data.message;
  },

  async getUsers() {
    const res = await request('/api/auth/users');
    const data = await res.json();
    return data.users;
  },

  async login(params: { email?: string; userId?: string; password?: string }) {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }, false);
    const data = await jsonOrThrow(res, 'Login failed');
    if (data && data.token) setToken(data.token);
    return data;
  },

  async register(data: { name: string; email: string; password?: string; preferredLanguage?: string; avatar?: string }) {
    const res = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, false);
    const out = await jsonOrThrow(res, 'Registration failed');
    if (out && out.token) setToken(out.token);
    return out;
  },

  async createCheckout(cycle: string, gateway: string, userId: string) {
    const isB2B = cycle === 'anual' || cycle === '1y';
    const planId = isB2B ? 'B2B_1Y' : (cycle === 'mensual' || cycle === '1m' ? 'B2C_1M' : 'B2C_15D');
    const body = isB2B
      ? { companyName: 'Mi Empresa', planId, gateway }
      : { planId, gateway };
    const path = isB2B ? '/api/b2b/checkout' : '/api/b2c/checkout';
    const res = await request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await jsonOrThrow(res, 'Checkout creation failed');
    return { orderId: data.orderId, checkoutUrl: data.url, cycle, gateway };
  },

  async confirmSubscription(userId: string, cycle: string, gateway: string, orderId: string) {
    const res = await request('/api/auth/me');
    const data = await res.json();
    return { success: true, user: data.user, orderId };
  },

  async getVaultPlans() {
    const res = await request('/api/vault/plans');
    return res.json();
  },

  async createVaultCheckout(planId: string, gateway = 'mercadopago', clientEmail?: string, rfc?: string) {
    const res = await request('/api/vault/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, gateway, clientEmail, rfc }),
    });
    return jsonOrThrow(res, 'Vault checkout failed');
  },

  async translateVaultContract(params: any) {
    const res = await request('/api/vault/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return jsonOrThrow(res, 'Contract translation failed');
  },

  async getVaultCertificates() {
    const res = await request('/api/vault/certificates');
    const data = await res.json();
    return data.certificates;
  },

  async recordDestructionCertificate(params: any) {
    const res = await request('/api/vault/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data.certificate;
  },

  async sendWebRTCSignal(signalData: any) {
    const res = await request('/api/webrtc/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signalData),
    });
    return res.json();
  },
};
