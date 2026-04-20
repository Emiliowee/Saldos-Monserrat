import { X, Home, Tag as TagIcon } from 'lucide-react'
import { InvRulesNotebookIcon } from '@/components/cuaderno/InvRulesNotebookIcon.jsx'
import { cn } from '@/lib/utils'

/**
 * Barra de “documentos abiertos” al estilo Notion/VS Code:
 * pestañas planas con indicador inferior en la activa. Inicio no se cierra.
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
  return (
    <div
      role="tablist"
      aria-label="Documentos del cuaderno"
      className="flex min-h-9 min-w-0 shrink-0 items-stretch gap-0 border-b border-border/60 bg-background px-2 sm:px-3"
    >
      <div className="flex min-w-0 flex-1 items-stretch gap-0 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Tab
        active={screen === 'home'}
        icon={<Home className="size-3" strokeWidth={1.75} />}
        label="Inicio"
        onSelect={onGoHome}
      />
      {invRulePinned ? (
        <Tab
          active={screen === 'invRule'}
          icon={<InvRulesNotebookIcon className="size-3" />}
          label={invRuleTitle}
          onSelect={onSelectInvRule}
          onClose={onCloseInvRule}
          closeLabel="Cerrar regla"
        />
      ) : null}
      {tagPinned ? (
        <Tab
          active={screen === 'tag'}
          icon={<TagIcon className="size-3" strokeWidth={1.75} />}
          label={tagTitle}
          onSelect={onSelectTag}
          onClose={onCloseTag}
          closeLabel="Cerrar etiqueta"
        />
      ) : null}
      </div>
    </div>
  )
}

function Tab({ active, icon, label, onSelect, onClose, closeLabel }) {
  return (
    <div
      role="tab"
      aria-selected={active}
      className={cn(
        'relative flex h-9 max-w-[min(100%,16rem)] shrink-0 items-stretch text-[12px] font-medium transition-colors',
        active
          ? 'text-foreground'
          : 'text-muted-foreground/80 hover:text-foreground/90',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex min-w-0 items-center gap-1.5 truncate px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
          active ? 'cursor-default' : 'cursor-pointer',
        )}
        title={label}
      >
        <span className={cn('shrink-0', active ? 'text-foreground/85' : 'text-muted-foreground/70')} aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 truncate tracking-[-0.005em]">{label}</span>
      </button>
      {onClose ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void Promise.resolve(onClose()) }}
          className="mr-2 inline-flex size-5 shrink-0 items-center justify-center self-center rounded text-muted-foreground/60 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
          aria-label={closeLabel}
        >
          <X className="size-3" strokeWidth={2} />
        </button>
      ) : null}
      <span
        className={cn(
          'pointer-events-none absolute inset-x-2 bottom-0 h-[2px] rounded-t-[1.5px] transition-colors',
          active ? 'bg-foreground' : 'bg-transparent',
        )}
        aria-hidden
      />
    </div>
  )
}
