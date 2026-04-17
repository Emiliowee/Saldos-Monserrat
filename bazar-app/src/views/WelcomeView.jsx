import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useAppStore } from '@/stores/useAppStore'
import { RiveBazarCanvas } from '@/components/rive/RiveBazarCanvas.jsx'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowRight, Package, Users, DollarSign } from 'lucide-react'

function formatMXN(value) {
  const n = Number(value) || 0
  const frac = Math.abs(n % 1) > 0.001
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: frac ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n)
}

function MetricCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  )
}

export function WelcomeView() {
  const enterApp = useAppStore((s) => s.enterApp)
  const [riveError, setRiveError] = useState(null)
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void window.bazar?.window?.setWelcomeMode?.(true)
    })
    return () => {
      cancelAnimationFrame(id)
      void window.bazar?.window?.setWelcomeMode?.(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const b = window.bazar?.db
      if (!b?.getWelcomeSnapshot) {
        if (!cancelled) {
          setStats(null)
          setStatsLoading(false)
        }
        return
      }
      try {
        const s = await b.getWelcomeSnapshot()
        if (!cancelled) setStats(s)
      } catch {
        if (!cancelled) setStats(null)
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-full items-center justify-center p-6">
      <motion.div
        className="flex w-full max-w-md flex-col items-center gap-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Branding */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Saldos Monserrat
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Bazar Monserrat
          </h1>
        </div>

        {/* Rive animation */}
        <div className="relative w-full overflow-hidden rounded-xl border bg-card" style={{ aspectRatio: '16/9' }}>
          {riveError ? (
            <div className="flex h-full items-center justify-center p-4">
              <p className="text-sm text-muted-foreground text-center">{riveError}</p>
            </div>
          ) : (
            <RiveBazarCanvas
              layoutVariant="welcome"
              stageClassName="w-full h-full"
              rootClassName="w-full h-full"
              onLoadError={setRiveError}
            />
          )}
        </div>

        {/* Metrics */}
        {statsLoading ? (
          <div className="grid w-full grid-cols-3 gap-2">
            {[0, 1, 2].map((k) => (
              <div key={k} className="h-16 animate-pulse rounded-lg border bg-muted/40" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid w-full grid-cols-3 gap-2">
            <MetricCard
              icon={Package}
              label="Inventario"
              value={`${stats.productosDisponibles} / ${stats.productosTotal}`}
            />
            <MetricCard
              icon={Users}
              label="Con saldo"
              value={`${stats.clientesConSaldo}${stats.clientesTotal > 0 ? ` / ${stats.clientesTotal}` : ''}`}
            />
            <MetricCard
              icon={DollarSign}
              label="Por cobrar"
              value={formatMXN(stats.saldoTotalPendiente)}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            Abrí la app en escritorio para ver inventario y cuentas.
          </p>
        )}

        {/* CTA */}
        <Button size="lg" className="w-full gap-2" onClick={enterApp}>
          Entrar al sistema
          <ArrowRight className="size-4" />
        </Button>

        <p className="text-[10px] text-muted-foreground select-none">
          Inventario y caja · local
        </p>
      </motion.div>
    </div>
  )
}
