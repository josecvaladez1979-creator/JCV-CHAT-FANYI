import { api } from './api';

type SSECallback = (data: any) => void;

const EVENTS = [
  'connected',
  'new_message',
  'message_translated',
  'message_reaction',
  'typing',
  'channel_created',
  'user_joined',
  'user_updated',
  'user_status',
  'webrtc_signal',
];

// Conexión en tiempo real. Antes abría el flujo sin credenciales y reintentaba
// cada 3 s para siempre. Ahora pide un boleto de un solo uso con la sesión,
// reintenta con espera creciente y se detiene si no hay sesión.
class RealtimeChatClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<SSECallback>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private wanted = false;
  private connecting = false;

  async connect() {
    this.wanted = true;
    if (this.eventSource || this.connecting) return;

    this.connecting = true;
    try {
      const ticket = await api.getStreamTicket();
      if (!this.wanted) return;
      this.open(ticket);
    } catch (error: any) {
      // Sin sesión (401) no tiene sentido reintentar.
      if (error?.status === 401) {
        this.wanted = false;
        this.emit('connection_status', { connected: false });
        return;
      }
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private open(ticket: string) {
    const es = new EventSource('/api/chat/stream?ticket=' + encodeURIComponent(ticket));
    this.eventSource = es;

    es.onopen = () => {
      this.attempts = 0;
      this.emit('connection_status', { connected: true });
    };

    es.onerror = () => {
      es.close();
      if (this.eventSource === es) this.eventSource = null;
      this.emit('connection_status', { connected: false });
      this.scheduleReconnect();
    };

    EVENTS.forEach((name) => {
      es.addEventListener(name, (e: MessageEvent) => {
        try {
          this.emit(name, JSON.parse(e.data));
        } catch (err) {
          console.error('Error leyendo un evento en tiempo real:', err);
        }
      });
    });
  }

  // Espera 1 s, 2 s, 4 s... hasta 30 s, con un poco de azar para que todos
  // los usuarios no reconecten a la vez.
  private scheduleReconnect() {
    if (!this.wanted) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    const base = Math.min(30_000, 1000 * 2 ** this.attempts);
    this.attempts += 1;
    const delay = base + Math.floor(Math.random() * 1000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  on(event: string, callback: SSECallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  disconnect() {
    this.wanted = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.attempts = 0;
  }
}

export const realtimeChat = new RealtimeChatClient();
