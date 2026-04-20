import { cn } from '@/lib/utils'

/** PNG Fluent — reglas de inventario dentro del Cuaderno (no sidebar). */
export const INV_RULES_NOTEBOOK_SRC = '/cuaderno/fluent-color--notebook-16.png'

export function InvRulesNotebookIcon({ className, ...rest }) {
  return (
    <img
      src={INV_RULES_NOTEBOOK_SRC}
      alt=""
      draggable={false}
      className={cn('object-contain', className)}
      {...rest}
    />
  )
}
