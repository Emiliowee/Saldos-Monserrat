import { useEffect, useRef, useState } from 'react'
import { motion as Motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Trash2, X, Sparkles, ImagePlus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { ProductLabelPreview } from '@/components/inventory/ProductLabelPreview'
import { ProductReferencePanel } from '@/components/inventory/ProductReferencePanel'
import { InventoryPropertyEditor } from '@/components/inventory/InventoryPropertyEditor'
import { localPathToFileUrl } from '@/lib/localFileUrl'
import { Button } from '@/components/ui/button'

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
function mapApiProductToDraft(full) {
  const pu = full.pieza_unica == null ? true : Number(full.pieza_unica) === 1 || full.pieza_unica === true
  const st = Number(full.stock)
  return {
    id: full.id,
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
    pieza_unica: pu,
    stock: Number.isFinite(st) && st >= 1 ? Math.floor(st) : 1,
  }
}

export function InventoryProductDrawer({ open, draft, setDraft, onSave, onClose, onDelete, onRefreshInventory, onClearForm, onProductLoadedFromLookup }) {
  const [tab, setTab] = useState('principal')
  const [labelLinea, setLabelLinea] = useState('—')
  const [refPrefsTick, setRefPrefsTick] = useState(0)
  const [saveBusy, setSaveBusy] = useState(false)
  const [autoFilled, setAutoFilled] = useState({ nombre: false, precio: false })
  const reduceMotion = useReducedMotion()
  const lastAutofillKey = useRef('')

  useEffect(() => { lastAutofillKey.current = ''; setAutoFilled({ nombre: false, precio: false }) }, [draft.id])
  useEffect(() => { if (open) setTab('principal') }, [open, draft.id])

  useEffect(() => {
    if (!open || draft.id != null || String(draft.codigo || '').trim()) return
    const api = window.bazar?.db?.nextCodigoMsr; if (!api) return
    let cancelled = false
    void (async () => { try { const code = await api(); if (!cancelled && code) setDraft((d) => d.id != null || String(d.codigo || '').trim() ? d : { ...d, codigo: code }) } catch { /* ok */ } })()
    return () => { cancelled = true }
  }, [open, draft.id, draft.codigo, setDraft])

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
    if (!open || !hasAnyTagSelected(draft.tagsByGroup)) return
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
            const mode = st.altaAutoFillMode || 'patrones'
            if (mode === 'cuaderno' && st.altaAutofillPrecioCuaderno !== false) precioVal = await api.suggestPrecioFromTags({ tagsByGroup: tb, mode: 'cuaderno', excludeCodigo: ex })
            else if (mode === 'patrones' && st.altaAutofillPrecioPatrones !== false) precioVal = await api.suggestPrecioFromTags({ tagsByGroup: tb, mode: 'patrones', excludeCodigo: ex })
          }
          if (!cancel && precioVal != null && Number.isFinite(Number(precioVal))) { const n = Number(precioVal); const s = Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : n.toFixed(2); setDraft((d) => String(d.precio || '').trim() ? d : { ...d, precio: s }); setAutoFilled(p => ({ ...p, precio: true })) }
        } catch { /* ok */ }
      }
      if (st.altaAutofillCodigoMsrNuevo !== false && draft.id == null && !String(draft.codigo || '').trim() && typeof api.nextCodigoMsr === 'function') { try { const c = await api.nextCodigoMsr(); if (!cancel && c) setDraft((d) => String(d.codigo || '').trim() ? d : { ...d, codigo: c }) } catch { /* ok */ } }
    })()
    return () => { cancel = true }
  }, [open, draft.tagsByGroup, draft.codigo, draft.descripcion, draft.precio, draft.id, draft.ruleId, refPrefsTick, setDraft])

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

  const handleSaveClick = async () => {
    if (saveBusy) return; setSaveBusy(true)
    try { await onSave?.() } catch (err) { toast.error(String(err?.message || err) || 'Error') }
    finally { setSaveBusy(false) }
  }

  return (
    <>
      {/* Backdrop sin AnimatePresence: en salida, un Motion con opacity 0 puede seguir capturando eventos. */}
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px]"
          aria-label="Cerrar"
          onClick={onClose}
        />
      ) : null}
      <AnimatePresence>
        {open && (
            <Motion.aside key="dr" className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col border-l bg-card shadow-2xl" role="dialog" aria-modal="true" initial={reduceMotion ? false : { x: '100%' }} animate={{ x: 0 }} exit={reduceMotion ? undefined : { x: '100%' }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
                <h2 className="text-[14px] font-semibold">{draft.id == null ? 'Nuevo artículo' : 'Editar artículo'}</h2>
                <div className="flex items-center gap-0.5">
                  {draft.id != null && typeof onDelete === 'function' && (
                    <button type="button" className="size-7 inline-flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" onClick={() => onDelete()}><Trash2 className="size-3.5" /></button>
                  )}
                  <button type="button" className="size-7 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" onClick={onClose}><X className="size-4" /></button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b shrink-0">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={[
                      'flex-1 py-2 text-[11px] font-medium transition-colors border-b-[1.5px]',
                      tab === t.id
                        ? 'border-foreground/60 text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
                {tab === 'principal' && (
                  <>
                    {/* STEP 1: Property editor — Notion-style inline */}
                    <InventoryPropertyEditor
                      ruleId={draft.ruleId ?? null}
                      tagsByGroup={draft.tagsByGroup}
                      ruleFieldValues={draft.ruleFieldValues}
                      onChange={({ ruleId, tagsByGroup, ruleFieldValues: rv }) => {
                        lastAutofillKey.current = ''
                        setDraft((d) => ({
                          ...d,
                          ruleId: ruleId ?? null,
                          tagsByGroup,
                          ...(rv !== undefined ? { ruleFieldValues: rv } : {}),
                        }))
                      }}
                    />

                    {/* Auto-fill indicator */}
                    {(autoFilled.nombre || autoFilled.precio) && (
                      <div className="flex items-center gap-1.5 px-1 text-[10px] text-primary">
                        <Sparkles className="size-3 shrink-0" />
                        <span>
                          {autoFilled.nombre && autoFilled.precio ? 'Nombre y precio auto-completados' : autoFilled.nombre ? 'Nombre auto-completado' : 'Precio auto-completado'}
                        </span>
                      </div>
                    )}

                    {/* Fields */}
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Código {draft.id == null && <span className="normal-case tracking-normal text-muted-foreground">· auto-generado</span>}
                        </label>
                        <input className="h-8 w-full rounded-lg border border-border bg-background px-3 text-[12.5px] font-mono outline-none focus:ring-1 focus:ring-ring" value={draft.codigo} readOnly={draft.id != null} placeholder="MSR-… (Enter busca)" onChange={(e) => setDraft((d) => ({ ...d, codigo: e.target.value }))} onKeyDown={onCodigoKeyDown} autoComplete="off" />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Nombre</label>
                        <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:ring-1 focus:ring-ring resize-none" rows={2} placeholder={tagsOk ? 'Nombre del artículo' : 'Definí propiedades primero'} value={draft.descripcion} onChange={(e) => { setDraft((d) => ({ ...d, descripcion: e.target.value })); setAutoFilled(p => ({ ...p, nombre: false })) }} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Precio</label>
                          <input className="h-8 w-full rounded-lg border border-border bg-background px-3 text-[12.5px] tabular-nums outline-none focus:ring-1 focus:ring-ring" inputMode="decimal" placeholder="$0" value={draft.precio} onChange={(e) => { setDraft((d) => ({ ...d, precio: e.target.value })); setAutoFilled(p => ({ ...p, precio: false })) }} />
                        </div>
                        {draft.id != null && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Estado</label>
                            <select className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-[12px] outline-none" value={draft.estado} onChange={(e) => setDraft((d) => ({ ...d, estado: e.target.value }))}>
                              {ESTADOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-[12px]">
                          <input type="checkbox" className="size-3.5 rounded border accent-primary" checked={draft.pieza_unica !== false} onChange={(e) => { const pu = e.target.checked; setDraft((d) => ({ ...d, pieza_unica: pu, stock: pu ? 1 : Math.max(1, Number(d.stock) || 1) })) }} />
                          <span className="text-foreground">Pieza única</span>
                        </label>
                        {draft.pieza_unica === false && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">Stock:</span>
                            <input className="h-7 w-16 rounded-md border border-border bg-background px-2 text-[12px] tabular-nums outline-none text-center" inputMode="numeric" min={1} value={draft.stock != null ? String(draft.stock) : '1'} onChange={(e) => { const n = Math.max(1, Math.floor(Number(e.target.value) || 1)); setDraft((d) => ({ ...d, stock: n })) }} />
                          </div>
                        )}
                      </div>

                      {/* Image */}
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={pickImage} className="size-14 shrink-0 rounded-xl border border-dashed border-border bg-muted/20 flex items-center justify-center overflow-hidden hover:border-border transition-colors">
                          {imgSrc ? <img src={imgSrc} alt="" className="size-full object-cover" draggable={false} /> : <ImagePlus className="size-4 text-muted-foreground" />}
                        </button>
                        <div className="text-[10.5px] text-muted-foreground">
                          {imgSrc ? 'Click para cambiar imagen' : 'Imagen del producto (opcional)'}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button type="button" className="text-[10.5px] text-muted-foreground hover:text-foreground transition-colors" onClick={() => onClearForm?.()}>Limpiar formulario</button>
                    </div>
                  </>
                )}

                {tab === 'etiqueta' && (
                  <>
                    <ProductLabelPreview nombre={labelLinea} precio={precioNum} codigo={draft.codigo} />
                    {draft.codigo && (
                      <Button size="sm" variant="outline" className="mx-auto text-[11px]" disabled={!tagsOk} onClick={async () => {
                        if (!tagsOk) { toast.error('Elegí al menos un valor en las propiedades.'); return }
                        const api = window.bazar?.printers?.printLabel; if (!api) return
                        try { const res = await api({ codigo: draft.codigo, nombre: labelLinea, precio: precioNum }); if (res?.ok) toast.success(res.message || 'Etiqueta lista'); else toast.error(res?.message || 'Error') }
                        catch (err) { toast.error(String(err?.message || err)) }
                      }}>Guardar etiqueta PDF</Button>
                    )}
                  </>
                )}

                {tab === 'referencia' && (
                  <ProductReferencePanel tagsByGroup={draft.tagsByGroup || {}} codigo={draft.codigo} onApplyMedian={applyMedian} onPrefsSaved={() => { setRefPrefsTick((t) => t + 1); lastAutofillKey.current = '' }} />
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0">
                <Button variant="ghost" size="sm" className="text-[11px]" onClick={onClose}>Cancelar</Button>
                <Button size="sm" className="text-[11px] inline-flex items-center gap-1.5" disabled={saveBusy} onClick={handleSaveClick}>
                  {saveBusy ? <RefreshCw className="size-3.5 shrink-0 animate-spin" aria-hidden /> : null}
                  {saveBusy ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </Motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
