import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tabla base al estilo database Notion:
 * - header sticky discreto con uppercase 10px
 * - filas 34px con zebra mínima
 * - hover tinte cálido + RowActionStrip revelado a la derecha
 * - selección con borde izquierdo 2px de marca
 * - scroll vertical contenido en wrapper parent
 *
 * Es una tabla sin virtualización; adecuada para hasta ~2k filas.
 * Para más, se puede envolver con @tanstack/react-virtual a futuro.
 */
export const DataTable = forwardRef(function DataTable({ children, className }, ref) {
  return (
    <div ref={ref} className={cn('relative flex min-h-0 flex-1 overflow-auto', className)}>
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        {children}
      </table>
    </div>
  )
})

export function DataTableHeader({ children }) {
  return (
    <thead className="sticky top-0 z-[5] bg-background/92 backdrop-blur-[2px]">
      <tr>{children}</tr>
    </thead>
  )
}

export function DataTableHead({ children, className, align = 'left', width }) {
  const style = width ? { width } : undefined
  return (
    <th
      scope="col"
      style={style}
      className={cn(
        'sticky top-0 border-b border-border/60 px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground/70',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function DataTableBody({ children }) {
  return <tbody>{children}</tbody>
}

/**
 * @param {object} p
 * @param {boolean} [p.selected]
 * @param {boolean} [p.active] — resalta sin marcar selección (p. ej. con foco)
 * @param {(e: React.MouseEvent) => void} [p.onClick]
 * @param {(e: React.MouseEvent) => void} [p.onDoubleClick]
 * @param {import('react').ReactNode} p.children
 */
export function DataTableRow({ selected, active, onClick, onDoubleClick, children, className }) {
  return (
    <tr
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-selected={selected || undefined}
      className={cn(
        'group/row relative cursor-pointer transition-colors',
        '[&>td]:border-b [&>td]:border-border/45',
        'hover:[&>td]:bg-[#faf9f8] dark:hover:[&>td]:bg-zinc-900/55',
        selected && '[&>td]:bg-primary/[0.04] hover:[&>td]:bg-primary/[0.07]',
        active && !selected && '[&>td]:bg-muted/20',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function DataTableCell({ children, className, align = 'left', mono = false, muted = false }) {
  return (
    <td
      className={cn(
        'px-3 py-2 align-middle',
        align === 'right' && 'text-right tabular-nums',
        align === 'center' && 'text-center',
        mono && 'font-mono text-[11.5px]',
        muted && 'text-muted-foreground/85',
        className,
      )}
    >
      {children}
    </td>
  )
}

/**
 * Tira flotante de acciones a la derecha de la fila, visible en hover.
 * El contenedor <td> donde se coloque debe tener `position: relative` (ya lo trae).
 */
export function RowActionStrip({ children, className }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'absolute right-2 top-1/2 -translate-y-1/2 hidden items-center gap-0.5 rounded-md border border-border/40 bg-background/95 p-0.5 shadow-[0_1px_0_hsl(0_0%_0%/0.04),0_4px_12px_hsl(0_0%_0%/0.06)] group-hover/row:flex motion-safe:group-hover/row:animate-in motion-safe:group-hover/row:fade-in',
        'dark:bg-zinc-900/95',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function RowActionButton({ icon, label, onClick, destructive = false }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded text-muted-foreground/80 transition-colors',
        destructive
          ? 'hover:bg-destructive/10 hover:text-destructive'
          : 'hover:bg-[#f1f0ef] hover:text-foreground dark:hover:bg-zinc-800/70',
      )}
    >
      {icon}
    </button>
  )
}

/** Caja que envuelve la tabla para que solo ella tenga scroll (sticky header). */
export function DataTableShell({ children, className }) {
  return <div className={cn('flex min-h-0 flex-1 flex-col', className)}>{children}</div>
}
