import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Package,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Percent,
  Tag as TagIcon,
  Printer,
  LayoutGrid,
  LayoutList,
  Download,
  FilterX,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { InventoryProductPage } from '@/components/inventory/InventoryProductPage'
import { PriceAdjustDialog } from '@/components/inventory/PriceAdjustDialog'
import { formatPrice } from '@/lib/format'
import { appConfirm } from '@/lib/appConfirm'
import { releaseModalBodyLocks } from '@/lib/releaseModalBodyLocks'
import { ipcErrorMessage } from '@/lib/ipcErrorMessage'
import {
  PageHeader,
  PageHeaderDivider,
  ChipFilter,
  ViewSwitcher,
  EmptyState,
  SelectionToolbar,
  SelectionToolbarButton,
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableCell,
  DataTableShell,
  RowActionStrip,
  RowActionButton,
  Checkbox,
  SearchField,
} from '@/components/premium'

const ESTADO_OPTIONS = [
  { value: '0', label: 'Todos' },
  { value: '1', label: 'Disponible' },
  { value: '2', label: 'En banqueta' },
  { value: '3', label: 'Vendido' },
  { value: '4', label: 'Reservado' },
]

const VISTA_OPTIONS = [
  { value: '0', label: 'General' },
  { value: '1', label: 'Banqueta' },
]

const ANTIGUEDAD_OPTIONS = [
  { value: 'main', label: 'Todos' },
  { value: 'stale', label: 'Más de 6 meses' },
]

function estadoLabel(raw) {
  const e = String(raw || '').trim().toLowerCase()
  const map = { disponible: 'Disponible', reservado: 'Reservado', vendido: 'Vendido', en_banqueta: 'En banqueta' }
  return map[e] || e.split('_').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || '—'
}

/** Pill de estado estilo Notion select: fondo 6% + texto con matiz del estado. */
function EstadoBadge({ raw }) {
  const e = String(raw || '').toLowerCase()
  const cls =
    e === 'disponible'
      ? 'bg-success/[0.08] text-success dark:text-success-foreground'
      : e === 'vendido'
        ? 'bg-muted/60 text-muted-foreground'
        : e === 'en_banqueta'
          ? 'bg-primary/10 text-primary'
          : e === 'reservado'
            ? 'bg-warning/15 text-warning-foreground dark:text-warning'
            : 'bg-muted/50 text-muted-foreground'
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {estadoLabel(raw)}
    </span>
  )
}

function emptyDraft() {
  return {
    id: null,
    codigo: '',
    descripcion: '',
    precio: '',
    estado: 'disponible',
    imagen_path: '',
    tagsByGroup: {},
    ruleId: null,
    ruleFieldValues: {},
    pieza_unica: true,
    stock: 1,
    venta_items_count: 0,
    baja_estado_manual_en: null,
  }
}

function invVentaItemsCount(row) {
  const n = Number(row?.venta_items_count)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

const MSG_DELETE_BLOCKED_POS =
  'Este artículo tiene al menos una línea en ventas del POS: el comprobante sigue vinculado a este registro. Por eso no se puede borrar, aunque lo marques «Disponible» otra vez. (Si solo habías puesto «Vendido» a mano en la ficha y nunca pasó por el POS, no hay esas líneas y el borrado puede estar permitido.)'

function parsePrecio(text) {
  const t = String(text ?? '').trim().replace(',', '.')
  if (!t) return null
  const v = Number(t)
  return Number.isFinite(v) && v >= 0 ? v : null
}

function formatFechaIngreso(v) {
  if (v == null || v === '') return '—'
  const s = String(v)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function optionIdPositive(v) {
  if (v == null || v === '') return false
  if (typeof v === 'bigint') return v > 0n
  const n = Number(v)
  return Number.isFinite(n) && n > 0
}

function draftHasAnyTag(map) {
  if (!map || typeof map !== 'object') return false
  return Object.values(map).some((v) => optionIdPositive(v))
}

function normPiezaUnica(v) { return v == null ? true : typeof v === 'boolean' ? v : Number(v) === 1 }
/** Stock real en BD (incluye 0); solo cae a 1 si el valor es inválido. */
function normStock(row) {
  const n = Number(row?.stock)
  if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  return 1
}

function invRowId(row) {
  const n = Number(row?.id)
  return Number.isFinite(n) ? n : null
}

/** Tags de lista inventario como pills compactas (CSV desde API). */
function InvTagPills({ tagsCsv, max = 999 }) {
  const parts = String(tagsCsv ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) {
    return <span className="text-muted-foreground/70">—</span>
  }
  const cap = Number.isFinite(Number(max)) && Number(max) > 0 ? Math.floor(Number(max)) : 999
  const visible = parts.slice(0, cap)
  const hidden = parts.length - visible.length
  return (
    <span className="flex max-w-full flex-wrap items-center gap-1">
      {visible.map((t, i) => (
        <span
          key={`${i}-${t}`}
          className="inline-flex max-w-[9rem] shrink-0 truncate rounded-md border border-border/55 bg-muted/35 px-1.5 py-0.5 text-[10.5px] font-medium text-foreground/85 dark:bg-zinc-800/55"
          title={t}
        >
          {t}
        </span>
      ))}
      {hidden > 0 ? (
        <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground/80" title={parts.join(', ')}>
          +{hidden}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Arma payload de alta/edición: validación + autocompletado nombre/precio + reglas.
 * @returns {Promise<{ ok: true, payload: object, esNuevo: boolean, editId: number } | { ok: false, error: string }>}
 */
async function buildInventorySavePayload(api, d) {
  if (!draftHasAnyTag(d.tagsByGroup)) return { ok: false, error: 'Elegí al menos un tag.' }
  const codigo = String(d.codigo ?? '').trim()
  if (!codigo) return { ok: false, error: 'El código es obligatorio' }
  let descripcion = String(d.descripcion ?? '').trim()
  if (!descripcion && api.suggestNombreFromTags) {
    try {
      const raw = await window.bazar?.settings?.get?.()
      const st = raw && typeof raw === 'object' ? raw : {}
      if (st.altaAutofillNombreDesdeTags !== false) {
        const sn = await api.suggestNombreFromTags({ tagsByGroup: d.tagsByGroup, excludeCodigo: codigo || undefined })
        if (sn && String(sn).trim()) descripcion = String(sn).trim()
      }
      if (!descripcion && api.getNombreEtiquetaDesdeTags) {
        const et = await api.getNombreEtiquetaDesdeTags({ tagsByGroup: d.tagsByGroup })
        if (et && String(et).trim()) descripcion = String(et).trim()
      }
    } catch { /* ignore */ }
  }
  if (!descripcion) return { ok: false, error: 'El nombre / descripción es obligatorio' }

  let precio = parsePrecio(d.precio)
  if (precio === null && api.suggestPrecioFromTags) {
    try {
      const raw = await window.bazar?.settings?.get?.()
      const st = raw && typeof raw === 'object' ? raw : {}
      const mode = st.altaAutoFillMode || 'patrones'
      if (mode !== 'off') {
        const skipC = st.altaAutofillPrecioCuaderno === false
        const skipP = st.altaAutofillPrecioPatrones === false
        let precioVal = null
        if (mode === 'cuaderno' && !skipC) {
          precioVal = await api.suggestPrecioFromTags({
            tagsByGroup: d.tagsByGroup,
            mode: 'cuaderno',
            excludeCodigo: codigo || undefined,
          })
        } else if (mode === 'patrones' && !skipP) {
          precioVal = await api.suggestPrecioFromTags({
            tagsByGroup: d.tagsByGroup,
            mode: 'patrones',
            excludeCodigo: codigo || undefined,
          })
        }
        if (precioVal != null && Number.isFinite(Number(precioVal))) precio = Number(precioVal)
      }
    } catch { /* ignore */ }
  }
  if (precio === null) return { ok: false, error: 'Indica un precio válido (número ≥ 0)' }

  if (d.ruleId && typeof api.getInvPricingRule === 'function') {
    try {
      const rule = await api.getInvPricingRule({ id: Number(d.ruleId) })
      const cfs = Array.isArray(rule?.customFields) ? rule.customFields : []
      const vals =
        d.ruleFieldValues && typeof d.ruleFieldValues === 'object' && !Array.isArray(d.ruleFieldValues)
          ? d.ruleFieldValues
          : {}
      for (const f of cfs) {
        if (!f.required) continue
        const v = vals[f.id]
        let ok = true
        if (f.type === 'checkbox') ok = typeof v === 'boolean'
        else if (f.type === 'number') {
          const s = String(v ?? '').trim().replace(',', '.')
          ok = s !== '' && Number.isFinite(Number(s))
        } else if (f.type === 'select') {
          const opts = Array.isArray(f.options) ? f.options : []
          ok = typeof v === 'string' && opts.includes(v)
        } else if (f.type === 'image') ok = typeof v === 'string' && v.trim().length > 0
        else ok = typeof v === 'string' && v.trim().length > 0
        if (!ok) {
          return {
            ok: false,
            error: `Completá el campo obligatorio de la regla: «${String(f.name || '').trim() || 'Campo'}».`,
          }
        }
      }
    } catch {
      /* si falla la regla, no bloqueamos el guardado */
    }
  }

  const esNuevo = d.id == null
  const editId = Number(d.id)
  const tagsByGroup = d.tagsByGroup && typeof d.tagsByGroup === 'object' ? { ...d.tagsByGroup } : {}
  const pieza_unica = d.pieza_unica !== false
  let stock = Math.max(1, Math.floor(Number(String(d.stock ?? '').replace(',', '.')) || 1))
  if (pieza_unica) stock = 1
  const ruleIdVal =
    d.ruleId != null && String(d.ruleId).trim() !== '' && Number.isFinite(Number(d.ruleId)) && Number(d.ruleId) > 0
      ? Math.floor(Number(d.ruleId))
      : null
  const ruleFieldValues =
    d.ruleFieldValues && typeof d.ruleFieldValues === 'object' && !Array.isArray(d.ruleFieldValues)
      ? { ...d.ruleFieldValues }
      : {}
  const payload = {
    codigo,
    descripcion,
    precio,
    estado: esNuevo ? 'disponible' : String(d.estado ?? 'disponible'),
    imagen_path: String(d.imagen_path ?? '').trim(),
    tagsByGroup,
    ruleId: ruleIdVal,
    ruleFieldValues,
    pieza_unica,
    stock,
  }
  return { ok: true, payload, esNuevo, editId }
}

async function persistInventoryProduct(api, built, { closePage, refresh }) {
  const { payload, esNuevo, editId } = built
  if (esNuevo) {
    await api.addProduct(payload)
    toast.success('Artículo creado')
    try {
      const st = await window.bazar?.settings?.get?.()
      if (st?.printLabelAfterSave && window.bazar?.printers?.printLabel) {
        void window.bazar.printers
          .printLabel({ codigo: payload.codigo, nombre: payload.descripcion, precio: payload.precio })
          .then((res) => {
            if (res?.ok) toast.message(res.message || 'Etiqueta PDF en Descargas')
            else if (res?.message) toast.error(res.message)
          })
          .catch(() => {
            toast.error('No se pudo generar la etiqueta PDF')
          })
      }
    } catch {
      /* no bloquea */
    }
  } else {
    if (!Number.isFinite(editId) || editId <= 0) {
      toast.error('Identificador de artículo no válido.')
      return
    }
    await api.updateProduct({ ...payload, id: editId })
    toast.success('Guardado')
  }
  closePage()
  await refresh()
}

export function InventoryView() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const qRef = useRef('')
  const inventorySearchRef = useRef(null)
  const listReqRef = useRef(0)
  /** Evita doble `openEdit` (StrictMode + sessionStorage + evento en la misma navegación). */
  const openingInventoryProductRef = useRef(null)
  /** Evita doble `openNew` al abrir alta desde Home / paleta. */
  const newProductBootstrapRef = useRef(false)
  const viewAliveRef = useRef(true)
  const [estadoIndex, setEstadoIndex] = useState(0)
  const [vistaIndex, setVistaIndex] = useState(0)
  const [listTab, setListTab] = useState('main')
  const [viewMode, setViewMode] = useState('table')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [focusedId, setFocusedId] = useState(null)
  const [productPage, setProductPage] = useState(null)
  const [draft, setDraft] = useState(emptyDraft)
  const draftRef = useRef(draft)
  const [priceDialogOpen, setPriceDialogOpen] = useState(false)
  draftRef.current = draft
  qRef.current = q

  useLayoutEffect(() => {
    let raw
    try { raw = sessionStorage.getItem('bazar.inventoryLanding') } catch { return }
    if (!raw) return
    try { sessionStorage.removeItem('bazar.inventoryLanding') } catch { /* noop */ }
    let parsed
    try { parsed = JSON.parse(raw) } catch { return }
    if (!parsed || typeof parsed !== 'object') return
    if (typeof parsed.estadoIndex === 'number' && parsed.estadoIndex >= 0 && parsed.estadoIndex <= 4) setEstadoIndex(parsed.estadoIndex)
    if (typeof parsed.vistaIndex === 'number' && parsed.vistaIndex >= 0 && parsed.vistaIndex <= 1) setVistaIndex(parsed.vistaIndex)
    if (parsed.listTab === 'stale' || parsed.listTab === 'main') setListTab(parsed.listTab)
  }, [])

  // Vista «Banqueta» ya filtra por `en_banqueta`; un chip de estado incompatible (p. ej. Vendido) vacía la lista sin que quede claro por qué.
  useEffect(() => {
    if (vistaIndex !== 1) return
    if (estadoIndex !== 0 && estadoIndex !== 2) setEstadoIndex(0)
  }, [vistaIndex, estadoIndex])

  const refresh = useCallback(async (searchOverride) => {
    const api = window.bazar?.db
    if (!api?.getInventoryList) { setRows([]); return }
    const search =
      searchOverride !== undefined && searchOverride !== null
        ? String(searchOverride).trim()
        : String(qRef.current).trim()
    const reqId = ++listReqRef.current
    try {
      const data = await api.getInventoryList({ search, estadoIndex, vistaIndex, listTab })
      if (reqId !== listReqRef.current) return
      if (!viewAliveRef.current) return
      const nextRows = Array.isArray(data) ? data : []
      const visibleIds = new Set(
        nextRows.map((r) => invRowId(r)).filter((id) => id != null),
      )
      // Transición baja la prioridad frente a la escritura en la búsqueda (p. ej. tras borrar y listas grandes).
      startTransition(() => {
        setRows(nextRows)
        // Tras cambiar búsqueda/filtros, la selección debe quedar solo sobre filas visibles;
        // si no, «Eliminar» actúa sobre ids que ya no coinciden con lo que el usuario ve.
        setSelectedIds((prev) => {
          if (prev.size === 0) return prev
          const next = new Set()
          for (const x of prev) {
            const n = Number(x)
            if (Number.isFinite(n) && n > 0 && visibleIds.has(n)) next.add(n)
          }
          return next.size === prev.size ? prev : next
        })
        setFocusedId((cur) => {
          if (cur == null) return cur
          const n = Number(cur)
          return Number.isFinite(n) && n > 0 && visibleIds.has(n) ? n : null
        })
      })
    } catch (e) {
      if (reqId !== listReqRef.current) return
      if (!viewAliveRef.current) return
      toast.error(ipcErrorMessage(e))
    }
  }, [estadoIndex, vistaIndex, listTab])

  useEffect(() => {
    viewAliveRef.current = true
    return () => {
      viewAliveRef.current = false
    }
  }, [])

  // Filtros: limpiar selección (evita ids invisibles) y refresco inmediato. Texto: debounce aparte.
  useEffect(() => {
    setSelectedIds(new Set())
    void refresh()
  }, [estadoIndex, vistaIndex, listTab, refresh])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh(q)
    }, 200)
    return () => window.clearTimeout(t)
  }, [q, refresh])

  const openEdit = useCallback(async (row) => {
    if (!row) return
    const id = invRowId(row)
    if (id == null) {
      toast.error('Identificador de artículo no válido.')
      return
    }
    const api = window.bazar?.db
    if (!api?.getProductById) {
      toast.error('Base de datos no disponible.')
      return
    }
    try {
      const full = await api.getProductById(id)
      if (!full) {
        toast.error('No se encontró el artículo (puede haber sido eliminado).')
        void refresh()
        return
      }
      const draftId = invRowId(full)
      const focusId = draftId ?? id
      if (focusId == null || !Number.isFinite(Number(focusId)) || Number(focusId) <= 0) {
        toast.error('El artículo devolvió un id no válido.')
        return
      }
      setDraft({
        id: focusId,
        codigo: full.codigo ?? '',
        descripcion: full.descripcion ?? '',
        precio: full.precio != null ? String(full.precio) : '',
        estado: String(full.estado || 'disponible').toLowerCase(),
        imagen_path: full.imagen_path ?? '',
        tagsByGroup: full.tagsByGroup && typeof full.tagsByGroup === 'object' ? full.tagsByGroup : {},
        ruleId: full.ruleId ?? null,
        ruleFieldValues:
          full.ruleFieldValues && typeof full.ruleFieldValues === 'object' && !Array.isArray(full.ruleFieldValues)
            ? { ...full.ruleFieldValues }
            : {},
        pieza_unica: normPiezaUnica(full.pieza_unica),
        stock: normStock(full),
        venta_items_count: invVentaItemsCount(full),
        baja_estado_manual_en: full.baja_estado_manual_en != null && String(full.baja_estado_manual_en).trim() !== '' ? String(full.baja_estado_manual_en) : null,
      })
      setFocusedId(focusId)
      setProductPage({ mode: 'edit', id: focusId })
    } catch (e) {
      toast.error(ipcErrorMessage(e))
    }
  }, [refresh])

  const openNew = useCallback(async () => {
    const base = emptyDraft()
    const api = window.bazar?.db
    if (api?.nextCodigoMsr) { try { base.codigo = await api.nextCodigoMsr() } catch { /* ok */ } }
    setDraft(base)
    setFocusedId(null)
    setProductPage({ mode: 'new' })
  }, [])

  const loadProductFromLookup = (next) => {
    setDraft(next)
    const nid = invRowId(next)
    if (nid != null) setFocusedId(nid)
  }

  useEffect(() => {
    const runOpen = (rawId) => {
      const id = Number(rawId)
      if (!Number.isFinite(id) || id <= 0) return
      if (openingInventoryProductRef.current === id) return
      openingInventoryProductRef.current = id
      void (async () => {
        try {
          await openEdit({ id })
        } finally {
          openingInventoryProductRef.current = null
        }
      })()
    }
    const onScan = (e) => {
      if (e?.detail == null) return
      runOpen(e.detail)
    }
    window.addEventListener('bazar:inventory-open-product', onScan)
    return () => window.removeEventListener('bazar:inventory-open-product', onScan)
  }, [openEdit])

  useEffect(() => {
    let cancelled = false
    if (newProductBootstrapRef.current) return
    let raw
    try {
      raw = sessionStorage.getItem('bazar.inventoryNewProduct')
    } catch {
      return
    }
    if (!raw) return
    newProductBootstrapRef.current = true
    void (async () => {
      try {
        if (!cancelled) await openNew()
      } finally {
        newProductBootstrapRef.current = false
        if (!cancelled) {
          try {
            sessionStorage.removeItem('bazar.inventoryNewProduct')
          } catch {
            /* noop */
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [openNew])

  const closePage = useCallback(() => {
    setProductPage(null)
    releaseModalBodyLocks()
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (priceDialogOpen) { setPriceDialogOpen(false); return }
      if (productPage) closePage()
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [productPage, priceDialogOpen, closePage])

  const priceDialogWasOpen = useRef(false)
  useEffect(() => {
    if (priceDialogOpen) { priceDialogWasOpen.current = true; return }
    if (!priceDialogWasOpen.current) return
    priceDialogWasOpen.current = false
    const id = window.setTimeout(() => {
      releaseModalBodyLocks()
      inventorySearchRef.current?.focus?.({ preventScroll: true })
    }, 50)
    return () => clearTimeout(id)
  }, [priceDialogOpen])

  const save = useCallback(async () => {
    const d = draftRef.current
    const api = window.bazar?.db
    if (!api?.addProduct || !api?.updateProduct) {
      toast.error('Base de datos no disponible.')
      return
    }
    const built = await buildInventorySavePayload(api, d)
    if (built.ok === false) {
      toast.error(built.error)
      return
    }
    try {
      await persistInventoryProduct(api, built, { closePage, refresh })
    } catch (e) {
      const raw = ipcErrorMessage(e)
      toast.error(raw && raw !== '[object Object]' ? raw : 'No se pudo guardar.')
    }
  }, [closePage, refresh])

  const deleteOne = useCallback(async (id, codigo, metaRow) => {
    const api = window.bazar?.db
    const pid = Number(id)
    if (!api?.deleteProduct || id == null || !Number.isFinite(pid) || pid <= 0) return
    if (metaRow != null && invVentaItemsCount(metaRow) > 0) {
      toast.error(MSG_DELETE_BLOCKED_POS)
      return
    }
    if (!(await appConfirm(`¿Eliminar «${codigo || id}»?`, { destructive: true, confirmLabel: 'Eliminar' }))) return
    try {
      await api.deleteProduct(pid)
      toast.success('Eliminado')
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(pid); n.delete(id); return n })
      if (focusedId === pid || focusedId === id) setFocusedId(null)
      if (draftRef.current?.id === pid || draftRef.current?.id === id) closePage()
      await new Promise((r) => requestAnimationFrame(r))
      await refresh()
      requestAnimationFrame(() => {
        inventorySearchRef.current?.focus?.({ preventScroll: true })
      })
    } catch (e) {
      toast.error(ipcErrorMessage(e))
    }
  }, [closePage, refresh, focusedId])

  const deleteMany = useCallback(async () => {
    const ids = Array.from(
      new Set(Array.from(selectedIds, (x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)),
    )
    if (ids.length === 0) return
    if (!(await appConfirm(`¿Eliminar ${ids.length} artículo(s)?`, { destructive: true, confirmLabel: 'Eliminar' }))) return
    const api = window.bazar?.db
    if (!api?.deleteProduct) { toast.error('Base de datos no disponible.'); return }
    const byId = new Map()
    for (const r of rows) {
      const rid = invRowId(r)
      if (rid != null) byId.set(rid, r)
    }
    let ok = 0
    const failLines = []
    const removedFromSelection = new Set()
    for (const pid of ids) {
      const row = byId.get(pid)
      if (row != null && invVentaItemsCount(row) > 0) {
        failLines.push(`«${row.codigo || pid}»: historial POS (no se borra)`)
        continue
      }
      try {
        await api.deleteProduct(pid)
        ok += 1
        removedFromSelection.add(pid)
        // Ceder el hilo para que el input de búsqueda siga respondiendo entre borrados IPC.
        await new Promise((r) => requestAnimationFrame(r))
      } catch (e) {
        failLines.push(`«${row?.codigo || pid}»: ${ipcErrorMessage(e)}`)
      }
    }
    if (removedFromSelection.size > 0) {
      setSelectedIds((prev) => {
        const n = new Set(prev)
        for (const id of removedFromSelection) n.delete(id)
        return n
      })
    }
    if (ok > 0) toast.success(ok === ids.length ? `Eliminados ${ok} artículo(s)` : `Eliminados ${ok} de ${ids.length}`)
    if (failLines.length) {
      const head = failLines.slice(0, 4).join('\n')
      const more = failLines.length > 4 ? `\n…y ${failLines.length - 4} más` : ''
      toast.error(head + more, { duration: 12_000 })
    }
    await refresh()
    requestAnimationFrame(() => {
      inventorySearchRef.current?.focus?.({ preventScroll: true })
    })
  }, [selectedIds, refresh, rows])

  const deleteFromPage = useCallback(async () => {
    const d = draftRef.current
    const id = d?.id
    if (id == null) return
    const api = window.bazar?.db
    if (api?.getProductById) {
      try {
        const full = await api.getProductById(id)
        if (!full) {
          toast.error('No se encontró el artículo.')
          void refresh()
          return
        }
        const metaRow = { ...d, venta_items_count: invVentaItemsCount(full) }
        await deleteOne(id, String(d.codigo || '').trim() || undefined, metaRow)
      } catch (e) {
        toast.error(ipcErrorMessage(e))
      }
      return
    }
    await deleteOne(id, String(d.codigo || '').trim() || undefined, d)
  }, [deleteOne, refresh])

  const printLabels = useCallback(async (ids) => {
    const api = window.bazar?.printers?.printLabel
    if (!api) { toast.error('Impresión no disponible'); return }
    const list = ids && ids.length ? ids : [...selectedIds]
    if (list.length === 0) { toast.message('Seleccioná al menos un artículo'); return }
    const byId = new Map()
    for (const r of rows) {
      const id = invRowId(r)
      if (id != null) byId.set(id, r)
    }
    let ok = 0
    for (const raw of list) {
      const id = Number(raw)
      const r = Number.isFinite(id) ? byId.get(id) : undefined
      if (!r) continue
      try {
        const res = await api({ codigo: r.codigo, nombre: r.descripcion || r.codigo, precio: Number(r.precio) || 0 })
        if (res?.ok) ok += 1
      } catch { /* continuamos con las demás */ }
    }
    toast.success(`${ok}/${list.length} etiquetas generadas`)
  }, [rows, selectedIds])

  const clearFilters = () => {
    setEstadoIndex(0)
    setVistaIndex(0)
    setListTab('main')
    setQ('')
    inventorySearchRef.current?.focus?.({ preventScroll: true })
  }

  const hasActiveFilters = estadoIndex !== 0 || vistaIndex !== 0 || listTab !== 'main' || q.trim() !== ''
  const allRowIds = useMemo(
    () => rows.map((r) => invRowId(r)).filter((id) => id != null),
    [rows],
  )
  const allSelected = allRowIds.length > 0 && allRowIds.every((id) => selectedIds.has(id))
  const someSelected = allRowIds.some((id) => selectedIds.has(id))
  const headerChecked = allSelected ? true : someSelected ? 'indeterminate' : false

  /** El `Checkbox` premium llama `onChange(!isOn)`; en indeterminado `isOn` es true → llega `false` y no debe vaciar la tabla: debe completar la selección. */
  const toggleHeaderSelect = useCallback(() => {
    if (allRowIds.length === 0) return
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(allRowIds))
  }, [allRowIds, allSelected])

  const toggleOne = (id) => {
    const n = Number(id)
    if (!Number.isFinite(n)) return
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev, (x) => Number(x)).filter((x) => Number.isFinite(x)))
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  /** Toda la selección visible tiene historial POS: el borrado masivo no va a lograr nada útil. */
  const bulkDeleteAllBlocked = useMemo(() => {
    if (selectedIds.size === 0) return false
    const byId = new Map()
    for (const r of rows) {
      const rid = invRowId(r)
      if (rid != null) byId.set(rid, r)
    }
    for (const raw of selectedIds) {
      const id = Number(raw)
      if (!Number.isFinite(id) || id <= 0) return false
      const r = byId.get(id)
      if (!r) return false
      if (invVentaItemsCount(r) === 0) return false
    }
    return true
  }, [rows, selectedIds])

  // Si hay página abierta (nuevo / edit) tomamos todo el canvas del módulo.
  if (productPage) {
    return (
      <InventoryProductPage
        draft={draft}
        setDraft={setDraft}
        mode={productPage.mode}
        onSave={save}
        onBack={closePage}
        onDelete={productPage.mode === 'edit' ? deleteFromPage : undefined}
        onClearForm={openNew}
        onProductLoadedFromLookup={loadProductFromLookup}
      />
    )
  }

  const hasInvSelection = selectedIds.size > 0

  return (
    <div data-app-workspace className="relative flex h-full flex-col bg-background">
      <PageHeader
        icon={<Package className="size-5" strokeWidth={1.5} />}
        title="Inventario"
        description="Todos los artículos de la tienda. Filtra, edita y ajusta precios en masa."
        count={rows.length}
        actions={
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90 dark:bg-foreground dark:text-background dark:hover:bg-foreground/88"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Nuevo artículo
          </button>
        }
        menuItems={[
          { id: 'price', label: 'Ajustar precios en masa…', icon: <Percent className="size-3.5" />, onClick: () => setPriceDialogOpen(true) },
          { id: 'print', label: 'Imprimir etiquetas seleccionadas', icon: <Printer className="size-3.5" />, onClick: () => printLabels() },
          { id: 'refresh', label: 'Refrescar', icon: <RefreshCw className="size-3.5" />, onClick: () => void refresh(), separatorBefore: true },
          { id: 'clear', label: 'Vaciar filtros', icon: <FilterX className="size-3.5" />, onClick: clearFilters },
          { id: 'export', label: 'Exportar CSV', icon: <Download className="size-3.5" />, onClick: () => toast.message('Exportación pronto disponible') },
        ]}
      />
      <PageHeaderDivider />

      {/* Toolbar de filtros / vista */}
      <div className="relative flex shrink-0 items-center justify-between gap-4 border-b border-border/50 px-10 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <ViewSwitcher
            views={[
              { id: 'table', label: 'Tabla', icon: <LayoutList className="size-3.5" strokeWidth={1.75} /> },
              { id: 'cards', label: 'Tarjetas', icon: <LayoutGrid className="size-3.5" strokeWidth={1.75} /> },
            ]}
            current={viewMode}
            onChange={setViewMode}
          />
          <span className="h-4 w-px bg-border/60" aria-hidden />
          <div className="flex min-w-0 items-center gap-1.5">
            <ChipFilter
              label="Estado"
              options={ESTADO_OPTIONS.filter((o) => o.value !== '0')}
              value={estadoIndex ? String(estadoIndex) : null}
              onChange={(v) => setEstadoIndex(v == null ? 0 : Number(v))}
              placeholder="Todos"
            />
            <ChipFilter
              label="Vista"
              options={VISTA_OPTIONS.filter((o) => o.value !== '0')}
              value={vistaIndex ? String(vistaIndex) : null}
              onChange={(v) => setVistaIndex(v == null ? 0 : Number(v))}
              placeholder="General"
            />
            <ChipFilter
              label="Antigüedad"
              options={ANTIGUEDAD_OPTIONS.filter((o) => o.value !== 'main')}
              value={listTab !== 'main' ? listTab : null}
              onChange={(v) => setListTab(v == null ? 'main' : String(v))}
              placeholder="Todas"
            />
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-0.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground/80 transition-colors hover:bg-muted/70 hover:text-foreground/85 dark:hover:bg-muted/55"
              >
                <FilterX className="size-3" strokeWidth={1.75} />
                Vaciar
              </button>
            ) : null}
          </div>
        </div>
        <SearchField
          ref={inventorySearchRef}
          value={q}
          onChange={setQ}
          data-inventory-search
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void refresh(q)
            }
          }}
          placeholder="Código, nombre o tag…"
          width="w-72"
        />
      </div>

      {/* Tabla / tarjetas */}
      <DataTableShell className="px-10 pb-6 pt-2">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Package className="size-6" strokeWidth={1.5} />}
            title={hasActiveFilters ? 'Sin resultados' : 'Todavía no hay artículos'}
            description={
              hasActiveFilters
                ? 'Probá quitando algunos filtros o ampliar la búsqueda.'
                : 'Creá tu primer artículo para empezar a registrar el inventario del bazar.'
            }
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-3 text-[12.5px] font-medium text-foreground/85 transition-colors hover:bg-muted/70 dark:hover:bg-muted/55"
                >
                  <FilterX className="size-3.5" strokeWidth={1.75} />
                  Vaciar filtros
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openNew}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90 dark:bg-foreground dark:text-background dark:hover:bg-foreground/88"
                >
                  <Plus className="size-3.5" strokeWidth={2} />
                  Crear primer artículo
                </button>
              )
            }
          />
        ) : viewMode === 'cards' ? (
          <CardsView
            rows={rows}
            focusedId={focusedId}
            onFocus={(rid) => {
              if (rid != null && Number.isFinite(Number(rid))) setFocusedId(Number(rid))
            }}
            onEdit={openEdit}
            selectedIds={selectedIds}
            onToggle={toggleOne}
            hasSelection={hasInvSelection}
          />
        ) : (
          <div
            className="inv-table-select flex min-h-0 flex-1 flex-col"
            data-has-selection={hasInvSelection ? '' : undefined}
          >
            <DataTable>
            <DataTableHeader>
              <DataTableHead width="32px" className="px-3 inv-select-cell">
                <div data-inv-check-wrap className="inline-flex">
                  <Checkbox checked={headerChecked} onChange={toggleHeaderSelect} aria="Seleccionar todo" />
                </div>
              </DataTableHead>
              <DataTableHead width="128px">Código</DataTableHead>
              <DataTableHead>Nombre</DataTableHead>
              <DataTableHead width="140px">Tags</DataTableHead>
              <DataTableHead width="96px" align="right">Precio</DataTableHead>
              <DataTableHead width="48px" align="center">Ud.</DataTableHead>
              <DataTableHead width="120px">Estado</DataTableHead>
              <DataTableHead width="96px">Fecha</DataTableHead>
            </DataTableHeader>
            <DataTableBody>
              {rows.map((r) => {
                const rid = invRowId(r)
                const rowSelected = rid != null && selectedIds.has(rid)
                const rowActive = rid != null && focusedId === rid
                return (
                <DataTableRow
                  key={rid ?? r.id}
                  selected={rowSelected}
                  active={rowActive}
                  onClick={() => rid != null && setFocusedId(rid)}
                  onDoubleClick={(e) => { e.preventDefault(); void openEdit(r) }}
                >
                  <DataTableCell className="px-3 inv-select-cell">
                    <div data-inv-check-wrap className="inline-flex">
                      <Checkbox
                        checked={rowSelected}
                        onChange={() => rid != null && toggleOne(rid)}
                        aria={`Seleccionar ${r.codigo}`}
                      />
                    </div>
                  </DataTableCell>
                  <DataTableCell mono muted>{r.codigo || '—'}</DataTableCell>
                  <DataTableCell>
                    <span className="block max-w-full truncate text-foreground/95">{r.descripcion || '—'}</span>
                  </DataTableCell>
                  <DataTableCell className="text-[11.5px] text-muted-foreground/85">
                    <InvTagPills tagsCsv={r.tags} max={6} />
                  </DataTableCell>
                  <DataTableCell align="right" className="col-precio font-medium text-foreground/90">
                    {formatPrice(r.precio)}
                  </DataTableCell>
                  <DataTableCell align="center" className="text-[11.5px] text-muted-foreground/85">
                    {normPiezaUnica(r.pieza_unica) ? '1' : normStock(r)}
                  </DataTableCell>
                  <DataTableCell><EstadoBadge raw={r.estado} /></DataTableCell>
                  <DataTableCell className="relative pr-3 text-[11.5px] tabular-nums text-muted-foreground/85">
                    {formatFechaIngreso(r.fecha_ingreso ?? r.created_at)}
                    <RowActionStrip>
                      <RowActionButton
                        icon={<Eye className="size-3.5" strokeWidth={1.75} />}
                        label="Abrir"
                        onClick={() => void openEdit(r)}
                      />
                      <RowActionButton
                        icon={<Pencil className="size-3.5" strokeWidth={1.75} />}
                        label="Editar"
                        onClick={() => void openEdit(r)}
                      />
                      <RowActionButton
                        icon={<Printer className="size-3.5" strokeWidth={1.75} />}
                        label="Imprimir etiqueta"
                        onClick={() => rid != null && void printLabels([rid])}
                      />
                      <RowActionButton
                        icon={<Trash2 className="size-3.5" strokeWidth={1.75} />}
                        label="Eliminar"
                        destructive
                        disabled={invVentaItemsCount(r) > 0}
                        title={
                          invVentaItemsCount(r) > 0
                            ? 'No se puede eliminar: tiene líneas en ventas del POS (aunque el estado sea «Disponible»).'
                            : undefined
                        }
                        onClick={() => rid != null && void deleteOne(rid, r.codigo, r)}
                      />
                    </RowActionStrip>
                  </DataTableCell>
                </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>
          </div>
        )}
      </DataTableShell>

      <SelectionToolbar
        count={selectedIds.size}
        countLabel={selectedIds.size === 1 ? 'artículo' : 'artículos'}
        onClear={() => setSelectedIds(new Set())}
        actions={
          <>
            <SelectionToolbarButton
              icon={<Percent className="size-3.5" strokeWidth={1.75} />}
              label="Ajustar precios"
              onClick={() => setPriceDialogOpen(true)}
            />
            <SelectionToolbarButton
              icon={<Printer className="size-3.5" strokeWidth={1.75} />}
              label="Imprimir etiquetas"
              onClick={() => printLabels()}
            />
            <SelectionToolbarButton
              icon={<TagIcon className="size-3.5" strokeWidth={1.75} />}
              label="Cambiar tags"
              onClick={() => toast.message('Próximamente')}
            />
            <SelectionToolbarButton
              icon={<Trash2 className="size-3.5" strokeWidth={1.75} />}
              label="Eliminar"
              destructive
              disabled={bulkDeleteAllBlocked}
              title={
                bulkDeleteAllBlocked
                  ? 'Ninguno de los seleccionados se puede borrar: todos tienen historial en ventas del POS.'
                  : undefined
              }
              onClick={deleteMany}
            />
          </>
        }
      />

      <PriceAdjustDialog
        open={priceDialogOpen}
        initialTagsByGroup={draft.tagsByGroup}
        inventorySearchRef={inventorySearchRef}
        onClose={() => setPriceDialogOpen(false)}
        onApplied={() => void refresh()}
      />
    </div>
  )
}

/** Vista de tarjetas: grilla compacta con imagen opcional, nombre, estado y precio. */
function CardsView({ rows, focusedId, onFocus, onEdit, selectedIds, onToggle, hasSelection }) {
  return (
    <div
      className="inv-cards-grid grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 pt-3"
      data-has-selection={hasSelection ? '' : undefined}
    >
      {rows.map((r) => {
        const rid = invRowId(r)
        const selected = rid != null && selectedIds.has(rid)
        const active = rid != null && focusedId === rid
        return (
          <article
            key={rid ?? r.id}
            onClick={() => rid != null && onFocus(rid)}
            onDoubleClick={(e) => { e.preventDefault(); void onEdit(r) }}
            className={`group relative cursor-pointer rounded-lg border p-3 transition-colors ${
              selected
                ? 'border-primary/40 bg-primary/[0.04]'
                : active
                  ? 'border-foreground/30 bg-muted/20'
                  : 'border-border/60 hover:border-border hover:bg-muted/45 dark:hover:bg-muted/40'
            }`}
          >
            <div data-inv-card-check className="absolute left-2 top-2">
              <Checkbox
                checked={selected}
                onChange={() => rid != null && onToggle(rid)}
                aria={`Seleccionar ${r.codigo}`}
              />
            </div>
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="font-mono text-[10.5px] text-muted-foreground/80">{r.codigo || '—'}</span>
              <EstadoBadge raw={r.estado} />
            </div>
            <h3 className="mb-1 line-clamp-2 text-[13px] font-medium leading-snug tracking-[-0.005em] text-foreground/95">
              {r.descripcion || '—'}
            </h3>
            <div className="mb-2 text-[11px] leading-relaxed text-muted-foreground/85">
              <InvTagPills tagsCsv={r.tags} max={4} />
            </div>
            <div className="flex items-end justify-between gap-2">
              <span className="col-precio text-[15px] font-semibold text-foreground">{formatPrice(r.precio)}</span>
              <span className="text-[10px] text-muted-foreground/70">
                {formatFechaIngreso(r.fecha_ingreso ?? r.created_at)}
              </span>
            </div>
          </article>
        )
      })}
    </div>
  )
}
