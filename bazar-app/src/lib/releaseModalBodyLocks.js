/**
 * Radix Dialog a veces deja `pointer-events: none` en `body` si el cierre coincide con
 * `window.confirm`, HMR o modales anidados. Eso deja la app “muerta” (clics/teclado no
 * llegan a los inputs aunque no haya overlay visible).
 *
 * Solo quitamos `pointer-events` para no romper el scroll-lock (`overflow`) de otro
 * diálogo Radix que siga abierto.
 */
export function releaseModalBodyLocks() {
  document.body.style.removeProperty('pointer-events')
}
