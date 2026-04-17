import { useEffect, useState } from 'react'
import { ExternalLink, ShoppingCart, ArrowRight, Receipt, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/useAppStore'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'

export function PdvHubView() {
  const setSection = useAppStore((s) => s.setSection)
  const hasShell = typeof window !== 'undefined' && Boolean(window.bazar?.pdv?.open)
  const [recentSales, setRecentSales] = useState([])

  useEffect(() => {
    const fn = window.bazar?.db?.getSales
    if (typeof fn !== 'function') return
    void fn({ limit: 5 }).then(r => setRecentSales(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const openTerminal = async () => {
    try {
      const p = window.bazar?.pdv?.open?.()
      if (p && typeof p.then === 'function') { await p; return }
      if (!hasShell) toast.error('Disponible solo en la app de escritorio.')
    } catch (e) { toast.error(String(e?.message || e)) }
  }

  return (
    <div className="flex h-full items-start justify-center overflow-auto">
      <div className="w-full max-w-lg px-8 py-12 space-y-10">
        {/* Hero */}
        <div className="space-y-3">
          <div className="size-12 rounded-2xl bg-primary/8 flex items-center justify-center">
            <ShoppingCart className="size-5 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">Punto de venta</h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground max-w-sm">
            La caja corre en una ventana independiente conectada a la misma base de datos.
            Escaneá productos, armá el ticket y cobrá.
          </p>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full h-12 text-[14px] gap-2.5 rounded-xl shadow-sm"
            onClick={() => void openTerminal()}
          >
            <ExternalLink className="size-[18px]" strokeWidth={1.5} />
            Abrir ventana de caja
          </Button>
          <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            {hasShell ? (
              <span>Atajo <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">F1</kbd></span>
            ) : (
              <span>Requiere la app de escritorio (Electron)</span>
            )}
          </div>
        </div>

        {/* Recent sales */}
        {recentSales.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Últimas ventas</span>
            </div>
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {recentSales.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Receipt className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[12px] text-muted-foreground flex-1 truncate">
                    {s.item_count} {s.item_count === 1 ? 'artículo' : 'artículos'}
                  </span>
                  <span className="text-[13px] font-medium tabular-nums">{formatPrice(s.total)}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-28 text-right">
                    {s.created_at ? String(s.created_at).slice(5, 16).replace('T', ' ') : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Secondary action */}
        <button
          type="button"
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setSection('inventario')}
        >
          Ir a inventario
          <ArrowRight className="size-3" />
        </button>
      </div>
    </div>
  )
}
