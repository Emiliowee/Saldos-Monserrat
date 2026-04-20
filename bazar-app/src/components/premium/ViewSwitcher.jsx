import { cn } from '@/lib/utils'

/**
 * Conmutador de vistas al estilo database Notion:
 * subtle underline sobre la vista activa + hover gris cálido.
 *
 * @param {object} p
 * @param {Array<{ id: string, label: string, icon?: import('react').ReactNode, hint?: string | number }>} p.views
 * @param {string} p.current
 * @param {(id: string) => void} p.onChange
 */
export function ViewSwitcher({ views, current, onChange }) {
  return (
    <div role="tablist" className="relative flex items-center gap-px">
      {views.map((v) => {
        const active = v.id === current
        return (
          <button
            key={v.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(v.id)}
            className={cn(
              'group relative inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-[12px] font-medium leading-none tracking-[-0.005em] transition-colors duration-120',
              active
                ? 'text-foreground'
                : 'text-muted-foreground/80 hover:bg-muted/70 hover:text-foreground/90 dark:hover:bg-muted/55',
            )}
          >
            {v.icon ? <span className="shrink-0 opacity-80">{v.icon}</span> : null}
            <span>{v.label}</span>
            {v.hint != null && v.hint !== '' ? (
              <span className="shrink-0 rounded px-1 text-[10px] tabular-nums text-muted-foreground/60">
                {v.hint}
              </span>
            ) : null}
            {active ? (
              <span
                aria-hidden
                className="absolute -bottom-[9px] left-1 right-1 h-[2px] rounded-full bg-foreground/75"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
