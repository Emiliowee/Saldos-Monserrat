import { ChevronLeft, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Encabezado de página al estilo Notion:
 * icono grande + breadcrumb/atrás opcional + título 22–24px + descripción + acciones.
 *
 * @param {object} p
 * @param {import('react').ReactNode} [p.icon]
 * @param {string} p.title
 * @param {import('react').ReactNode} [p.description]
 * @param {number | string} [p.count] — contador pequeño junto al título
 * @param {import('react').ReactNode} [p.actions] — botones primarios/secundarios a la derecha
 * @param {Array<{ id: string, label: string, icon?: import('react').ReactNode, onClick: () => void, destructive?: boolean, separatorBefore?: boolean }>} [p.menuItems]
 * @param {{ label: string, onClick: () => void }} [p.back] — breadcrumb "← etiqueta" antes del título
 * @param {string} [p.className]
 */
export function PageHeader({ icon, title, description, count, actions, menuItems, back, className }) {
  const hasMenu = Array.isArray(menuItems) && menuItems.length > 0
  return (
    <header className={cn('relative px-10 pb-3 pt-10', className)}>
      {back ? (
        <button
          type="button"
          onClick={back.onClick}
          className="group mb-4 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[12px] font-medium text-muted-foreground/75 transition-colors hover:bg-[#f1f0ef] hover:text-foreground/85 dark:hover:bg-zinc-800/70"
        >
          <ChevronLeft className="size-3.5 opacity-70" strokeWidth={1.75} />
          <span className="tracking-[-0.005em]">{back.label}</span>
        </button>
      ) : null}

      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {icon ? (
            <span
              className="mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/30 text-foreground/80 dark:bg-zinc-800/50"
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="flex min-w-0 items-baseline gap-2.5 truncate text-[28px] font-semibold leading-[1.15] tracking-[-0.022em] text-foreground">
              <span className="truncate">{title}</span>
              {count != null && count !== '' ? (
                <span className="shrink-0 text-[14px] font-normal tabular-nums text-muted-foreground/65">
                  {count}
                </span>
              ) : null}
            </h1>
            {description ? (
              <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-muted-foreground/80">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {(actions || hasMenu) && (
          <div className="flex shrink-0 items-center gap-1.5 pt-1">
            {actions}
            {hasMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-[#f1f0ef] hover:text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 dark:hover:bg-zinc-800/70"
                  aria-label="Más opciones"
                >
                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="min-w-[220px]">
                  {menuItems.map((mi, i) => (
                    <div key={mi.id}>
                      {mi.separatorBefore && i > 0 ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem
                        inset={false}
                        variant={mi.destructive ? 'destructive' : 'default'}
                        onClick={mi.onClick}
                        className="gap-2.5 py-1.5 text-[12.5px]"
                      >
                        {mi.icon ? <span className="text-muted-foreground/70">{mi.icon}</span> : null}
                        {mi.label}
                      </DropdownMenuItem>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        )}
      </div>
    </header>
  )
}

/** Separador sutil entre encabezado y contenido, como la línea que Notion añade bajo el título. */
export function PageHeaderDivider({ className }) {
  return <div className={cn('mx-10 h-px bg-border/60', className)} aria-hidden />
}
