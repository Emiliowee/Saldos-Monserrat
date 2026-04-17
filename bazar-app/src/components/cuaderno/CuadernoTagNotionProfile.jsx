import { Eye, Folder, Link2, Tag as TagIcon, Trash2 } from 'lucide-react'
import { PropertyIconPickerButton } from '@/components/properties/PropertyPickers.jsx'
import { notionCoverBannerClasses } from '@/lib/propertyTokens'
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
  active,
  onActiveChange,
  groupName,
  onGroupClick,
  siblingRows = [],
  onSiblingClick,
  onSave,
  onClose,
  onDelete,
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className={cn(
            'relative z-0 h-[6.5rem] w-full overflow-hidden sm:h-[7rem]',
            notionCoverBannerClasses('gray'),
          )}
          aria-hidden
        />

        <div className="relative z-10 mx-auto w-full max-w-[720px] px-6 pb-10 pt-0 sm:px-12">
          <div className="-mt-11 flex flex-col items-start sm:-mt-[3.25rem]">
            <PropertyIconPickerButton
              value={icon}
              onChange={onIconChange}
              title="Cambiar icono"
              appearance="hero"
              triggerClassName="h-[5rem] w-[5rem] drop-shadow-sm sm:h-[5.5rem] sm:w-[5.5rem]"
              glyphClassName="!size-[5rem] sm:!size-[5.5rem]"
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
                  {siblingRows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => onSiblingClick?.(row.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-transparent bg-muted/50 px-2 py-1 text-[12px] font-medium text-foreground/90 transition-colors hover:border-border/50 hover:bg-muted/70 dark:bg-zinc-800/50 dark:hover:bg-zinc-800/75"
                    >
                      <TagIcon className="size-3 shrink-0 opacity-60" strokeWidth={1.75} aria-hidden />
                      <span className="truncate">{row.name}</span>
                    </button>
                  ))}
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
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-[12px]" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" size="sm" className="h-8 text-[12px]" onClick={onSave}>
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
