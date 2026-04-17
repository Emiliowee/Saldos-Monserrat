import { useEffect, useState } from 'react'
import {
  Package,
  Wallet,
  MapPin,
  ShoppingCart,
  ExternalLink,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { Button } from '@/components/ui/button'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const MODULES = [
  { id: 'inventario', label: 'Inventario',  desc: 'Alta, etiquetas y stock',       Icon: Package,   kbd: 'F2' },
  { id: 'cuaderno',   label: 'Cuaderno',    desc: 'Reglas de precio y categorías', Icon: BookOpen,  kbd: null },
  { id: 'creditos',   label: 'Créditos',    desc: 'Clientes y saldos',            Icon: Wallet,    kbd: 'F3' },
  { id: 'banqueta',   label: 'Banqueta',    desc: 'Mostrador y ferias',           Icon: MapPin,    kbd: 'F4' },
]

export function HomeView() {
  const { setSection } = useAppStore()
  const [snap, setSnap] = useState(null)
  const now = new Date()
  const dateLine = `${DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`

  useEffect(() => {
    const fn = window.bazar?.db?.getWelcomeSnapshot
    if (typeof fn !== 'function') return
    void fn().then((s) => setSnap(s && typeof s === 'object' ? s : null)).catch(() => {})
  }, [])

  const openPdv = () => {
    const p = window.bazar?.pdv?.open?.()
    if (p && typeof p.then === 'function') { p.catch(() => setSection('pdv')); return }
    setSection('pdv')
  }

  return (
    <div className="relative flex h-full items-start justify-center overflow-auto">
      <div className="relative z-[1] w-full max-w-lg px-8 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">{dateLine}</p>
          <div className="space-y-1">
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
              <span className="bazar-wordmark-coral">Bazar</span>{' '}
              <span className="font-normal text-muted-foreground">Monserrat</span>
            </h1>
            <p className="flex items-center gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
              <Sparkles className="size-3.5 shrink-0 text-primary" strokeWidth={1.5} />
              Inventario, precios y caja — un solo lugar, pensado para el mostrador real.
            </p>
          </div>
        </header>

        {snap && (
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 rounded-2xl border border-primary/10 bg-card/80 px-5 py-4 shadow-sm backdrop-blur-sm">
            <div>
              <p className="text-[24px] font-semibold tabular-nums tracking-tight text-foreground">{snap.productosDisponibles}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Disponibles</p>
            </div>
            <div className="hidden h-10 w-px bg-border sm:block" />
            <div>
              <p className="text-[24px] font-semibold tabular-nums tracking-tight text-foreground">{snap.productosTotal - snap.productosDisponibles}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Banqueta / vendidos</p>
            </div>
            {snap.clientesConSaldo > 0 && (
              <>
                <div className="hidden h-10 w-px bg-border sm:block" />
                <div>
                  <p className="text-[24px] font-semibold tabular-nums tracking-tight text-primary">
                    ${Number(snap.saldoTotalPendiente || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Crédito ({snap.clientesConSaldo})</p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="space-y-3">
          <Button
            size="lg"
            className="h-12 w-full gap-2.5 rounded-xl text-[13px] font-medium shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/25"
            onClick={openPdv}
          >
            <ShoppingCart className="size-4" strokeWidth={1.75} />
            Abrir punto de venta
            <ExternalLink className="size-3.5 opacity-80" strokeWidth={1.5} />
          </Button>
          <p className="text-center text-[10px] text-muted-foreground">Ventana aparte · misma base de datos</p>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Módulos</p>
          <div className="grid grid-cols-2 gap-2.5">
            {MODULES.map(({ id, label, desc, Icon, kbd }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className="group flex items-start gap-3 rounded-xl border border-primary/10 bg-card/70 p-3.5 text-left shadow-sm backdrop-blur-sm transition-all hover:border-primary/25 hover:bg-card hover:shadow-md"
              >
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary transition-colors group-hover:bg-primary/18">
                  <Icon className="size-[17px]" strokeWidth={1.65} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium text-foreground">{label}</span>
                    {kbd && (
                      <kbd className="hidden h-[14px] items-center rounded border border-primary/15 bg-primary/[0.06] px-1 font-mono text-[8px] text-muted-foreground sm:inline-flex">{kbd}</kbd>
                    )}
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-primary/10 pt-8 text-[11px] text-muted-foreground">
          <button
            type="button"
            className="transition-colors hover:text-primary underline-offset-2 hover:underline"
            onClick={() => {
              const p = window.bazar?.devices?.open?.()
              if (p && typeof p.then === 'function') { p.catch(() => { window.location.hash = '#devices' }); return }
              window.location.hash = '#devices'
            }}
          >
            Dispositivos
          </button>
          <span className="text-primary/30">·</span>
          <button type="button" className="transition-colors hover:text-primary underline-offset-2 hover:underline" onClick={() => setSection('config')}>
            Configuración
          </button>
        </div>
      </div>
    </div>
  )
}
