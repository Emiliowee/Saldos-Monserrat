import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Monitor, Undo2, X } from 'lucide-react'
import { PdvTerminalView } from '@/views/PdvTerminalView'
import { PdvReturnsView } from '@/pdv/PdvReturnsView'
import { useTheme } from '@/theme/ThemeProvider.jsx'
import '@/pdv/pdv-retro.css'

/** Controles ventana frameless (misma API que la ventana principal). */
function PdvWindowControls() {
  const api = typeof window !== 'undefined' ? window.bazar?.window : undefined
  if (!api) return null
  const btn =
    'inline-flex size-[30px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
  return (
    <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' }}>
      <button type="button" className={btn} aria-label="Minimizar" onClick={() => api.minimize?.()}>
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button type="button" className={btn} aria-label="Maximizar" onClick={() => api.toggleMaximize?.()}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        type="button"
        className={`${btn} hover:text-destructive`}
        aria-label="Cerrar caja"
        onClick={() => api.close?.()}
      >
        <X className="size-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}

/**
 * Caja en ventana/hash `#pdv-terminal`: cromado propio (sin sidebar), mismos colores que el resto de Bazar.
 */
export function PdvStandaloneApp() {
  const [tab, setTab] = useState('venta')
  const hideNative = typeof window !== 'undefined' && window.bazar?.runtime?.platform === 'darwin'
  const { resolvedTheme } = useTheme()

  const tabBtn = (active) =>
    `rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
      active
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`

  return (
    <div data-pdv-standalone className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header
        className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
            <Monitor className="size-4 text-primary" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
              Caja Monserrat
            </p>
            <p className="truncate text-[10px] text-muted-foreground">Mostrador — misma base que el gestión</p>
          </div>
        </div>
        <nav
          className="hidden shrink-0 items-center gap-1 sm:flex"
          style={{ WebkitAppRegion: 'no-drag' }}
          aria-label="Secciones caja"
        >
          <button type="button" onClick={() => setTab('venta')} className={tabBtn(tab === 'venta')}>
            Venta
          </button>
          <button
            type="button"
            onClick={() => setTab('devoluciones')}
            className={`flex items-center gap-1.5 ${tabBtn(tab === 'devoluciones')}`}
          >
            <Undo2 className="size-3" strokeWidth={2} />
            Devoluciones
          </button>
        </nav>
        {!hideNative ? <PdvWindowControls /> : <div className="w-2 shrink-0" />}
      </header>

      <div
        className="flex shrink-0 gap-1 border-b border-border bg-muted/30 p-2 sm:hidden"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <button type="button" onClick={() => setTab('venta')} className={`flex-1 py-2 ${tabBtn(tab === 'venta')}`}>
          Venta
        </button>
        <button
          type="button"
          onClick={() => setTab('devoluciones')}
          className={`flex-1 py-2 ${tabBtn(tab === 'devoluciones')}`}
        >
          Devoluciones
        </button>
      </div>

      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === 'venta' ? <PdvTerminalView /> : <PdvReturnsView />}
      </main>
      <Toaster position="top-center" richColors theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />
    </div>
  )
}
