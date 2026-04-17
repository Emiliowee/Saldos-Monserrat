import { useEffect, useRef, useState } from 'react'
import { Trash2, Sparkles, ImagePlus, Package, Save } from 'lucide-react'
import { toast } from 'sonner'
import { ProductLabelPreview } from '@/components/inventory/ProductLabelPreview'
import { ProductReferencePanel } from '@/components/inventory/ProductReferencePanel'
import { InventoryPropertyEditor } from '@/components/inventory/InventoryPropertyEditor'
import { localPathToFileUrl } from '@/lib/localFileUrl'
import { PageHeader, PageHeaderDivider } from '@/components/premium'
import { cn } from '@/lib/utils'

const ESTADOS = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'vendido', label: 'Vendido' },
  { value: 'en_banqueta', label: 'En banqueta' },
]

const TABS = [
  { id: 'principal', label: 'Datos' },
  { id: 'etiqueta', label: 'Etiqueta' },
  { id: 'referencia', label: 'Referencia' },
]

const ALTA_PREFS_DEFAULTS = { altaAutoFillMode: 'patrones', altaAutofillPrecioCuaderno: true, altaAutofillPrecioPatrones: true, altaAutofillNombreDesdeTags: true, altaAutofillCodigoMsrNuevo: true }

function tagsKey(map) { if (!map || typeof map !== 'object') return '{}'; const keys = Object.keys(map).map(Number).filter(Number.isFinite).sort((a, b) => a - b); return JSON.stringify(keys.reduce((acc, k) => { acc[k] = map[k]; return acc }, {})) }
function optionIdPositive(v) { if (v == null || v === '') return false; const n = Number(v); return Number.isFinite(n) && n > 0 }
function hasAnyTagSelected(map) { if (!map || typeof map !== 'object') return false; return Object.values(map).some(optionIdPositive) }
function mapApiProductToDraft(full) { const pu = full.pieza_unica == null ? true : Number(full.pieza_unica) === 1 || full.pieza_unica === true; const st = Number(full.stock); return { id: full.id, codigo: full.codigo ?? '', descripcion: full.descripcion ?? '', precio: full.precio != null ? String(full.precio) : '', estado: String(full.estado || 'disponible').toLowerCase(), imagen_path: full.imagen_path ?? '', tagsByGroup: full.tagsByGroup && typeof full.tagsByGroup === 'object' ? full.tagsByGroup : {}, ruleId: full.ruleId ?? null, pieza_unica: pu, stock: Number.isFinite(st) && st >= 1 ? Math.floor(st) : 1 } }

/**
 * Página de edición / alta de producto, al estilo Notion page:
 * cover opcional → icon + título → propiedades (bloque tabla key/value) → tabs con contenido.
 */
export function InventoryProductPage({ draft, setDraft, mode, onSave, onBack, onDelete, onClearForm, onProductLoadedFromLookup }) {
  const [tab, setTab] = useState('principal')
  const [labelLinea, setLabelLinea] = useState('—')
  const [refPrefsTick, setRefPrefsTick] = useState(0)
  const [saveBusy, setSaveBusy] = useState(false)
  const [autoFilled, setAutoFilled] = useState({ nombre: false, precio: false })
  const lastAutofillKey = useRef('')

  useEffect(() => { lastAutofillKey.current = ''; setAutoFilled({ nombre: false, precio: false }); setTab('principal') }, [draft.id])

  useEffect(() => {
    if (draft.id != null || String(draft.codigo || '').trim()) return
    const api = window.bazar?.db?.nextCodigoMsr; if (!api) return
    let cancelled = false
    void (async () => { try { const code = await api(); if (!cancelled && code) setDraft((d) => d.id != null || String(d.codigo || '').trim() ? d : { ...d, codigo: code }) } catch { /* ok */ } })()
    return () => { cancelled = true }
  }, [draft.id, draft.codigo, setDraft])

  useEffect(() => {
    let cancel = false
    void (async () => {
      const d = String(draft.descripcion || '').trim()
      if (d) { setLabelLinea(d); return }
      const api = window.bazar?.db; const tb = draft.tagsByGroup || {}
      if (!api || Object.keys(tb).length === 0) { setLabelLinea('—'); return }
      try { const sn = await api.suggestNombreFromTags({ tagsByGroup: tb, excludeCodigo: String(draft.codigo || '').trim() || undefined }); if (cancel) return; if (sn) { setLabelLinea(sn); return }; const et = await api.getNombreEtiquetaDesdeTags({ tagsByGroup: tb }); if (cancel) return; setLabelLinea(et || '—') }
      catch { if (!cancel) setLabelLinea('—') }
    })()
    return () => { cancel = true }
  }, [draft.descripcion, draft.tagsByGroup, draft.codigo])

  useEffect(() => {
    if (!hasAnyTagSelected(draft.tagsByGroup)) return
    const tb = draft.tagsByGroup || {}; if (Object.keys(tb).length === 0) return
    const pSig = String(draft.precio || '').trim() ? '1' : '0'; const nSig = String(draft.descripcion || '').trim() ? '1' : '0'
    const ruleSig = draft.ruleId ? `r:${draft.ruleId}` : 'free'
    const key = `${tagsKey(tb)}|${refPrefsTick}|${pSig}|${nSig}|${ruleSig}`; if (key === lastAutofillKey.current) return
    let cancel = false
    void (async () => {
      const api = window.bazar?.db; if (!api) return
      const raw = await window.bazar?.settings?.get?.(); const st = { ...ALTA_PREFS_DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) }
      lastAutofillKey.current = key; const ex = String(draft.codigo || '').trim() || undefined
      if (st.altaAutofillNombreDesdeTags !== false && !String(draft.descripcion || '').trim()) {
        try { const nombre = await api.suggestNombreFromTags({ tagsByGroup: tb, excludeCodigo: ex }); if (!cancel && nombre) { setDraft((d) => String(d.descripcion || '').trim() ? d : { ...d, descripcion: nombre }); setAutoFilled(p => ({ ...p, nombre: true })) } } catch { /* ok */ }
      }
      if (!String(draft.precio || '').trim()) {
        try {
          let precioVal = null
          if (draft.ruleId) {
            precioVal = await api.suggestPrecioFromTags({ tagsByGroup: tb, ruleId: Number(draft.ruleId), excludeCodigo: ex })
          } else if (st.altaAutoFillMode !== 'off') {
            const modeAutoFill = st.altaAutoFillMode || 'patrones'
            if (modeAutoFill === 'cuaderno' && st.altaAutofillPrecioCuaderno !== false) precioVal = await api.suggestPrecioFromTags({ tagsByGroup: tb, mode: 'cuaderno', excludeCodigo: ex })
            else if (modeAutoFill === 'patrones' && st.altaAutofillPrecioPatrones !== false) precioVal = await api.suggestPrecioFromTags({ tagsByGroup: tb, mode: 'patrones', excludeCodigo: ex })
          }
          if (!cancel && precioVal != null && Number.isFinite(Number(precioVal))) { const n = Number(precioVal); const s = Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : n.toFixed(2); setDraft((d) => String(d.precio || '').trim() ? d : { ...d, precio: s }); setAutoFilled(p => ({ ...p, precio: true })) }
        } catch { /* ok */ }
      }
      if (st.altaAutofillCodigoMsrNuevo !== false && draft.id == null && !String(draft.codigo || '').trim() && typeof api.nextCodigoMsr === 'function') { try { const c = await api.nextCodigoMsr(); if (!cancel && c) setDraft((d) => String(d.codigo || '').trim() ? d : { ...d, codigo: c }) } catch { /* ok */ } }
    })()
    return () => { cancel = true }
  }, [draft.tagsByGroup, draft.codigo, draft.descripcion, draft.precio, draft.id, draft.ruleId, refPrefsTick, setDraft])

  const precioNum = Number(String(draft.precio).replace(',', '.'))
  const applyMedian = (m) => { const n = Number(m); if (!Number.isFinite(n)) return; const s = Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : n.toFixed(2); setDraft((d) => ({ ...d, precio: s })) }

  const onCodigoKeyDown = async (e) => {
    if (e.key !== 'Enter') return; const raw = String(draft.codigo || '').trim(); if (!raw) return
    const api = window.bazar?.db?.getProductByCodigo; if (!api) return
    try { const full = await api(raw); if (!full) { toast.message(`No encontrado: «${raw}»`); return }; onProductLoadedFromLookup?.(mapApiProductToDraft(full)); toast.message(`Cargado: ${full.codigo}`) }
    catch (err) { toast.error(String(err?.message || err)) }
  }

  const pickImage = async () => {
    const pick = window.bazar?.productImage?.pick; if (!pick) return
    try { const res = await pick(); if (res?.cancelled || !res?.path) return; setDraft((d) => ({ ...d, imagen_path: res.path })); toast.success('Imagen asignada') }
    catch (err) { toast.error(String(err?.message || err)) }
  }

  const imgSrc = draft.imagen_path ? localPathToFileUrl(draft.imagen_path) : ''
  const tagsOk = hasAnyTagSelected(draft.tagsByGroup)
  const isNew = mode === 'new' || draft.id == null
  const pageTitle = isNew
    ? 'Nuevo artículo'
    : String(draft.descripcion || '').trim() || `Artículo ${String(draft.codigo || '').trim() || '—'}`

  const handleSaveClick = async () => {
    if (saveBusy) return; setSaveBusy(true)
    try { await onSave?.() } catch (err) { toast.error(String(err?.message || err) || 'Error') }
    finally { setSaveBusy(false) }
  }

  const menuItems = []
  if (!isNew && typeof onDelete === 'function') {
    menuItems.push({
      id: 'delete',
      label: 'Eliminar artículo',
      icon: <Trash2 className="size-3.5" />,
      destructive: true,
      separatorBefore: true,
      onClick: () => void onDelete(),
    })
  }
  if (typeof onClearForm === 'function' && isNew) {
    menuItems.push({
      id: 'clear',
      label: 'Limpiar formulario',
      onClick: () => onClearForm(),
    })
  }

  return (
    <div data-app-workspace className="relative flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        icon={
          imgSrc ? (
            <img src={imgSrc} alt="" className="size-full rounded-lg object-cover" draggable={false} />
          ) : (
            <Package className="size-4.5" strokeWidth={1.5} />
          )
        }
        back={{ label: 'Inventario', onClick: onBack }}
        title={pageTitle}
        description={
          isNew
            ? 'Completá las propiedades del artículo. El código, nombre y precio pueden autocompletarse desde los tags.'
            : String(draft.codigo || '').trim()
              ? `Código ${String(draft.codigo || '').trim()}`
              : null
        }
        actions={
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saveBusy}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              'bg-foreground text-background hover:bg-foreground/90',
            )}
          >
            <Save className="size-3.5" strokeWidth={2} />
            {saveBusy ? 'Guardando…' : 'Guardar'}
          </button>
        }
        menuItems={menuItems.length > 0 ? menuItems : undefined}
      />
      <PageHeaderDivider />

      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border/50 px-10">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'relative inline-flex h-9 items-center px-2.5 text-[12.5px] font-medium leading-none tracking-[-0.005em] transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground/80 hover:text-foreground/90',
              )}
            >
              {t.label}
              {active ? (
                <span aria-hidden className="absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-foreground/80" />
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Body con contenedor centrado tipo Notion */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-10 py-6">
          {tab === 'principal' && (
            <div className="space-y-6">
              {/* Properties block */}
              <section>
                <SectionLabel>Propiedades</SectionLabel>
                <InventoryPropertyEditor
                  ruleId={draft.ruleId ?? null}
                  tagsByGroup={draft.tagsByGroup}
                  onChange={({ ruleId, tagsByGroup }) => {
                    lastAutofillKey.current = ''
                    setDraft((d) => ({ ...d, ruleId: ruleId ?? null, tagsByGroup }))
                  }}
                />
              </section>

              {(autoFilled.nombre || autoFilled.precio) && (
                <div className="flex items-center gap-1.5 rounded-md bg-primary/[0.05] px-2.5 py-1.5 text-[11px] text-primary">
                  <Sparkles className="size-3 shrink-0" strokeWidth={1.75} />
                  <span>
                    {autoFilled.nombre && autoFilled.precio
                      ? 'Nombre y precio auto-completados desde los tags'
                      : autoFilled.nombre
                        ? 'Nombre auto-completado desde los tags'
                        : 'Precio auto-completado desde los tags'}
                  </span>
                </div>
              )}

              {/* Identificación */}
              <section>
                <SectionLabel>Identificación</SectionLabel>
                <PropertyRow
                  label="Código"
                  hint={isNew ? 'auto-generado' : undefined}
                >
                  <input
                    className={fieldClass}
                    value={draft.codigo}
                    readOnly={!isNew}
                    placeholder="MSR-… (Enter busca)"
                    onChange={(e) => setDraft((d) => ({ ...d, codigo: e.target.value }))}
                    onKeyDown={onCodigoKeyDown}
                    autoComplete="off"
                  />
                </PropertyRow>
                <PropertyRow label="Nombre">
                  <textarea
                    className={cn(fieldClass, 'min-h-[32px] resize-none py-1.5')}
                    rows={2}
                    placeholder={tagsOk ? 'Nombre del artículo' : 'Definí propiedades primero'}
                    value={draft.descripcion}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, descripcion: e.target.value }))
                      setAutoFilled((p) => ({ ...p, nombre: false }))
                    }}
                  />
                </PropertyRow>
              </section>

              {/* Precio / estado */}
              <section>
                <SectionLabel>Precio & estado</SectionLabel>
                <PropertyRow label="Precio">
                  <input
                    className={cn(fieldClass, 'tabular-nums')}
                    inputMode="decimal"
                    placeholder="$0"
                    value={draft.precio}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, precio: e.target.value }))
                      setAutoFilled((p) => ({ ...p, precio: false }))
                    }}
                  />
                </PropertyRow>
                {!isNew ? (
                  <PropertyRow label="Estado">
                    <select
                      className={cn(fieldClass, 'appearance-none bg-[url(\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%221.75%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>\')] bg-[length:12px_12px] bg-[center_right_10px] bg-no-repeat pr-7')}
                      value={draft.estado}
                      onChange={(e) => setDraft((d) => ({ ...d, estado: e.target.value }))}
                    >
                      {ESTADOS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </PropertyRow>
                ) : null}
                <PropertyRow label="Pieza única">
                  <div className="flex items-center gap-3 py-0.5">
                    <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-foreground/85">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border accent-primary"
                        checked={draft.pieza_unica !== false}
                        onChange={(e) => {
                          const pu = e.target.checked
                          setDraft((d) => ({ ...d, pieza_unica: pu, stock: pu ? 1 : Math.max(1, Number(d.stock) || 1) }))
                        }}
                      />
                      Sí
                    </label>
                    {draft.pieza_unica === false ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] text-muted-foreground/80">Stock</span>
                        <input
                          className={cn(fieldClass, 'h-7 w-20 text-center tabular-nums')}
                          inputMode="numeric"
                          min={1}
                          value={draft.stock != null ? String(draft.stock) : '1'}
                          onChange={(e) => {
                            const n = Math.max(1, Math.floor(Number(e.target.value) || 1))
                            setDraft((d) => ({ ...d, stock: n }))
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </PropertyRow>
              </section>

              {/* Imagen */}
              <section>
                <SectionLabel>Imagen</SectionLabel>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={pickImage}
                    className="inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/20 text-muted-foreground/70 transition-colors hover:border-border/90 hover:text-muted-foreground"
                    aria-label="Elegir imagen"
                  >
                    {imgSrc ? (
                      <img src={imgSrc} alt="" className="size-full object-cover" draggable={false} />
                    ) : (
                      <ImagePlus className="size-4" strokeWidth={1.5} />
                    )}
                  </button>
                  <div className="text-[11.5px] leading-relaxed text-muted-foreground/80">
                    {imgSrc ? 'Click para cambiar la imagen del producto.' : 'Imagen del producto (opcional). Aparecerá en la ficha y en la vista tarjetas.'}
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'etiqueta' && (
            <div className="space-y-4">
              <SectionLabel>Vista previa de la etiqueta</SectionLabel>
              <ProductLabelPreview nombre={labelLinea} precio={precioNum} codigo={draft.codigo} />
              {draft.codigo ? (
                <button
                  type="button"
                  disabled={!tagsOk}
                  onClick={async () => {
                    if (!tagsOk) { toast.error('Elegí al menos un valor en las propiedades.'); return }
                    const api = window.bazar?.printers?.printLabel; if (!api) return
                    try {
                      const res = await api({ codigo: draft.codigo, nombre: labelLinea, precio: precioNum })
                      if (res?.ok) toast.success(res.message || 'Etiqueta lista'); else toast.error(res?.message || 'Error')
                    } catch (err) { toast.error(String(err?.message || err)) }
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-3 text-[12.5px] font-medium text-foreground/85 transition-colors hover:bg-[#f3f3f2] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800/60"
                >
                  Guardar etiqueta PDF
                </button>
              ) : null}
            </div>
          )}

          {tab === 'referencia' && (
            <div className="space-y-4">
              <SectionLabel>Productos similares y mediana de precios</SectionLabel>
              <ProductReferencePanel
                tagsByGroup={draft.tagsByGroup || {}}
                codigo={draft.codigo}
                onApplyMedian={applyMedian}
                onPrefsSaved={() => { setRefPrefsTick((t) => t + 1); lastAutofillKey.current = '' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
      {children}
    </h2>
  )
}

/** Fila clave-valor estilo Notion: etiqueta gris 110px + control */
function PropertyRow({ label, hint, children }) {
  return (
    <div className="group flex min-h-[32px] items-start gap-3 border-b border-border/30 py-1.5 last:border-b-0 hover:bg-[#faf9f8]/80 dark:hover:bg-zinc-900/40">
      <div className="flex w-[130px] shrink-0 items-center gap-1 pt-1.5 text-[11.5px] text-muted-foreground/85">
        <span>{label}</span>
        {hint ? (
          <span className="text-[10px] italic text-muted-foreground/60">· {hint}</span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

const fieldClass =
  'h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-[13px] text-foreground/95 outline-none transition-colors hover:bg-[#f3f3f2] focus:border-ring/40 focus:bg-background focus:shadow-[inset_0_0_0_1px_var(--ring)] dark:hover:bg-zinc-800/40'
