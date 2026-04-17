import { forwardRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Campo de búsqueda estilo Notion: fondo casi invisible hasta hover/focus,
 * kbd hint opcional a la derecha.
 *
 * @param {object} p
 * @param {string} p.value
 * @param {(next: string) => void} p.onChange
 * @param {string} [p.placeholder]
 * @param {string} [p.kbd] — etiqueta keyboard, p. ej. "⌘F"
 * @param {string} [p.width]  — p. ej. 'w-60'
 */
export const SearchField = forwardRef(function SearchField(
  { value, onChange, onKeyDown, placeholder = 'Buscar…', kbd, width = 'w-60', className, ...rest },
  ref,
) {
  const hasValue = !!value && value.length > 0
  return (
    <div
      className={cn(
        'group relative inline-flex h-7 items-center rounded-md border border-transparent bg-transparent transition-[background-color,border-color] duration-120',
        'hover:border-border/60 hover:bg-[#f3f3f2] dark:hover:bg-zinc-800/60',
        'focus-within:border-ring/40 focus-within:bg-background focus-within:shadow-[inset_0_0_0_1px_var(--ring)]',
        width,
        className,
      )}
    >
      <Search
        className="pointer-events-none ml-2 size-3.5 shrink-0 text-muted-foreground/70"
        strokeWidth={1.75}
        aria-hidden
      />
      <input
        ref={ref}
        type="search"
        data-no-barcode="true"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-2 text-[12.5px] leading-none tracking-[-0.003em] outline-none placeholder:text-muted-foreground/60"
        {...rest}
      />
      {hasValue ? (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => onChange('')}
          className="mr-1 inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground"
        >
          <X className="size-3" strokeWidth={2} />
        </button>
      ) : kbd ? (
        <kbd className="mr-2 hidden select-none items-center rounded border border-border/60 bg-background/60 px-1 font-mono text-[9.5px] text-muted-foreground/70 sm:inline-flex">
          {kbd}
        </kbd>
      ) : null}
    </div>
  )
})
