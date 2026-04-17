import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ListChecks, Sparkles, Settings2, X } from 'lucide-react'
import { TagGlyph } from '@/components/TagGlyph'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import {
  notionColorDotClass,
  notionPastelSelectPillClasses,
  normalizeNotionColorKey,
} from '@/lib/propertyTokens'

/**
 * Selector de propiedades estilo Notion para el drawer de inventario.
 *
 * Visualmente se presenta como un **bloque-trigger compacto** con resumen
 * (regla activa + chips de tags seleccionados). Al abrirlo se muestra un
 * modal centrado con el editor completo (igual que antes).
 *
 * Dos modos internos:
 *  - Modo libre (sin `ruleId`): se muestran todos los grupos/opciones.
 *  - Modo regla: el ancla queda fija, y solo se ven los grupos del scope con
 *    las opciones que aparecen como companion en alguna fila de la regla.
 */
export function InventoryPropertyEditor({ ruleId, tagsByGroup, onChange }) {
  const [rules, setRules] = useState([])
  const [groups, setGroups] = useState([])
  const [ruleDetail, setRuleDetail] = useState(null)
  const [ruleDetailLoading, setRuleDetailLoading] = useState(false)
  const [rulePopoverOpen, setRulePopoverOpen] = useState(false)
  const [openGroupId, setOpenGroupId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const safeTags = tagsByGroup && typeof tagsByGroup === 'object' ? tagsByGroup : {}

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const [rs, gs] = await Promise.all([
          window.bazar?.db?.listInvPricingRules?.() ?? [],
          window.bazar?.db?.getTagGroupsForProduct?.() ?? [],
        ])
        if (cancel) return
        setRules(Array.isArray(rs) ? rs.filter((r) => r.active && r.row_count > 0) : [])
        setGroups(Array.isArray(gs) ? gs : [])
      } catch {
        if (!cancel) {
          setRules([])
          setGroups([])
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!ruleId) {
      setRuleDetail(null)
      return
    }
    let cancel = false
    setRuleDetailLoading(true)
    void (async () => {
      try {
        const d = await window.bazar?.db?.getInvPricingRule?.({ id: ruleId })
        if (!cancel) setRuleDetail(d ?? null)
      } catch {
        if (!cancel) setRuleDetail(null)
      } finally {
        if (!cancel) setRuleDetailLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [ruleId])

  /**
   * Cuando la regla cargada cambia: fijar el ancla en la selección y purgar
   * todo lo que no entre dentro del scope o de los companions de la regla.
   */
  useEffect(() => {
    if (!ruleDetail) return
    const anchorGid = ruleDetail.anchor_group_id
    const anchorOid = ruleDetail.anchor_option_id
    const scopeGids = new Set(
      ruleDetail.scope_all
        ? groups.map((g) => g.id).filter((id) => id !== anchorGid)
        : (ruleDetail.scopeGroupIds || []).filter((id) => id !== anchorGid),
    )
    const companionByGroup = buildCompanionMap(ruleDetail, groups)
    const next = {}
    if (anchorGid && anchorOid) next[anchorGid] = anchorOid
    for (const gid of Object.keys(safeTags)) {
      const g = Number(gid)
      if (g === anchorGid) continue
      if (!scopeGids.has(g)) continue
      const validSet = companionByGroup.get(g) || new Set()
      const o = Number(safeTags[gid])
      if (validSet.has(o)) next[g] = o
    }
    const prevKey = JSON.stringify(
      Object.keys(safeTags)
        .map(Number)
        .sort((a, b) => a - b)
        .reduce((acc, k) => ((acc[k] = safeTags[k]), acc), {}),
    )
    const nextKey = JSON.stringify(
      Object.keys(next)
        .map(Number)
        .sort((a, b) => a - b)
        .reduce((acc, k) => ((acc[k] = next[k]), acc), {}),
    )
    if (prevKey !== nextKey) onChange?.({ ruleId, tagsByGroup: next })
  }, [ruleDetail, groups]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleGroups = useMemo(() => {
    if (!ruleDetail) {
      return { anchor: null, rest: groups }
    }
    const anchorGid = ruleDetail.anchor_group_id
    const anchorGroup = groups.find((g) => g.id === anchorGid) || null
    const companionByGroup = buildCompanionMap(ruleDetail, groups)
    const scopeIds = ruleDetail.scope_all
      ? groups.map((g) => g.id).filter((id) => id !== anchorGid)
      : (ruleDetail.scopeGroupIds || []).filter((id) => id !== anchorGid)
    const rest = scopeIds
      .map((gid) => {
        const g = groups.find((gg) => gg.id === gid)
        if (!g) return null
        const companions = companionByGroup.get(gid)
        const options = companions
          ? (g.options || []).filter((o) => companions.has(o.id))
          : g.options || []
        return { ...g, options }
      })
      .filter(Boolean)
    return { anchor: anchorGroup, rest }
  }, [groups, ruleDetail])

  const setGroupValue = useCallback(
    (gid, oid) => {
      const next = { ...safeTags }
      if (oid == null || oid === 0 || oid === '') delete next[gid]
      else next[gid] = Number(oid)
      onChange?.({ ruleId: ruleId || null, tagsByGroup: next })
    },
    [safeTags, onChange, ruleId],
  )

  const handleRuleChange = (nextRuleId) => {
    if (nextRuleId === ruleId) return
    if (!nextRuleId) {
      onChange?.({ ruleId: null, tagsByGroup: safeTags })
      return
    }
    onChange?.({ ruleId: Number(nextRuleId), tagsByGroup: safeTags })
  }

  const activeRule = rules.find((r) => r.id === ruleId) || null

  /* -------- compact summary (trigger) -------- */

  const summaryChips = useMemo(() => {
    const chips = []
    for (const g of groups) {
      const oid = Number(safeTags[g.id])
      if (!oid) continue
      const opt = (g.options || []).find((o) => Number(o.id) === oid)
      if (!opt) continue
      chips.push({
        groupId: g.id,
        groupName: g.name,
        optionId: opt.id,
        label: opt.name,
        icon: opt.tag_icon,
        color: normalizeNotionColorKey(opt.notion_color, 'default'),
        isAnchor: ruleDetail && g.id === ruleDetail.anchor_group_id,
      })
    }
    return chips
  }, [groups, safeTags, ruleDetail])

  const selectedCount = summaryChips.length
  const hasAnything = Boolean(activeRule || selectedCount > 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={cn(
          'group/trigger flex w-full flex-col gap-1.5 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors',
          'hover:border-foreground/20 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground/80 group-hover/trigger:text-foreground/80">
            {activeRule ? (
              <Sparkles className="size-3.5" strokeWidth={1.8} />
            ) : (
              <Settings2 className="size-3.5" strokeWidth={1.8} />
            )}
          </span>
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Propiedades
          </span>
          {activeRule ? (
            <span className="ml-1 inline-flex items-center gap-1 truncate rounded-full bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-medium text-primary">
              <ListChecks className="size-3 shrink-0" strokeWidth={2} />
              <span className="truncate max-w-[120px]">{activeRule.name}</span>
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-1 text-[10.5px] text-muted-foreground/70 group-hover/trigger:text-foreground/80">
            {hasAnything ? (
              <>
                {selectedCount > 0 && (
                  <span className="tabular-nums">
                    {selectedCount} {selectedCount === 1 ? 'propiedad' : 'propiedades'}
                  </span>
                )}
                <span className="opacity-60">· Editar</span>
              </>
            ) : (
              <span className="text-primary/80">+ Elegir</span>
            )}
          </span>
        </div>

        {selectedCount > 0 ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {summaryChips.slice(0, 8).map((c) => (
              <span
                key={`${c.groupId}-${c.optionId}`}
                className={cn(
                  'inline-flex max-w-[180px] items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                  notionPastelSelectPillClasses(c.color, true),
                )}
                title={`${c.groupName}: ${c.label}`}
              >
                <TagGlyph icon={c.icon} className="size-3 shrink-0" />
                <span className="truncate">{c.label}</span>
                {c.isAnchor && (
                  <span className="shrink-0 rounded-sm bg-primary/20 px-1 text-[8.5px] font-semibold uppercase tracking-wider text-primary">
                    A
                  </span>
                )}
              </span>
            ))}
            {summaryChips.length > 8 && (
              <span className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground">
                +{summaryChips.length - 8}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground/75">
            <span>
              {activeRule
                ? 'Elegí las opciones que aplican a este artículo.'
                : 'Asigná una regla del cuaderno o elegí tags sueltos.'}
            </span>
          </div>
        )}
      </button>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="z-[210] gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="flex flex-row items-start justify-between gap-3 border-b px-5 py-3 text-left">
            <div className="min-w-0">
              <DialogTitle className="text-[14px] font-semibold">Propiedades del artículo</DialogTitle>
              <DialogDescription className="mt-0.5 text-[11.5px]">
                {activeRule
                  ? 'Completá las opciones permitidas por la regla. El precio se autocompleta según el cuaderno.'
                  : 'Elegí las propiedades del artículo. Podés asignar una regla para autocompletar precio.'}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="shrink-0 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          </DialogHeader>

          <div className="flex items-center gap-2 border-b bg-muted/20 px-5 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3" strokeWidth={2} />
              Regla
            </div>
            <Popover open={rulePopoverOpen} onOpenChange={setRulePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'ml-auto inline-flex max-w-[60%] items-center gap-1.5 rounded-md border border-transparent bg-card px-2.5 py-1 text-[12px] shadow-sm transition-colors hover:bg-muted/40',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  {activeRule ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 truncate font-medium text-foreground">
                      <ListChecks className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                      <span className="truncate">{activeRule.name}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="inline-block size-1.5 rounded-full bg-muted-foreground/50" />
                      Modo libre
                    </span>
                  )}
                  <ChevronDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent className="z-[260] w-[min(100vw-1.5rem,320px)] p-0" align="end" sideOffset={4}>
                <Command>
                  <CommandInput placeholder="Buscar regla…" className="h-10 text-[13px]" />
                  <CommandList className="max-h-[260px]">
                    <CommandEmpty className="py-6 text-[12.5px]">Ninguna regla coincide.</CommandEmpty>
                    <CommandGroup heading="Modo">
                      <CommandItem
                        value="libre"
                        onSelect={() => {
                          handleRuleChange(null)
                          setRulePopoverOpen(false)
                        }}
                        className="gap-2"
                      >
                        <span className="inline-block size-1.5 rounded-full bg-muted-foreground/60" />
                        <span className="text-[13px]">Modo libre · elegir tags sueltos</span>
                        {!ruleId ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
                      </CommandItem>
                    </CommandGroup>
                    {rules.length > 0 ? (
                      <CommandGroup heading="Reglas activas">
                        {rules.map((r) => {
                          const active = r.id === ruleId
                          return (
                            <CommandItem
                              key={r.id}
                              value={`${r.name} ${r.anchor_label}`}
                              onSelect={() => {
                                handleRuleChange(r.id)
                                setRulePopoverOpen(false)
                              }}
                              className="flex-col items-start gap-0.5"
                            >
                              <div className="flex w-full items-center gap-2">
                                <ListChecks className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                                <span className="truncate text-[13px] font-medium">{r.name}</span>
                                {active ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
                              </div>
                              <span className="truncate text-[11px] text-muted-foreground">
                                {r.anchor_label} · {r.row_count} fila{r.row_count === 1 ? '' : 's'}
                                {r.scope_all ? ' · todas las categorías' : ''}
                              </span>
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    ) : null}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="max-h-[60vh] divide-y divide-border/50 overflow-auto">
            {ruleId && ruleDetailLoading ? (
              <div className="px-5 py-6 text-[12.5px] text-muted-foreground">Cargando regla…</div>
            ) : null}

            {visibleGroups.anchor && ruleDetail ? (
              <AnchorRow group={visibleGroups.anchor} rule={ruleDetail} />
            ) : null}

            {visibleGroups.rest.map((g) => {
              const current = safeTags[g.id]
              const hasSelection = current != null && Number(current) > 0
              const selectedOpt = (g.options || []).find((o) => Number(o.id) === Number(current))
              return (
                <PropertyRow
                  key={g.id}
                  group={g}
                  hasSelection={hasSelection}
                  selectedOpt={selectedOpt}
                  open={openGroupId === g.id}
                  onOpenChange={(o) => setOpenGroupId(o ? g.id : null)}
                  onPick={(oid) => {
                    setGroupValue(g.id, oid === Number(current) ? null : oid)
                    setOpenGroupId(null)
                  }}
                  onClear={() => {
                    setGroupValue(g.id, null)
                    setOpenGroupId(null)
                  }}
                />
              )
            })}

            {visibleGroups.rest.length === 0 && !visibleGroups.anchor ? (
              <div className="px-5 py-6 text-center text-[12px] text-muted-foreground">
                No hay propiedades definidas. Creá grupos y tags desde el Cuaderno.
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 border-t bg-muted/10 px-5 py-2.5">
            <span className="text-[11px] text-muted-foreground">
              {selectedCount > 0
                ? `${selectedCount} ${selectedCount === 1 ? 'propiedad seleccionada' : 'propiedades seleccionadas'}`
                : 'Sin propiedades seleccionadas'}
            </span>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-[12px] font-medium text-background hover:bg-foreground/90"
            >
              Listo
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* -------- helpers -------- */

function buildCompanionMap(ruleDetail, groups) {
  const ret = new Map()
  if (!ruleDetail) return ret
  const groupById = new Map((groups || []).map((g) => [g.id, g]))
  const optionGroup = new Map()
  for (const g of groups || []) {
    for (const o of g.options || []) optionGroup.set(o.id, g.id)
  }
  for (const row of ruleDetail.rows || []) {
    for (const oid of row.companionIds || []) {
      const gid = optionGroup.get(Number(oid))
      if (!gid) continue
      if (!groupById.has(gid)) continue
      if (!ret.has(gid)) ret.set(gid, new Set())
      ret.get(gid).add(Number(oid))
    }
  }
  return ret
}

function AnchorRow({ group, rule }) {
  const optionColor = normalizeNotionColorKey(rule.anchor_notion_color, 'default')
  const groupColor = normalizeNotionColorKey(group.notion_color, 'gray')
  return (
    <div className="grid grid-cols-1 gap-2 px-5 py-2.5 sm:grid-cols-[minmax(0,38%)_1fr] sm:items-center sm:gap-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={cn('inline-block size-1.5 shrink-0 rounded-full', notionColorDotClass(groupColor))} />
        <span className="truncate text-[12.5px] text-muted-foreground">{group.name}</span>
        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary">
          Ancla
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-medium',
            notionPastelSelectPillClasses(optionColor, true),
          )}
        >
          <TagGlyph icon={rule.anchor_tag_icon} className="size-3.5 shrink-0" />
          <span className="truncate">{rule.anchor_name}</span>
        </span>
        <span className="text-[10.5px] text-muted-foreground">fijado por la regla</span>
      </div>
    </div>
  )
}

function PropertyRow({ group, hasSelection, selectedOpt, open, onOpenChange, onPick, onClear }) {
  const gc = normalizeNotionColorKey(group.notion_color, 'gray')
  const oc = selectedOpt ? normalizeNotionColorKey(selectedOpt.notion_color, 'default') : 'default'
  return (
    <div className="grid grid-cols-1 gap-2 px-5 py-2.5 sm:grid-cols-[minmax(0,38%)_1fr] sm:items-center sm:gap-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={cn('inline-block size-1.5 shrink-0 rounded-full', notionColorDotClass(gc))} />
        <span className="truncate text-[12.5px] text-muted-foreground">
          {group.name}
          {group.required ? <span className="text-destructive"> *</span> : null}
        </span>
      </div>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex min-h-8 w-full max-w-full items-center justify-between gap-2 rounded-md border border-transparent bg-card px-2 py-1 text-left text-[12.5px] transition-colors hover:bg-muted/40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              {hasSelection && selectedOpt ? (
                <span className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5', notionPastelSelectPillClasses(oc, true))}>
                  <TagGlyph icon={selectedOpt.tag_icon} className="size-3 shrink-0" />
                  <span className="truncate font-medium">{selectedOpt.name}</span>
                </span>
              ) : (
                <span className="truncate text-muted-foreground">Vacío</span>
              )}
            </span>
            <ChevronDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[260] w-[min(100vw-1.5rem,300px)] p-0"
          align="end"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandInput placeholder="Buscar opción…" className="h-9 text-[13px]" />
            <CommandList className="max-h-[220px]">
              <CommandEmpty className="py-5 text-[12.5px]">Ninguna opción coincide.</CommandEmpty>
              <CommandGroup>
                {(group.options || []).length === 0 ? (
                  <div className="px-3 py-4 text-[12px] text-muted-foreground">
                    Esta regla no incluye opciones para esta categoría.
                  </div>
                ) : null}
                {(group.options || []).map((o) => {
                  const active = hasSelection && Number(selectedOpt?.id) === Number(o.id)
                  const color = normalizeNotionColorKey(o.notion_color, 'default')
                  return (
                    <CommandItem
                      key={o.id}
                      value={`${o.name} ${o.id}`}
                      onSelect={() => onPick?.(o.id)}
                      className="gap-2"
                    >
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium', notionPastelSelectPillClasses(color, active))}>
                        <TagGlyph icon={o.tag_icon} className="size-3 shrink-0" />
                        {o.name}
                      </span>
                      {active ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          {hasSelection ? (
            <div className="border-t border-border p-1">
              <button
                type="button"
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={onClear}
              >
                <X className="size-3.5" />
                Quitar selección
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}
