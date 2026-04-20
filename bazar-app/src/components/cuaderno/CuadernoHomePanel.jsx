import { Plus } from 'lucide-react'
import { PageHeader, PageHeaderDivider, EmptyState } from '@/components/premium'
import { InvRulesNotebookIcon } from '@/components/cuaderno/InvRulesNotebookIcon.jsx'
import { cn } from '@/lib/utils'

/**
 * Pantalla de inicio del Cuaderno: listado de reglas de precio con chrome alineado a Inventario.
 */
export function CuadernoHomePanel({ loading, invRules, onNewRule, onOpenRule }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader
        icon={<InvRulesNotebookIcon className="size-5" />}
        title="Reglas de inventario"
        description="Precios sugeridos según combinaciones de tags. El ancla define qué categoría fija la regla."
        count={invRules.length}
        actions={
          <button
            type="button"
            onClick={onNewRule}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Nueva regla
          </button>
        }
      />
      <PageHeaderDivider />

      <div className="min-h-0 flex-1 overflow-y-auto px-10 pb-8 pt-4">
        {loading ? (
          <p className="py-12 text-center text-[13px] text-muted-foreground">Cargando…</p>
        ) : invRules.length === 0 ? (
          <EmptyState
            size="compact"
            icon={<InvRulesNotebookIcon className="size-5" />}
            title="Aún no hay reglas"
            description="Creá una con «Nueva regla»: elegís un tag ancla y definís el precio de cada combinación de propiedades."
            action={
              <button
                type="button"
                onClick={onNewRule}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
              >
                <Plus className="size-3.5" strokeWidth={2} />
                Nueva regla
              </button>
            }
          />
        ) : (
          <ul className="mx-auto max-w-2xl space-y-1">
            {invRules.map((r) => {
              const meta = []
              meta.push(`${r.row_count} fila${r.row_count === 1 ? '' : 's'}`)
              if (!r.scope_all) meta.push('alcance limitado')
              if (r.active === false) meta.push('pausada')
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpenRule(r)}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors',
                      'hover:border-border/60 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 dark:hover:bg-zinc-900/55',
                    )}
                  >
                    <span className="truncate text-[14px] font-medium leading-snug tracking-[-0.01em] text-foreground/95">
                      {r.name}
                    </span>
                    <span className="truncate text-[11.5px] text-muted-foreground/85">
                      Ancla:{' '}
                      <span className="text-foreground/75">{r.anchor_label || `#${r.anchor_option_id}`}</span>
                      {' · '}
                      {meta.join(' · ')}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
