import { useEffect, useState } from 'react'
import { ExternalLink, ArrowRight, Receipt, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/useAppStore'
import { formatPrice } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function PdvHubView() {
  const setSection = useAppStore((s) => s.setSection)
  const hasShell = typeof window !== 'undefined' && Boolean(window.bazar?.pdv?.open)
  const [recentSales, setRecentSales] = useState([])

  useEffect(() => {
    const fn = window.bazar?.db?.getSales
    if (typeof fn !== 'function') return
    void fn({ limit: 5 }).then((r) => setRecentSales(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const openTerminal = async () => {
    try {
      const p = window.bazar?.pdv?.open?.()
      if (p && typeof p.then === 'function') {
        await p
        return
      }
      if (!hasShell) toast.error('Disponible solo en la app de escritorio.')
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  return (
    <div className="flex h-full items-start justify-center overflow-auto bg-background p-6 md:p-10">
      <div className="w-full max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Punto de venta</CardTitle>
            <CardDescription>
              En escritorio puedes abrir la caja en una ventana aparte (mismo programa, interfaz de mostrador). Aquí
              solo abres o enlazas esa ventana; el inventario y el resto del menú no cambian.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="button" className="w-full gap-2" onClick={() => void openTerminal()}>
              <ExternalLink className="size-4 shrink-0" strokeWidth={2} />
              Abrir ventana de caja
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {hasShell ? (
                <>
                  Atajo <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">F1</kbd>
                </>
              ) : (
                'Requiere la app de escritorio (Electron).'
              )}
            </p>
          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 px-0" onClick={() => setSection('inventario')}>
              Ir a inventario
              <ArrowRight className="size-3.5" strokeWidth={2} />
            </Button>
          </CardFooter>
        </Card>

        {recentSales.length > 0 ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Últimas ventas</CardTitle>
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <Clock className="size-3.5" strokeWidth={2} />
                Registradas en esta base
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ul className="divide-y divide-border">
                {recentSales.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-6 py-2.5 text-sm">
                    <Receipt className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      #{s.id} · {s.item_count} {s.item_count === 1 ? 'ítem' : 'ítems'}
                    </span>
                    <span className="shrink-0 tabular-nums font-medium">{formatPrice(s.total)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
