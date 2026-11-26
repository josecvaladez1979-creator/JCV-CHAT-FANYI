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
  'message_deleted',
];

// Conexión en tiempo real. Pide un boleto de un solo uso con la sesión, reintenta con
// espera creciente y se detiene si no hay sesión. Cuando falla, avisa el MOTIVO
// (connection_status.reason) para poder ver qué pasa en cada teléfono.
class RealtimeChatClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<SSECallback>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private wanted = false;
  private connecting = false;
  private isOpen = false;
  private lastProbeAt = 0;

  private emitStatus(connected: boolean, reason?: string) {
    this.emit('connection_status', { connected, reason });
  }

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
        this.emitStatus(false, 'sin sesión iniciada (401)');
        return;
      }
      const detail = error?.status ? `HTTP ${error.status}` : error?.message || 'sin respuesta';
      this.emitStatus(false, `no se obtuvo el boleto: ${detail}`);
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
      this.isOpen = true;
      this.emitStatus(true);
    };

    es.onerror = () => {
      es.close();
      if (this.eventSource === es) this.eventSource = null;
      this.isOpen = false;
      this.emitStatus(false, 'la conexión se cortó; reintentando');
      this.scheduleReconnect();
      // Tras varios fallos seguidos, se hace una prueba para ver qué responde el servidor.
      if (this.attempts >= 2) void this.diagnose();
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

  // Una vez por minuto como máximo: pide un boleto, abre la conexión con fetch,
  // lee SOLO el código de respuesta y la cierra. EventSource no revela el código.
  private async diagnose() {
    const now = Date.now();
    if (now - this.lastProbeAt < 60_000) return;
    this.lastProbeAt = now;

    let info: string;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const ticket = await api.getStreamTicket();
      const res = await fetch('/api/chat/stream?ticket=' + encodeURIComponent(ticket), {
        signal: controller.signal,
        cache: 'no-store',
      });
      info = `prueba: HTTP ${res.status} ${res.headers.get('content-type') ?? 'sin tipo'}`;
    } catch (e: any) {
      info = `prueba: sin respuesta (${e?.name || 'error'})`;
    } finally {
      clearTimeout(timer);
      controller.abort();
    }

    // Si mientras tanto se logró conectar, no se pisa ese estado.
    if (!this.isOpen) this.emitStatus(false, info);
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
    this.isOpen = false;
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
