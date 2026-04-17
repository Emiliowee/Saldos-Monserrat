/**
 * Permite a CuadernoView registrar una comprobación async antes de salir del módulo
 * (otra sección, atrás/adelante en el historial).
 *
 * @type {{ run: () => Promise<boolean> } | null}
 */
let api = null

/** @param {null | (() => Promise<boolean>)} run - true = permitir salir */
export function registerCuadernoNavGuard(run) {
  api = run ? { run } : null
}

/** @returns {Promise<boolean>} true si se puede salir del módulo Cuaderno */
export async function ensureCanLeaveCuaderno() {
  if (!api?.run) return true
  try {
    return await api.run()
  } catch {
    return false
  }
}
