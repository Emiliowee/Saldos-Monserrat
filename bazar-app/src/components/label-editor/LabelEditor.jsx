import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  Eye, EyeOff, Trash2, Copy, RotateCcw, Save, X, Maximize2,
  Building2, ImageIcon, ImagePlus, Type, Tag, Hash, Barcode, TextCursorInput, Minus, CheckCircle2, FilePlus,
  Beaker, Info, Grid3x3, ZoomIn, LayoutTemplate, Sparkles, ChevronDown, Undo2, Redo2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  BLOCK_META,
  cloneTemplate,
  createBlock,
  createDefaultTemplate,
  isBuiltinTemplateId,
} from '@/lib/labelModel'
import { LabelRender } from './LabelRender'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { appConfirm } from '@/lib/appConfirm'
import { releaseModalBodyLocks } from '@/lib/releaseModalBodyLocks'

const MAX_UNDO = 50

const TYPE_ICONS = {
  empresa: Building2,
  logo: ImageIcon,
  imagen_fija: ImagePlus,
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
  { id: 'normal', label: 'Normal', data: { empresa: 'Saldos Monserrat', nombre: 'Blusa manga corta liso', precio: '$350', codigo: 'MSR-0001' } },
  { id: 'largo', label: 'Texto largo', data: { empresa: 'Saldos Monserrat', nombre: 'Vestido estampado flores manga larga con bolsillos', precio: '$1890', codigo: 'MSR-99999' } },
  { id: 'mini', label: 'Precio corto', data: { empresa: 'Saldos Monserrat', nombre: 'Calcetín', precio: '$25', codigo: 'MSR-12' } },
]

const BLOCK_HINT = {
  empresa: 'Texto fijo. Se toma del nombre del workspace (Configuración → Espacio de trabajo).',
  nombre: 'Se reemplaza por el nombre del producto al imprimir cada etiqueta.',
  precio: 'Se reemplaza por el precio del producto, con formato $MXN.',
  codigo: 'Se reemplaza por el código (MSR) del producto.',
  codigo_barras: 'Genera el código de barras Code128 a partir del código del producto.',
  texto_libre: 'Este texto aparece TAL CUAL en todas las etiquetas. Útil para «OFERTA», «DTO.», etc.',
  separador: 'Línea decorativa. Útil para dividir secciones.',
  imagen_fija: 'PNG, JPG o WebP desde tu PC. Misma imagen en todas las etiquetas (marca, sello, icono).',
}

/** Datos fijos para las miniaturas de plantillas: identifican el layout más que los datos reales. */
const THUMBNAIL_DATA = { empresa: 'Saldos', nombre: 'Artículo de ejemplo', precio: '$350', codigo: 'MSR-0001' }

const RIBBON_TABS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'insertar', label: 'Insertar' },
  { id: 'vista', label: 'Vista' },
]

/**
 * Editor completo de plantillas de etiqueta — layout tipo Word/Blender:
 *  - Header con título + acciones globales.
 *  - Ribbon (pestañas Inicio/Insertar/Vista) con grupos y botones amplios.
 *  - Body 3 cols: plantillas (plegable) | canvas | propiedades. Pantalla completa.
 */
export function LabelEditor({ open, onClose, initialTemplateId = null, onDirty }) {
  const [list, setList] = useState({ activeId: null, templates: [] })
  const [, setDraftId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [selectedBlockId, setSelectedBlockId] = useState(null)
  const [dirty, setDirty] = useState(false)
  /** 100 % = misma escala visual que antes con 15 px/mm en el lienzo. */
  const CANVAS_PX_PER_MM_AT_100 = 15
  const [zoomPct, setZoomPct] = useState(100)
  const canvasScale = (zoomPct / 100) * CANVAS_PX_PER_MM_AT_100
  const [showGrid, setShowGrid] = useState(true)
  const [logoPath, setLogoPath] = useState('')
  const [labelLogoOpts, setLabelLogoOpts] = useState({
    labelLogoStyle: 'thermal',
    labelLogoWarmth: 0,
    labelLogoContrast: 100,
    labelLogoSaturation: 100,
  })
  const [busy, setBusy] = useState(false)
  const [sampleOverride, setSampleOverride] = useState(DEFAULT_SAMPLE)
  const [showSamplePanel, setShowSamplePanel] = useState(false)
  const [ribbonTab, setRibbonTab] = useState('inicio')
  /** Plantillas: ocultas por defecto para no comer espacio; se abren con el botón. */
  const [templatesOpen, setTemplatesOpen] = useState(false)
  /** Incrementa al hacer doble clic en «texto libre» en el lienzo → enfocar textarea en el panel. */
  const [textoLibrePulse, setTextoLibrePulse] = useState(0)
  /** Solo para re-leer tamaños de historial (refs) y actualizar UI de deshacer/rehacer. */
  const [histTick, setHistTick] = useState(0)
  const [newTplOpen, setNewTplOpen] = useState(false)
  const [newTplName, setNewTplName] = useState('Nueva plantilla')

  const canvasWrapRef = useRef(null)
  const draftRef = useRef(null)
  const historyRef = useRef({ past: [], future: [] })
  const isApplyingHistoryRef = useRef(false)
  const api = typeof window !== 'undefined' ? window.bazar?.labels : null

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const clearHistory = useCallback(() => {
    historyRef.current = { past: [], future: [] }
    setHistTick((t) => t + 1)
  }, [])

  const snapshotForUndo = useCallback(() => {
    if (isApplyingHistoryRef.current) return
    const d = draftRef.current
    if (!d) return
    historyRef.current.past.push(cloneTemplate(d))
    if (historyRef.current.past.length > MAX_UNDO) historyRef.current.past.shift()
    historyRef.current.future = []
    setHistTick((t) => t + 1)
  }, [])

  const undo = useCallback(() => {
    const { past, future } = historyRef.current
    if (past.length === 0 || !draftRef.current) return
    const cur = cloneTemplate(draftRef.current)
    const prev = past.pop()
    future.push(cur)
    isApplyingHistoryRef.current = true
    setDraft(prev)
    setDirty(true)
    queueMicrotask(() => {
      isApplyingHistoryRef.current = false
    })
    setHistTick((t) => t + 1)
  }, [])

  const onTextoLibreDoubleClick = useCallback((id) => {
    setSelectedBlockId(id)
    setTextoLibrePulse((n) => n + 1)
  }, [])

  const redo = useCallback(() => {
    const { past, future } = historyRef.current
    if (future.length === 0 || !draftRef.current) return
    const cur = cloneTemplate(draftRef.current)
    const next = future.pop()
    past.push(cur)
    isApplyingHistoryRef.current = true
    setDraft(next)
    setDirty(true)
    queueMicrotask(() => {
      isApplyingHistoryRef.current = false
    })
    setHistTick((t) => t + 1)
  }, [])

  /** Arrastre / redimensionado en canvas (debe declararse antes de `patchBlock`). */
  const dragRef = useRef(null)

  const reload = useCallback(async () => {
    if (!api?.list) return
    try {
      const data = await api.list()
      setList(data)
      const startId = initialTemplateId || data.activeId
      const t = data.templates.find((x) => x.id === startId) || data.templates[0]
      if (t) {
        setDraftId(t.id)
        setDraft(cloneTemplate(t))
        setDirty(false)
        clearHistory()
      }
    } catch (e) { toast.error(String(e?.message || e)) }
  }, [api, initialTemplateId, clearHistory])

  useEffect(() => {
    if (!open) return
    void reload()
    const loadLogo = async () => {
      try {
        const s = await window.bazar?.settings?.get?.()
        setLogoPath(String(s?.workspaceLogoPath || ''))
        setLabelLogoOpts({
          labelLogoStyle: s?.labelLogoStyle === 'original' ? 'original' : 'thermal',
          labelLogoWarmth: Number.isFinite(Number(s?.labelLogoWarmth)) ? Number(s.labelLogoWarmth) : 0,
          labelLogoContrast: Number.isFinite(Number(s?.labelLogoContrast)) ? Number(s.labelLogoContrast) : 100,
          labelLogoSaturation: Number.isFinite(Number(s?.labelLogoSaturation)) ? Number(s.labelLogoSaturation) : 100,
        })
      } catch { /* noop */ }
    }
    void loadLogo()
    /* Al volver de Configuración, refrescar ruta del logo para la vista previa */
    const onWinFocus = () => { void loadLogo() }
    window.addEventListener('focus', onWinFocus)
    return () => window.removeEventListener('focus', onWinFocus)
  }, [open, reload])

  useEffect(() => {
    if (!open) releaseModalBodyLocks()
  }, [open])

  useEffect(() => { onDirty?.(dirty) }, [dirty, onDirty])

  const switchToTemplate = useCallback(async (id) => {
    if (dirty) {
      const ok = await appConfirm('Hay cambios sin guardar. ¿Descartar?', { destructive: true, confirmLabel: 'Descartar' })
      if (!ok) return
    }
    const t = list.templates.find((x) => x.id === id)
    if (!t) return
    setDraftId(id)
    setDraft(cloneTemplate(t))
    setSelectedBlockId(null)
    setDirty(false)
    clearHistory()
  }, [dirty, list.templates, clearHistory])

  const patchDraft = useCallback((patch) => {
    snapshotForUndo()
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setDirty(true)
  }, [snapshotForUndo])

  const patchBlock = useCallback((id, patch) => {
    if (!isApplyingHistoryRef.current && dragRef.current == null) {
      snapshotForUndo()
    }
    setDraft((d) => {
      if (!d) return d
      return { ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }
    })
    setDirty(true)
  }, [snapshotForUndo])

  /** Logo en etiqueta: mismos campos que `settings-store` (PDF / vista previa). */
  const patchLabelLogo = useCallback((partial) => {
    setLabelLogoOpts((prev) => ({ ...prev, ...partial }))
    void window.bazar?.settings?.set?.(partial).catch((e) => {
      toast.error(String(e?.message || e))
    })
  }, [])

  const addBlock = useCallback((type) => {
    snapshotForUndo()
    setDraft((d) => {
      if (!d) return d
      const w = Math.min(d.width_mm - 6, 30)
      const h = type === 'imagen_fija' ? Math.min(14, d.height_mm - 6) : 6
      const iw = type === 'imagen_fija' ? Math.min(w, 14) : w
      const block = createBlock(type, { x: 3, y: 3, w: iw, h })
      return { ...d, blocks: [...d.blocks, block] }
    })
    setSelectedBlockId(null)
    setDirty(true)
  }, [snapshotForUndo])

  const removeBlock = useCallback((id) => {
    snapshotForUndo()
    setDraft((d) => d ? { ...d, blocks: d.blocks.filter((b) => b.id !== id) } : d)
    if (selectedBlockId === id) setSelectedBlockId(null)
    setDirty(true)
  }, [selectedBlockId, snapshotForUndo])

  const duplicateBlock = useCallback((id) => {
    snapshotForUndo()
    setDraft((d) => {
      if (!d) return d
      const src = d.blocks.find((b) => b.id === id)
      if (!src) return d
      const copy = { ...src, id: `b_${Date.now()}_${Math.floor(Math.random() * 10000)}`, x: src.x + 2, y: src.y + 2 }
      return { ...d, blocks: [...d.blocks, copy] }
    })
    setDirty(true)
  }, [snapshotForUndo])

  const moveBlock = useCallback((id, dir) => {
    snapshotForUndo()
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
  }, [snapshotForUndo])

  /* ─── Drag & resize ─────────────────────────────────────────────────── */
  const onBlockPointerDown = useCallback((e, block) => {
    if (block.visible === false) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = canvasWrapRef.current?.getBoundingClientRect()
    const d = draftRef.current
    if (!rect || !d) return
    dragRef.current = {
      mode: 'move',
      id: block.id,
      startMouse: { x: e.clientX, y: e.clientY },
      startBlock: { x: block.x, y: block.y, w: block.w, h: block.h },
      scale: rect.width / d.width_mm,
      undoSnapshot: cloneTemplate(d),
    }
  }, [])

  const onResizeHandlePointerDown = useCallback((e, block, corner) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = canvasWrapRef.current?.getBoundingClientRect()
    const d = draftRef.current
    if (!rect || !d) return
    dragRef.current = {
      mode: 'resize',
      corner,
      id: block.id,
      startMouse: { x: e.clientX, y: e.clientY },
      startBlock: { x: block.x, y: block.y, w: block.w, h: block.h },
      scale: rect.width / d.width_mm,
      undoSnapshot: cloneTemplate(d),
    }
  }, [])

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
    const onUp = () => {
      const drag = dragRef.current
      dragRef.current = null
      if (!drag?.undoSnapshot || isApplyingHistoryRef.current) return
      const now = draftRef.current
      if (!now) return
      if (JSON.stringify(drag.undoSnapshot) !== JSON.stringify(now)) {
        historyRef.current.past.push(drag.undoSnapshot)
        if (historyRef.current.past.length > MAX_UNDO) historyRef.current.past.shift()
        historyRef.current.future = []
        setHistTick((t) => t + 1)
      }
    }
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

  const openNewTemplateDialog = () => {
    if (!api?.upsert) return
    setNewTplName('Nueva plantilla')
    setNewTplOpen(true)
  }

  const submitNewTemplate = async () => {
    const name = newTplName.trim()
    if (!name) {
      toast.error('Escribí un nombre para la plantilla.')
      return
    }
    if (!api?.upsert) return
    setNewTplOpen(false)
    setBusy(true)
    try {
      const base = createDefaultTemplate()
      const created = await api.upsert({ ...base, id: undefined, name })
      await reload()
      setDraftId(created.id)
      setDraft(cloneTemplate(created))
      setDirty(false)
      clearHistory()
    } catch (e) {
      toast.error(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const duplicateTemplate = async () => {
    if (!api?.duplicate || !draft) return
    setBusy(true)
    try {
      const copy = await api.duplicate(draft.id)
      await reload()
      setDraftId(copy.id)
      setDraft(cloneTemplate(copy))
      setDirty(false)
      clearHistory()
    } catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const deleteTemplate = async () => {
    if (!api?.remove || !draft) return
    if (isBuiltinTemplateId(draft.id)) {
      toast.error('Las plantillas incluidas con la app no se pueden eliminar.')
      return
    }
    const ok = await appConfirm(`¿Eliminar la plantilla «${draft.name}»?`, { destructive: true, confirmLabel: 'Eliminar' })
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
    const ok = await appConfirm(
      'Se restaurará la plantilla «Estándar bazar» al diseño actual de fábrica. Las demás plantillas incluidas (ticket, góndola, etc.) no se borran.',
      { title: 'Restaurar plantilla', confirmLabel: 'Restaurar' },
    )
    if (!ok) return
    setBusy(true)
    try {
      const data = await api.restoreDefault()
      setList(data)
      const d = data.templates.find((x) => x.id === 'default')
      if (d) {
        setDraftId(d.id)
        setDraft(cloneTemplate(d))
        setDirty(false)
        clearHistory()
      }
      toast.success('Plantilla original restaurada')
    } catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const selectedBlock = useMemo(
    () => (draft?.blocks || []).find((b) => b.id === selectedBlockId) || null,
    [draft, selectedBlockId],
  )

  const hotkeysFilter = useCallback((e) => {
    const t = e?.target
    if (t && typeof t === 'object' && 'closest' in t && typeof t.closest === 'function') {
      if (t.closest('input, textarea, select, [contenteditable="true"], [cmdk-input-wrapper], [data-slot="command-input-wrapper"]')) {
        return false
      }
    }
    return true
  }, [])

  const hotkeysOk = open && Boolean(draft)

  useHotkeys(
    'mod+z',
    (e) => {
      e.preventDefault()
      undo()
    },
    { enabled: hotkeysOk, preventDefault: true, filter: hotkeysFilter },
    [hotkeysOk, undo, hotkeysFilter],
  )
  useHotkeys(
    'mod+shift+z',
    (e) => {
      e.preventDefault()
      redo()
    },
    { enabled: hotkeysOk, preventDefault: true, filter: hotkeysFilter },
    [hotkeysOk, redo, hotkeysFilter],
  )
  useHotkeys(
    'mod+y',
    (e) => {
      e.preventDefault()
      redo()
    },
    { enabled: hotkeysOk, preventDefault: true, filter: hotkeysFilter },
    [hotkeysOk, redo, hotkeysFilter],
  )
  useHotkeys(
    'delete, backspace',
    () => {
      if (!selectedBlockId) return
      removeBlock(selectedBlockId)
    },
    { enabled: hotkeysOk && Boolean(selectedBlockId), filter: hotkeysFilter },
    [hotkeysOk, selectedBlockId, removeBlock, hotkeysFilter],
  )

  if (!open || !draft) return null

  void histTick
  const canUndo = historyRef.current.past.length > 0
  const canRedo = historyRef.current.future.length > 0

  const sampleData = { ...sampleOverride, logoPath, ...labelLogoOpts }
  const handleClose = async () => {
    if (dirty && !(await appConfirm('Hay cambios sin guardar. ¿Cerrar de todas formas?', { destructive: true, confirmLabel: 'Cerrar' }))) return
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-[240] flex flex-col bg-background" data-no-barcode="true">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-border/60 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        {/* ─── Header compacto ────────────────────────────────────────── */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/30 text-foreground/80 dark:bg-zinc-800/50">
              <LayoutTemplate className="size-3.5" strokeWidth={1.6} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[13.5px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
                  Editor de etiqueta
                </h2>
                <span className="shrink-0 text-[11px] text-muted-foreground/80">·</span>
                <span className="truncate text-[12px] font-medium text-muted-foreground/85">
                  {draft.name}
                </span>
                {isBuiltinTemplateId(draft.id) ? (
                  <span className="shrink-0 rounded bg-muted/50 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/85">
                    incl.
                  </span>
                ) : null}
                {list.activeId === draft.id ? (
                  <span className="shrink-0 rounded bg-success/[0.12] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-success dark:text-success-foreground">
                    activa
                  </span>
                ) : null}
              </div>
              <p className="truncate text-[10.5px] leading-tight text-muted-foreground/70">
                {draft.width_mm.toFixed(1)} × {draft.height_mm.toFixed(1)} mm
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {dirty ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700 dark:text-amber-400">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Sin guardar
              </span>
            ) : null}
            <button
              type="button"
              disabled={busy || list.activeId === draft.id}
              onClick={setActive}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-transparent px-2.5 text-[11.5px] font-medium text-foreground/85 transition-colors hover:bg-[#f3f3f2] disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800/60"
            >
              <CheckCircle2 className="size-3.5" strokeWidth={1.75} />
              Usar esta
            </button>
            <button
              type="button"
              disabled={!dirty || busy}
              onClick={saveCurrent}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[11.5px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:pointer-events-none disabled:opacity-40 dark:bg-foreground/92"
            >
              <Save className="size-3.5" strokeWidth={1.75} />
              Guardar
            </button>
            <button
              type="button"
              onClick={() => void handleClose()}
              className="ml-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/75 transition-colors hover:bg-[#f3f3f2] hover:text-foreground dark:hover:bg-zinc-800/60"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* ─── Ribbon (pestañas + grupos de acciones) ─────────────────── */}
        <div className="shrink-0 border-b border-border/60 bg-[#fafaf9] dark:bg-zinc-900/30">
          <div className="flex items-center gap-0.5 px-3 pt-1.5">
            {RIBBON_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRibbonTab(t.id)}
                className={cn(
                  'relative inline-flex h-7 items-center gap-1 rounded-t-md px-2.5 text-[11.5px] font-medium transition-colors',
                  ribbonTab === t.id
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground/75 hover:text-foreground/85',
                  t.id === 'insertar' && draft.blocks.length === 0 && ribbonTab !== 'insertar' && 'ring-2 ring-primary/35 ring-offset-2 ring-offset-background',
                )}
              >
                {t.label}
                {ribbonTab === t.id ? (
                  <span className="absolute -bottom-px left-0 right-0 h-px bg-background" aria-hidden />
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex min-h-[56px] items-stretch gap-0 bg-background">
            {ribbonTab === 'inicio' && (
              <>
                <RibbonGroup label="Plantilla">
                  <RibbonButton
                    icon={<LayoutTemplate className="size-4" strokeWidth={1.5} />}
                    label="Plantillas"
                    onClick={() => setTemplatesOpen((v) => !v)}
                    active={templatesOpen}
                  />
                  <RibbonButton icon={<FilePlus className="size-4" strokeWidth={1.5} />} label="Nueva" onClick={openNewTemplateDialog} disabled={busy} />
                  <RibbonButton icon={<Copy className="size-4" strokeWidth={1.5} />} label="Duplicar" onClick={duplicateTemplate} disabled={busy || !draft.id} />
                  <RibbonButton
                    icon={<Trash2 className="size-4" strokeWidth={1.5} />}
                    label="Eliminar"
                    onClick={deleteTemplate}
                    disabled={busy || isBuiltinTemplateId(draft.id)}
                    destructive
                  />
                </RibbonGroup>
                <RibbonGroup label="Edición">
                  <RibbonButton icon={<Undo2 className="size-4" strokeWidth={1.5} />} label="Deshacer" onClick={undo} disabled={busy || !canUndo} />
                  <RibbonButton icon={<Redo2 className="size-4" strokeWidth={1.5} />} label="Rehacer" onClick={redo} disabled={busy || !canRedo} />
                </RibbonGroup>
                <RibbonGroup label="Estado">
                  <RibbonButton icon={<CheckCircle2 className="size-4" strokeWidth={1.5} />} label="Marcar activa" onClick={setActive} disabled={busy || list.activeId === draft.id} />
                  <RibbonButton icon={<Save className="size-4" strokeWidth={1.5} />} label="Guardar" onClick={saveCurrent} disabled={!dirty || busy} primary />
                </RibbonGroup>
                <RibbonGroup label="Restaurar">
                  <RibbonButton icon={<RotateCcw className="size-4" strokeWidth={1.5} />} label="Original fábrica" onClick={restoreOriginal} disabled={busy} />
                </RibbonGroup>
              </>
            )}
            {ribbonTab === 'insertar' && (
              <RibbonGroup label="Bloques">
                {Object.keys(BLOCK_META).map((type) => {
                  const Ico = TYPE_ICONS[type] || Type
                  return (
                    <RibbonButton
                      key={type}
                      icon={<Ico className="size-4" strokeWidth={1.5} />}
                      label={BLOCK_META[type]?.label || type}
                      onClick={() => addBlock(type)}
                    />
                  )
                })}
              </RibbonGroup>
            )}
            {ribbonTab === 'vista' && (
              <>
                <RibbonGroup label="Canvas">
                  <RibbonToggle
                    icon={<Grid3x3 className="size-4" strokeWidth={1.5} />}
                    label="Rejilla"
                    active={showGrid}
                    onToggle={() => setShowGrid((v) => !v)}
                  />
                  <RibbonToggle
                    icon={<Beaker className="size-4" strokeWidth={1.5} />}
                    label="Datos prueba"
                    active={showSamplePanel}
                    onToggle={() => setShowSamplePanel((v) => !v)}
                  />
                </RibbonGroup>
                <RibbonGroup label="Zoom">
                  <div className="flex items-center gap-2 px-2">
                    <ZoomIn className="size-3.5 text-muted-foreground/80" strokeWidth={1.5} />
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={1}
                      value={zoomPct}
                      onChange={(e) => setZoomPct(Number(e.target.value))}
                      className="w-28 accent-foreground"
                    />
                    <span className="w-10 tabular-nums text-[11px] text-muted-foreground/80">{zoomPct}%</span>
                  </div>
                </RibbonGroup>
              </>
            )}
          </div>
        </div>

        {/* ─── Body ─────────────────────────────────────────────────────── */}
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(200px,240px)_minmax(0,1fr)_minmax(240px,300px)] gap-0">
          {/* LEFT — plantillas (plegable) + lista de bloques */}
          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border/60 bg-[#fafaf9] dark:bg-zinc-900/20">
            <div className="shrink-0 space-y-1.5 border-b border-border/60 px-2.5 py-2">
              <button
                type="button"
                onClick={() => setTemplatesOpen((v) => !v)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left transition-colors',
                  templatesOpen
                    ? 'border-border/70 bg-background shadow-sm'
                    : 'border-transparent bg-background/60 hover:border-border/50 hover:bg-background',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <LayoutTemplate className="size-3.5 shrink-0 text-muted-foreground/80" strokeWidth={1.6} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/75">
                      Plantillas
                    </span>
                    <span className="block truncate text-[11.5px] font-medium text-foreground/90" title={draft.name}>
                      {draft.name}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-[10px] tabular-nums text-muted-foreground/60">{list.templates.length}</span>
                  <ChevronDown
                    className={cn('size-4 text-muted-foreground/70 transition-transform duration-200', templatesOpen && 'rotate-180')}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </span>
              </button>
              {!templatesOpen ? (
                <p className="px-0.5 text-[10px] leading-snug text-muted-foreground/70">
                  Tocá el botón para ver miniaturas y cambiar de plantilla.
                </p>
              ) : null}
            </div>
            {templatesOpen ? (
              <div className="min-h-0 max-h-[min(40vh,320px)] shrink-0 overflow-y-auto overscroll-contain px-2 pb-2 pt-1">
                <div className="flex flex-col gap-1.5">
                  {list.templates.map((t) => (
                    <TemplateThumb
                      key={t.id}
                      template={t}
                      isActive={t.id === list.activeId}
                      isCurrent={t.id === draft.id}
                      isBuiltin={isBuiltinTemplateId(t.id)}
                      compact
                      onSelect={() => {
                        void switchToTemplate(t.id)
                        setTemplatesOpen(false)
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-border/60">
              <div className="flex items-center justify-between px-3 pb-1 pt-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
                  Bloques
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground/65">{draft.blocks.length}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-2.5">
                <div className="flex flex-col gap-px">
                  {draft.blocks.map((b, i) => {
                    const Ico = TYPE_ICONS[b.type] || Type
                    const sel = selectedBlockId === b.id
                    return (
                      <div
                        key={b.id}
                        className={cn(
                          'group/row flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors',
                          sel ? 'bg-[#ebeae8] dark:bg-zinc-800/70' : 'hover:bg-[#f1f0ef] dark:hover:bg-zinc-800/50',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => patchBlock(b.id, { visible: !b.visible })}
                          className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 hover:text-foreground"
                          title={b.visible ? 'Ocultar' : 'Mostrar'}
                        >
                          {b.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedBlockId(b.id)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12px]"
                        >
                          <Ico className="size-3 shrink-0 opacity-70" />
                          <span className={cn('truncate', !b.visible && 'text-muted-foreground line-through')}>
                            {BLOCK_META[b.type]?.label || b.type}
                            {b.type === 'texto_libre' && b.text ? (
                              <span className="text-muted-foreground"> · {String(b.text).slice(0, 14)}</span>
                            ) : null}
                            {b.type === 'imagen_fija' && b.imagePath ? (
                              <span className="text-muted-foreground"> · {String(b.imagePath).replace(/^.*[/\\]/, '').slice(0, 18)}</span>
                            ) : null}
                          </span>
                        </button>
                        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
                          {i > 0 ? (
                            <button type="button" onClick={() => moveBlock(b.id, 'up')} className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-muted/60" title="Subir">↑</button>
                          ) : null}
                          {i < draft.blocks.length - 1 ? (
                            <button type="button" onClick={() => moveBlock(b.id, 'down')} className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-muted/60" title="Bajar">↓</button>
                          ) : null}
                          <button type="button" onClick={() => duplicateBlock(b.id)} className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-muted/60" title="Duplicar">
                            <Copy className="size-3" />
                          </button>
                          <button type="button" onClick={() => removeBlock(b.id)} className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive" title="Eliminar">
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {draft.blocks.length === 0 ? (
                    <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
                      <p>
                        Agregá un bloque desde la pestaña <b className="text-foreground/80">Insertar</b> (arriba en el menú).
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-[11px]"
                        onClick={() => setRibbonTab('insertar')}
                      >
                        Ir a Insertar
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>

          {/* CENTER — canvas */}
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#f5f4f2] dark:bg-zinc-900/50">
            {showSamplePanel ? (
              <SamplePanel value={sampleOverride} onChange={setSampleOverride} onClose={() => setShowSamplePanel(false)} />
            ) : null}
            <div
              className="flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-auto p-6 sm:p-8"
              onPointerDown={() => setSelectedBlockId(null)}
            >
              <div
                ref={canvasWrapRef}
                className="inline-block overflow-hidden rounded-sm bg-white shadow-[0_12px_40px_rgba(0,0,0,0.09)] ring-1 ring-black/5"
                style={{ width: draft.width_mm * canvasScale, height: draft.height_mm * canvasScale }}
              >
                <LabelRender
                  template={draft}
                  data={sampleData}
                  scale={canvasScale}
                  interactive
                  showGrid={showGrid}
                  selectedId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  onBlockPointerDown={onBlockPointerDown}
                  onResizeHandlePointerDown={onResizeHandlePointerDown}
                  onTextoLibreDoubleClick={onTextoLibreDoubleClick}
                />
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1 border-t border-border/60 bg-background/70 px-4 py-1.5 text-[10.5px] text-muted-foreground/75 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="inline-flex items-center gap-1.5">
                <Maximize2 className="size-3 shrink-0" strokeWidth={1.5} />
                <span className="tabular-nums">{draft.width_mm.toFixed(1)} × {draft.height_mm.toFixed(1)} mm</span>
              </span>
              <span className="inline-flex min-w-0 items-start gap-1 sm:items-center">
                <Info className="mt-0.5 size-3 shrink-0 sm:mt-0" strokeWidth={1.5} />
                <span className="leading-snug">Nombre / Precio / Código se reemplazan al imprimir</span>
              </span>
            </div>
          </div>

          {/* RIGHT — propiedades */}
          <aside className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden border-l border-border/60 bg-background">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur">
              <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
                {selectedBlock
                  ? selectedBlock.type === 'logo'
                    ? 'Logo'
                    : selectedBlock.type === 'imagen_fija'
                      ? 'Imagen'
                      : (BLOCK_META[selectedBlock.type]?.label || 'Bloque')
                  : 'Plantilla'}
              </span>
              {selectedBlock ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => removeBlock(selectedBlock.id)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border/70 px-2 text-[10.5px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                    title="Eliminar bloque"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    Eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBlockId(null)}
                    className="text-[10.5px] font-medium text-muted-foreground/75 hover:text-foreground"
                  >
                    Plantilla
                  </button>
                </div>
              ) : null}
            </div>
            {selectedBlock ? (
              <BlockProperties
                block={selectedBlock}
                onChange={(patch) => patchBlock(selectedBlock.id, patch)}
                labelLogoOpts={labelLogoOpts}
                patchLabelLogo={patchLabelLogo}
                textoLibreEditPulse={selectedBlock.type === 'texto_libre' ? textoLibrePulse : 0}
              />
            ) : (
              <TemplateProperties draft={draft} patchDraft={patchDraft} />
            )}
          </aside>
        </div>
      </div>

      <Dialog open={newTplOpen} onOpenChange={setNewTplOpen}>
        <DialogContent className="z-[260] sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="text-[15px]">Nueva plantilla</DialogTitle>
            <DialogDescription className="text-[13px]">
              Elegí un nombre para guardarla en tu lista de plantillas.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newTplName}
            onChange={(e) => setNewTplName(e.target.value)}
            placeholder="Nombre de la plantilla"
            className="h-9 text-[13px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submitNewTemplate()
              }
            }}
          />
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setNewTplOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => void submitNewTemplate()}>
              Crear plantilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function round2(n) { return Math.round(Number(n) * 100) / 100 }

/* ─── Ribbon primitives ────────────────────────────────────────────────── */

function RibbonGroup({ label, children }) {
  return (
    <div className="flex items-stretch border-r border-border/50 last:border-r-0">
      <div className="flex min-w-0 flex-col justify-between px-2 pt-1.5">
        <div className="flex items-center gap-1 px-0.5 py-0.5">{children}</div>
        <p className="px-0.5 pb-1 pt-0.5 text-[9.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/65">
          {label}
        </p>
      </div>
    </div>
  )
}

function RibbonButton({ icon, label, onClick, disabled, destructive, primary, active }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group inline-flex h-[42px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[10.5px] font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-35',
        destructive
          ? 'text-muted-foreground/80 hover:bg-destructive/10 hover:text-destructive'
          : primary
            ? 'text-foreground hover:bg-foreground/[0.06]'
            : active
              ? 'bg-foreground/[0.06] text-foreground'
              : 'text-foreground/85 hover:bg-[#f1f0ef] dark:hover:bg-zinc-800/60',
      )}
    >
      <span
        className={cn(
          'inline-flex size-6 items-center justify-center rounded text-foreground/80 transition-colors',
          primary && 'text-foreground',
        )}
      >
        {icon}
      </span>
      <span className="max-w-[72px] truncate leading-none">{label}</span>
    </button>
  )
}

function RibbonToggle({ icon, label, active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex h-[42px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[10.5px] font-medium transition-colors',
        active
          ? 'bg-foreground/[0.06] text-foreground'
          : 'text-foreground/80 hover:bg-[#f1f0ef] dark:hover:bg-zinc-800/60',
      )}
    >
      <span className="inline-flex size-6 items-center justify-center rounded">{icon}</span>
      <span className="max-w-[72px] truncate leading-none">{label}</span>
    </button>
  )
}

/* ─── Galería / thumbnail ──────────────────────────────────────────────── */

function TemplateThumb({ template, isActive, isCurrent, isBuiltin, onSelect, compact }) {
  /* Miniatura: renderizamos el SVG real a escala muy pequeña, enmarcado. */
  const w = template?.width_mm || 50
  const h = template?.height_mm || 35
  const MAX_W = compact ? 156 : 224
  const MAX_H = compact ? 72 : 108
  const scale = Math.min(MAX_W / w, MAX_H / h)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col gap-1 rounded-md border text-left transition-all',
        compact ? 'p-1.5' : 'gap-1.5 rounded-lg p-2',
        isCurrent
          ? 'border-foreground/40 bg-background shadow-[0_1px_0_rgba(0,0,0,0.03)]'
          : 'border-border/60 bg-background/70 hover:border-border hover:bg-background',
      )}
    >
      <div className={cn('flex items-center justify-center overflow-hidden rounded border border-border/40 bg-[#fafaf9] dark:bg-zinc-900/40', compact ? 'p-1' : 'rounded-md p-1.5')}>
        <div style={{ width: w * scale, height: h * scale }} className="overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
          <LabelRender template={template} data={THUMBNAIL_DATA} scale={scale} />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={cn('min-w-0 flex-1 truncate font-medium leading-tight text-foreground/90', compact ? 'text-[11px]' : 'text-[12px]')}>
          {template.name}
        </span>
        {isBuiltin ? (
          <span className="shrink-0 rounded bg-muted/60 px-1 py-0.5 text-[8.5px] font-medium uppercase tracking-wider text-muted-foreground/80">
            incl.
          </span>
        ) : null}
        {isActive ? (
          <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-success/[0.14] text-success" title="Plantilla activa">
            <Sparkles className="size-2.5" strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <span className={cn('truncate tabular-nums text-muted-foreground/65', compact ? 'text-[10px]' : 'text-[10.5px]')}>
        {w.toFixed(0)} × {h.toFixed(0)} mm · {template.blocks?.length ?? 0} bloques
      </span>
    </button>
  )
}

/* ─── Paneles derechos ─────────────────────────────────────────────────── */

function TemplateProperties({ draft, patchDraft }) {
  return (
    <div className="min-w-0 space-y-5 p-3.5 text-[12px]">
      <section className="space-y-2">
        <Field label="Nombre">
          <input
            className="h-7 w-full rounded-md border border-border/70 bg-background px-2 text-[12px] outline-none transition-colors focus:border-foreground/50 focus:ring-1 focus:ring-ring/30"
            value={draft.name || ''}
            onChange={(e) => patchDraft({ name: e.target.value })}
          />
        </Field>
        <div className="grid min-w-0 grid-cols-2 gap-2">
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
      </section>

      <section className="space-y-2 border-t border-border/50 pt-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">Borde</h3>
        <label className="flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            className="size-3.5 accent-foreground"
            checked={!!draft.border?.enabled}
            onChange={(e) => patchDraft({ border: { ...draft.border, enabled: e.target.checked } })}
          />
          Mostrar borde
        </label>
        {draft.border?.enabled ? (
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <Field label="Grosor">
              <NumberInput value={draft.border?.width ?? 0.5} min={0.1} max={4} step={0.1} onChange={(v) => patchDraft({ border: { ...draft.border, width: v } })} />
            </Field>
            <Field label="Color">
              <ColorInput value={draft.border?.color || '#C6C6C7'} onChange={(v) => patchDraft({ border: { ...draft.border, color: v } })} />
            </Field>
          </div>
        ) : null}
      </section>

      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        Click en un bloque del canvas o de la lista para editar sus propiedades.
      </p>
    </div>
  )
}

function BlockProperties({ block, onChange, labelLogoOpts, patchLabelLogo, textoLibreEditPulse = 0 }) {
  const textoLibreRef = useRef(null)
  const hint = block.type === 'logo' ? null : BLOCK_HINT[block.type] || null

  useEffect(() => {
    if (block.type !== 'texto_libre' || !textoLibreEditPulse) return
    const el = textoLibreRef.current
    if (!el) return
    el.focus()
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [textoLibreEditPulse, block.type, block.id])
  return (
    <div className="min-w-0 space-y-4 p-3.5 text-[12px]">
      {hint ? (
        <div className="flex gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 dark:bg-zinc-900/40">
          <Info className="mt-0.5 size-3 shrink-0 text-muted-foreground/80" strokeWidth={1.75} />
          <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
        </div>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">Posición</h3>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <Field label="X (mm)"><NumberInput value={block.x} min={0} step={0.1} onChange={(v) => onChange({ x: v })} /></Field>
          <Field label="Y (mm)"><NumberInput value={block.y} min={0} step={0.1} onChange={(v) => onChange({ y: v })} /></Field>
          <Field label="Ancho"><NumberInput value={block.w} min={1} step={0.1} onChange={(v) => onChange({ w: v })} /></Field>
          <Field label="Alto"><NumberInput value={block.h} min={1} step={0.1} onChange={(v) => onChange({ h: v })} /></Field>
        </div>
      </section>

      {(block.type === 'empresa' || block.type === 'nombre' || block.type === 'codigo' || block.type === 'texto_libre' || block.type === 'precio') && (
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">Texto</h3>
          {block.type === 'texto_libre' ? (
            <Field label="Contenido (Enter = nueva línea)">
              <textarea
                ref={textoLibreRef}
                rows={5}
                className="min-h-[5.5rem] w-full resize-y rounded-md border border-border/70 bg-background px-2 py-1.5 text-[11px] leading-snug outline-none focus:border-foreground/50 focus:ring-1 focus:ring-ring/30"
                value={block.text || ''}
                onChange={(e) => onChange({ text: e.target.value })}
                spellCheck={false}
              />
            </Field>
          ) : null}
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <Field label="Tamaño (pt)">
              <NumberInput value={block.fontSize} min={3} max={96} step={0.5} onChange={(v) => onChange({ fontSize: v })} />
            </Field>
            <Field label="Peso">
              <SelectInput value={block.fontWeight || 'normal'} onChange={(v) => onChange({ fontWeight: v })} options={[{ value: 'normal', label: 'Regular' }, { value: 'bold', label: 'Bold' }]} />
            </Field>
            <Field label="Alineación">
              <SelectInput value={block.align || 'left'} onChange={(v) => onChange({ align: v })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centrado' }, { value: 'right', label: 'Derecha' }]} />
            </Field>
            <Field label="Color"><ColorInput value={block.color || '#141417'} onChange={(v) => onChange({ color: v })} /></Field>
          </div>
          {block.type === 'nombre' ? (
            <Field label="Líneas máximas">
              <NumberInput value={block.maxLines || 2} min={1} max={6} step={1} onChange={(v) => onChange({ maxLines: Math.max(1, Math.floor(v)) })} />
            </Field>
          ) : null}
          {block.type === 'texto_libre' ? (
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <Field label="Líneas máximas">
                <NumberInput value={block.maxLines ?? 8} min={1} max={20} step={1} onChange={(v) => onChange({ maxLines: Math.max(1, Math.floor(v)) })} />
              </Field>
              <Field label="Interlineado (× altura)">
                <NumberInput value={block.lineHeight ?? 1.2} min={1} max={2.5} step={0.05} onChange={(v) => onChange({ lineHeight: v })} />
              </Field>
            </div>
          ) : null}
        </section>
      )}

      {block.type === 'precio' ? (
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">Etiqueta «PRECIO:»</h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-3.5 accent-foreground"
              checked={block.showLabel !== false}
              onChange={(e) => onChange({ showLabel: e.target.checked })}
            />
            Mostrar etiqueta
          </label>
          {block.showLabel !== false ? (
            <>
              <Field label="Texto">
                <input
                  className="h-7 w-full rounded-md border border-border/70 bg-background px-2 text-[12px] outline-none focus:border-foreground/50 focus:ring-1 focus:ring-ring/30"
                  value={block.labelText || 'PRECIO:'}
                  onChange={(e) => onChange({ labelText: e.target.value })}
                />
              </Field>
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <Field label="Tamaño (pt)"><NumberInput value={block.labelFontSize || 7.5} min={3} max={64} step={0.5} onChange={(v) => onChange({ labelFontSize: v })} /></Field>
                <Field label="Color"><ColorInput value={block.labelColor || '#141417'} onChange={(v) => onChange({ labelColor: v })} /></Field>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {block.type === 'codigo_barras' ? (
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">Código de barras</h3>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <Field label="Color de barras"><ColorInput value={block.barColor || '#000000'} onChange={(v) => onChange({ barColor: v })} /></Field>
            <Field label="Fondo"><ColorInput value={block.background || '#FFFFFF'} onChange={(v) => onChange({ background: v })} /></Field>
          </div>
        </section>
      ) : null}

      {block.type === 'separador' ? (
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">Línea</h3>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <Field label="Grosor"><NumberInput value={block.thickness || 0.5} min={0.1} max={4} step={0.1} onChange={(v) => onChange({ thickness: v })} /></Field>
            <Field label="Color"><ColorInput value={block.color || '#C6C6C7'} onChange={(v) => onChange({ color: v })} /></Field>
          </div>
        </section>
      ) : null}

      {block.type === 'imagen_fija' ? (
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">Archivo</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="h-7 rounded-md border border-border/70 bg-background px-2.5 text-[11.5px] font-medium transition-colors hover:bg-muted/50"
              onClick={async () => {
                const pick = window.bazar?.productImage?.pick
                if (typeof pick !== 'function') {
                  toast.error('Elegir archivo solo está disponible en la app de escritorio.')
                  return
                }
                try {
                  const res = await pick()
                  if (res?.cancelled || !res?.path) return
                  onChange({ imagePath: String(res.path) })
                  toast.success('Imagen asignada al bloque')
                } catch (e) {
                  toast.error(String(e?.message || e))
                }
              }}
            >
              Elegir imagen…
            </button>
            {String(block.imagePath || '').trim() ? (
              <button
                type="button"
                className="h-7 rounded-md border border-border/70 px-2.5 text-[11.5px] text-muted-foreground transition-colors hover:bg-muted/50"
                onClick={() => onChange({ imagePath: '' })}
              >
                Quitar imagen
              </button>
            ) : null}
          </div>
          <Field label="Encaje en el marco">
            <SelectInput
              value={block.objectFit || 'contain'}
              onChange={(v) => onChange({ objectFit: v })}
              options={[
                { value: 'contain', label: 'Entero (contain)' },
                { value: 'cover', label: 'Recortar (cover)' },
              ]}
            />
          </Field>
        </section>
      ) : null}

      {block.type === 'logo' ? (
        <section className="space-y-3 border-t border-border/50 pt-4">
          <Field label="Encaje en el marco">
            <SelectInput
              value={block.objectFit || 'contain'}
              onChange={(v) => onChange({ objectFit: v })}
              options={[
                { value: 'contain', label: 'Entero (contain)' },
                { value: 'cover', label: 'Recortar (cover)' },
              ]}
            />
          </Field>
          <div className="space-y-2 rounded-md border border-border/60 bg-muted/15 p-2.5 dark:bg-zinc-900/35">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Aspecto al imprimir</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  (labelLogoOpts.labelLogoStyle || 'thermal') !== 'original'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/70 text-muted-foreground hover:bg-muted/50',
                )}
                onClick={() => patchLabelLogo({ labelLogoStyle: 'thermal' })}
              >
                Térmica (B/N)
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  labelLogoOpts.labelLogoStyle === 'original'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/70 text-muted-foreground hover:bg-muted/50',
                )}
                onClick={() => patchLabelLogo({ labelLogoStyle: 'original' })}
              >
                Color original
              </button>
            </div>
            <div className="space-y-2 border-t border-border/50 pt-2">
              {(labelLogoOpts.labelLogoStyle || 'thermal') === 'original' ? (
                <>
                  <Collapsible className="group rounded-md border border-border/50">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[10.5px] font-semibold text-foreground outline-none hover:bg-muted/40">
                      <span>Saturación</span>
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.75} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 px-2 pb-2 pt-0">
                      <div className="flex justify-end text-[10px] text-muted-foreground">
                        <span className="tabular-nums">{Number(labelLogoOpts.labelLogoSaturation ?? 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={Number(labelLogoOpts.labelLogoSaturation ?? 100)}
                        onChange={(e) => patchLabelLogo({ labelLogoSaturation: Number(e.target.value) })}
                        className="w-full accent-foreground"
                      />
                      <p className="text-[10px] text-muted-foreground/90">100% = archivo; menos = más gris; más = más intenso.</p>
                    </CollapsibleContent>
                  </Collapsible>
                  <Collapsible className="group rounded-md border border-border/50">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[10.5px] font-semibold text-foreground outline-none hover:bg-muted/40">
                      <span>Contraste</span>
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.75} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 px-2 pb-2 pt-0">
                      <div className="flex justify-end text-[10px] text-muted-foreground">
                        <span className="tabular-nums">{Number(labelLogoOpts.labelLogoContrast ?? 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={70}
                        max={130}
                        value={Number(labelLogoOpts.labelLogoContrast ?? 100)}
                        onChange={(e) => patchLabelLogo({ labelLogoContrast: Number(e.target.value) })}
                        className="w-full accent-foreground"
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </>
              ) : (
                <>
                  <Collapsible className="group rounded-md border border-border/50">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[10.5px] font-semibold text-foreground outline-none hover:bg-muted/40">
                      <span className="min-w-0 leading-tight">Tinte (frío ↔ cálido)</span>
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.75} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 px-2 pb-2 pt-0">
                      <div className="flex justify-end text-[10px] text-muted-foreground">
                        <span className="tabular-nums">{Number(labelLogoOpts.labelLogoWarmth ?? 0)}</span>
                      </div>
                      <input
                        type="range"
                        min={-30}
                        max={30}
                        value={Number(labelLogoOpts.labelLogoWarmth ?? 0)}
                        onChange={(e) => patchLabelLogo({ labelLogoWarmth: Number(e.target.value) })}
                        className="w-full accent-foreground"
                      />
                      <p className="text-[10px] text-muted-foreground/90">Negativo más frío; positivo más cálido / sepia.</p>
                    </CollapsibleContent>
                  </Collapsible>
                  <Collapsible className="group rounded-md border border-border/50">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[10.5px] font-semibold text-foreground outline-none hover:bg-muted/40">
                      <span>Contraste</span>
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.75} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 px-2 pb-2 pt-0">
                      <div className="flex justify-end text-[10px] text-muted-foreground">
                        <span className="tabular-nums">{Number(labelLogoOpts.labelLogoContrast ?? 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={70}
                        max={130}
                        value={Number(labelLogoOpts.labelLogoContrast ?? 100)}
                        onChange={(e) => patchLabelLogo({ labelLogoContrast: Number(e.target.value) })}
                        className="w-full accent-foreground"
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <label className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/75">{label}</label>
      {children}
    </div>
  )
}

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
      className="h-7 w-full rounded-md border border-border/70 bg-background px-2 text-[12px] tabular-nums outline-none focus:border-foreground/50 focus:ring-1 focus:ring-ring/30"
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

/** Hex #rrggbb en minúsculas — formato que Chromium/Electron acepta bien en <input type="color">. */
function toPickerHex(raw) {
  const s = String(raw || '').trim()
  if (!s) return '#000000'
  let m = s.match(/^#?([0-9a-fA-F]{6})$/i)
  if (m) return `#${m[1].toLowerCase()}`
  m = s.match(/^#?([0-9a-fA-F]{3})$/i)
  if (m) {
    const [r, g, b] = m[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return '#000000'
}

function normalizeHex(raw) {
  const s = String(raw || '').trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toUpperCase()}`
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    const [r, g, b] = s.split('')
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return null
}

/**
 * Selector de color: muestra un cuadrado de muestra (el nativo suele verse mal en Windows/Electron).
 * El input type="color" va encima, invisible, dentro de un <label>.
 */
function ColorInput({ value, onChange }) {
  const inputId = useId()
  const pickerHex = useMemo(() => toPickerHex(value), [value])
  const [text, setText] = useState(() => (normalizeHex(value) || pickerHex.toUpperCase()))
  const textFocused = useRef(false)

  useEffect(() => {
    if (!textFocused.current) setText(normalizeHex(value) || toPickerHex(value).toUpperCase())
  }, [value])

  return (
    <div className="color-scheme-light flex min-w-0 items-center gap-2">
      <label
        htmlFor={inputId}
        className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border/80 shadow-sm ring-1 ring-inset ring-black/[0.08] dark:ring-white/10"
        style={{ backgroundColor: pickerHex }}
        title="Elegir color"
      >
        <span className="sr-only">Abrir selector de color</span>
        <input
          id={inputId}
          type="color"
          value={pickerHex}
          onChange={(e) => {
            const next = `#${e.target.value.replace(/^#/, '').toUpperCase()}`
            setText(next)
            onChange?.(next)
          }}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          aria-label="Selector de color"
        />
      </label>
      <input
        type="text"
        className="h-7 min-w-0 flex-1 rounded-md border border-border/70 bg-background px-2 font-mono text-[11.5px] outline-none focus:border-foreground/50 focus:ring-1 focus:ring-ring/30"
        value={text}
        onFocus={() => { textFocused.current = true }}
        onChange={(e) => {
          setText(e.target.value)
          const norm = normalizeHex(e.target.value)
          if (norm) onChange?.(norm)
        }}
        onBlur={() => {
          textFocused.current = false
          const norm = normalizeHex(text)
          if (norm) { setText(norm); onChange?.(norm) }
          else setText(normalizeHex(value) || toPickerHex(value).toUpperCase())
        }}
        placeholder="#RRGGBB"
        spellCheck={false}
      />
    </div>
  )
}

function SamplePanel({ value, onChange, onClose }) {
  const patch = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="border-b border-border/60 bg-background px-4 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
          <Beaker className="size-3" strokeWidth={1.75} />
          Previsualización con datos de ejemplo
        </div>
        <div className="flex items-center gap-1">
          {SAMPLE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.data)}
              className="rounded-md px-1.5 py-0.5 text-[10.5px] text-muted-foreground/80 hover:bg-[#f1f0ef] hover:text-foreground dark:hover:bg-zinc-800/60"
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="ml-1 inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-[#f1f0ef] hover:text-foreground dark:hover:bg-zinc-800/60"
          >
            <X className="size-3" />
          </button>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <SampleField label="Empresa" value={value.empresa} onChange={(v) => patch('empresa', v)} />
        <SampleField label="Nombre" value={value.nombre} onChange={(v) => patch('nombre', v)} />
        <SampleField label="Precio" value={value.precio} onChange={(v) => patch('precio', v)} />
        <SampleField label="Código" value={value.codigo} onChange={(v) => patch('codigo', v)} />
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground/70">
        Los valores solo afectan la vista previa — al imprimir se usan los datos del producto real.
      </p>
    </div>
  )
}

function SampleField({ label, value, onChange }) {
  return (
    <div className="space-y-0.5">
      <label className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">{label}</label>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-full rounded border border-border/70 bg-background px-1.5 text-[11px] outline-none focus:border-foreground/50 focus:ring-1 focus:ring-ring/30"
      />
    </div>
  )
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      className="h-7 w-full rounded-md border border-border/70 bg-background px-1.5 text-[12px] outline-none focus:border-foreground/50 focus:ring-1 focus:ring-ring/30"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  )
}
