import { useEffect } from 'react'
import { Eye, Folder, Link2, Loader2, Package, Palette, Tag as TagIcon, Trash2 } from 'lucide-react'
import { PropertyColorPickerButton, PropertyIconPickerButton } from '@/components/properties/PropertyPickers.jsx'
import {
  notionCoverBannerClasses,
  notionColorDotClass,
  notionPastelSelectPillClasses,
  normalizeNotionColorKey,
} from '@/lib/propertyTokens'
import { TagGlyph } from '@/components/TagGlyph'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Propiedades de etiqueta — layout Notion: cover, icon hero, título, property rows y hermanas como chips.
 * Superficies y bordes alineados con Inventario / variables del tema (`background`, `muted`, `border`).
 */
export function CuadernoTagNotionProfile({
  name,
  onNameChange,
  icon,
  onIconChange,
  color = 'default',
  onColorChange,
  active,
  onActiveChange,
  groupName,
  onGroupClick,
  siblingRows = [],
  onSiblingClick,
  onSave,
  isSaving = false,
  isDirty = false,
  onClose,
  onDelete,
  onRequestClose,
  usageCount = null,
  usageLoading = false,
}) {
  const MAX_SIBLINGS = 14
  const visibleSiblings = siblingRows.slice(0, MAX_SIBLINGS)
  const hiddenSiblingCount = Math.max(0, siblingRows.length - MAX_SIBLINGS)
  const colorKey = normalizeNotionColorKey(color, 'default')

  const previewLabel = (name || '').trim() || 'Etiqueta'

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (isDirty && !isSaving) onSave?.()
        return
      }
      if (e.key === 'Escape') {
        const tag = /** @type {HTMLElement|null} */ (e.target)
        if (tag instanceof HTMLInputElement || tag instanceof HTMLTextAreaElement) return
        if (isDirty) onRequestClose?.() ?? onClose?.()
        else onClose?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDirty, isSaving, onSave, onClose, onRequestClose])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className={cn(
            'relative z-0 h-[4rem] w-full overflow-hidden transition-colors duration-300 sm:h-[4.25rem]',
            notionCoverBannerClasses(colorKey),
          )}
          aria-hidden
        />

        <div className="relative z-10 mx-auto w-full max-w-[720px] px-6 pb-10 pt-0 sm:px-12">
          <div className="-mt-8 flex flex-col items-start sm:-mt-9">
            <PropertyIconPickerButton
              value={icon}
              onChange={onIconChange}
              title="Cambiar icono"
              appearance="hero"
              triggerClassName="h-[4.25rem] w-[4.25rem] drop-shadow-sm sm:h-[4.5rem] sm:w-[4.5rem]"
              glyphClassName="!size-[4.25rem] sm:!size-[4.5rem]"
            />

            <div className="group/title mt-3 w-full rounded-md px-0 transition-colors hover:bg-muted/45">
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Etiqueta sin nombre"
                className="w-full border-0 bg-transparent px-0 py-0.5 text-left text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus-visible:ring-0 sm:text-[2.35rem]"
              />
            </div>

            <div className="mt-3.5 flex items-center gap-2">
              <span
                className={cn(notionPastelSelectPillClasses(colorKey, true), 'max-w-full gap-1.5')}
                aria-label="Vista previa en inventario"
                title="Así se mostrará esta etiqueta en el inventario"
              >
                {icon ? (
                  <TagGlyph icon={icon} className="size-3.5" />
                ) : (
                  <TagIcon className="size-3 opacity-70" strokeWidth={1.75} aria-hidden />
                )}
                <span className="truncate">{previewLabel}</span>
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/70">
                Vista previa
              </span>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-[minmax(7.5rem,9rem)_1fr] gap-x-3 gap-y-0.5">
            <PropertyRow icon={<Folder className="size-3.5" strokeWidth={1.75} />} label="Dentro de">
              {onGroupClick ? (
                <button
                  type="button"
                  onClick={onGroupClick}
                  className="flex min-h-[1.75rem] w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-muted/50 dark:hover:bg-zinc-800/55"
                >
                  <Link2 className="size-3 shrink-0 opacity-60" strokeWidth={1.75} aria-hidden />
                  <span className="truncate text-foreground">{groupName || '—'}</span>
                </button>
              ) : (
                <div className="flex min-h-[1.75rem] items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px]">
                  <span className="truncate text-foreground">{groupName || '—'}</span>
                </div>
              )}
            </PropertyRow>

            <PropertyRow icon={<Palette className="size-3.5" strokeWidth={1.75} />} label="Color">
              <ColorInlinePicker value={colorKey} onChange={onColorChange} />
            </PropertyRow>

            <PropertyRow
              icon={
                <span
                  className={cn('size-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-muted-foreground/45')}
                  aria-hidden
                />
              }
              label="Estado"
            >
              <button
                type="button"
                onClick={() => onActiveChange(!active)}
                className="flex min-h-[1.75rem] w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-muted/50 dark:hover:bg-zinc-800/55"
              >
                <Eye className="size-3 shrink-0 opacity-60" strokeWidth={1.75} aria-hidden />
                <span className={cn('truncate', active ? 'text-foreground' : 'text-muted-foreground')}>
                  {active ? 'Visible en inventario' : 'Oculta en inventario'}
                </span>
              </button>
            </PropertyRow>

            <PropertyRow icon={<Package className="size-3.5" strokeWidth={1.75} />} label="En uso">
              <div className="flex min-h-[1.75rem] items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px]">
                {usageLoading ? (
                  <>
                    <Loader2 className="size-3 shrink-0 animate-spin opacity-50" strokeWidth={1.75} aria-hidden />
                    <span className="text-muted-foreground">Calculando…</span>
                  </>
                ) : usageCount == null ? (
                  <span className="text-muted-foreground/70">—</span>
                ) : usageCount === 0 ? (
                  <span className="text-muted-foreground">Aún no se usa</span>
                ) : (
                  <span className="text-foreground tabular-nums">
                    {usageCount} {usageCount === 1 ? 'producto' : 'productos'}
                  </span>
                )}
              </div>
            </PropertyRow>
          </div>

          <div className="mt-10 border-t border-border/60 pt-6">
            <div className="flex items-end justify-between gap-2">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/90">
                Otras etiquetas del grupo
              </h3>
              {siblingRows.length > 0 ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">{siblingRows.length}</span>
              ) : null}
            </div>
            <div className="mt-3">
              {siblingRows.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {visibleSiblings.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => onSiblingClick?.(row.id)}
                      title={row.name}
                      className="group/sib inline-flex items-center gap-1.5 rounded-md border border-transparent bg-muted/45 px-2 py-1 text-[12px] font-medium text-foreground/90 transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:border-border/60 hover:bg-muted/70 hover:-translate-y-[0.5px] dark:bg-zinc-800/50 dark:hover:bg-zinc-800/75"
                    >
                      <span
                        className={cn('size-2 shrink-0 rounded-full', notionColorDotClass(row.notionColor || 'default'))}
                        aria-hidden
                      />
                      <span className="truncate">{row.name}</span>
                    </button>
                  ))}
                  {hiddenSiblingCount > 0 ? (
                    <span className="inline-flex items-center rounded-md border border-dashed border-border/60 px-2 py-1 text-[11px] text-muted-foreground">
                      Ver todas (+{hiddenSiblingCount})
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-[12.5px] text-muted-foreground">Es la única etiqueta del grupo.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 bg-muted/25 px-4 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-[12px] text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="mr-1 size-3.5" strokeWidth={1.75} aria-hidden />
          Eliminar etiqueta
        </Button>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1 text-[10.5px] tabular-nums text-muted-foreground/70 sm:inline-flex">
            <Kbd>Esc</Kbd>
            <span>cerrar</span>
            <span aria-hidden className="mx-1 text-muted-foreground/40">·</span>
            <Kbd>⌘S</Kbd>
            <span>guardar</span>
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-[12px]" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-[12px]"
              disabled={isSaving || !isDirty}
              onClick={onSave}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-1 size-3.5 shrink-0 animate-spin" strokeWidth={1.75} aria-hidden />
                  Guardando…
                </>
              ) : isDirty ? (
                'Guardar cambios'
              ) : (
                'Sin cambios'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }) {
  return (
    <kbd className="inline-flex h-[17px] select-none items-center rounded-[4px] border border-border/50 bg-background/70 px-1 font-mono text-[9.5px] font-medium text-muted-foreground/85 shadow-[var(--shadow-xs)]">
      {children}
    </kbd>
  )
}

function ColorInlinePicker({ value, onChange }) {
  return (
    <div className="flex min-h-[1.75rem] items-center gap-2 px-1.5 py-1">
      <PropertyColorPickerButton value={value} onChange={(c) => onChange?.(c)} title="Color de la etiqueta" />
      <span className="text-[12.5px] text-foreground/85">{colorLabel(value)}</span>
    </div>
  )
}

function colorLabel(key) {
  const map = {
    default: 'Predeterminado',
    gray: 'Gris',
    brown: 'Marrón',
    orange: 'Naranja',
    yellow: 'Amarillo',
    green: 'Verde',
    blue: 'Azul',
    purple: 'Morado',
    pink: 'Rosa',
    red: 'Rojo',
  }
  return map[key] || key
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
