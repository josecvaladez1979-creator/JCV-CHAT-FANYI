// Unión de la lista local de mensajes con la que responde el servidor.
// Sirve de respaldo cuando la conexión en vivo no llega (redes móviles, proxies)
// y para que los mensajes BORRADOS desaparezcan aunque se perdiera el aviso.

type Msg = {
  id: string;
  timestamp: number;
  translations?: Record<string, string>;
  reactions?: Record<string, string[]>;
};

export function sameMessages<T extends Msg>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
    if (JSON.stringify(a[i].translations ?? null) !== JSON.stringify(b[i].translations ?? null)) return false;
    if (JSON.stringify(a[i].reactions ?? {}) !== JSON.stringify(b[i].reactions ?? {})) return false;
  }
  return true;
}

// serverTime = hora del servidor justo ANTES de armar la lista.
// - Lo que ya estaba aquí y la lista no trae, y es ANTERIOR a esa hora: fue borrado.
// - Lo que llegó en vivo y es POSTERIOR a esa hora: aún puede faltar en la lista; se conserva.
// Si nada cambió devuelve la MISMA lista (así la pantalla no parpadea).
export function mergeMessages<T extends Msg>(prev: T[], fresh: T[], serverTime: number): T[] {
  const byId = new Map<string, T>();
  for (const m of fresh) byId.set(m.id, m);

  for (const m of prev) {
    if (!byId.has(m.id) && m.timestamp > serverTime) byId.set(m.id, m);
  }

  const merged = [...byId.values()].sort(
    (a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id)
  );
  return sameMessages(prev, merged) ? prev : merged;
}
