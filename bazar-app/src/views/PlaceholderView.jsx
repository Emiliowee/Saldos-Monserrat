import {
  Home,
  Package,
  ShoppingCart,
  Wallet,
  BookOpen,
  MapPin,
  Settings,
  Flower2,
} from 'lucide-react'
import { NAV_MODULES } from '@/theme/nav'
import { Card, CardContent } from '@/components/ui/card'

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
  const Icon = ICONS[section] || Flower2

  return (
    <div className="flex h-full items-center justify-center overflow-auto p-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/12 shadow-inner ring-1 ring-primary/20">
          <Icon className="size-8 text-primary" strokeWidth={1.4} />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Bazar Monserrat</p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{mod?.label || section}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Este módulo está en preparación. La navegación y el diseño ya siguen la identidad de la app.
          </p>
        </div>
        <Card className="w-full border-primary/15 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardContent className="flex items-start gap-3 p-4 text-left">
            <Flower2 className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Si necesitás priorizar qué construir aquí (reportes, usuarios, etc.), definilo en el cuaderno de prácticas y lo enlazamos al mismo estilo visual.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
