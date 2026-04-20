import { forwardRef, useEffect, useState } from 'react'
import {
  ChevronRight,
  FilePlus,
  Folder,
  FolderPlus,
  Search,
  Tag as TagIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TagGlyph } from '@/components/TagGlyph.jsx'
import { notionColorDotClass } from '@/lib/propertyTokens'
import { cn } from '@/lib/utils'

/**
 * Panel derecho del Cuaderno: categorías, búsqueda en árbol, drag & drop, multiselección.
 * Estado y efectos viven en CuadernoView; aquí solo presentación y callbacks.
 */
export const CuadernoTreeAside = forwardRef(function CuadernoTreeAside(
  {
    loading,
    hasGroups,
    filteredTree,
    openGroupIds,
    selectedGroupId,
    selectedTagIds,
    draggingGroupId,
    draggingTagId,
    treeSearch,
    treeSearchOpen,
    setTreeSearchOpen,
    setTreeSearch,
    treeSearchInputRef,
    inlineNewGroupOpen,
    inlineGroupName,
    setInlineGroupName,
    inlineGroupInputRef,
    creatingTagGroupId,
    inlineTagName,
    setInlineTagName,
    inlineTagInputRef,
    onNewCategory,
    onNewTag,
    onClearTreeSearch,
    onChevronClick,
    onGroupSummaryClick,
    onDragOver,
    onDropOnGroup,
    onFolderContextMenu,
    onGroupDragStart,
    onGroupDragEnd,
    onTagDragStart,
    onTagDragEnd,
    onTagClick,
    onTagContextMenu,
    submitInlineNewTag,
    cancelInlineNewTag,
    submitInlineNewGroup,
    cancelInlineNewGroup,
  },
  ref,
) {
  const [dragOverGroupId, setDragOverGroupId] = useState(null)

  useEffect(() => {
    if (draggingTagId == null) setDragOverGroupId(null)
  }, [draggingTagId])

  return (
    <aside
      ref={ref}
      tabIndex={0}
      className={cn(
        'order-2 flex min-h-0 w-full shrink-0 flex-col border-border/60 bg-sidebar outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
        'border-t lg:w-[272px] lg:max-w-[272px] lg:flex-none lg:border-t-0 lg:border-l',
      )}
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-border/60 bg-background/70 px-2 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">Categorías</h2>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              title="Nueva categoría"
              onClick={onNewCategory}
            >
              <FolderPlus className="size-3.5" strokeWidth={1.5} />
              <span className="sr-only">Nueva categoría</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={selectedGroupId == null}
              title={selectedGroupId == null ? 'Seleccioná una carpeta' : 'Nueva etiqueta'}
              onClick={onNewTag}
            >
              <FilePlus className="size-3.5" strokeWidth={1.5} />
              <span className="sr-only">Nueva etiqueta</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={cn(
                'size-7 shrink-0 text-muted-foreground hover:text-foreground',
                (treeSearchOpen || treeSearch.trim()) && 'bg-muted/80 text-foreground ring-1 ring-border/80',
              )}
              title="Buscar en el árbol"
              aria-pressed={treeSearchOpen}
              onClick={() => setTreeSearchOpen((o) => !o)}
            >
              <Search className="size-3.5" strokeWidth={1.5} />
              <span className="sr-only">Buscar</span>
            </Button>
          </div>
        </div>
        {treeSearchOpen ? (
          <div className="relative" data-cuaderno-tree-search>
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" strokeWidth={1.5} aria-hidden />
            <Input
              ref={treeSearchInputRef}
              className="h-8 border-border/60 bg-background/80 pl-8 pr-8 text-[12px]"
              placeholder="Buscar…"
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
            />
            {treeSearch.trim() ? (
              <button
                type="button"
                className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Limpiar búsqueda"
                onClick={onClearTreeSearch}
              >
                <span className="text-[14px] leading-none">×</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-2">
        {loading ? (
          <p className="py-4 text-center text-[11px] text-muted-foreground">Cargando…</p>
        ) : (
          <div className="space-y-0.5">
            {!loading && !hasGroups && !inlineNewGroupOpen ? (
              <p className="rounded border border-dashed border-border/50 bg-card/50 px-2 py-3 text-center text-[11px] leading-snug text-muted-foreground">
                Sin categorías. Usá el botón de carpeta y escribí abajo.
              </p>
            ) : null}
            {!loading && hasGroups && filteredTree.length === 0 && treeSearch.trim() ? (
              <p className="px-1 py-4 text-center text-[11px] text-muted-foreground">Ninguna coincidencia.</p>
            ) : null}
            {filteredTree.map(({ group: g, options: opts }) => {
              const open = openGroupIds.has(g.id)
              const count = Number(g.option_count) || (g.options || []).length
              const selected = selectedGroupId === g.id
              return (
                <div key={g.id} className="rounded-md">
                  <div
                    className={cn(
                      'flex items-stretch gap-0.5 rounded-md border transition-colors duration-120',
                      selected
                        ? 'border-border/70 bg-background shadow-[0_1px_0_rgba(0,0,0,0.03)]'
                        : 'border-transparent hover:border-border/40 hover:bg-muted/40 dark:hover:bg-zinc-800/50',
                      draggingGroupId === g.id && 'opacity-60',
                      draggingTagId != null && dragOverGroupId === g.id && 'ring-2 ring-primary/40 bg-primary/[0.04]',
                    )}
                    onDragEnter={(e) => {
                      if (draggingTagId == null) return
                      e.preventDefault()
                      setDragOverGroupId(g.id)
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) setDragOverGroupId(null)
                    }}
                    onDragOver={(e) => {
                      onDragOver?.(e)
                      if (draggingTagId != null) e.preventDefault()
                    }}
                    onDrop={(e) => {
                      setDragOverGroupId(null)
                      onDropOnGroup(e, g.id)
                    }}
                    onContextMenu={(e) => onFolderContextMenu(e, g)}
                  >
                    <button
                      type="button"
                      onClick={() => onChevronClick(g.id, open)}
                      className="flex w-7 shrink-0 touch-manipulation items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-expanded={open}
                      aria-label={open ? 'Contraer' : 'Expandir'}
                    >
                      <ChevronRight className={cn('size-3.5 transition-transform duration-150', open && 'rotate-90')} strokeWidth={1.5} />
                    </button>
                    <div
                      draggable
                      onDragStart={(e) => onGroupDragStart(e, g.id)}
                      onDragEnd={onGroupDragEnd}
                      onClick={() => onGroupSummaryClick(g.id)}
                      className={cn(
                        'flex min-w-0 flex-1 cursor-default select-none items-center gap-1.5 rounded-md py-1.5 pl-0.5 pr-1 text-left touch-manipulation',
                        'transition-colors duration-100 hover:bg-muted/45',
                      )}
                    >
                      <span className={cn('size-1.5 shrink-0 rounded-full', notionColorDotClass(g.notion_color))} />
                      <Folder className="size-3.5 shrink-0 text-muted-foreground/80" strokeWidth={1.5} />
                      <span className="min-w-0 truncate text-[12px] font-medium leading-tight text-foreground">
                        {g.name}
                        <span className="font-normal text-muted-foreground"> ({count})</span>
                      </span>
                    </div>
                  </div>
                  {open ? (
                    <ul className="ml-7 border-l border-border/40 pl-2 pb-0.5 pt-0.5">
                      {opts.map((o) => {
                        const multiSel = selectedTagIds.length > 1 && selectedTagIds.includes(o.id)
                        const dragIds = multiSel ? selectedTagIds : [o.id]
                        return (
                          <li key={o.id}>
                            <button
                              type="button"
                              draggable
                              onDragStart={(e) => onTagDragStart(e, o.id, dragIds)}
                              onDragEnd={onTagDragEnd}
                              onClick={(e) => onTagClick(e, g, o)}
                              onContextMenu={(e) => onTagContextMenu(e, g, o)}
                              className={cn(
                                'flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[11.5px] transition-colors duration-100',
                                'hover:bg-[#f1f0ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:hover:bg-zinc-800/60',
                                draggingTagId === o.id && 'cursor-grabbing opacity-60',
                                o.active === false && 'opacity-50',
                                selectedTagIds.includes(o.id) && 'bg-[#ebeae8] ring-1 ring-border/80 dark:bg-zinc-800/80',
                              )}
                            >
                              <span className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground/70">
                                {o.tag_icon ? (
                                  <TagGlyph icon={o.tag_icon} className="size-3.5" />
                                ) : (
                                  <TagIcon className="size-3.5 opacity-40" strokeWidth={1.5} aria-hidden />
                                )}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-foreground">{o.name}</span>
                            </button>
                          </li>
                        )
                      })}
                      {creatingTagGroupId === g.id ? (
                        <li>
                          <div className="flex items-center gap-2 rounded-md border border-dashed border-primary/35 bg-background/80 px-2 py-2">
                            <FilePlus className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                            <Input
                              ref={inlineTagInputRef}
                              className="h-8 flex-1 border-none bg-transparent px-0 text-[12px] shadow-none focus-visible:ring-0"
                              placeholder="Nombre de la etiqueta…"
                              value={inlineTagName}
                              onChange={(e) => setInlineTagName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void submitInlineNewTag()
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault()
                                  cancelInlineNewTag()
                                }
                              }}
                            />
                          </div>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              )
            })}
            {inlineNewGroupOpen ? (
              <div className="flex items-stretch gap-0.5 rounded-lg border border-dashed border-primary/35 bg-primary/[0.06] px-0 py-1">
                <div className="w-7 shrink-0" aria-hidden />
                <div className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 pr-1">
                  <FolderPlus className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                  <Input
                    ref={inlineGroupInputRef}
                    className="h-8 flex-1 border-none bg-transparent text-[12px] shadow-none focus-visible:ring-0"
                    placeholder="Nombre de la categoría…"
                    value={inlineGroupName}
                    onChange={(e) => setInlineGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void submitInlineNewGroup()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelInlineNewGroup()
                      }
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  )
})
