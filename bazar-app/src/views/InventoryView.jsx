import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { releaseModalBodyLocks } from '@/lib/releaseModalBodyLocks'
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
  return { id: null, codigo: '', descripcion: '', precio: '', estado: 'disponible', imagen_path: '', tagsByGroup: {}, ruleId: null, pieza_unica: true, stock: 1 }
}

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
function normStock(row) { const n = Number(row?.stock); return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1 }

export function InventoryView() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const qRef = useRef('')
  const inventorySearchRef = useRef(null)
  const listReqRef = useRef(0)
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
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      if (reqId !== listReqRef.current) return
      toast.error(String(e.message || e))
    }
  }, [estadoIndex, vistaIndex, listTab])

  useEffect(() => {
    const t = setTimeout(() => { void refresh(q) }, 240)
    return () => clearTimeout(t)
  }, [q, refresh])

  useEffect(() => { void refresh() }, [estadoIndex, vistaIndex, listTab, refresh])

  const openEdit = useCallback(async (row) => {
    if (!row) return
    const api = window.bazar?.db
    if (api?.getProductById) {
      try {
        const full = await api.getProductById(row.id)
        if (full) {
          setDraft({ id: full.id, codigo: full.codigo ?? '', descripcion: full.descripcion ?? '', precio: full.precio != null ? String(full.precio) : '', estado: String(full.estado || 'disponible').toLowerCase(), imagen_path: full.imagen_path ?? '', tagsByGroup: full.tagsByGroup && typeof full.tagsByGroup === 'object' ? full.tagsByGroup : {}, pieza_unica: normPiezaUnica(full.pieza_unica), stock: normStock(full) })
          setFocusedId(row.id)
          setProductPage({ mode: 'edit', id: row.id })
          return
        }
      } catch (e) { toast.error(String(e.message || e)) }
    }
    setDraft({ id: row.id, codigo: row.codigo ?? '', descripcion: row.descripcion ?? '', precio: row.precio != null ? String(row.precio) : '', estado: String(row.estado || 'disponible').toLowerCase(), imagen_path: row.imagen_path ?? '', tagsByGroup: {}, pieza_unica: normPiezaUnica(row.pieza_unica), stock: normStock(row) })
    setFocusedId(row.id)
    setProductPage({ mode: 'edit', id: row.id })
  }, [])

  const openNew = useCallback(async () => {
    const base = emptyDraft()
    const api = window.bazar?.db
    if (api?.nextCodigoMsr) { try { base.codigo = await api.nextCodigoMsr() } catch { /* ok */ } }
    setDraft(base)
    setFocusedId(null)
    setProductPage({ mode: 'new' })
  }, [])

  const loadProductFromLookup = (next) => { setDraft(next); setFocusedId(next.id) }

  useEffect(() => {
    let raw; try { raw = sessionStorage.getItem('bazar.inventoryOpenProductId') } catch { return }
    if (!raw) return; try { sessionStorage.removeItem('bazar.inventoryOpenProductId') } catch { /* noop */ }
    const id = Number(raw); if (!Number.isFinite(id)) return
    void openEdit({ id })
  }, [openEdit])

  useEffect(() => { try { const flag = sessionStorage.getItem('bazar.inventoryNewProduct'); if (flag) { sessionStorage.removeItem('bazar.inventoryNewProduct'); void openNew() } } catch { /* noop */ } }, [openNew])

  useEffect(() => {
    const onScan = (e) => {
      const id = e?.detail; if (id == null) return
      void openEdit({ id: Number(id) })
    }
    window.addEventListener('bazar:inventory-open-product', onScan)
    return () => window.removeEventListener('bazar:inventory-open-product', onScan)
  }, [openEdit])

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
    const d = draftRef.current; const api = window.bazar?.db
    if (!api?.addProduct || !api?.updateProduct) { toast.error('Base de datos no disponible.'); return }
    if (!draftHasAnyTag(d.tagsByGroup)) { toast.error('Elegí al menos un tag.'); return }
    const codigo = String(d.codigo ?? '').trim()
    if (!codigo) { toast.error('El código es obligatorio'); return }
    let descripcion = String(d.descripcion ?? '').trim()
    if (!descripcion && api.suggestNombreFromTags) {
      try {
        const raw = await window.bazar?.settings?.get?.(); const st = raw && typeof raw === 'object' ? raw : {}
        if (st.altaAutofillNombreDesdeTags !== false) { const sn = await api.suggestNombreFromTags({ tagsByGroup: d.tagsByGroup, excludeCodigo: codigo || undefined }); if (sn && String(sn).trim()) descripcion = String(sn).trim() }
        if (!descripcion && api.getNombreEtiquetaDesdeTags) { const et = await api.getNombreEtiquetaDesdeTags({ tagsByGroup: d.tagsByGroup }); if (et && String(et).trim()) descripcion = String(et).trim() }
      } catch { /* ignore */ }
    }
    if (!descripcion) { toast.error('El nombre / descripción es obligatorio'); return }
    let precio = parsePrecio(d.precio)
    if (precio === null && api.suggestPrecioFromTags) {
      try {
        const raw = await window.bazar?.settings?.get?.(); const st = raw && typeof raw === 'object' ? raw : {}
        const mode = st.altaAutoFillMode || 'patrones'
        if (mode !== 'off') {
          const skipC = st.altaAutofillPrecioCuaderno === false; const skipP = st.altaAutofillPrecioPatrones === false; let precioVal = null
          if (mode === 'cuaderno' && !skipC) precioVal = await api.suggestPrecioFromTags({ tagsByGroup: d.tagsByGroup, mode: 'cuaderno', excludeCodigo: codigo || undefined })
          else if (mode === 'patrones' && !skipP) precioVal = await api.suggestPrecioFromTags({ tagsByGroup: d.tagsByGroup, mode: 'patrones', excludeCodigo: codigo || undefined })
          if (precioVal != null && Number.isFinite(Number(precioVal))) precio = Number(precioVal)
        }
      } catch { /* ignore */ }
    }
    if (precio === null) { toast.error('Indica un precio válido (número ≥ 0)'); return }
    const esNuevo = d.id == null
    const tagsByGroup = d.tagsByGroup && typeof d.tagsByGroup === 'object' ? { ...d.tagsByGroup } : {}
    const pieza_unica = d.pieza_unica !== false
    let stock = Math.max(1, Math.floor(Number(String(d.stock ?? '').replace(',', '.')) || 1)); if (pieza_unica) stock = 1
    const payload = { codigo, descripcion, precio, estado: esNuevo ? 'disponible' : String(d.estado ?? 'disponible'), imagen_path: String(d.imagen_path ?? '').trim(), tagsByGroup, pieza_unica, stock }
    try {
      if (esNuevo) {
        await api.addProduct(payload); toast.success('Artículo creado')
        try { const st = await window.bazar?.settings?.get?.(); if (st?.printLabelAfterSave && window.bazar?.printers?.printLabel) { void window.bazar.printers.printLabel({ codigo: payload.codigo, nombre: payload.descripcion, precio: payload.precio }).then((res) => { if (res?.ok) toast.message(res.message || 'Etiqueta PDF en Descargas'); else if (res?.message) toast.error(res.message) }).catch(() => { toast.error('No se pudo generar la etiqueta PDF') }) } } catch { /* no bloquea */ }
      } else { await api.updateProduct({ ...payload, id: d.id }); toast.success('Guardado') }
      closePage(); await refresh()
    } catch (e) { const raw = typeof e === 'string' ? e : e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e); toast.error(raw && raw !== '[object Object]' ? raw : 'No se pudo guardar.') }
  }, [closePage, refresh])

  const deleteOne = useCallback(async (id, codigo) => {
    const api = window.bazar?.db
    if (!api?.deleteProduct || id == null) return
    if (!window.confirm(`¿Eliminar «${codigo || id}»?`)) return
    try {
      await api.deleteProduct(id)
      toast.success('Eliminado')
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
      if (focusedId === id) setFocusedId(null)
      if (draftRef.current?.id === id) closePage()
      await refresh()
    } catch (e) { toast.error(String(e?.message || e)) }
  }, [closePage, refresh, focusedId])

  const deleteMany = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    if (!window.confirm(`¿Eliminar ${ids.length} artículo(s)?`)) return
    const api = window.bazar?.db
    if (!api?.deleteProduct) { toast.error('Base de datos no disponible.'); return }
    try {
      for (const id of ids) { await api.deleteProduct(id) }
      toast.success(`Eliminados ${ids.length} artículo(s)`)
      setSelectedIds(new Set())
      await refresh()
    } catch (e) { toast.error(String(e.message || e)) }
  }, [selectedIds, refresh])

  const deleteFromPage = useCallback(async () => {
    const d = draftRef.current; const id = d?.id
    if (id == null) return
    await deleteOne(id, String(d.codigo || '').trim() || undefined)
  }, [deleteOne])

  const printLabels = useCallback(async (ids) => {
    const api = window.bazar?.printers?.printLabel
    if (!api) { toast.error('Impresión no disponible'); return }
    const list = ids && ids.length ? ids : [...selectedIds]
    if (list.length === 0) { toast.message('Seleccioná al menos un artículo'); return }
    const byId = new Map(rows.map((r) => [r.id, r]))
    let ok = 0
    for (const id of list) {
      const r = byId.get(id); if (!r) continue
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
  const allRowIds = useMemo(() => rows.map((r) => r.id), [rows])
  const allSelected = allRowIds.length > 0 && allRowIds.every((id) => selectedIds.has(id))
  const someSelected = allRowIds.some((id) => selectedIds.has(id))
  const headerChecked = allSelected ? true : someSelected ? 'indeterminate' : false

  const toggleAll = (next) => {
    if (next) setSelectedIds(new Set(allRowIds))
    else setSelectedIds(new Set())
  }

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

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

  return (
    <div data-app-workspace className="relative flex h-full flex-col bg-background">
      <PageHeader
        icon={<Package className="size-5" strokeWidth={1.5} />}
        title="Inventario"
        description="Todos los artículos de la tienda. Filtrá, editá y ajustá precios en masa."
        count={rows.length}
        actions={
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90 dark:bg-foreground/92"
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
                className="ml-0.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground/80 hover:bg-[#f1f0ef] hover:text-foreground/85 dark:hover:bg-zinc-800/60"
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
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') { e.preventDefault(); void refresh(q) }
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
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-3 text-[12.5px] font-medium text-foreground/85 transition-colors hover:bg-[#f3f3f2] dark:hover:bg-zinc-800/60"
                >
                  <FilterX className="size-3.5" strokeWidth={1.75} />
                  Vaciar filtros
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openNew}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
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
            onFocus={setFocusedId}
            onEdit={openEdit}
            selectedIds={selectedIds}
            onToggle={toggleOne}
          />
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableHead width="32px" className="px-3">
                <Checkbox checked={headerChecked} onChange={toggleAll} aria="Seleccionar todo" />
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
              {rows.map((r) => (
                <DataTableRow
                  key={r.id}
                  selected={selectedIds.has(r.id)}
                  active={focusedId === r.id}
                  onClick={() => setFocusedId(r.id)}
                  onDoubleClick={(e) => { e.preventDefault(); void openEdit(r) }}
                >
                  <DataTableCell className="px-3">
                    <Checkbox
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      aria={`Seleccionar ${r.codigo}`}
                    />
                  </DataTableCell>
                  <DataTableCell mono muted>{r.codigo || '—'}</DataTableCell>
                  <DataTableCell>
                    <span className="block max-w-full truncate text-foreground/95">{r.descripcion || '—'}</span>
                  </DataTableCell>
                  <DataTableCell className="text-[11.5px] text-muted-foreground/85">
                    <span className="block max-w-full truncate">{String(r.tags || '').trim() || '—'}</span>
                  </DataTableCell>
                  <DataTableCell align="right" className="font-medium text-foreground/90">{formatPrice(r.precio)}</DataTableCell>
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
                        onClick={() => void printLabels([r.id])}
                      />
                      <RowActionButton
                        icon={<Trash2 className="size-3.5" strokeWidth={1.75} />}
                        label="Eliminar"
                        destructive
                        onClick={() => void deleteOne(r.id, r.codigo)}
                      />
                    </RowActionStrip>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
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
        onApplied={() => refresh()}
      />
    </div>
  )
}

/** Vista de tarjetas: grilla compacta con imagen opcional, nombre, estado y precio. */
function CardsView({ rows, focusedId, onFocus, onEdit, selectedIds, onToggle }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 pt-3">
      {rows.map((r) => {
        const selected = selectedIds.has(r.id)
        const active = focusedId === r.id
        return (
          <article
            key={r.id}
            onClick={() => onFocus(r.id)}
            onDoubleClick={(e) => { e.preventDefault(); void onEdit(r) }}
            className={`group relative cursor-pointer rounded-lg border p-3 transition-colors ${
              selected
                ? 'border-primary/40 bg-primary/[0.04]'
                : active
                  ? 'border-foreground/30 bg-muted/20'
                  : 'border-border/60 hover:border-border hover:bg-[#faf9f8] dark:hover:bg-zinc-900/60'
            }`}
          >
            <div className="absolute left-2 top-2 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden={!selected}>
              <Checkbox
                checked={selected}
                onChange={() => onToggle(r.id)}
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
            <div className="mb-2 text-[11px] leading-relaxed text-muted-foreground/85 line-clamp-2">
              {String(r.tags || '').trim() || '—'}
            </div>
            <div className="flex items-end justify-between gap-2">
              <span className="text-[15px] font-semibold tabular-nums text-foreground">{formatPrice(r.precio)}</span>
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
