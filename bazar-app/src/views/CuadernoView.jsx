import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { registerCuadernoNavGuard } from '@/lib/cuadernoNavGuard.js'
import { appConfirm } from '@/lib/appConfirm'
import { createPortal } from 'react-dom'
import { FilePlus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CuadernoInvRuleEditorPanel } from '@/components/cuaderno/CuadernoInvRuleEditorPanel.jsx'
import { CuadernoTagNotionProfile } from '@/components/cuaderno/CuadernoTagNotionProfile.jsx'
import { CuadernoDocumentRail } from '@/components/cuaderno/CuadernoDocumentRail.jsx'
import { CuadernoHomePanel } from '@/components/cuaderno/CuadernoHomePanel.jsx'
import { CuadernoTreeAside } from '@/components/cuaderno/CuadernoTreeAside.jsx'
import { PropertyColorPickerButton } from '@/components/properties/PropertyPickers.jsx'
import { normalizeNotionColorKey } from '@/lib/propertyTokens'

function reorderGroups(list, draggedId, targetId) {
  const from = list.findIndex((g) => g.id === draggedId)
  const to = list.findIndex((g) => g.id === targetId)
  if (from < 0 || to < 0 || draggedId === targetId) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  const to2 = next.findIndex((g) => g.id === targetId)
  next.splice(to2, 0, item)
  return next
}

export function CuadernoView() {
  const [groups, setGroups] = useState([])
  const [invRules, setInvRules] = useState([])
  const [loading, setLoading] = useState(true)

  const [openGroupIds, setOpenGroupIds] = useState(() => new Set())

  /** Carpeta seleccionada en el árbol (estilo VS: acciones dependen de la selección). */
  const [selectedGroupId, setSelectedGroupId] = useState(null)

  /** Fila inline: nueva categoría al pie del árbol (mismo nivel que el resto). */
  const [inlineNewGroupOpen, setInlineNewGroupOpen] = useState(false)
  const [inlineGroupName, setInlineGroupName] = useState('')
  const inlineGroupInputRef = useRef(null)

  /** Fila inline: nueva etiqueta dentro de `creatingTagGroupId`. */
  const [creatingTagGroupId, setCreatingTagGroupId] = useState(null)
  const [inlineTagName, setInlineTagName] = useState('')
  const inlineTagInputRef = useRef(null)

  /** Panel central: inicio | regla de inventario | propiedades de etiqueta */
  const [mainCenter, setMainCenter] = useState(() => ({ screen: 'home' }))
  /** Regla abierta en pestaña (como la etiqueta: sigue al ir a Inicio). */
  const [invRuleTabPinned, setInvRuleTabPinned] = useState(null)
  /** Etiqueta abierta en pestaña (sigue visible al ir a Inicio dentro del cuaderno). */
  const [tagTabPinned, setTagTabPinned] = useState(null)

  const [ctxMenu, setCtxMenu] = useState(null)
  const [renameDlg, setRenameDlg] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')

  useEffect(() => {
    if (!renameDlg) return
    setRenameDraft(renameDlg.initialName || '')
  }, [renameDlg])

  /** Selección múltiple de etiquetas (Ctrl/Cmd+clic). */
  const [selectedTagIds, setSelectedTagIds] = useState([])

  const asideRef = useRef(null)
  const treeSearchInputRef = useRef(null)
  const lastLoadedTagKeyRef = useRef('')

  /** Conteo de productos que usan la etiqueta abierta (Notion-style usage). */
  const [tagUsageCount, setTagUsageCount] = useState(null)
  const [tagUsageLoading, setTagUsageLoading] = useState(false)

  const [treeSearch, setTreeSearch] = useState('')
  const [treeSearchOpen, setTreeSearchOpen] = useState(false)
  const [draggingGroupId, setDraggingGroupId] = useState(null)
  const [draggingTagId, setDraggingTagId] = useState(null)
  const [tagOptionSaving, setTagOptionSaving] = useState(false)

  const [groupSheetId, setGroupSheetId] = useState(null)
  const [groupNameDraft, setGroupNameDraft] = useState('')

  const activeTagSheet = useMemo(() => {
    if (mainCenter.screen === 'tag')
      return { groupId: mainCenter.groupId, optionId: mainCenter.optionId }
    if (tagTabPinned) return tagTabPinned
    return null
  }, [mainCenter, tagTabPinned])

  const optSheet =
    mainCenter.screen === 'tag'
      ? { groupId: mainCenter.groupId, optionId: mainCenter.optionId }
      : null
  const [optNameDraft, setOptNameDraft] = useState('')
  const [optColor, setOptColor] = useState('default')
  const [optIcon, setOptIcon] = useState(null)
  const [optActive, setOptActive] = useState(true)

  const isTagDirty = useMemo(() => {
    if (!activeTagSheet) return false
    const g = groups.find((x) => x.id === activeTagSheet.groupId)
    const o = g?.options?.find((x) => x.id === activeTagSheet.optionId)
    if (!o) return false
    return (
      optNameDraft.trim() !== String(o.name || '').trim() ||
      optColor !== normalizeNotionColorKey(o.notion_color, 'default') ||
      optIcon !== (o.tag_icon ?? null) ||
      optActive !== (o.active !== false)
    )
  }, [activeTagSheet, groups, optNameDraft, optColor, optIcon, optActive])

  /** 'module' | 'closeTab' | null */
  const [unsavedKind, setUnsavedKind] = useState(null)
  const unsavedResolveRef = useRef(null)

  const discardTagDraftsFromDb = useCallback(() => {
    if (!activeTagSheet) return
    const g = groups.find((x) => x.id === activeTagSheet.groupId)
    const o = g?.options?.find((x) => x.id === activeTagSheet.optionId)
    if (!o) return
    setOptNameDraft(o.name || '')
    setOptColor(normalizeNotionColorKey(o.notion_color, 'default'))
    setOptIcon(o.tag_icon ?? null)
    setOptActive(o.active !== false)
  }, [activeTagSheet, groups])

  const refresh = useCallback(async () => {
    const db = window.bazar?.db
    if (!db?.getCuadernoTagGroups) {
      setGroups([])
      setInvRules([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const listInv = typeof db.listInvPricingRules === 'function' ? db.listInvPricingRules() : Promise.resolve([])
      const [g, ir] = await Promise.all([db.getCuadernoTagGroups(), listInv])
      setGroups(Array.isArray(g) ? g : [])
      setInvRules(Array.isArray(ir) ? ir : [])
    } catch (e) {
      toast.error(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!inlineNewGroupOpen) return
    const t = requestAnimationFrame(() => inlineGroupInputRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [inlineNewGroupOpen])

  useEffect(() => {
    if (creatingTagGroupId == null) return
    const t = requestAnimationFrame(() => inlineTagInputRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [creatingTagGroupId])

  useEffect(() => {
    if (!treeSearchOpen) return
    const t = requestAnimationFrame(() => treeSearchInputRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [treeSearchOpen])

  useEffect(() => {
    if (!ctxMenu) return
    const onDown = (ev) => {
      if (ev.button !== 0) return
      setCtxMenu(null)
    }
    const onKey = (ev) => {
      if (ev.key === 'Escape') setCtxMenu(null)
    }
    const t = window.setTimeout(() => window.addEventListener('mousedown', onDown), 0)
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [ctxMenu])

  useEffect(() => {
    const el = asideRef.current
    if (!el) return
    const onKey = (e) => {
      if (e.key !== 'Enter') return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      if (t?.closest?.('[data-cuaderno-tree-search]')) return
      if (selectedGroupId == null) return
      if (creatingTagGroupId != null || inlineNewGroupOpen) return
      e.preventDefault()
      setInlineNewGroupOpen(false)
      setInlineGroupName('')
      setInlineTagName('')
      setCreatingTagGroupId(selectedGroupId)
      setGroupExpanded(selectedGroupId, true)
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [selectedGroupId, creatingTagGroupId, inlineNewGroupOpen])

  const groupSheet = groups.find((g) => g.id === groupSheetId) || null

  useEffect(() => {
    if (groupSheet) setGroupNameDraft(groupSheet.name || '')
  }, [groupSheet])

  useEffect(() => {
    if (!activeTagSheet) {
      lastLoadedTagKeyRef.current = ''
      return
    }
    const key = `${activeTagSheet.groupId}:${activeTagSheet.optionId}`
    const g = groups.find((x) => x.id === activeTagSheet.groupId)
    const o = g?.options?.find((x) => x.id === activeTagSheet.optionId)
    if (!o) return
    if (key === lastLoadedTagKeyRef.current && isTagDirty) return
    lastLoadedTagKeyRef.current = key
    setOptNameDraft(o.name || '')
    setOptColor(normalizeNotionColorKey(o.notion_color, 'default'))
    setOptIcon(o.tag_icon ?? null)
    setOptActive(o.active !== false)
  }, [activeTagSheet, groups, isTagDirty])

  useEffect(() => {
    if (!activeTagSheet) return
    if (groups.length === 0) return
    const g = groups.find((x) => x.id === activeTagSheet.groupId)
    const o = g?.options?.find((x) => x.id === activeTagSheet.optionId)
    if (!g || !o) {
      setTagTabPinned(null)
      setMainCenter({ screen: 'home' })
    }
  }, [groups, activeTagSheet])

  /** Carga el conteo de uso cuando cambia la etiqueta abierta. */
  useEffect(() => {
    if (!activeTagSheet) {
      setTagUsageCount(null)
      setTagUsageLoading(false)
      return
    }
    const fn = window.bazar?.db?.countProductsByTagOption
    if (typeof fn !== 'function') {
      setTagUsageCount(null)
      setTagUsageLoading(false)
      return
    }
    let cancelled = false
    setTagUsageLoading(true)
    Promise.resolve(fn(activeTagSheet.optionId))
      .then((n) => {
        if (cancelled) return
        setTagUsageCount(Number.isFinite(Number(n)) ? Number(n) : 0)
      })
      .catch(() => {
        if (cancelled) return
        setTagUsageCount(null)
      })
      .finally(() => {
        if (!cancelled) setTagUsageLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTagSheet])

  useEffect(() => {
    registerCuadernoNavGuard(async () => {
      if (!isTagDirty) return true
      return await new Promise((resolve) => {
        unsavedResolveRef.current = resolve
        setUnsavedKind('module')
      })
    })
    return () => registerCuadernoNavGuard(null)
  }, [isTagDirty])

  useEffect(() => {
    if (selectedGroupId == null) return
    if (!groups.some((g) => g.id === selectedGroupId)) setSelectedGroupId(null)
  }, [groups, selectedGroupId])

  useEffect(() => {
    if (creatingTagGroupId == null) return
    if (!groups.some((g) => g.id === creatingTagGroupId)) setCreatingTagGroupId(null)
  }, [groups, creatingTagGroupId])

  const setGroupExpanded = (id, expanded) => {
    setOpenGroupIds((prev) => {
      const next = new Set(prev)
      if (expanded) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const applyReorder = async (nextList) => {
    const api = window.bazar?.db?.cuadernoReorderTagGroups
    if (typeof api !== 'function') return
    const orderedIds = nextList.map((g) => g.id)
    try {
      await api({ orderedIds })
      setGroups(nextList)
    } catch (e) {
      toast.error(String(e?.message || e))
      void refresh()
    }
  }

  const onDragStart = (e, id) => {
    setDraggingGroupId(id)
    e.dataTransfer.setData('text/cuaderno-group', String(id))
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const moveTagToGroup = async (optionId, targetGroupId) => {
    const api = window.bazar?.db?.cuadernoMoveTagOption
    if (typeof api !== 'function') return
    try {
      await api({ optionId, groupId: targetGroupId })
      toast.success('Etiqueta movida')
      setSelectedTagIds([])
      void refresh()
    } catch (err) {
      toast.error(String(err?.message || err))
    }
  }

  const onDropOnGroup = (e, targetId) => {
    e.preventDefault()
    const tagOne = e.dataTransfer.getData('text/cuaderno-tag')
    if (tagOne) {
      const oid = Number(tagOne)
      if (oid) void moveTagToGroup(oid, targetId)
      return
    }
    const multi = e.dataTransfer.getData('text/cuaderno-tags-multi')
    if (multi) {
      try {
        const ids = JSON.parse(multi)
        if (Array.isArray(ids) && ids.length) {
          void (async () => {
            const api = window.bazar?.db?.cuadernoMoveTagOption
            if (typeof api !== 'function') return
            for (const id of ids) {
              try {
                await api({ optionId: Number(id), groupId: targetId })
              } catch (err) {
                toast.error(String(err?.message || err))
                break
              }
            }
            toast.success('Etiquetas movidas')
            setSelectedTagIds([])
            void refresh()
          })()
        }
      } catch {
        /* noop */
      }
      return
    }
    const raw = e.dataTransfer.getData('text/cuaderno-group')
    const draggedId = Number(raw)
    if (!draggedId || draggedId === targetId) return
    const next = reorderGroups(groups, draggedId, targetId)
    void applyReorder(next)
  }

  const startInlineNewGroup = () => {
    setCreatingTagGroupId(null)
    setInlineTagName('')
    setInlineGroupName('')
    setInlineNewGroupOpen(true)
  }

  const cancelInlineNewGroup = () => {
    setInlineNewGroupOpen(false)
    setInlineGroupName('')
  }

  const submitInlineNewGroup = async () => {
    const name = inlineGroupName.trim()
    if (!name) {
      cancelInlineNewGroup()
      return
    }
    try {
      const add = window.bazar?.db?.cuadernoAddTagGroup
      if (typeof add !== 'function') {
        toast.error('Base de datos no disponible.')
        return
      }
      const res = await add({ name })
      toast.success('Categoría creada')
      cancelInlineNewGroup()
      const newId = res && typeof res === 'object' ? Number(res.id) : null
      await refresh()
      if (newId && Number.isFinite(newId)) {
        setSelectedGroupId(newId)
        setGroupExpanded(newId, true)
      }
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  const startInlineNewTag = () => {
    const gid = selectedGroupId
    if (gid == null) return
    setInlineNewGroupOpen(false)
    setInlineGroupName('')
    setInlineTagName('')
    setCreatingTagGroupId(gid)
    setGroupExpanded(gid, true)
  }

  const cancelInlineNewTag = () => {
    setCreatingTagGroupId(null)
    setInlineTagName('')
  }

  const submitInlineNewTag = async () => {
    const name = inlineTagName.trim()
    const groupId = Number(creatingTagGroupId)
    if (!name) {
      cancelInlineNewTag()
      return
    }
    if (!groupId) return
    try {
      const add = window.bazar?.db?.cuadernoAddTagOption
      if (typeof add !== 'function') {
        toast.error('Base de datos no disponible.')
        return
      }
      await add({ groupId, name })
      toast.success('Etiqueta añadida')
      cancelInlineNewTag()
      void refresh()
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  const saveGroupSheet = async () => {
    if (!groupSheet) return
    const name = groupNameDraft.trim()
    if (!name) return
    const api = window.bazar?.db
    if (!api?.cuadernoRenameTagGroup) {
      toast.error('Base de datos no disponible.')
      return
    }
    try {
      await api.cuadernoRenameTagGroup({ id: groupSheet.id, name })
      toast.success('Categoría actualizada')
      setGroupSheetId(null)
      void refresh()
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  const setGroupColor = async (notionColor) => {
    if (!groupSheet) return
    const api = window.bazar?.db
    if (!api?.cuadernoSetTagGroupStyle) {
      toast.error('Base de datos no disponible.')
      return
    }
    try {
      await api.cuadernoSetTagGroupStyle({ id: groupSheet.id, notionColor })
      void refresh()
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  const deleteGroup = async () => {
    if (!groupSheet) return
    if (!(await appConfirm('¿Eliminar esta categoría y todas sus etiquetas?', { destructive: true, confirmLabel: 'Eliminar' }))) return
    const api = window.bazar?.db
    if (!api?.cuadernoDeleteTagGroup) {
      toast.error('Base de datos no disponible.')
      return
    }
    try {
      await api.cuadernoDeleteTagGroup({ id: groupSheet.id })
      toast.success('Categoría eliminada')
      setGroupSheetId(null)
      void refresh()
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  const saveOptionSheet = async () => {
    if (!activeTagSheet) return false
    if (tagOptionSaving) return false
    const name = optNameDraft.trim()
    if (!name) {
      toast.error('El nombre de la etiqueta es obligatorio')
      return false
    }
    const oid = activeTagSheet.optionId
    const api = window.bazar?.db
    if (!api?.cuadernoRenameTagOption || !api?.cuadernoSetTagOptionStyle || !api?.cuadernoSetTagOptionActive) {
      toast.error('Base de datos no disponible.')
      return false
    }
    setTagOptionSaving(true)
    try {
      await api.cuadernoRenameTagOption({ id: oid, name })
      await api.cuadernoSetTagOptionStyle({
        id: oid,
        notionColor: optColor,
        tagIcon: optIcon,
      })
      await api.cuadernoSetTagOptionActive({ id: oid, active: optActive })
      toast.success('Etiqueta actualizada')
      void refresh()
      return true
    } catch (e) {
      toast.error(String(e?.message || e))
      return false
    } finally {
      setTagOptionSaving(false)
    }
  }

  const deleteOption = async () => {
    if (!activeTagSheet) return
    if (!(await appConfirm('¿Eliminar esta etiqueta?', { destructive: true, confirmLabel: 'Eliminar' }))) return
    const api = window.bazar?.db
    if (!api?.cuadernoDeleteTagOption) {
      toast.error('Base de datos no disponible.')
      return
    }
    try {
      await api.cuadernoDeleteTagOption({ id: activeTagSheet.optionId })
      toast.success('Etiqueta eliminada')
      setTagTabPinned(null)
      setMainCenter({ screen: 'home' })
      void refresh()
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  const goHomeCenter = useCallback(() => {
    setMainCenter({ screen: 'home' })
  }, [])

  const openTagSheet = useCallback((groupId, optionId) => {
    setTagTabPinned({ groupId, optionId })
    setMainCenter({ screen: 'tag', groupId, optionId })
  }, [])

  const resolveUnsaved = useCallback((allow) => {
    const r = unsavedResolveRef.current
    if (!r) return
    unsavedResolveRef.current = null
    setUnsavedKind(null)
    r(allow)
  }, [])

  const tryCloseTagTab = useCallback(async () => {
    if (!isTagDirty) {
      setTagTabPinned(null)
      setMainCenter({ screen: 'home' })
      return
    }
    const allow = await new Promise((resolve) => {
      unsavedResolveRef.current = resolve
      setUnsavedKind('closeTab')
    })
    if (!allow) return
    setTagTabPinned(null)
    setMainCenter({ screen: 'home' })
  }, [isTagDirty])

  const tryCloseInvRuleTab = useCallback(() => {
    setInvRuleTabPinned(null)
    setMainCenter((mc) => (mc.screen === 'invRule' ? { screen: 'home' } : mc))
  }, [])

  const deleteTagById = async (id) => {
    try {
      await window.bazar?.db?.cuadernoDeleteTagOption?.({ id })
      toast.success('Etiqueta eliminada')
      setSelectedTagIds([])
      setTagTabPinned((pin) => (pin && pin.optionId === id ? null : pin))
      setMainCenter((mc) =>
        mc.screen === 'tag' && mc.optionId === id ? { screen: 'home' } : mc,
      )
      void refresh()
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  const deleteSelectedTags = async () => {
    const ids = selectedTagIds.length ? selectedTagIds : []
    if (ids.length === 0) return
    if (!(await appConfirm(`¿Eliminar ${ids.length} etiqueta(s)?`, { destructive: true, confirmLabel: 'Eliminar' }))) return
    for (const id of ids) {
      try {
        await window.bazar?.db?.cuadernoDeleteTagOption?.({ id })
      } catch (e) {
        toast.error(String(e?.message || e))
        void refresh()
        return
      }
    }
    toast.success('Eliminadas')
    setSelectedTagIds([])
    setCtxMenu(null)
    setTagTabPinned((pin) => (pin && ids.includes(pin.optionId) ? null : pin))
    setMainCenter((mc) => {
      if (mc.screen !== 'tag') return mc
      if (ids.includes(mc.optionId)) return { screen: 'home' }
      return mc
    })
    void refresh()
  }

  const onDragStartTag = (e, optionId, dragIds) => {
    setDraggingTagId(optionId)
    e.dataTransfer.effectAllowed = 'move'
    if (dragIds.length > 1) {
      e.dataTransfer.setData('text/cuaderno-tags-multi', JSON.stringify(dragIds))
    } else {
      e.dataTransfer.setData('text/cuaderno-tag', String(optionId))
    }
  }

  const commitRename = async () => {
    if (!renameDlg) return
    const name = renameDraft.trim()
    if (!name) return
    try {
      if (renameDlg.kind === 'tag') {
        await window.bazar?.db?.cuadernoRenameTagOption?.({ id: renameDlg.id, name })
        toast.success('Etiqueta renombrada')
      } else {
        await window.bazar?.db?.cuadernoRenameTagGroup?.({ id: renameDlg.id, name })
        toast.success('Categoría renombrada')
      }
      setRenameDlg(null)
      setCtxMenu(null)
      void refresh()
    } catch (err) {
      toast.error(String(err?.message || err))
    }
  }

  const filteredTree = useMemo(() => {
    const q = treeSearch.trim().toLowerCase()
    const sortOpts = (arr) =>
      [...(arr || [])].sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
    if (!q) {
      return groups.map((group) => ({ group, options: [...(group.options || [])] }))
    }
    const out = []
    for (const group of groups) {
      const gName = String(group.name || '').toLowerCase()
      const raw = group.options || []
      if (gName.includes(q)) {
        out.push({ group, options: sortOpts(raw) })
        continue
      }
      const opts = sortOpts(raw.filter((o) => String(o.name || '').toLowerCase().includes(q)))
      if (opts.length) out.push({ group, options: opts })
    }
    return out
  }, [groups, treeSearch])

  useEffect(() => {
    const q = treeSearch.trim().toLowerCase()
    if (!q) return
    setOpenGroupIds((prev) => {
      const next = new Set(prev)
      for (const group of groups) {
        const gName = String(group.name || '').toLowerCase()
        const raw = group.options || []
        if (gName.includes(q)) {
          next.add(group.id)
          continue
        }
        if (raw.some((o) => String(o.name || '').toLowerCase().includes(q))) next.add(group.id)
      }
      return next
    })
  }, [treeSearch, groups])

  const centerTagLabel = useMemo(() => {
    const ctx =
      mainCenter.screen === 'tag'
        ? { groupId: mainCenter.groupId, optionId: mainCenter.optionId }
        : tagTabPinned
    if (!ctx) return ''
    const g = groups.find((x) => x.id === ctx.groupId)
    const o = g?.options?.find((x) => x.id === ctx.optionId)
    return o?.name ? String(o.name) : 'Etiqueta'
  }, [mainCenter, tagTabPinned, groups])

  const tagTabTitle = tagTabPinned ? (centerTagLabel ? `Etiqueta · ${centerTagLabel}` : 'Etiqueta') : ''

  const invRuleTabTitle = useMemo(() => {
    if (!invRuleTabPinned) return ''
    if (invRuleTabPinned.ruleId == null) return 'Nueva regla'
    const found = invRules.find((x) => x.id === invRuleTabPinned.ruleId)
    return found ? `Regla · ${found.name}` : 'Regla'
  }, [invRuleTabPinned, invRules])

  return (
    <>
      <div data-app-workspace className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
        <CuadernoDocumentRail
          screen={mainCenter.screen}
          onGoHome={goHomeCenter}
          invRulePinned={!!invRuleTabPinned}
          invRuleTitle={invRuleTabTitle}
          onSelectInvRule={() => {
            if (!invRuleTabPinned) return
            setMainCenter({ screen: 'invRule', ruleId: invRuleTabPinned.ruleId })
          }}
          onCloseInvRule={tryCloseInvRuleTab}
          tagPinned={!!tagTabPinned}
          tagTitle={tagTabTitle || centerTagLabel || 'Etiqueta'}
          onSelectTag={() => {
            if (!tagTabPinned) return
            openTagSheet(tagTabPinned.groupId, tagTabPinned.optionId)
          }}
          onCloseTag={() => void tryCloseTagTab()}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <CuadernoTreeAside
            ref={asideRef}
            loading={loading}
            hasGroups={groups.length > 0}
            filteredTree={filteredTree}
            openGroupIds={openGroupIds}
            selectedGroupId={selectedGroupId}
            selectedTagIds={selectedTagIds}
            draggingGroupId={draggingGroupId}
            draggingTagId={draggingTagId}
            treeSearch={treeSearch}
            treeSearchOpen={treeSearchOpen}
            setTreeSearchOpen={setTreeSearchOpen}
            setTreeSearch={setTreeSearch}
            treeSearchInputRef={treeSearchInputRef}
            inlineNewGroupOpen={inlineNewGroupOpen}
            inlineGroupName={inlineGroupName}
            setInlineGroupName={setInlineGroupName}
            inlineGroupInputRef={inlineGroupInputRef}
            creatingTagGroupId={creatingTagGroupId}
            inlineTagName={inlineTagName}
            setInlineTagName={setInlineTagName}
            inlineTagInputRef={inlineTagInputRef}
            onNewCategory={() => {
              setSelectedGroupId(null)
              startInlineNewGroup()
            }}
            onNewTag={startInlineNewTag}
            onClearTreeSearch={() => setTreeSearch('')}
            onChevronClick={(groupId, isOpen) => {
              setSelectedGroupId(groupId)
              setGroupExpanded(groupId, !isOpen)
            }}
            onGroupSummaryClick={(groupId) => setSelectedGroupId(groupId)}
            onDragOver={onDragOver}
            onDropOnGroup={onDropOnGroup}
            onFolderContextMenu={(e, g) => {
              e.preventDefault()
              setCtxMenu({
                kind: 'folder',
                x: e.clientX,
                y: e.clientY,
                groupId: g.id,
                groupName: g.name,
              })
            }}
            onGroupDragStart={onDragStart}
            onGroupDragEnd={() => setDraggingGroupId(null)}
            onTagDragStart={onDragStartTag}
            onTagDragEnd={() => setDraggingTagId(null)}
            onTagClick={(e, g, o) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                setSelectedTagIds((prev) => {
                  const s = new Set(prev)
                  if (s.has(o.id)) s.delete(o.id)
                  else s.add(o.id)
                  return [...s]
                })
                return
              }
              setSelectedTagIds([])
              openTagSheet(g.id, o.id)
            }}
            onTagContextMenu={(e, g, o) => {
              e.preventDefault()
              setCtxMenu({
                kind: 'tag',
                x: e.clientX,
                y: e.clientY,
                groupId: g.id,
                groupName: g.name,
                optionId: o.id,
                optionName: o.name,
              })
            }}
            submitInlineNewTag={submitInlineNewTag}
            cancelInlineNewTag={cancelInlineNewTag}
            submitInlineNewGroup={submitInlineNewGroup}
            cancelInlineNewGroup={cancelInlineNewGroup}
          />

          <main className="order-1 flex min-h-0 min-w-0 flex-1 flex-col bg-background lg:border-r lg:border-border/40 dark:border-zinc-800/60">
            {mainCenter.screen === 'home' ? (
              <CuadernoHomePanel
                loading={loading}
                invRules={invRules}
                onNewRule={() => {
                  setInvRuleTabPinned({ ruleId: null })
                  setMainCenter({ screen: 'invRule', ruleId: null })
                }}
                onOpenRule={(r) => {
                  setInvRuleTabPinned({ ruleId: r.id })
                  setMainCenter({ screen: 'invRule', ruleId: r.id })
                }}
              />
            ) : null}

            {mainCenter.screen === 'invRule' && invRuleTabPinned ? (
              <CuadernoInvRuleEditorPanel
                key={invRuleTabPinned.ruleId == null ? 'inv-rule-new' : `inv-rule-${invRuleTabPinned.ruleId}`}
                ruleId={invRuleTabPinned.ruleId}
                groups={groups}
                onClose={() => setMainCenter({ screen: 'home' })}
                onSaved={async (savedId) => {
                  await refresh()
                  if (savedId != null && Number.isFinite(Number(savedId))) {
                    setInvRuleTabPinned({ ruleId: Number(savedId) })
                    setMainCenter({ screen: 'invRule', ruleId: Number(savedId) })
                  }
                }}
                onDeleted={tryCloseInvRuleTab}
              />
            ) : null}

            {mainCenter.screen === 'tag' && optSheet ? (
              <CuadernoTagNotionProfile
                name={optNameDraft}
                onNameChange={setOptNameDraft}
                icon={optIcon}
                onIconChange={setOptIcon}
                color={optColor}
                onColorChange={setOptColor}
                active={optActive}
                onActiveChange={setOptActive}
                groupName={groups.find((g) => g.id === optSheet.groupId)?.name ?? '—'}
                onGroupClick={() => setGroupSheetId(optSheet.groupId)}
                siblingRows={(groups.find((g) => g.id === optSheet.groupId)?.options || [])
                  .filter((o) => o.id !== optSheet.optionId)
                  .map((o) => ({
                    id: o.id,
                    name: String(o.name || '').trim(),
                    notionColor: normalizeNotionColorKey(o.notion_color, 'default'),
                  }))
                  .filter((o) => o.name)}
                onSiblingClick={(optionId) => {
                  openTagSheet(optSheet.groupId, optionId)
                }}
                onSave={() => void saveOptionSheet()}
                isSaving={tagOptionSaving}
                isDirty={isTagDirty}
                usageCount={tagUsageCount}
                usageLoading={tagUsageLoading}
                onClose={goHomeCenter}
                onDelete={() => void deleteOption()}
              />
            ) : null}
          </main>
        </div>
      </div>

      <Dialog
        open={unsavedKind != null}
        onOpenChange={(open) => {
          if (!open) resolveUnsaved(false)
        }}
      >
        <DialogContent className="z-[240] sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {unsavedKind === 'closeTab' ? '¿Cerrar la pestaña de la etiqueta?' : '¿Salir del Cuaderno sin guardar?'}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed">
              Tenés cambios sin guardar en esta etiqueta. Podés guardarlos, descartarlos o volver para seguir editando.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => resolveUnsaved(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                discardTagDraftsFromDb()
                resolveUnsaved(true)
              }}
            >
              Descartar cambios
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                const ok = await saveOptionSheet()
                if (ok) resolveUnsaved(true)
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDlg != null} onOpenChange={(o) => !o && setRenameDlg(null)}>
        <DialogContent className="z-[220] sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle className="text-[14px]">
              {renameDlg?.kind === 'tag' ? 'Renombrar etiqueta' : 'Renombrar categoría'}
            </DialogTitle>
          </DialogHeader>
          <Input
            className="h-9 text-[13px]"
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void commitRename()}
          />
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setRenameDlg(null)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={() => void commitRename()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ctxMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="menu"
            className="fixed z-[300] min-w-[200px] rounded-md border border-border bg-popover py-1 text-[12px] text-foreground shadow-lg"
            style={{
              left: Math.min(ctxMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 800) - 210),
              top: Math.min(ctxMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 600) - 160),
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {ctxMenu.kind === 'folder' ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    setGroupSheetId(ctxMenu.groupId)
                    setCtxMenu(null)
                  }}
                >
                  Propiedades
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    setRenameDlg({ kind: 'folder', id: ctxMenu.groupId, initialName: ctxMenu.groupName || '' })
                    setCtxMenu(null)
                  }}
                >
                  <Pencil className="size-3.5 opacity-70" />
                  Renombrar
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setCtxMenu(null)
                    void (async () => {
                      if (!(await appConfirm('¿Eliminar esta categoría y todas sus etiquetas?', { destructive: true, confirmLabel: 'Eliminar' }))) return
                      try {
                        await window.bazar?.db?.cuadernoDeleteTagGroup?.({ id: ctxMenu.groupId })
                        toast.success('Categoría eliminada')
                        void refresh()
                      } catch (e) {
                        toast.error(String(e?.message || e))
                      }
                    })()
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Eliminar
                </button>
              </>
            ) : (
              (() => {
                const bulk =
                  selectedTagIds.length > 1 && selectedTagIds.includes(ctxMenu.optionId)
                return (
                  <>
                    {!bulk ? (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
                          onClick={() => {
                            openTagSheet(ctxMenu.groupId, ctxMenu.optionId)
                            setCtxMenu(null)
                          }}
                        >
                          Propiedades
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
                          onClick={() => {
                            setRenameDlg({
                              kind: 'tag',
                              id: ctxMenu.optionId,
                              initialName: ctxMenu.optionName || '',
                            })
                            setCtxMenu(null)
                          }}
                        >
                          <Pencil className="size-3.5 opacity-70" />
                          Renombrar
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (bulk) void deleteSelectedTags()
                        else void deleteTagById(ctxMenu.optionId)
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      {bulk ? `Eliminar ${selectedTagIds.length} etiquetas` : 'Eliminar'}
                    </button>
                  </>
                )
              })()
            )}
          </div>,
          document.body,
        )}

      <Sheet open={groupSheetId != null} onOpenChange={(o) => !o && setGroupSheetId(null)}>
        <SheetContent className="z-[210] w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-left text-[15px]">Categoría</SheetTitle>
            <SheetDescription className="text-left text-[12px]">
              Nombre, color y etiquetas. Los cambios de nombre se guardan al pulsar Guardar.
            </SheetDescription>
          </SheetHeader>
          {groupSheet && (
            <div className="flex flex-col gap-4 px-4 pb-4">
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-medium text-muted-foreground">Nombre</span>
                <Input className="h-9 text-[13px]" value={groupNameDraft} onChange={(e) => setGroupNameDraft(e.target.value)} />
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-muted-foreground">Color</span>
                <PropertyColorPickerButton
                  value={normalizeNotionColorKey(groupSheet.notion_color, 'gray')}
                  onChange={(c) => void setGroupColor(c)}
                  title="Color de la categoría"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit text-[12px]"
                onClick={() => {
                  const id = groupSheet.id
                  setGroupSheetId(null)
                  setSelectedGroupId(id)
                  setCreatingTagGroupId(id)
                  setInlineTagName('')
                  setGroupExpanded(id, true)
                }}
              >
                <FilePlus className="size-3.5" />
                Añadir etiqueta (en línea)
              </Button>
            </div>
          )}
          <SheetFooter className="gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void deleteGroup()}>
              Eliminar categoría
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setGroupSheetId(null)}>
                Cerrar
              </Button>
              <Button type="button" size="sm" onClick={() => void saveGroupSheet()}>
                Guardar nombre
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
