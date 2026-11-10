import crypto from "node:crypto";

// ========================================================
// TIEMPO REAL: conexiones SSE y boletos de un solo uso
// Funciona con UNA sola instancia del servidor (la memoria no se comparte).
// Con varias instancias hará falta un canal común (por ejemplo Redis).
// ========================================================

export const MAX_CONNECTIONS_PER_USER = 5;
export const MAX_CONNECTIONS_TOTAL = 1000;

type SseResponse = {
  write(chunk: string): unknown;
  end(): unknown;
};

type Connection = { id: string; userId: string; res: SseResponse };

export class ChatHub {
  private connections = new Map<string, Connection>();

  count(): number {
    return this.connections.size;
  }

  countForUser(userId: string): number {
    let n = 0;
    for (const c of this.connections.values()) if (c.userId === userId) n++;
    return n;
  }

  add(userId: string, res: SseResponse): Connection {
    const conn: Connection = { id: crypto.randomUUID(), userId, res };
    this.connections.set(conn.id, conn);
    return conn;
  }

  remove(id: string): void {
    this.connections.delete(id);
  }

  private frame(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  private safeWrite(conn: Connection, chunk: string): void {
    try {
      conn.res.write(chunk);
    } catch {
      this.connections.delete(conn.id);
    }
  }

  sendTo(conn: Connection, event: string, data: unknown): void {
    this.safeWrite(conn, this.frame(event, data));
  }

  // audience = null  → todos los conectados (canales públicos)
  // audience = Set   → solo esos usuarios (canales privados)
  broadcast(event: string, data: unknown, audience: Set<string> | null): void {
    const chunk = this.frame(event, data);
    for (const conn of [...this.connections.values()]) {
      if (audience === null || audience.has(conn.userId)) {
        this.safeWrite(conn, chunk);
      }
    }
  }

  // Comentario SSE: mantiene viva la conexión a través de proxies.
  heartbeat(): void {
    for (const conn of [...this.connections.values()]) {
      this.safeWrite(conn, ": ping\n\n");
    }
  }

  closeAll(): void {
    for (const conn of [...this.connections.values()]) {
      try {
        conn.res.end();
      } catch {
        // ya cerrada
      }
    }
    this.connections.clear();
  }
}

export const hub = new ChatHub();

// EventSource no puede enviar cabeceras. Para no poner el token de acceso en
// la dirección, el cliente pide un boleto de un solo uso (30 s) y lo presenta.
export class TicketStore {
  private tickets = new Map<string, { userId: string; expiresAt: number }>();
  private ttlMs: number;
  private now: () => number;

  constructor(ttlMs: number, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  issue(userId: string): string {
    const ticket = crypto.randomBytes(32).toString("hex");
    this.tickets.set(ticket, { userId, expiresAt: this.now() + this.ttlMs });
    return ticket;
  }

  // Devuelve el usuario y borra el boleto: solo sirve una vez.
  consume(ticket: string): string | null {
    const entry = this.tickets.get(ticket);
    if (!entry) return null;
    this.tickets.delete(ticket);
    return entry.expiresAt > this.now() ? entry.userId : null;
  }

  purge(): void {
    const t = this.now();
    for (const [k, v] of this.tickets) if (v.expiresAt <= t) this.tickets.delete(k);
  }

  size(): number {
    return this.tickets.size;
  }
}

export const tickets = new TicketStore(30_000);

export function startChatTimers(): () => void {
  const beat = setInterval(() => hub.heartbeat(), 20_000);
  const purge = setInterval(() => tickets.purge(), 60_000);
  beat.unref();
  purge.unref();
  return () => {
    clearInterval(beat);
    clearInterval(purge);
  };
  }
