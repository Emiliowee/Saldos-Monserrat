import { X, Home, ScrollText, Tag as TagIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Barra de “documentos abiertos” al estilo Notion (no pestañas Chrome en la titlebar).
 * Inicio + regla de inventario + etiqueta, cada uno cerrable salvo Inicio.
 */
export function CuadernoDocumentRail({
  screen,
  onGoHome,
  invRulePinned,
  invRuleTitle,
  onSelectInvRule,
  onCloseInvRule,
  tagPinned,
  tagTitle,
  onSelectTag,
  onCloseTag,
}) {
  const TabBtn = ({ active, icon, label, onSelect, onClose, closeLabel }) => (
    <div
      className={cn(
        'flex h-7 max-w-[min(100%,14rem)] shrink-0 items-stretch overflow-hidden rounded-md border text-[12px] font-medium transition-colors',
        active
          ? 'border-border/70 bg-background text-foreground shadow-[0_1px_0_hsl(0_0%_0%/0.04)]'
            : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/55 hover:text-foreground/90 dark:hover:bg-zinc-800/60',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-1.5 truncate px-2 py-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        title={label}
      >
        <span className="shrink-0 opacity-70" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 truncate">{label}</span>
      </button>
      {onClose ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            void Promise.resolve(onClose())
          }}
          className="flex w-6 shrink-0 items-center justify-center text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          aria-label={closeLabel}
        >
          <X className="size-3" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  )

  return (
    <div
      role="tablist"
      aria-label="Documentos del cuaderno"
      className="flex shrink-0 items-center gap-1 border-b border-border/50 bg-muted/25 px-4 py-1.5"
    >
      <TabBtn
        active={screen === 'home'}
        icon={<Home className="size-3" strokeWidth={1.75} />}
        label="Inicio"
        onSelect={onGoHome}
      />
      {invRulePinned ? (
        <TabBtn
          active={screen === 'invRule'}
          icon={<ScrollText className="size-3" strokeWidth={1.75} />}
          label={invRuleTitle}
          onSelect={onSelectInvRule}
          onClose={onCloseInvRule}
          closeLabel="Cerrar regla"
        />
      ) : null}
      {tagPinned ? (
        <TabBtn
          active={screen === 'tag'}
          icon={<TagIcon className="size-3" strokeWidth={1.75} />}
          label={tagTitle}
          onSelect={onSelectTag}
          onClose={onCloseTag}
          closeLabel="Cerrar etiqueta"
        />
      ) : null}
    </div>
  )
}
