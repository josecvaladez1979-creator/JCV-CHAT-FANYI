type SSECallback = (data: any) => void;

class RealtimeChatClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<SSECallback>> = new Map();
  private reconnectTimer: any = null;
  private isConnected = false;

  connect() {
    if (this.eventSource) {
      return;
    }

    try {
      this.eventSource = new EventSource('/api/chat/stream');

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.emit('connection_status', { connected: true });
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.emit('connection_status', { connected: false });
        this.eventSource?.close();
        this.eventSource = null;

        // Schedule auto reconnect
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, 3000);
      };

      // Listen to custom SSE events
      const events = [
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

      events.forEach((eventName) => {
        this.eventSource?.addEventListener(eventName, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            this.emit(eventName, data);
          } catch (err) {
            console.error('Error parsing SSE event data:', err);
          }
        });
      });
    } catch (e) {
      console.error('Failed to establish EventSource connection:', e);
    }
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
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }
}

export const realtimeChat = new RealtimeChatClient();
