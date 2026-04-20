import { cn } from '@/lib/utils'

/**
 * Vacío al estilo Notion: glifo suave + mensaje + acción primaria opcional.
 * @param {object} p
 * @param {import('react').ReactNode} p.icon
 * @param {string} p.title
 * @param {import('react').ReactNode} [p.description]
 * @param {import('react').ReactNode} [p.action]
 * @param {string} [p.className]
 * @param {'compact' | 'default'} [p.size='default']
 */
export function EmptyState({ icon, title, description, action, className, size = 'default' }) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-md flex-col items-center gap-3 text-center',
        size === 'compact' ? 'py-10' : 'py-20',
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          'inline-flex items-center justify-center rounded-2xl bg-muted/30 text-muted-foreground/75 dark:bg-muted/50',
          size === 'compact' ? 'size-10' : 'size-14',
        )}
      >
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground/90">{title}</h3>
        {description ? (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground/85">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
