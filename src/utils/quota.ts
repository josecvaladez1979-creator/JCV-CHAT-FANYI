// Las cuotas y los límites ya NO se llevan en el navegador: cualquiera podía
// borrarlos o alterarlos desde las herramientas del navegador. Ahora todo lo decide
// el servidor con el saldo del usuario.
//
// Este archivo se conserva mínimo SOLO porque CallModal.tsx todavía importa
// incrementCallQuota. Cuando existan las llamadas, el servidor medirá los minutos
// y esta función se podrá borrar junto con su importación en CallModal.
export function incrementCallQuota(
  _plan: string | undefined,
  _durationSeconds: number,
  _callType: 'voice' | 'video'
): void {
  // No hace nada a propósito.
}
