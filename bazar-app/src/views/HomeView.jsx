import { useEffect, useMemo, useState } from 'react'
import {
  Package,
  Wallet,
  MapPin,
  ShoppingCart,
  BookOpen,
  Printer,
  ArrowUpRight,
  Plus,
  Tag,
  ScanLine,
  Settings,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const MODULES = [
  { id: 'inventario', label: 'Inventario', desc: 'Alta, etiquetas y stock', Icon: Package, kbd: 'F2' },
  { id: 'cuaderno', label: 'Cuaderno', desc: 'Reglas de precio y categorías', Icon: BookOpen },
  { id: 'creditos', label: 'Créditos', desc: 'Clientes y saldos', Icon: Wallet, kbd: 'F3' },
  { id: 'banqueta', label: 'Banqueta', desc: 'Mostrador y ferias', Icon: MapPin, kbd: 'F4' },
]

export function HomeView() {
  const { setSection } = useAppStore()
  const [snap, setSnap] = useState(null)
  const [clockTick, setClockTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setClockTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const now = useMemo(() => new Date(), [clockTick])
  const dateLine = `${DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`
  const hour = now.getHours()
  const greeting = hour < 6 ? 'Buenas noches' : hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'

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

  const openDevices = () => {
    const p = window.bazar?.devices?.open?.()
    if (p && typeof p.then === 'function') { p.catch(() => { window.location.hash = '#devices' }); return }
    window.location.hash = '#devices'
  }

  const productosTotal = Number(snap?.productosTotal ?? 0)
  const disponibles = Number(snap?.productosDisponibles ?? 0)
  const ocupados = Math.max(0, productosTotal - disponibles)
  const credito = Number(snap?.saldoTotalPendiente ?? 0)
  const clientesConSaldo = Number(snap?.clientesConSaldo ?? 0)

  const newInventoryItem = () => {
    try {
      sessionStorage.setItem('bazar.inventoryNewProduct', '1')
    } catch { /* noop */ }
    setSection('inventario')
  }
  const newBanquetaSalida = () => {
    try { sessionStorage.setItem('bazar.banquetaNewSalida', '1') } catch { /* noop */ }
    setSection('banqueta')
  }

  return (
    <div data-app-workspace className="relative flex h-full flex-col overflow-auto bg-background">
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 mx-auto w-full max-w-[880px] px-10 pb-16 pt-14">
        <header className="space-y-2.5 motion-safe:animate-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
            {dateLine}
          </p>
          <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.028em] text-foreground">
            {greeting},{' '}
            <span className="text-muted-foreground/65 font-normal">bienvenida a</span>{' '}
            <span className="bazar-wordmark-coral">Bazar Monserrat</span>
          </h1>
          <p className="max-w-[58ch] text-[13.5px] leading-relaxed text-muted-foreground/80">
            Inventario, precios y caja en un solo workspace. Elegí un módulo o abrí el punto de venta.
          </p>
        </header>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4 pb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
              Resumen
            </h2>
            <button
              type="button"
              onClick={() => setSection('inventario')}
              className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground/75 transition-colors hover:text-foreground"
            >
              Abrir inventario
              <ArrowUpRight className="size-3" strokeWidth={1.75} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-lg border border-border/60 bg-card/40 shadow-[var(--shadow-xs)] sm:grid-cols-4 divide-x divide-y divide-border/60">
            <StatCell label="Disponibles" value={disponibles} />
            <StatCell label="En banqueta / vendidos" value={ocupados} muted />
            <StatCell label="Total artículos" value={productosTotal} muted />
            <StatCell
              label={clientesConSaldo ? `Crédito · ${clientesConSaldo} cte.` : 'Crédito'}
              value={credito}
              money
              accent={credito > 0}
            />
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4 pb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
              Acciones rápidas
            </h2>
          </div>

          <button
            type="button"
            onClick={openPdv}
            className="group mb-2 flex w-full items-center gap-3 rounded-lg border border-foreground/10 bg-foreground px-4 py-3 text-background shadow-[var(--shadow-sm)] transition-[background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-foreground/92 hover:shadow-[var(--shadow-md)] active:scale-[0.995] dark:bg-foreground/92"
          >
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-background/10">
              <ShoppingCart className="size-4" strokeWidth={1.75} />
            </span>
            <span className="flex-1 text-left">
              <span className="block text-[13px] font-medium leading-tight">Abrir punto de venta</span>
              <span className="mt-0.5 block text-[11px] leading-tight text-background/75">
                Ventana aparte · misma base de datos
              </span>
            </span>
            <ArrowUpRight className="size-4 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" strokeWidth={1.75} />
          </button>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <QuickAction Icon={Plus} label="Nuevo artículo" hint="Agregar inventario" onClick={newInventoryItem} />
            <QuickAction Icon={ScanLine} label="Nueva salida banqueta" hint="Planificar feria" onClick={newBanquetaSalida} />
            <QuickAction Icon={Printer} label="Dispositivos" hint="Scanner · impresora" onClick={openDevices} />
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4 pb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
              Módulos
            </h2>
            <button
              type="button"
              onClick={() => setSection('config')}
              className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground/75 transition-colors hover:text-foreground"
            >
              <Settings className="size-3" strokeWidth={1.75} />
              Configuración
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODULES.map(({ id, label, desc, Icon, kbd }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className="group flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-left shadow-[var(--shadow-xs)] transition-[background-color,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:border-border hover:bg-card hover:shadow-[var(--shadow-sm)] dark:bg-card/40 dark:hover:bg-card/70"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/40 text-foreground/80 transition-colors group-hover:bg-muted/70 dark:bg-muted/30 dark:group-hover:bg-muted/50">
                  <Icon className="size-[17px]" strokeWidth={1.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium leading-tight tracking-[-0.005em] text-foreground">
                      {label}
                    </span>
                    {kbd ? (
                      <kbd className="inline-flex h-[15px] items-center rounded-sm border border-border/70 bg-muted/20 px-1 font-mono text-[9px] text-muted-foreground/80">
                        {kbd}
                      </kbd>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] leading-snug text-muted-foreground/80">
                    {desc}
                  </span>
                </span>
                <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground/80" strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </section>

        <footer className="mt-14 flex items-center justify-between border-t border-border/50 pt-5 text-[11px] text-muted-foreground/65">
          <span className="inline-flex items-center gap-1.5">
            <Tag className="size-3" strokeWidth={1.5} />
            Saldos Monserrat · workspace local
          </span>
          <span className="tabular-nums">v1.0</span>
        </footer>
      </div>
    </div>
  )
}

function StatCell({ label, value, money = false, muted = false, accent = false }) {
  const display = money
    ? `$${Number(value || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
    : Number(value || 0).toLocaleString('es-MX')
  return (
    <div className={cn('relative flex flex-col gap-1 px-4 py-3.5')}>
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/75">
        {label}
      </span>
      <span
        className={cn(
          'text-[22px] font-semibold tabular-nums leading-none tracking-[-0.015em]',
          accent ? 'text-foreground' : muted ? 'text-foreground/85' : 'text-foreground',
        )}
      >
        {display}
      </span>
    </div>
  )
}

function QuickAction({ Icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2.5 rounded-md border border-border/60 bg-card/50 px-3 py-2.5 text-left shadow-[var(--shadow-xs)] transition-[background-color,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:border-border hover:bg-card hover:shadow-[var(--shadow-sm)] dark:bg-card/40 dark:hover:bg-card/70"
    >
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/40 text-foreground/75 transition-colors group-hover:bg-muted/70 dark:bg-muted/30 dark:group-hover:bg-muted/50">
        <Icon className="size-3.5" strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium leading-tight text-foreground">{label}</span>
        <span className="mt-0.5 block truncate text-[10.5px] leading-tight text-muted-foreground/75">{hint}</span>
      </span>
    </button>
  )
}
