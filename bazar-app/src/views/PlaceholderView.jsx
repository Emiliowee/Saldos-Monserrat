import {
  Home,
  Package,
  ShoppingCart,
  Wallet,
  BookOpen,
  MapPin,
  Settings,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import { NAV_MODULES } from '@/theme/nav'
import { useAppStore } from '@/stores/useAppStore'

const ICONS = {
  inicio: Home,
  inventario: Package,
  pdv: ShoppingCart,
  creditos: Wallet,
  cuaderno: BookOpen,
  banqueta: MapPin,
  config: Settings,
}

export function PlaceholderView({ section }) {
  const mod = NAV_MODULES.find((m) => m.id === section)
  const Icon = ICONS[section] || Sparkles
  const setSection = useAppStore((s) => s.setSection)

  return (
    <div
      data-app-workspace
      className="relative flex h-full items-center justify-center overflow-auto bg-background px-6 py-10"
    >
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 flex w-full max-w-[460px] flex-col items-start gap-6">
        <div
          aria-hidden
          className="relative inline-flex size-11 items-center justify-center rounded-lg border border-border/70 bg-card text-foreground/70 shadow-[var(--shadow-xs)]"
        >
          <Icon className="size-[18px]" strokeWidth={1.5} />
          <span className="absolute -right-1 -top-1 inline-flex size-2 rounded-full bg-primary/70 ring-2 ring-background" />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
            Bazar Monserrat · Módulo
          </p>
          <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.022em] text-foreground">
            {mod?.label || section}
          </h1>
          <p className="max-w-[42ch] text-[13px] leading-relaxed text-muted-foreground/85">
            Este módulo está en preparación. El resto del workspace ya está operativo —
            podés seguir trabajando en inventario, PDV o cuaderno.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSection('inicio')}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-background px-3 text-[12.5px] font-medium text-foreground/85 shadow-[var(--shadow-xs)] transition-[background-color,border-color,color] duration-150 hover:border-border hover:bg-muted/40 hover:text-foreground"
          >
            Volver al inicio
          </button>
          <button
            type="button"
            onClick={() => setSection('inventario')}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Ir a inventario
            <ArrowUpRight className="size-3" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  )
}
