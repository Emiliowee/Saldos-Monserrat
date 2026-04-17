import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  CornerDownLeft,
  Layers,
  Plus,
  Search,
  ScrollText,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { cloneComboRows } from '@/lib/cuadernoPriceCombos.js'
import { normalizeNotionColorKey, notionTagChipReadonlyClasses } from '@/lib/propertyTokens'

/** Pie alineado con Inventario (`muted` suave). */
const chromeFooter = 'bg-muted/25'

/** Catálogo plano de opciones disponibles, excluyendo la categoría del ancla. */
function useTagCatalog(groups, anchorGroupId, scopeAll, scopeGroupIds) {
  return useMemo(() => {
    const allowedGroupIds = new Set()
    for (const g of groups || []) {
      if (anchorGroupId != null && g.id === anchorGroupId) continue
      if (!scopeAll && !scopeGroupIds.has(g.id)) continue
      allowedGroupIds.add(g.id)
    }
    const labelById = new Map()
    const colorById = new Map()
    const byGroup = []
    for (const g of groups || []) {
      if (!allowedGroupIds.has(g.id)) continue
      const opts = []
      for (const o of g.options || []) {
        if (!o.active) continue
        const nm = String(o.name || '').trim()
        if (!nm) continue
        labelById.set(o.id, nm)
        colorById.set(o.id, normalizeNotionColorKey(o.notion_color, 'default'))
        opts.push({ id: o.id, name: nm, color: normalizeNotionColorKey(o.notion_color, 'default') })
      }
      if (opts.length) byGroup.push({ groupId: g.id, groupName: String(g.name || ''), options: opts })
    }
    return { labelById, colorById, byGroup, allowedGroupIds }
  }, [groups, anchorGroupId, scopeAll, scopeGroupIds])
}

function TagPill({ name, color = 'default', onRemove, size = 'sm' }) {
  const sz = size === 'xs'
    ? 'h-5 px-1.5 text-[10.5px]'
    : 'h-[1.375rem] px-1.5 text-[11px]'
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1 rounded-[4px] font-medium leading-none',
        notionTagChipReadonlyClasses(color),
        sz,
      )}
    >
      <span className="truncate">{name}</span>
      {onRemove ? (
        <button
          type="button"
          className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px] opacity-60 hover:bg-muted/70 hover:opacity-100 dark:hover:bg-zinc-800/80"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Quitar ${name}`}
        >
          <X className="size-2.5" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </span>
  )
}

/** Picker del tag ancla: buscador, lista agrupada, crear-con-enter y drop desde el árbol. */
function AnchorTagCombobox({ value, valueLabel, valueColor, groups, disabled, onSelect, onOpenChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const flatGroups = useMemo(() => {
    const out = []
    for (const g of groups || []) {
      const gName = String(g.name || '').trim()
      const opts = []
      for (const o of g.options || []) {
        if (!o.active) continue
        const nm = String(o.name || '').trim()
        if (!nm) continue
        opts.push({
          id: o.id,
          name: nm,
          groupId: g.id,
          groupName: gName,
          color: normalizeNotionColorKey(o.notion_color, 'default'),
          q: `${gName} ${nm}`.toLowerCase(),
        })
      }
      if (opts.length) out.push({ groupId: g.id, groupName: gName, options: opts })
    }
    return out
  }, [groups])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return flatGroups
    const res = []
    for (const g of flatGroups) {
      const opts = g.options.filter((o) => o.q.includes(q) || String(o.id) === q)
      if (opts.length) res.push({ ...g, options: opts })
    }
    return res
  }, [flatGroups, query])

  const hasExact = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    for (const g of flatGroups) {
      for (const o of g.options) if (o.name.toLowerCase() === q) return true
    }
    return false
  }, [flatGroups, query])

  useEffect(() => {
    onOpenChange?.(open)
    if (open) {
      const t = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(t)
    } else {
      setQuery('')
    }
  }, [open, onOpenChange])

  const createTag = async (rawName) => {
    const name = String(rawName || '').trim()
    if (!name) return
    const api = window.bazar?.db
    if (!api?.cuadernoAddTagOption || !api?.cuadernoAddTagGroup) {
      toast.error('No se puede crear el tag.')
      return
    }
    try {
      // Si hay una sola categoría disponible, lo crea ahí; si no hay ninguna, crea "Sin categoría".
      let groupId = null
      const firstGroup = (groups || [])[0]
      if (firstGroup) groupId = firstGroup.id
      if (!groupId) {
        const res = await api.cuadernoAddTagGroup({ name: 'Sin categoría' })
        groupId = res?.id ?? null
      }
      if (!groupId) throw new Error('No se pudo determinar la categoría.')
      const created = await api.cuadernoAddTagOption({ groupId, name })
      if (!created?.id) throw new Error('No se creó la etiqueta.')
      toast.success(`Tag «${name}» creado`)
      onSelect({ id: Number(created.id), groupId })
      setOpen(false)
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const raw = e.dataTransfer.getData('text/cuaderno-tag')
    const id = Number(raw)
    if (!id) return
    // Encontrar grupo del tag arrastrado
    for (const g of groups || []) {
      const hit = (g.options || []).find((o) => o.id === id)
      if (hit) {
        onSelect({ id, groupId: g.id })
        setOpen(false)
        return
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('text/cuaderno-tag')) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'link'
              setDragOver(true)
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'group/anchor flex min-h-[1.75rem] w-full max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors',
            'hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none',
            dragOver && 'ring-2 ring-primary/40 ring-offset-0',
            disabled && 'opacity-50',
          )}
        >
          {value ? (
            <TagPill name={valueLabel} color={valueColor} />
          ) : (
            <span className="text-muted-foreground/70">Vacío</span>
          )}
          <ChevronDown className="ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover/anchor:opacity-60" strokeWidth={1.75} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border border-border/60 p-0 shadow-lg"
        align="start"
        sideOffset={6}
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-2">
          <Search className="size-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.75} aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim() && !hasExact) {
                e.preventDefault()
                void createTag(query)
              }
            }}
            placeholder="Buscá o escribí para crear…"
            className="h-6 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-muted-foreground">Sin coincidencias.</p>
          ) : (
            filtered.map((g) => (
              <div key={g.groupId} className="pb-1">
                <p className="px-2.5 pb-0.5 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80">
                  {g.groupName}
                </p>
                <ul>
                  {g.options.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 px-2 py-1 text-left text-[13px] transition-colors',
                          'hover:bg-muted/55 dark:hover:bg-zinc-800/60',
                          value === o.id && 'bg-muted/55',
                        )}
                        onClick={() => {
                          onSelect({ id: o.id, groupId: o.groupId })
                          setOpen(false)
                        }}
                      >
                        <TagPill name={o.name} color={o.color} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        {query.trim() && !hasExact ? (
          <button
            type="button"
            onClick={() => void createTag(query)}
            className="flex w-full items-center gap-2 border-t border-border/60 bg-muted/30 px-3 py-2 text-left text-[12.5px] text-foreground transition-colors hover:bg-muted/55 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/70"
          >
            <Plus className="size-3.5 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              Crear <span className="font-medium">«{query.trim()}»</span>
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10.5px] text-muted-foreground">
              <CornerDownLeft className="size-3" strokeWidth={1.75} aria-hidden /> Enter
            </span>
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

/** Popover de alcance: toggle "todas" y checkboxes por categoría, excluye la del ancla. */
function ScopePopover({ groups, anchorGroupId, scopeAll, scopeGroupIds, onChangeScopeAll, onToggleGroup }) {
  const [open, setOpen] = useState(false)
  const selectableGroups = useMemo(
    () => (groups || []).filter((g) => g.id !== anchorGroupId),
    [groups, anchorGroupId],
  )
  const label = scopeAll
    ? 'Todas las categorías'
    : scopeGroupIds.size === 0
      ? 'Sin categorías'
      : `${scopeGroupIds.size} categoría${scopeGroupIds.size === 1 ? '' : 's'}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/scope flex min-h-[1.75rem] w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none"
        >
          <span className={cn('truncate', !scopeAll && scopeGroupIds.size === 0 && 'text-muted-foreground')}>{label}</span>
          <ChevronDown className="ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover/scope:opacity-60" strokeWidth={1.75} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border border-border/60 p-0 shadow-lg"
        align="start"
        sideOffset={6}
      >
        <button
          type="button"
          onClick={() => onChangeScopeAll(true)}
          className={cn(
            'flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors',
            'hover:bg-muted/55 dark:hover:bg-zinc-800/60',
            scopeAll && 'bg-muted/45',
          )}
        >
          <span>Todas las categorías</span>
          {scopeAll ? <span className="text-[11px] text-muted-foreground">por defecto</span> : null}
        </button>
        <div className="border-t border-border/60 py-1">
          <p className="px-3 pb-1 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80">
            Sólo estas categorías
          </p>
          {selectableGroups.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-muted-foreground">No hay otras categorías.</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto">
              {selectableGroups.map((g) => {
                const checked = !scopeAll && scopeGroupIds.has(g.id)
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (scopeAll) onChangeScopeAll(false)
                        onToggleGroup(g.id)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-muted/55 dark:hover:bg-zinc-800/60"
                    >
                      <span
                        className={cn(
                          'flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[9px]',
                          checked
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-muted-foreground/40 bg-transparent',
                        )}
                        aria-hidden
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <span className="truncate">{g.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Popover multi-select para tags companion en una fila. Respeta alcance. */
function CompanionPicker({ catalog, selectedIds, onToggle, onClear }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) { setQ(''); return }
    const t = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [open])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return catalog.byGroup
    const res = []
    for (const g of catalog.byGroup) {
      const opts = g.options.filter((o) => o.name.toLowerCase().includes(query))
      if (opts.length) res.push({ ...g, options: opts })
    }
    return res
  }, [catalog, q])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 items-center gap-1 rounded-[4px] border border-dashed border-border/70 bg-transparent px-1.5 text-[11px] text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground dark:border-zinc-700 dark:hover:border-zinc-500"
        >
          <Plus className="size-3" strokeWidth={2} aria-hidden />
          Combinación
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border border-border/60 p-0 shadow-lg"
        align="start"
        sideOffset={4}
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-2">
          <Search className="size-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.75} aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar tag…"
            className="h-6 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
          />
          {selectedIds.length ? (
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-muted/55 hover:text-foreground"
            >
              Limpiar
            </button>
          ) : null}
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-muted-foreground">Sin tags disponibles en el alcance.</p>
          ) : (
            filtered.map((g) => (
              <div key={g.groupId} className="pb-1">
                <p className="px-2.5 pb-0.5 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80">
                  {g.groupName}
                </p>
                <ul>
                  {g.options.map((o) => {
                    const on = selectedIds.includes(o.id)
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => onToggle(o.id)}
                          className={cn(
                            'flex w-full items-center gap-2 px-2 py-1 text-left text-[13px] transition-colors',
                            'hover:bg-muted/55 dark:hover:bg-zinc-800/60',
                            on && 'bg-muted/55',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[9px]',
                              on ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground/40',
                            )}
                            aria-hidden
                          >
                            {on ? '✓' : ''}
                          </span>
                          <TagPill name={o.name} color={o.color} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PriceRow({ row, idx, catalog, anchorLabel, anchorColor, onChange, onRemove }) {
  const priceInputRef = useRef(null)
  const selectedTags = useMemo(
    () => (row.companionIds || []).map((id) => ({ id, name: catalog.labelById.get(id) || `#${id}`, color: catalog.colorById.get(id) || 'default' })),
    [row.companionIds, catalog],
  )

  const toggleCompanion = (optId) => {
    const set = new Set(row.companionIds || [])
    if (set.has(optId)) set.delete(optId)
    else set.add(optId)
    onChange({ ...row, companionIds: [...set] })
  }

  return (
    <div className="group/row flex items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-muted/45 dark:hover:bg-zinc-900/50">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {anchorLabel ? <TagPill name={anchorLabel} color={anchorColor} /> : null}
        {selectedTags.map((t) => (
          <TagPill
            key={t.id}
            name={t.name}
            color={t.color}
            onRemove={() => toggleCompanion(t.id)}
          />
        ))}
        <CompanionPicker
          catalog={catalog}
          selectedIds={row.companionIds || []}
          onToggle={toggleCompanion}
          onClear={() => onChange({ ...row, companionIds: [] })}
        />
      </div>
      <div className="flex shrink-0 items-center">
        <span className="select-none pr-1 text-[12px] text-muted-foreground/80 tabular-nums">$</span>
        <input
          ref={priceInputRef}
          type="text"
          inputMode="decimal"
          value={row.price}
          onChange={(e) => onChange({ ...row, price: e.target.value })}
          placeholder="0"
          className="h-7 w-24 rounded-md border-0 bg-transparent text-right text-[13px] tabular-nums outline-none transition-colors focus:bg-muted/50 dark:focus:bg-zinc-800/50"
          aria-label={`Precio fila ${idx + 1}`}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-70 hover:opacity-100 focus-visible:opacity-100 hover:bg-muted/55 hover:text-destructive dark:hover:bg-zinc-800/60"
        aria-label={`Quitar fila ${idx + 1}`}
      >
        <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  )
}

/** Editor de regla de inventario: layout Notion (property rows + sección de precios). */
export function CuadernoInvRuleEditorPanel({ ruleId, groups, onClose, onSaved, onDeleted }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [anchorOptionId, setAnchorOptionId] = useState(null)
  const [scopeAll, setScopeAll] = useState(true)
  const [scopeGroupIds, setScopeGroupIds] = useState(() => new Set())
  const [active, setActive] = useState(true)
  const [rows, setRows] = useState(() => cloneComboRows([{ companionIds: [], price: '' }]))

  const anchorLocation = useMemo(() => {
    if (!anchorOptionId) return { groupId: null, groupName: '', name: '', color: 'default' }
    for (const g of groups || []) {
      const hit = (g.options || []).find((o) => o.id === anchorOptionId)
      if (hit) {
        return {
          groupId: g.id,
          groupName: String(g.name || ''),
          name: String(hit.name || '').trim(),
          color: normalizeNotionColorKey(hit.notion_color, 'default'),
        }
      }
    }
    return { groupId: null, groupName: '', name: `#${anchorOptionId}`, color: 'default' }
  }, [anchorOptionId, groups])

  const catalog = useTagCatalog(groups, anchorLocation.groupId, scopeAll, scopeGroupIds)

  const resetEmpty = useCallback(() => {
    setName('')
    setDescription('')
    setAnchorOptionId(null)
    setScopeAll(true)
    setScopeGroupIds(new Set())
    setActive(true)
    setRows(cloneComboRows([{ companionIds: [], price: '' }]))
  }, [])

  useEffect(() => {
    const api = window.bazar?.db
    if (ruleId == null) {
      resetEmpty()
      setLoading(false)
      return
    }
    if (!api?.getInvPricingRule) return
    setLoading(true)
    void (async () => {
      try {
        const r = await api.getInvPricingRule({ id: ruleId })
        setName(String(r.name || ''))
        setDescription(String(r.notes || ''))
        setAnchorOptionId(Number(r.anchor_option_id) || null)
        setScopeAll(Boolean(r.scope_all))
        setScopeGroupIds(new Set(Array.isArray(r.scopeGroupIds) ? r.scopeGroupIds : []))
        setActive(r.active !== false)
        const nextRows =
          Array.isArray(r.rows) && r.rows.length > 0
            ? cloneComboRows(
                r.rows.map((row) => ({
                  companionIds: Array.isArray(row.companionIds) ? [...row.companionIds] : [],
                  price: row.price == null ? '' : String(row.price),
                })),
              )
            : cloneComboRows([{ companionIds: [], price: '' }])
        setRows(nextRows)
      } catch (e) {
        toast.error(String(e?.message || e))
        onClose?.()
      } finally {
        setLoading(false)
      }
    })()
  }, [ruleId, onClose, resetEmpty])

  /** Si la categoría del ancla quedó seleccionada en el alcance, la quitamos silenciosamente. */
  useEffect(() => {
    if (anchorLocation.groupId == null) return
    if (!scopeGroupIds.has(anchorLocation.groupId)) return
    setScopeGroupIds((prev) => {
      const n = new Set(prev)
      n.delete(anchorLocation.groupId)
      return n
    })
  }, [anchorLocation.groupId, scopeGroupIds])

  /** Limpia companion ids que ya no están en el alcance. */
  useEffect(() => {
    setRows((prev) => {
      const allowed = catalog.labelById
      let changed = false
      const next = prev.map((r) => {
        const filtered = (r.companionIds || []).filter((id) => allowed.has(id))
        if (filtered.length !== (r.companionIds || []).length) { changed = true; return { ...r, companionIds: filtered } }
        return r
      })
      return changed ? next : prev
    })
  }, [catalog])

  const handleSelectAnchor = ({ id }) => { setAnchorOptionId(id) }

  const toggleScopeGroup = (gid) => {
    setScopeGroupIds((prev) => {
      const n = new Set(prev)
      if (n.has(gid)) n.delete(gid)
      else n.add(gid)
      return n
    })
  }

  const addRow = () => { setRows((prev) => [...prev, { companionIds: [], price: '' }]) }
  const updateRow = (idx, next) => { setRows((prev) => prev.map((r, i) => (i === idx ? next : r))) }
  const removeRow = (idx) => {
    setRows((prev) => (prev.length <= 1 ? [{ companionIds: [], price: '' }] : prev.filter((_, i) => i !== idx)))
  }

  const handleSave = async () => {
    const api = window.bazar?.db?.upsertInvPricingRule
    if (typeof api !== 'function') { toast.error('Base de datos no disponible.'); return }
    if (!name.trim()) { toast.error('Ponele un nombre a la regla.'); return }
    if (!anchorOptionId) { toast.error('Elegí el tag ancla.'); return }
    if (!scopeAll && scopeGroupIds.size === 0) { toast.error('Elegí al menos una categoría o usá «Todas».'); return }
    setSaving(true)
    try {
      const res = await api({
        id: ruleId != null ? ruleId : undefined,
        name: name.trim(),
        notes: description.trim() || null,
        anchorOptionId,
        scopeAll,
        scopeGroupIds: scopeAll ? [] : [...scopeGroupIds],
        active,
        rows: rows.map((r) => ({
          companionIds: r.companionIds || [],
          price: String(r.price ?? '').trim() === '' ? null : r.price,
        })),
      })
      toast.success(ruleId != null ? 'Regla actualizada' : 'Regla creada')
      onSaved?.(res?.id)
    } catch (e) {
      toast.error(String(e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (ruleId == null) return
    if (!window.confirm('¿Eliminar esta regla?')) return
    const api = window.bazar?.db?.deleteInvPricingRule
    if (typeof api !== 'function') return
    try {
      await api({ id: ruleId })
      toast.success('Regla eliminada')
      onDeleted?.()
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-[720px] px-6 pb-14 pt-10 sm:px-12">
          {loading ? (
            <p className="py-16 text-center text-[13px] text-muted-foreground">Cargando…</p>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <ScrollText className="size-3.5 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
                <span>Regla de inventario</span>
              </div>

              <div className="mt-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Regla sin título"
                  className="w-full border-0 bg-transparent px-0 py-1 text-left text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-foreground placeholder:text-foreground/25 focus:outline-none focus-visible:ring-0 sm:text-[2.35rem]"
                />
              </div>

              <div className="mt-1">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Agregá una descripción"
                  className="w-full border-0 bg-transparent px-0 py-1 text-left text-[14px] text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-0"
                />
              </div>

              <div className="mt-6 grid grid-cols-[minmax(7.5rem,9rem)_1fr] gap-x-3 gap-y-0.5">
                <PropertyRow icon={<TagIcon className="size-3.5" strokeWidth={1.75} />} label="Tag ancla">
                  <AnchorTagCombobox
                    value={anchorOptionId}
                    valueLabel={anchorLocation.name}
                    valueColor={anchorLocation.color}
                    groups={groups}
                    onSelect={handleSelectAnchor}
                  />
                </PropertyRow>
                <PropertyRow icon={<Layers className="size-3.5" strokeWidth={1.75} />} label="Alcance">
                  <ScopePopover
                    groups={groups}
                    anchorGroupId={anchorLocation.groupId}
                    scopeAll={scopeAll}
                    scopeGroupIds={scopeGroupIds}
                    onChangeScopeAll={setScopeAll}
                    onToggleGroup={toggleScopeGroup}
                  />
                </PropertyRow>
                <PropertyRow icon={<span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />} label="Estado">
                  <button
                    type="button"
                    onClick={() => setActive((v) => !v)}
                    className="flex min-h-[1.75rem] w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-muted/50"
                  >
                    <span className={cn(active ? 'text-foreground' : 'text-muted-foreground')}>{active ? 'Activa' : 'Pausada'}</span>
                  </button>
                </PropertyRow>
              </div>

              {anchorOptionId ? (
                <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  Mientras la regla esté activa, la categoría <span className="font-medium text-foreground/80">{anchorLocation.groupName || '—'}</span> queda fija en el ancla y no aparece al armar combinaciones.
                </p>
              ) : null}

              <div className="mt-10 border-t border-border/60 pt-6">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/90">Precios</h3>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Cada fila define qué otros tags acompañan al ancla y el precio exacto de esa combinación.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-[11.5px] text-muted-foreground hover:text-foreground"
                    onClick={addRow}
                    disabled={!anchorOptionId}
                  >
                    <Plus className="size-3.5" strokeWidth={2} aria-hidden />
                    Nueva fila
                  </Button>
                </div>

                <div className="mt-3">
                  {!anchorOptionId ? (
                    <div className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-[12.5px] text-muted-foreground">
                      Elegí primero el tag ancla para armar las filas.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {rows.map((row, idx) => (
                        <PriceRow
                          key={idx}
                          row={row}
                          idx={idx}
                          catalog={catalog}
                          anchorLabel={anchorLocation.name}
                          anchorColor={anchorLocation.color}
                          onChange={(next) => updateRow(idx, next)}
                          onRemove={() => removeRow(idx)}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={addRow}
                        className="flex w-full items-center gap-1.5 px-1 py-1.5 text-left text-[12.5px] text-muted-foreground/80 transition-colors hover:text-foreground"
                      >
                        <Plus className="size-3.5 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
                        Nueva fila
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={cn('flex shrink-0 items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5', chromeFooter)}>
        <div className="min-w-0">
          {ruleId != null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-[12px] text-destructive hover:text-destructive"
              onClick={() => void handleDelete()}
            >
              <Trash2 className="mr-1 size-3.5" strokeWidth={1.75} aria-hidden />
              Eliminar regla
            </Button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-[12px]" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={loading || saving}
            onClick={() => void handleSave()}
          >
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}

function PropertyRow({ icon, label, children }) {
  return (
    <>
      <div className="flex min-h-[1.75rem] items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-muted-foreground">
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground/80">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </>
  )
}
