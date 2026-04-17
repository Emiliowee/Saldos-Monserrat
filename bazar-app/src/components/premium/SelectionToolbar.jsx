import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Barra flotante inferior que aparece cuando hay N filas seleccionadas.
 * Sigue el patrón de Notion/Linear: desliza desde abajo con blur sutil.
 *
 * @param {object} p
 * @param {number} p.count
 * @param {import('react').ReactNode} [p.actions]
 * @param {() => void} p.onClear
 * @param {string} [p.countLabel] — p. ej. "artículos"
 */
export function SelectionToolbar({ count, actions, onClear, countLabel = 'seleccionados' }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (count > 0) setMounted(true)
    else {
      const t = setTimeout(() => setMounted(false), 220)
      return () => clearTimeout(t)
    }
  }, [count])

  if (!mounted) return null

  const visible = count > 0
  return (
    <div
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center transition-[opacity,transform] duration-200',
        visible
          ? 'translate-y-0 opacity-100 ease-out motion-reduce:transition-none'
          : 'translate-y-3 opacity-0 ease-in',
      )}
    >
      <div
        role="toolbar"
        aria-label="Acciones para la selección"
        className={cn(
          'pointer-events-auto flex items-center gap-1 rounded-xl border border-border/50 px-2 py-1.5 text-[12.5px]',
          'bg-background/90 shadow-[0_2px_8px_hsl(0_0%_0%/0.04),0_12px_32px_hsl(0_0%_0%/0.08)] backdrop-blur-md',
          'dark:bg-zinc-900/90 dark:shadow-[0_2px_8px_hsl(0_0%_0%/0.35),0_12px_32px_hsl(0_0%_0%/0.45)]',
        )}
      >
        <div className="flex items-center gap-1.5 pl-1.5 pr-2">
          <span className="inline-flex size-5 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold tabular-nums text-primary">
            {count}
          </span>
          <span className="text-[12px] text-muted-foreground">{countLabel}</span>
        </div>
        <span className="h-4 w-px bg-border/60" aria-hidden />
        <div className="flex items-center gap-0.5">{actions}</div>
        <span className="h-4 w-px bg-border/60" aria-hidden />
        <button
          type="button"
          onClick={onClear}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/75 transition-colors hover:bg-[#f1f0ef] hover:text-foreground dark:hover:bg-zinc-800/70"
          aria-label="Quitar selección"
          title="Quitar selección"
        >
          <X className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}

/** Botón interno estándar de la SelectionToolbar. */
export function SelectionToolbarButton({ icon, label, onClick, destructive = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors',
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground/85 hover:bg-[#f1f0ef] dark:hover:bg-zinc-800/70',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
