
const TOKEN_KEY = 'jcv_token';

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // El almacenamiento puede estar bloqueado.
  }
}

async function request(
  path: string,
  opts: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(opts.headers);
  const token = getToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(path, {
    ...opts,
    headers,
    credentials: 'include',
  });
}

async function jsonOrThrow(
  res: Response,
  fallback: string
): Promise<any> {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || fallback);
  }

  return data;
}

function saveAuthToken(data: any) {
  const token = data?.token || data?.accessToken;

  if (token) {
    setToken(token);
  }
}

const B2B_PLAN_IDS = [
  'BASIC',
  'PROFESSIONAL',
  'CORPORATE',
] as const;

type B2BPlanId = (typeof B2B_PLAN_IDS)[number];

export const api = {
  async getSiliconFlowStatus() {
    const res = await request('/api/siliconflow/status');
    return jsonOrThrow(res, 'No se pudo consultar el estado de la IA');
  },

  async translate(
    text: string,
    targetLang: string,
    sourceLang?: string,
    model?: string
  ) {
    const res = await request('/api/siliconflow/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        targetLang,
        sourceLang,
        model,
      }),
    });

    return jsonOrThrow(res, 'Error de traducción');
  },

  async processAudio(audioBase64: string, targetLang: string) {
    const res = await request('/api/siliconflow/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, targetLang }),
    });

    return jsonOrThrow(res, 'Error al procesar el audio');
  },

  async getChannels() {
    const res = await request('/api/chat/channels');
    const data = await jsonOrThrow(res, 'No se pudieron cargar los canales');
    return data.channels;
  },

  async createChannel(
    name: string,
    description: string,
    isE2EE = false
  ) {
    const res = await request('/api/chat/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, isE2EE }),
    });

    const data = await jsonOrThrow(res, 'No se pudo crear el canal');
    return data.channel;
  },

  async getMessages(channelId: string) {
    const res = await request(
      '/api/chat/messages?channelId=' + encodeURIComponent(channelId)
    );

    const data = await jsonOrThrow(res, 'No se pudieron cargar los mensajes');
    return data.messages;
  },

  async sendMessage(messageData: any) {
    const res = await request('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData),
    });

    const data = await jsonOrThrow(res, 'No se pudo enviar el mensaje');
    return data.message;
  },

  async getUsers() {
    const res = await request('/api/auth/users');
    const data = await jsonOrThrow(res, 'No se pudieron cargar los usuarios');
    return data.users;
  },

  async login(params: {
    email?: string;
    userId?: string;
    password?: string;
  }) {
    const res = await request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }
    );

    const data = await jsonOrThrow(res, 'No se pudo iniciar sesión');
    saveAuthToken(data);
    return data;
  },

  async register(data: {
    name: string;
    email: string;
    password?: string;
    preferredLanguage?: string;
    avatar?: string;
  }) {
    const res = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await jsonOrThrow(res, 'No se pudo crear la cuenta');
    saveAuthToken(result);
    return result;
  },

  // Checkout B2C: conserva los identificadores de los planes individuales.
  async createCheckout(
    cycle: string,
    gateway: string,
    userId: string
  ) {
    void userId;

    const planId =
      cycle === 'anual' || cycle === '1y' || cycle === 'B2C_1Y'
        ? 'B2C_1Y'
        : cycle === 'mensual' || cycle === '1m' || cycle === 'B2C_1M'
          ? 'B2C_1M'
          : cycle === 'B2C_15D'
            ? 'B2C_15D'
            : 'B2C_15D';

    const res = await request('/api/b2c/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, gateway }),
    });

    const data = await jsonOrThrow(res, 'No se pudo crear el pago B2C');

    return {
      orderId: data.orderId,
      checkoutUrl: data.url,
      cycle,
      gateway,
    };
  },

  // Lista los planes empresariales.
  async getB2BPlans() {
    const res = await request('/api/b2b/plans');
    const data = await jsonOrThrow(
      res,
      'No se pudieron cargar los planes empresariales'
    );

    return {
      ...data,
      plans: Array.isArray(data.plans)
        ? data.plans.filter((plan: any) =>
            B2B_PLAN_IDS.includes(plan.id as B2BPlanId)
          )
        : [],
    };
  },

  // Inicia el checkout de uno de los tres niveles B2B.
  async createB2BCheckout(
    companyName: string,
    planId: B2BPlanId,
    gateway: string
  ) {
    if (!B2B_PLAN_IDS.includes(planId)) {
      throw new Error('El plan empresarial seleccionado no es válido.');
    }

    if (!companyName.trim()) {
      throw new Error('Debes indicar el nombre de tu empresa.');
    }

    const res = await request('/api/b2b/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: companyName.trim(),
        planId,
        gateway,
      }),
    });

    const data = await jsonOrThrow(
      res,
      'No se pudo crear el pago empresarial'
    );

    return {
      ...data,
      orderId: data.orderId,
      url: data.url || data.checkoutUrl,
    };
  },

  async confirmSubscription(
    userId: string,
    cycle: string,
    gateway: string,
    orderId: string
  ) {
    void userId;
    void cycle;
    void gateway;

    const res = await request('/api/auth/me');
    const data = await jsonOrThrow(
      res,
      'No se pudo verificar la sesión'
    );

    return {
      success: true,
      user: data.user,
      orderId,
    };
  },

  async getVaultPlans() {
    const res = await request('/api/vault/plans');
    return jsonOrThrow(res, 'No se pudieron cargar los planes Vault');
  },

  async createVaultCheckout(
    planId: string,
    gateway = 'mercadopago',
    clientEmail?: string,
    rfc?: string
  ) {
    const res = await request('/api/vault/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        gateway,
        clientEmail,
        rfc,
      }),
    });

    return jsonOrThrow(res, 'No se pudo iniciar el pago Vault');
  },

  async translateVaultContract(params: any) {
    const res = await request('/api/vault/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    return jsonOrThrow(res, 'No se pudo traducir el contrato');
  },

  async getVaultCertificates() {
    const res = await request('/api/vault/certificates');
    const data = await jsonOrThrow(
      res,
      'No se pudieron cargar los certificados'
    );

    return data.certificates;
  },

  async recordDestructionCertificate(params: any) {
    const res = await request('/api/vault/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await jsonOrThrow(
      res,
      'No se pudo registrar el certificado'
    );

    return data.certificate;
  },

  async sendWebRTCSignal(signalData: any) {
    const res = await request('/api/webrtc/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signalData),
    });

    return jsonOrThrow(res, 'No se pudo enviar la señal de llamada');
  },
};
