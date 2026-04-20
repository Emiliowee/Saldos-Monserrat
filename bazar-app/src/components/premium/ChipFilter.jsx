import { ChevronDown, Check, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * Chip de filtro estilo Notion: botón pequeño con etiqueta + valor.
 * Si hay valor seleccionado se muestra con “tinte de marca muy suave”.
 *
 * @param {object} p
 * @param {string} p.label — prefijo, p. ej. "Estado"
 * @param {Array<{ value: string | number, label: string, hint?: string }>} p.options
 * @param {string | number | null | undefined} p.value
 * @param {(next: string | number | null) => void} p.onChange
 * @param {boolean} [p.allowClear=true]
 * @param {string} [p.placeholder="Todos"]
 */
export function ChipFilter({ label, options, value, onChange, allowClear = true, placeholder = 'Todos' }) {
  const current = options.find((o) => String(o.value) === String(value))
  const active = !!current
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'group inline-flex h-7 max-w-[240px] items-center gap-1.5 rounded-md border px-2 text-[11.5px] font-medium leading-none tracking-[-0.003em] transition-[background-color,border-color,color] duration-120',
          active
            ? 'border-primary/25 bg-primary/[0.05] text-foreground hover:bg-primary/[0.085]'
            : 'border-border/70 bg-transparent text-muted-foreground/85 hover:border-border hover:bg-muted/70 hover:text-foreground/85 dark:hover:bg-muted/55',
        )}
      >
        <span className="shrink-0 text-muted-foreground/70 group-hover:text-muted-foreground">
          {label}
        </span>
        <span className="min-w-0 truncate text-foreground/85">
          {current ? current.label : placeholder}
        </span>
        {active && allowClear ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={`Limpiar ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onChange(null)
            }}
            className="ml-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="size-3" strokeWidth={2} />
          </span>
        ) : (
          <ChevronDown className="size-3 shrink-0 opacity-55" strokeWidth={2} />
        )}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[220px] p-1">
        <div className="max-h-[280px] overflow-auto">
          {options.map((o) => {
            const isSel = String(o.value) === String(value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12.5px] transition-colors',
                  'hover:bg-muted/70 dark:hover:bg-muted/55',
                  isSel && 'bg-muted dark:bg-muted/70',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-foreground/90">{o.label}</span>
                {o.hint ? (
                  <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground/60">{o.hint}</span>
                ) : null}
                {isSel ? <Check className="size-3.5 shrink-0 text-foreground/70" strokeWidth={1.75} /> : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
