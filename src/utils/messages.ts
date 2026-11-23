// Unión de la lista local de mensajes con la que responde el servidor.
// Sirve de respaldo cuando la conexión en vivo no llega (redes móviles, proxies).

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

// Toma lo que dice el servidor y conserva lo que llegó en vivo mientras tanto.
// Si nada cambió devuelve la MISMA lista (así la pantalla no parpadea).
export function mergeMessages<T extends Msg>(prev: T[], fresh: T[]): T[] {
  // Una respuesta vacía nunca borra lo que ya se ve.
  if (fresh.length === 0) return prev;

  const oldest = fresh[0].timestamp;
  const byId = new Map<string, T>();
  for (const m of fresh) byId.set(m.id, m);

  // Un mensaje que llegó en vivo mientras se hacía la consulta aún puede faltar en ella.
  for (const m of prev) {
    if (!byId.has(m.id) && m.timestamp >= oldest) byId.set(m.id, m);
  }

  const merged = [...byId.values()].sort(
    (a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id)
  );
  return sameMessages(prev, merged) ? prev : merged;
}
