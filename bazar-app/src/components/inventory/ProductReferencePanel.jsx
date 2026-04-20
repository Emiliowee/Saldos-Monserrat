import { useCallback, useEffect, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/format'
import { ReferenceDetailModal } from '@/components/inventory/ReferenceDetailModal.jsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const [modalOpen, setModalOpen] = useState(false)

  const nTags = tagsByGroup && typeof tagsByGroup === 'object' ? Object.keys(tagsByGroup).length : 0

  const loadPrefs = useCallback(async () => {
    const raw = await window.bazar?.settings?.get?.()
    setPrefs(mergeSettings(raw))
  }, [])

  useEffect(() => {
    loadPrefs()
  }, [loadPrefs])

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

  const persistPrefs = async (patch) => {
    const api = window.bazar?.settings?.set
    if (!api) {
      toast.error('No se pudo guardar la preferencia.')
      return
    }
    try {
      const next = await api(patch)
      setPrefs(mergeSettings(next))
      onPrefsSaved?.()
    } catch {
      toast.error('No se pudo guardar la preferencia.')
    }
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
        body: 'Elegí Patrones o Cuaderno arriba para ver precio sugerido y autollenado al guardar tags.',
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
      <div className="flex flex-col gap-2 border-b px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold">Referencia de precio</span>
          <span className="mt-1 block text-[10.5px] text-muted-foreground">
            <span className="font-medium text-foreground/90">Modo de autollenado</span>
            <span className="text-muted-foreground"> — precio sugerido al guardar tags</span>
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {[
            { id: 'patrones', label: 'Patrones' },
            { id: 'cuaderno', label: 'Cuaderno' },
            { id: 'off', label: 'Off' },
          ].map((o) => (
            <Button
              key={o.id}
              type="button"
              variant={mode === o.id ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-[11px] font-medium"
              onClick={() => void persistPrefs({ altaAutoFillMode: o.id })}
            >
              {o.label}
            </Button>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Más opciones de autollenado"
              >
                <MoreHorizontal size={18} strokeWidth={1.5} aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[16rem]">
              <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                Opciones adicionales
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={prefs.altaAutofillNombreDesdeTags !== false}
                onCheckedChange={(v) => void persistPrefs({ altaAutofillNombreDesdeTags: Boolean(v) })}
              >
                Autollenar nombre (patrones inventario)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={prefs.altaAutofillPrecioPatrones !== false}
                onCheckedChange={(v) => void persistPrefs({ altaAutofillPrecioPatrones: Boolean(v) })}
              >
                Autollenar precio vía patrones
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={prefs.altaAutofillPrecioCuaderno !== false}
                onCheckedChange={(v) => void persistPrefs({ altaAutofillPrecioCuaderno: Boolean(v) })}
              >
                Autollenar precio vía cuaderno
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={prefs.altaAutofillCodigoMsrNuevo !== false}
                onCheckedChange={(v) => void persistPrefs({ altaAutofillCodigoMsrNuevo: Boolean(v) })}
              >
                Código MSR automático al crear (editable)
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
