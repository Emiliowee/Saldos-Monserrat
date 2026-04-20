import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion as Motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { formatPrice } from '@/lib/format'
import { localPathToFileUrl } from '@/lib/localFileUrl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ReferenceDetailModal({ open, onClose, resumenRows, patrones, cuaderno, tagLines }) {
  const [sub, setSub] = useState('patrones')
  const reduceMotion = useReducedMotion()

  useEffect(() => { if (open) setSub('patrones') }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  const stats = patrones?.stats

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div key="ref-detail-root" className="fixed inset-0 z-[100] flex">
          <Motion.div
            className="fixed inset-0 bg-black/35 backdrop-blur-[2px]"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onClose}
          />
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-4">
            <Motion.div
              role="dialog"
              aria-modal="true"
              className="pointer-events-auto flex max-h-[min(88vh,680px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-3.5">
                <div className="min-w-0">
                  <h2 className="text-[14px] font-semibold">Detalle del análisis</h2>
                  {tagLines?.length ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{tagLines.join(' · ')}</p>
                  ) : null}
                </div>
                <button type="button" className="size-7 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" onClick={onClose}>
                  <X className="size-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Stats grid */}
                {stats && patrones?.encontrado && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: 'Mediana', val: formatPrice(stats.median) },
                      { label: 'Muestra', val: stats.n },
                      { label: 'Rango', val: `${formatPrice(stats.min)} – ${formatPrice(stats.max)}` },
                      { label: 'Tipo', val: stats.conjunto_exacto ? 'Exacto' : 'Parcial' },
                    ].map(({ label, val }) => (
                      <div key={label} className="rounded-lg border bg-muted/30 px-3 py-2">
                        <p className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                        <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{val}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Resumen table */}
                {resumenRows.length > 0 && (
                  <div>
                    <h3 className="text-[12px] font-semibold mb-2">Resumen cuaderno + inventario</h3>
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-[12px]">
                        <tbody>
                          {resumenRows.map((row, i) => (
                            <tr key={i} className="border-b last:border-b-0">
                              <td className="px-3 py-2 text-muted-foreground">{row[0]}</td>
                              <td className="px-3 py-2">{row[1]}</td>
                              <td className="px-3 py-2 text-right font-medium tabular-nums">{row[2]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sub-tabs */}
                <div className="flex gap-px rounded-lg border overflow-hidden" role="tablist">
                  {[['patrones', 'Patrones (inventario)'], ['cuaderno', 'Cuaderno']].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={sub === id}
                      className={cn(
                        'flex-1 py-2 text-center text-[11px] font-medium transition-colors',
                        sub === id ? 'bg-foreground/[0.06] text-foreground' : 'text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setSub(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {sub === 'cuaderno' ? (
                  <div className="rounded-lg border bg-muted/20 px-4 py-3">
                    {!cuaderno?.encontrado ? (
                      <p className="text-[12px] text-muted-foreground">{cuaderno?.mensaje || 'Sin datos.'}</p>
                    ) : (
                      <>
                        <p className="text-[12px]"><strong>{cuaderno.rule_name}</strong>{cuaderno.rule_notes ? ` — ${cuaderno.rule_notes}` : ''}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          {cuaderno.fuente === 'tag_ancla' || cuaderno.fuente === 'tag_regla' ? (
                            <>
                              {cuaderno.sugerido != null && (
                                <span>
                                  Precio fijo <strong className="font-semibold text-foreground">{formatPrice(cuaderno.sugerido)}</strong>
                                </span>
                              )}
                              <span>Fila con {cuaderno.prioridad} etiqueta(s) extra en la tabla</span>
                            </>
                          ) : (
                            <>
                              <span>
                                Rango {formatPrice(cuaderno.price_min)} – {formatPrice(cuaderno.price_max)}
                              </span>
                              {cuaderno.sugerido != null && <span>Sugerido ~{formatPrice(cuaderno.sugerido)}</span>}
                              <span>Prioridad {cuaderno.prioridad}</span>
                            </>
                          )}
                        </div>
                        {cuaderno.condiciones?.length > 0 && (
                          <>
                            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Condiciones</p>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px]">
                              {cuaderno.condiciones.map(([g, o], i) => <li key={`${g}-${o}-${i}`}>{g}: {o}</li>)}
                            </ul>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted/20 px-4 py-3">
                    {!patrones?.encontrado ? (
                      <p className="text-[12px] text-muted-foreground">{patrones?.mensaje || 'Sin datos.'}</p>
                    ) : (
                      <>
                        {stats && (
                          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                            <span><strong className="font-semibold text-foreground">{stats.n}</strong> artículo(s)</span>
                            <span>Promedio {formatPrice(stats.avg)}</span>
                          </div>
                        )}
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Coincidencias</p>
                        <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                          {(patrones.productos || []).map((p) => {
                            const img = p.imagen_path ? localPathToFileUrl(String(p.imagen_path)) : ''
                            return (
                              <li key={p.codigo} className="flex gap-2.5 rounded-lg border bg-background px-2.5 py-2">
                                <div className="size-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                                  {img ? <img src={img} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-[10px] text-muted-foreground">—</span>}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="block font-mono text-[10px] text-muted-foreground">{p.codigo}</span>
                                  <span className="block text-[12px] truncate">{p.nombre || '—'}</span>
                                  {p.tags_coincidentes && <span className="block text-[10px] text-muted-foreground">{p.tags_coincidentes}</span>}
                                </div>
                                <div className="shrink-0 text-right">
                                  <span className="block text-[12px] font-semibold tabular-nums">{formatPrice(p.precio)}</span>
                                  <span className="block text-[10px] text-muted-foreground">{p.estado || '—'}</span>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 justify-end border-t px-5 py-3">
                <Button type="button" size="sm" className="text-[11px]" onClick={onClose}>Cerrar</Button>
              </div>
            </Motion.div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
