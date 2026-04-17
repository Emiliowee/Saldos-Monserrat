import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Eye, EyeOff, Plus, Trash2, Copy, RotateCcw, Save, X, Maximize2,
  Building2, ImageIcon, Type, Tag, Hash, Barcode, TextCursorInput, Minus, CheckCircle2, FilePlus,
  Beaker, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  BLOCK_META,
  cloneTemplate,
  createBlock,
  createDefaultTemplate,
  isBuiltinTemplateId,
} from '@/lib/labelModel'
import { LabelRender } from './LabelRender'

const TYPE_ICONS = {
  empresa: Building2,
  logo: ImageIcon,
  nombre: Type,
  precio: Tag,
  codigo: Hash,
  codigo_barras: Barcode,
  texto_libre: TextCursorInput,
  separador: Minus,
}

const DEFAULT_SAMPLE = {
  empresa: 'Saldos Monserrat',
  nombre: 'Blusa manga corta liso',
  precio: '$350',
  codigo: 'MSR-0001',
}

const SAMPLE_PRESETS = [
  { id: 'normal',  label: 'Normal',     data: { empresa: 'Saldos Monserrat', nombre: 'Blusa manga corta liso',               precio: '$350',  codigo: 'MSR-0001' } },
  { id: 'largo',   label: 'Texto largo', data: { empresa: 'Saldos Monserrat', nombre: 'Vestido estampado flores manga larga con bolsillos', precio: '$1890', codigo: 'MSR-99999' } },
  { id: 'mini',    label: 'Precio corto', data: { empresa: 'Saldos Monserrat', nombre: 'Calcetín',                         precio: '$25',   codigo: 'MSR-12' } },
]

/** Texto que aparece en el panel derecho para explicar qué representa cada bloque al imprimir. */
const BLOCK_HINT = {
  empresa:       'Texto fijo. Se toma del nombre del workspace (Configuración → Espacio de trabajo).',
  logo:          'Imagen fija. Se usa el logo configurado en Configuración → Espacio de trabajo.',
  nombre:        'Se reemplaza por el nombre del producto al imprimir cada etiqueta.',
  precio:        'Se reemplaza por el precio del producto, con formato $MXN.',
  codigo:        'Se reemplaza por el código (MSR) del producto.',
  codigo_barras: 'Genera el código de barras Code128 a partir del código del producto.',
  texto_libre:   'Este texto aparece TAL CUAL en todas las etiquetas. Útil para «OFERTA», «DTO.», etc.',
  separador:     'Línea decorativa. Útil para dividir secciones.',
}

/**
 * Editor completo de plantillas de etiqueta.
 * - Columna izquierda: lista de plantillas + lista de bloques.
 * - Centro: canvas interactivo con SVG (drag + resize).
 * - Columna derecha: propiedades del bloque o del canvas.
 */
export function LabelEditor({ open, onClose, initialTemplateId = null, onDirty }) {
  const [list, setList] = useState({ activeId: null, templates: [] })
  const [, setDraftId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [selectedBlockId, setSelectedBlockId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [scale, setScale] = useState(6)
  const [showGrid, setShowGrid] = useState(true)
  const [logoPath, setLogoPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [sampleOverride, setSampleOverride] = useState(DEFAULT_SAMPLE)
  const [showSamplePanel, setShowSamplePanel] = useState(false)

  const canvasWrapRef = useRef(null)

  const api = typeof window !== 'undefined' ? window.bazar?.labels : null

  const reload = useCallback(async () => {
    if (!api?.list) return
    try {
      const data = await api.list()
      setList(data)
      const startId = initialTemplateId || data.activeId
      const t = data.templates.find((x) => x.id === startId) || data.templates[0]
      if (t) { setDraftId(t.id); setDraft(cloneTemplate(t)); setDirty(false) }
    } catch (e) { toast.error(String(e?.message || e)) }
  }, [api, initialTemplateId])

  useEffect(() => {
    if (!open) return
    void reload()
    void (async () => {
      try {
        const s = await window.bazar?.settings?.get?.()
        setLogoPath(String(s?.workspaceLogoPath || ''))
      } catch { /* noop */ }
    })()
  }, [open, reload])

  useEffect(() => { onDirty?.(dirty) }, [dirty, onDirty])

  const switchToTemplate = useCallback((id) => {
    if (dirty) {
      const ok = window.confirm('Hay cambios sin guardar. ¿Descartar?')
      if (!ok) return
    }
    const t = list.templates.find((x) => x.id === id)
    if (!t) return
    setDraftId(id); setDraft(cloneTemplate(t)); setSelectedBlockId(null); setDirty(false)
  }, [dirty, list.templates])

  const patchDraft = useCallback((patch) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setDirty(true)
  }, [])

  const patchBlock = useCallback((id, patch) => {
    setDraft((d) => {
      if (!d) return d
      return { ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }
    })
    setDirty(true)
  }, [])

  const addBlock = useCallback((type) => {
    setDraft((d) => {
      if (!d) return d
      const w = Math.min(d.width_mm - 6, 30)
      const block = createBlock(type, { x: 3, y: 3, w, h: 6 })
      return { ...d, blocks: [...d.blocks, block] }
    })
    setSelectedBlockId(null)
    setDirty(true)
  }, [])

  const removeBlock = useCallback((id) => {
    setDraft((d) => d ? { ...d, blocks: d.blocks.filter((b) => b.id !== id) } : d)
    if (selectedBlockId === id) setSelectedBlockId(null)
    setDirty(true)
  }, [selectedBlockId])

  const duplicateBlock = useCallback((id) => {
    setDraft((d) => {
      if (!d) return d
      const src = d.blocks.find((b) => b.id === id)
      if (!src) return d
      const copy = { ...src, id: `b_${Date.now()}_${Math.floor(Math.random() * 10000)}`, x: src.x + 2, y: src.y + 2 }
      return { ...d, blocks: [...d.blocks, copy] }
    })
    setDirty(true)
  }, [])

  const moveBlock = useCallback((id, dir) => {
    setDraft((d) => {
      if (!d) return d
      const ix = d.blocks.findIndex((b) => b.id === id)
      if (ix < 0) return d
      const target = dir === 'up' ? ix - 1 : ix + 1
      if (target < 0 || target >= d.blocks.length) return d
      const blocks = d.blocks.slice()
      const [it] = blocks.splice(ix, 1)
      blocks.splice(target, 0, it)
      return { ...d, blocks }
    })
    setDirty(true)
  }, [])

  /* ─── Drag & resize ─────────────────────────────────────────────────── */
  const dragRef = useRef(null)
  const onBlockPointerDown = useCallback((e, block) => {
    if (block.visible === false) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = canvasWrapRef.current?.getBoundingClientRect()
    if (!rect || !draft) return
    dragRef.current = {
      mode: 'move',
      id: block.id,
      startMouse: { x: e.clientX, y: e.clientY },
      startBlock: { x: block.x, y: block.y, w: block.w, h: block.h },
      scale: rect.width / draft.width_mm,
    }
  }, [draft])

  const onResizeHandlePointerDown = useCallback((e, block, corner) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = canvasWrapRef.current?.getBoundingClientRect()
    if (!rect || !draft) return
    dragRef.current = {
      mode: 'resize',
      corner,
      id: block.id,
      startMouse: { x: e.clientX, y: e.clientY },
      startBlock: { x: block.x, y: block.y, w: block.w, h: block.h },
      scale: rect.width / draft.width_mm,
    }
  }, [draft])

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current
      if (!d) return
      const dx = (e.clientX - d.startMouse.x) / d.scale
      const dy = (e.clientY - d.startMouse.y) / d.scale
      if (d.mode === 'move') {
        const nx = Math.max(0, Math.min((draft?.width_mm || 60) - d.startBlock.w, d.startBlock.x + dx))
        const ny = Math.max(0, Math.min((draft?.height_mm || 40) - d.startBlock.h, d.startBlock.y + dy))
        patchBlock(d.id, { x: round2(nx), y: round2(ny) })
      } else if (d.mode === 'resize') {
        let { x, y, w, h } = d.startBlock
        if (d.corner.includes('e')) w = Math.max(2, d.startBlock.w + dx)
        if (d.corner.includes('s')) h = Math.max(1, d.startBlock.h + dy)
        if (d.corner.includes('w')) { x = d.startBlock.x + dx; w = Math.max(2, d.startBlock.w - dx) }
        if (d.corner.includes('n')) { y = d.startBlock.y + dy; h = Math.max(1, d.startBlock.h - dy) }
        patchBlock(d.id, { x: round2(Math.max(0, x)), y: round2(Math.max(0, y)), w: round2(w), h: round2(h) })
      }
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [draft?.width_mm, draft?.height_mm, patchBlock])

  /* ─── Persistencia ──────────────────────────────────────────────────── */
  const saveCurrent = async () => {
    if (!api?.upsert || !draft) return
    setBusy(true)
    try {
      await api.upsert(draft)
      setDirty(false)
      await reload()
      toast.success('Plantilla guardada')
    } catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const newTemplate = async () => {
    if (!api?.upsert) return
    const name = window.prompt('Nombre de la nueva plantilla:', 'Nueva plantilla')
    if (!name) return
    setBusy(true)
    try {
      const base = createDefaultTemplate()
      const created = await api.upsert({ ...base, id: undefined, name })
      await reload()
      setDraftId(created.id); setDraft(cloneTemplate(created)); setDirty(false)
    } catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const duplicateTemplate = async () => {
    if (!api?.duplicate || !draft) return
    setBusy(true)
    try {
      const copy = await api.duplicate(draft.id)
      await reload()
      setDraftId(copy.id); setDraft(cloneTemplate(copy)); setDirty(false)
    } catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const deleteTemplate = async () => {
    if (!api?.remove || !draft) return
    if (isBuiltinTemplateId(draft.id)) {
      toast.error('Las plantillas incluidas con la app no se pueden eliminar.')
      return
    }
    const ok = window.confirm(`¿Eliminar la plantilla «${draft.name}»?`)
    if (!ok) return
    setBusy(true)
    try {
      await api.remove(draft.id)
      await reload()
    } catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const setActive = async () => {
    if (!api?.setActive || !draft) return
    setBusy(true)
    try { await api.setActive(draft.id); await reload(); toast.success('Plantilla marcada como activa') }
    catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const restoreOriginal = async () => {
    if (!api?.restoreDefault) return
    const ok = window.confirm(
      'Se restaurará la plantilla «Estándar bazar» al diseño actual de fábrica. Las demás plantillas incluidas (ticket, góndola, etc.) no se borran.',
    )
    if (!ok) return
    setBusy(true)
    try {
      const data = await api.restoreDefault()
      setList(data)
      const d = data.templates.find((x) => x.id === 'default')
      if (d) { setDraftId(d.id); setDraft(cloneTemplate(d)); setDirty(false) }
      toast.success('Plantilla original restaurada')
    } catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  /* ─── Render ────────────────────────────────────────────────────────── */
  const selectedBlock = useMemo(
    () => (draft?.blocks || []).find((b) => b.id === selectedBlockId) || null,
    [draft, selectedBlockId],
  )

  if (!open || !draft) return null

  const sampleData = { ...sampleOverride, logoPath }

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
      <div className="relative w-[min(1200px,98vw)] h-[min(820px,94vh)] bg-background rounded-xl border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center">
              <Tag className="size-3.5" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold leading-tight">Editor de etiqueta</h2>
              <p className="text-[10.5px] text-muted-foreground leading-tight">Diseñá cómo se imprime cada artículo</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {dirty && <span className="text-[10.5px] text-amber-600 mr-1">Sin guardar</span>}
            <Button variant="ghost" size="sm" className="gap-1.5 text-[11px] h-8" disabled={busy} onClick={restoreOriginal} title="Restaurar la plantilla original">
              <RotateCcw className="size-3.5" />Restaurar original
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-[11px] h-8" disabled={busy || list.activeId === draft.id} onClick={setActive}>
              <CheckCircle2 className="size-3.5" />Usar esta
            </Button>
            <Button size="sm" className="gap-1.5 text-[11px] h-8" disabled={!dirty || busy} onClick={saveCurrent}>
              <Save className="size-3.5" />Guardar
            </Button>
            <button type="button" onClick={() => {
              if (dirty && !window.confirm('Hay cambios sin guardar. ¿Cerrar de todas formas?')) return
              onClose?.()
            }} className="size-8 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground ml-1">
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 grid grid-cols-[240px_1fr_280px]">
          {/* LEFT — plantillas + bloques */}
          <aside className="border-r overflow-y-auto">
            <div className="px-3 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Plantillas</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={newTemplate} className="size-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title="Nueva plantilla">
                  <FilePlus className="size-3.5" />
                </button>
                <button type="button" onClick={duplicateTemplate} className="size-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title="Duplicar">
                  <Copy className="size-3.5" />
                </button>
                {!isBuiltinTemplateId(draft.id) && (
                  <button type="button" onClick={deleteTemplate} className="size-6 inline-flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Eliminar">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-px px-1.5">
              {list.templates.map((t) => {
                const isActive = t.id === list.activeId
                const isCurrent = t.id === draft.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => switchToTemplate(t.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors',
                      isCurrent ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent/60',
                    )}
                  >
                    <span className={cn('inline-block size-1.5 rounded-full shrink-0', isActive ? 'bg-primary' : 'bg-muted-foreground/30')} />
                    <span className="flex-1 truncate">{t.name}</span>
                    {isBuiltinTemplateId(t.id) && (
                      <span className="shrink-0 rounded bg-muted/70 px-1 py-0.5 text-[8.5px] font-medium text-muted-foreground">incl.</span>
                    )}
                    {isActive && <span className="text-[9.5px] uppercase tracking-widest text-primary shrink-0">activa</span>}
                  </button>
                )
              })}
            </div>

            <div className="border-t mt-2 pt-2 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Bloques</span>
              <AddBlockMenu onAdd={addBlock} />
            </div>
            <div className="flex flex-col gap-px px-1.5 pb-2">
              {draft.blocks.map((b, i) => {
                const Ico = TYPE_ICONS[b.type] || Type
                const sel = selectedBlockId === b.id
                return (
                  <div
                    key={b.id}
                    className={cn(
                      'group/row flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors',
                      sel ? 'bg-accent' : 'hover:bg-accent/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => patchBlock(b.id, { visible: !b.visible })}
                      className="size-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                      title={b.visible ? 'Ocultar' : 'Mostrar'}
                    >
                      {b.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBlockId(b.id)}
                      className="flex-1 flex items-center gap-1.5 text-[12px] truncate text-left"
                    >
                      <Ico className="size-3 shrink-0 opacity-70" />
                      <span className={cn('truncate', !b.visible && 'text-muted-foreground line-through')}>
                        {BLOCK_META[b.type]?.label || b.type}
                        {b.type === 'texto_libre' && b.text && <span className="text-muted-foreground"> · {String(b.text).slice(0, 16)}</span>}
                      </span>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      {i > 0 && (
                        <button type="button" onClick={() => moveBlock(b.id, 'up')} className="size-5 inline-flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground" title="Subir">↑</button>
                      )}
                      {i < draft.blocks.length - 1 && (
                        <button type="button" onClick={() => moveBlock(b.id, 'down')} className="size-5 inline-flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground" title="Bajar">↓</button>
                      )}
                      <button type="button" onClick={() => duplicateBlock(b.id)} className="size-5 inline-flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground" title="Duplicar">
                        <Copy className="size-3" />
                      </button>
                      <button type="button" onClick={() => removeBlock(b.id)} className="size-5 inline-flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Eliminar">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {draft.blocks.length === 0 && (
                <div className="px-2 py-4 text-[11px] text-muted-foreground text-center">
                  Agregá un bloque desde el menú de arriba.
                </div>
              )}
            </div>
          </aside>

          {/* CENTER — canvas */}
          <div className="bg-[#fafaf9] dark:bg-zinc-900/50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-background/60 backdrop-blur">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Maximize2 className="size-3" />
                <span className="tabular-nums">{draft.width_mm.toFixed(1)} × {draft.height_mm.toFixed(1)} mm</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowSamplePanel((v) => !v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground hover:bg-accent transition-colors',
                    showSamplePanel && 'bg-accent text-foreground',
                  )}
                  title="Probar con otros datos"
                >
                  <Beaker className="size-3" />
                  Datos de prueba
                </button>
                <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer">
                  <input type="checkbox" className="size-3 accent-primary" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                  Rejilla
                </label>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>Zoom</span>
                  <input type="range" min={3} max={16} step={0.5} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-24 accent-primary" />
                  <span className="tabular-nums w-8">{scale.toFixed(1)}×</span>
                </div>
              </div>
            </div>
            {showSamplePanel && (
              <SamplePanel value={sampleOverride} onChange={setSampleOverride} onClose={() => setShowSamplePanel(false)} />
            )}
            <div
              className="flex-1 overflow-auto p-8 flex items-start justify-center"
              onPointerDown={() => setSelectedBlockId(null)}
            >
              <div
                ref={canvasWrapRef}
                className="inline-block shadow-[0_12px_40px_rgba(0,0,0,0.08)] ring-1 ring-black/5 rounded-sm overflow-hidden bg-white"
                style={{ width: draft.width_mm * scale, height: draft.height_mm * scale }}
              >
                <LabelRender
                  template={draft}
                  data={sampleData}
                  scale={scale}
                  interactive
                  showGrid={showGrid}
                  selectedId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  onBlockPointerDown={onBlockPointerDown}
                  onResizeHandlePointerDown={onResizeHandlePointerDown}
                />
              </div>
            </div>
            <div className="px-4 py-2 border-t bg-background/60 text-[10.5px] text-muted-foreground flex items-center justify-between gap-3">
              <span>Click en un bloque para seleccionarlo · Arrastrá para mover · Handles azules para redimensionar</span>
              <span className="inline-flex items-center gap-1 text-[10px]">
                <Info className="size-3" />
                Los bloques Nombre/Precio/Código se reemplazan con los datos del producto al imprimir
              </span>
            </div>
          </div>

          {/* RIGHT — propiedades */}
          <aside className="border-l overflow-y-auto">
            {selectedBlock ? (
              <BlockProperties block={selectedBlock} onChange={(patch) => patchBlock(selectedBlock.id, patch)} />
            ) : (
              <TemplateProperties draft={draft} patchDraft={patchDraft} />
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

function round2(n) { return Math.round(Number(n) * 100) / 100 }

function AddBlockMenu({ onAdd }) {
  const [open, setOpen] = useState(false)
  const types = Object.keys(BLOCK_META)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="size-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title="Agregar bloque">
        <Plus className="size-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-20 w-44 rounded-md border bg-popover shadow-md py-1">
            {types.map((t) => {
              const Ico = TYPE_ICONS[t] || Type
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => { onAdd(t); setOpen(false) }}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[12.5px] hover:bg-accent"
                >
                  <Ico className="size-3.5 opacity-70" />
                  {BLOCK_META[t]?.label || t}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Paneles derechos ────────────────────────────────────────────────── */

function TemplateProperties({ draft, patchDraft }) {
  return (
    <div className="p-3 space-y-4 text-[12px]">
      <div>
        <h3 className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Plantilla</h3>
        <Field label="Nombre">
          <input
            className="h-7 w-full rounded-md border bg-background px-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
            value={draft.name || ''}
            onChange={(e) => patchDraft({ name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Field label="Ancho (mm)">
            <NumberInput value={draft.width_mm} min={15} max={200} step={0.1} onChange={(v) => patchDraft({ width_mm: v })} />
          </Field>
          <Field label="Alto (mm)">
            <NumberInput value={draft.height_mm} min={10} max={200} step={0.1} onChange={(v) => patchDraft({ height_mm: v })} />
          </Field>
        </div>
        <Field label="Fondo">
          <ColorInput value={draft.background || '#FFFFFF'} onChange={(v) => patchDraft({ background: v })} />
        </Field>
      </div>

      <div>
        <h3 className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Borde</h3>
        <label className="flex items-center gap-2 text-[12px] mb-2">
          <input type="checkbox" className="size-3.5 accent-primary" checked={!!draft.border?.enabled} onChange={(e) => patchDraft({ border: { ...draft.border, enabled: e.target.checked } })} />
          Mostrar borde
        </label>
        {draft.border?.enabled && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Grosor">
              <NumberInput value={draft.border?.width ?? 0.5} min={0.1} max={4} step={0.1} onChange={(v) => patchDraft({ border: { ...draft.border, width: v } })} />
            </Field>
            <Field label="Color">
              <ColorInput value={draft.border?.color || '#C6C6C7'} onChange={(v) => patchDraft({ border: { ...draft.border, color: v } })} />
            </Field>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Seleccioná un bloque en el canvas o en la lista para editar sus propiedades.
      </p>
    </div>
  )
}

function BlockProperties({ block, onChange }) {
  const label = BLOCK_META[block.type]?.label || block.type
  const hint = BLOCK_HINT[block.type]
  return (
    <div className="p-3 space-y-3 text-[12px]">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</h3>
        </div>
        {hint && (
          <div className="flex gap-2 rounded-md border border-blue-200/60 bg-blue-50/70 dark:bg-blue-950/20 dark:border-blue-900/40 px-2.5 py-1.5 mb-3">
            <Info className="size-3 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <p className="text-[11px] leading-snug text-blue-900 dark:text-blue-200">{hint}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="X (mm)"><NumberInput value={block.x} min={0} step={0.1} onChange={(v) => onChange({ x: v })} /></Field>
          <Field label="Y (mm)"><NumberInput value={block.y} min={0} step={0.1} onChange={(v) => onChange({ y: v })} /></Field>
          <Field label="Ancho"><NumberInput value={block.w} min={1} step={0.1} onChange={(v) => onChange({ w: v })} /></Field>
          <Field label="Alto"><NumberInput value={block.h} min={1} step={0.1} onChange={(v) => onChange({ h: v })} /></Field>
        </div>
      </div>

      {(block.type === 'empresa' || block.type === 'nombre' || block.type === 'codigo' || block.type === 'texto_libre' || block.type === 'precio') && (
        <div>
          <h3 className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Texto</h3>
          {block.type === 'texto_libre' && (
            <Field label="Contenido">
              <input className="h-7 w-full rounded-md border bg-background px-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
                value={block.text || ''}
                onChange={(e) => onChange({ text: e.target.value })}
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tamaño (pt)">
              <NumberInput value={block.fontSize} min={3} max={96} step={0.5} onChange={(v) => onChange({ fontSize: v })} />
            </Field>
            <Field label="Peso">
              <SelectInput value={block.fontWeight || 'normal'} onChange={(v) => onChange({ fontWeight: v })} options={[{ value: 'normal', label: 'Regular' }, { value: 'bold', label: 'Bold' }]} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Field label="Alineación">
              <SelectInput value={block.align || 'left'} onChange={(v) => onChange({ align: v })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centrado' }, { value: 'right', label: 'Derecha' }]} />
            </Field>
            <Field label="Color"><ColorInput value={block.color || '#141417'} onChange={(v) => onChange({ color: v })} /></Field>
          </div>
          {block.type === 'nombre' && (
            <div className="mt-2">
              <Field label="Líneas máximas">
                <NumberInput value={block.maxLines || 2} min={1} max={6} step={1} onChange={(v) => onChange({ maxLines: Math.max(1, Math.floor(v)) })} />
              </Field>
            </div>
          )}
        </div>
      )}

      {block.type === 'precio' && (
        <div>
          <h3 className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Etiqueta «PRECIO:»</h3>
          <label className="flex items-center gap-2 mb-2">
            <input type="checkbox" className="size-3.5 accent-primary" checked={block.showLabel !== false} onChange={(e) => onChange({ showLabel: e.target.checked })} />
            Mostrar etiqueta
          </label>
          {block.showLabel !== false && (
            <>
              <Field label="Texto"><input className="h-7 w-full rounded-md border bg-background px-2 text-[12px] outline-none focus:ring-1 focus:ring-ring" value={block.labelText || 'PRECIO:'} onChange={(e) => onChange({ labelText: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Field label="Tamaño (pt)"><NumberInput value={block.labelFontSize || 7.5} min={3} max={64} step={0.5} onChange={(v) => onChange({ labelFontSize: v })} /></Field>
                <Field label="Color"><ColorInput value={block.labelColor || '#141417'} onChange={(v) => onChange({ labelColor: v })} /></Field>
              </div>
            </>
          )}
        </div>
      )}

      {block.type === 'codigo_barras' && (
        <div>
          <h3 className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Código de barras</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Color de barras"><ColorInput value={block.barColor || '#000000'} onChange={(v) => onChange({ barColor: v })} /></Field>
            <Field label="Fondo"><ColorInput value={block.background || '#FFFFFF'} onChange={(v) => onChange({ background: v })} /></Field>
          </div>
        </div>
      )}

      {block.type === 'separador' && (
        <div>
          <h3 className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Línea</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Grosor"><NumberInput value={block.thickness || 0.5} min={0.1} max={4} step={0.1} onChange={(v) => onChange({ thickness: v })} /></Field>
            <Field label="Color"><ColorInput value={block.color || '#C6C6C7'} onChange={(v) => onChange({ color: v })} /></Field>
          </div>
        </div>
      )}

      {block.type === 'logo' && (
        <div className="text-[11.5px] text-muted-foreground leading-relaxed">
          Se usará el logo configurado en <span className="text-foreground">Configuración → Workspace</span>. Si no hay logo, se muestra un marcador de posición.
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-0.5">
      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

/**
 * Input numérico con estado local. Permite edición libre (borrar todo y
 * volver a tipear, valores menores al min temporalmente, etc.) y sólo
 * valida en `blur` — así bajar un tamaño de 12 a 4 escribiendo «4»
 * funciona aun si el nuevo min es 3.
 */
function NumberInput({ value, onChange, min, max, step = 1 }) {
  const [local, setLocal] = useState(() => (value == null ? '' : String(value)))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setLocal(value == null ? '' : String(value))
  }, [value])
  return (
    <input
      type="number"
      inputMode="decimal"
      className="h-7 w-full rounded-md border bg-background px-2 text-[12px] tabular-nums outline-none focus:ring-1 focus:ring-ring"
      value={local}
      min={min}
      max={max}
      step={step}
      onFocus={() => { focused.current = true }}
      onChange={(e) => {
        const raw = e.target.value
        setLocal(raw)
        if (raw === '' || raw === '-' || raw === '.') return
        const v = Number(raw)
        if (Number.isFinite(v)) onChange?.(v)
      }}
      onBlur={() => {
        focused.current = false
        const v = Number(local)
        if (!Number.isFinite(v)) { setLocal(value == null ? '' : String(value)); return }
        let clamped = v
        if (min != null && clamped < min) clamped = min
        if (max != null && clamped > max) clamped = max
        if (clamped !== v) { setLocal(String(clamped)); onChange?.(clamped) }
      }}
    />
  )
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/

function normalizeHex(raw) {
  const s = String(raw || '').trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null
  return `#${s.toUpperCase()}`
}

function ColorInput({ value, onChange }) {
  const [local, setLocal] = useState(() => String(value || '#000000'))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setLocal(String(value || '#000000'))
  }, [value])
  const picker = HEX_RE.test(local) ? (local.startsWith('#') ? local : `#${local}`) : '#000000'
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        className="h-7 w-9 rounded border cursor-pointer bg-background"
        value={picker}
        onChange={(e) => {
          const v = e.target.value.toUpperCase()
          setLocal(v); onChange?.(v)
        }}
      />
      <input
        type="text"
        className="h-7 flex-1 rounded-md border bg-background px-2 text-[11.5px] font-mono outline-none focus:ring-1 focus:ring-ring"
        value={local}
        onFocus={() => { focused.current = true }}
        onChange={(e) => {
          setLocal(e.target.value)
          const norm = normalizeHex(e.target.value)
          if (norm) onChange?.(norm)
        }}
        onBlur={() => {
          focused.current = false
          const norm = normalizeHex(local)
          if (norm) { setLocal(norm); onChange?.(norm) }
          else setLocal(String(value || '#000000'))
        }}
        placeholder="#RRGGBB"
        spellCheck={false}
      />
    </div>
  )
}

/**
 * Panel para editar los datos de muestra del preview. Sólo afecta cómo se
 * ve la etiqueta en el editor; el PDF final siempre usa los datos del
 * producto real al imprimir.
 */
function SamplePanel({ value, onChange, onClose }) {
  const patch = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="border-b bg-blue-50/40 dark:bg-blue-950/10 px-4 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-widest text-blue-900/80 dark:text-blue-200/80">
          <Beaker className="size-3" />
          Previsualización con datos de ejemplo
        </div>
        <div className="flex items-center gap-1">
          {SAMPLE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.data)}
              className="text-[10.5px] rounded px-1.5 py-0.5 text-blue-900/80 dark:text-blue-200/80 hover:bg-blue-100/70 dark:hover:bg-blue-900/30"
            >
              {p.label}
            </button>
          ))}
          <button type="button" onClick={onClose} className="size-5 inline-flex items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-900/80 dark:text-blue-200/80 ml-1">
            <X className="size-3" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-[11px]">
        <SampleField label="Empresa" value={value.empresa} onChange={(v) => patch('empresa', v)} />
        <SampleField label="Nombre" value={value.nombre} onChange={(v) => patch('nombre', v)} />
        <SampleField label="Precio" value={value.precio} onChange={(v) => patch('precio', v)} />
        <SampleField label="Código" value={value.codigo} onChange={(v) => patch('codigo', v)} />
      </div>
      <p className="text-[10px] text-blue-900/60 dark:text-blue-200/60 mt-1.5">
        Estos valores solo afectan la vista previa. Al imprimir, cada etiqueta usa los datos del producto real.
      </p>
    </div>
  )
}

function SampleField({ label, value, onChange }) {
  return (
    <div className="space-y-0.5">
      <label className="text-[9.5px] font-medium uppercase tracking-wider text-blue-900/70 dark:text-blue-200/70">{label}</label>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-full rounded border border-blue-200 bg-white/80 dark:bg-zinc-900/60 dark:border-blue-900/40 px-1.5 text-[11px] outline-none focus:ring-1 focus:ring-blue-300"
      />
    </div>
  )
}

function SelectInput({ value, onChange, options }) {
  return (
    <select className="h-7 w-full rounded-md border bg-background px-1.5 text-[12px] outline-none focus:ring-1 focus:ring-ring" value={value} onChange={(e) => onChange?.(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
