import { useCallback, useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { formatPrice } from '@/lib/format'
import { ReferenceDetailModal } from '@/components/inventory/ReferenceDetailModal.jsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const SETTINGS_DEFAULTS = {
  altaAutoFillMode: 'patrones',
  altaAutofillPrecioCuaderno: true,
  altaAutofillPrecioPatrones: true,
  altaAutofillNombreDesdeTags: true,
  altaAutofillCodigoMsrNuevo: true,
}

function mergeSettings(raw) {
  return { ...SETTINGS_DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) }
}

/**
 * Resumen compacto + modal de detalle. Menú ⋯ para autollenado.
 */
export function ProductReferencePanel({ tagsByGroup, codigo, onApplyMedian, onPrefsSaved }) {
  const [loading, setLoading] = useState(false)
  const [snap, setSnap] = useState(null)
  const [resumenRows, setResumenRows] = useState([])
  const [prefs, setPrefs] = useState(() => ({ ...SETTINGS_DEFAULTS }))
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const menuRef = useRef(null)

  const nTags = tagsByGroup && typeof tagsByGroup === 'object' ? Object.keys(tagsByGroup).length : 0

  const loadPrefs = useCallback(async () => {
    const raw = await window.bazar?.settings?.get?.()
    setPrefs(mergeSettings(raw))
  }, [])

  useEffect(() => {
    loadPrefs()
  }, [loadPrefs])

  useEffect(() => {
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const refresh = useCallback(async () => {
    if (!window.bazar?.db?.getReferenceSnapshot) {
      setSnap(null)
      setResumenRows([])
      return
    }
    setLoading(true)
    try {
      const res = await window.bazar.db.getReferenceSnapshot({
        tagsByGroup: tagsByGroup || {},
        codigo: String(codigo || '').trim(),
      })
      setSnap(res)
    } catch {
      setSnap(null)
    } finally {
      setLoading(false)
    }
  }, [tagsByGroup, codigo])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const api = window.bazar?.db?.getReferenceRows
      if (!api || nTags === 0) {
        if (!cancel) setResumenRows([])
        return
      }
      try {
        const rows = await api({
          tagsByGroup: tagsByGroup || {},
          codigo: String(codigo || '').trim(),
          mode: 'off',
        })
        if (!cancel) setResumenRows(Array.isArray(rows) ? rows : [])
      } catch {
        if (!cancel) setResumenRows([])
      }
    })()
    return () => {
      cancel = true
    }
  }, [tagsByGroup, codigo, nTags])

  const persistPrefs = async (patch, { closeMenu = true } = {}) => {
    const api = window.bazar?.settings?.set
    if (!api) return
    try {
      const next = await api(patch)
      setPrefs(mergeSettings(next))
      onPrefsSaved?.()
    } catch {
      /* ignore */
    }
    if (closeMenu) setMenuOpen(false)
  }

  const patrones = snap?.patrones
  const cuaderno = snap?.cuaderno
  const mode = prefs.altaAutoFillMode || 'patrones'

  const tagLines = Array.isArray(snap?.tagLabels)
    ? snap.tagLabels
    : Array.isArray(patrones?.tags_elegidos)
      ? patrones.tags_elegidos
      : []

  const hero = (() => {
    if (nTags === 0) {
      return { variant: 'empty', title: 'Sin tags', body: 'Elegí tags en Principal para ver una referencia de precio.' }
    }
    if (loading) {
      return { variant: 'loading', title: 'Calculando…', body: null }
    }
    if (mode === 'off') {
      return {
        variant: 'muted',
        title: 'Autollenado desactivado',
        body: 'Activá patrones o cuaderno en el menú (⋯) para ver precio sugerido y autollenado al guardar tags.',
      }
    }
    if (mode === 'cuaderno') {
      if (cuaderno?.encontrado) {
        const p =
          cuaderno.sugerido != null && Number.isFinite(Number(cuaderno.sugerido))
            ? Number(cuaderno.sugerido)
            : (Number(cuaderno.price_min) + Number(cuaderno.price_max)) / 2
        return {
          variant: 'price',
          exact: true,
          price: p,
          title: formatPrice(p),
          body:
            cuaderno.fuente === 'tag_regla'
              ? `Regla por tag · ${cuaderno.rule_name || 'ancla'}`
              : `Referencia exacta · tabla clásica (${cuaderno.rule_name || 'regla'})`,
        }
      }
      if (patrones?.encontrado && prefs.altaAutofillPrecioPatrones !== false) {
        const med = patrones.stats?.median
        if (med != null && Number.isFinite(Number(med))) {
          return {
            variant: 'price',
            exact: Boolean(patrones.stats?.conjunto_exacto),
            price: Number(med),
            title: formatPrice(med),
            body: patrones.stats?.conjunto_exacto
              ? 'No hay regla en cuaderno; en inventario hay conjunto exacto de tags.'
              : 'No hay regla en cuaderno; referencia aproximada por inventario (mediana).',
          }
        }
      }
      return {
        variant: 'muted',
        title: 'Sin regla en cuaderno',
        body: cuaderno?.mensaje || 'No hay coincidencia en la tabla de precios para estos tags.',
      }
    }
    if (mode === 'patrones') {
      if (!patrones?.encontrado) {
        return { variant: 'muted', title: 'Sin datos en inventario', body: patrones?.mensaje || 'No hay piezas comparables.' }
      }
      const med = patrones.stats?.median
      if (med == null || !Number.isFinite(Number(med))) {
        return { variant: 'muted', title: 'Sin mediana', body: patrones?.mensaje || 'No se pudo calcular.' }
      }
      return {
        variant: 'price',
        exact: Boolean(patrones.stats?.conjunto_exacto),
        price: Number(med),
        title: formatPrice(med),
        body: patrones.stats?.conjunto_exacto
          ? `Mediana sobre ${patrones.stats?.n ?? '—'} pieza(s) con el mismo conjunto de tags.`
          : `Mediana aproximada · ${patrones.stats?.n ?? '—'} pieza(s) (coincidencia parcial de tags).`,
      }
    }
    return { variant: 'muted', title: '—', body: null }
  })()

  const canApply =
    hero.variant === 'price' && hero.price != null && typeof onApplyMedian === 'function'

  const canOpenModal = nTags > 0 && !loading && hero.variant !== 'empty'

  const heroSurfaceClass = {
    empty: 'border border-dashed border-muted-foreground/25 bg-muted/20',
    loading: 'border border-border bg-muted/30',
    muted: 'border border-border bg-muted/40',
    price: 'border border-primary/25 bg-primary/5',
  }[hero.variant]

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold">Referencia de precio</span>
          <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
            Autollenado:{' '}
            <strong className="font-medium text-foreground">
              {mode === 'patrones' ? 'patrones' : mode === 'cuaderno' ? 'cuaderno' : 'off'}
            </strong>
          </span>
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-expanded={menuOpen}
            aria-label="Configurar autollenado y referencia"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreHorizontal size={18} strokeWidth={1.5} aria-hidden />
          </Button>
          {menuOpen ? (
            <div
              className="absolute right-0 top-full z-50 mt-1 min-w-[min(100vw-2rem,18rem)] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md"
              role="menu"
            >
              <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Fuente del precio al autollenar
              </p>
              {[
                { id: 'patrones', label: 'Patrones (inventario)' },
                { id: 'cuaderno', label: 'Tabla de precios (cuaderno)' },
                { id: 'off', label: 'Desactivado' },
              ].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={mode === o.id}
                  className={cn(
                    'mb-0.5 w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
                    mode === o.id
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'hover:bg-accent/60 hover:text-accent-foreground',
                  )}
                  onClick={() => persistPrefs({ altaAutoFillMode: o.id }, { closeMenu: true })}
                >
                  {o.label}
                </button>
              ))}
              <div className="my-2 h-px bg-border" />
              <label className="flex cursor-pointer items-start gap-2 px-1 py-1.5 text-xs leading-snug hover:bg-accent/50 rounded-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={prefs.altaAutofillNombreDesdeTags !== false}
                  onChange={(e) =>
                    persistPrefs({ altaAutofillNombreDesdeTags: e.target.checked }, { closeMenu: false })
                  }
                />
                Autollenar nombre (patrones inventario)
              </label>
              <label className="flex cursor-pointer items-start gap-2 px-1 py-1.5 text-xs leading-snug hover:bg-accent/50 rounded-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={prefs.altaAutofillPrecioPatrones !== false}
                  onChange={(e) =>
                    persistPrefs({ altaAutofillPrecioPatrones: e.target.checked }, { closeMenu: false })
                  }
                />
                Autollenar precio vía patrones
              </label>
              <label className="flex cursor-pointer items-start gap-2 px-1 py-1.5 text-xs leading-snug hover:bg-accent/50 rounded-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={prefs.altaAutofillPrecioCuaderno !== false}
                  onChange={(e) =>
                    persistPrefs({ altaAutofillPrecioCuaderno: e.target.checked }, { closeMenu: false })
                  }
                />
                Autollenar precio vía cuaderno
              </label>
              <label className="flex cursor-pointer items-start gap-2 px-1 py-1.5 text-xs leading-snug hover:bg-accent/50 rounded-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={prefs.altaAutofillCodigoMsrNuevo !== false}
                  onChange={(e) =>
                    persistPrefs({ altaAutofillCodigoMsrNuevo: e.target.checked }, { closeMenu: false })
                  }
                />
                Código MSR automático al crear (editable)
              </label>
            </div>
          ) : null}
        </div>
      </div>

      {nTags === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">
          Elegí tags en Principal (botón «Tags…») para ver precio de referencia y autollenado.
        </p>
      ) : (
        <div className={cn('mx-3 mb-3 mt-3 rounded-md px-3 py-3', heroSurfaceClass)}>
          {hero.variant === 'price' ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-semibold tabular-nums tracking-tight">{hero.title}</span>
                {hero.exact ? (
                  <Badge variant="default">Exacto</Badge>
                ) : (
                  <Badge variant="secondary">Aproximado</Badge>
                )}
              </div>
              {hero.body ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{hero.body}</p> : null}
              {canApply ? (
                <Button type="button" className="mt-3 w-full sm:w-auto" onClick={() => onApplyMedian(hero.price)}>
                  Usar este precio en el formulario
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm font-medium">{hero.title}</p>
              {hero.body ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hero.body}</p> : null}
            </>
          )}

          {canOpenModal ? (
            <Button type="button" variant="link" className="mt-3 h-auto p-0 text-sm" onClick={() => setModalOpen(true)}>
              Abrir detalles del análisis…
            </Button>
          ) : null}
        </div>
      )}

      <ReferenceDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        resumenRows={resumenRows}
        patrones={patrones}
        cuaderno={cuaderno}
        tagLines={tagLines}
      />
    </div>
  )
}
