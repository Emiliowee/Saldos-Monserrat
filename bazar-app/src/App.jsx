import { useCallback, useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useReducedMotion } from 'motion/react'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/useAppStore'
import { NAV_MODULES } from '@/theme/nav'
import { ensureCanLeaveCuaderno } from '@/lib/cuadernoNavGuard.js'
import { useBarcode } from '@/hooks/useBarcode'
import { usePlatform } from '@/hooks/usePlatform'
import { ThemeProvider } from '@/theme/ThemeProvider.jsx'
import { SidebarProvider, SidebarInset, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/shell/AppSidebar'
import { AppCommandMenu } from '@/components/shell/AppCommandMenu'

import { HomeView } from '@/views/HomeView'
import { InventoryView } from '@/views/InventoryView'
import { PlaceholderView } from '@/views/PlaceholderView'
import { BanquetaView } from '@/views/BanquetaView.jsx'
import { PdvHubView } from '@/views/PdvHubView.jsx'
import { PdvTerminalView } from '@/views/PdvTerminalView.jsx'
import { SettingsHubView } from '@/views/SettingsHubView'
import { CreditosView } from '@/views/CreditosView.jsx'
import { CuadernoView } from '@/views/CuadernoView.jsx'
import { DevicesApp } from '@/devices/DevicesApp'
import { RivePreviewView } from '@/views/RivePreviewView.jsx'

function embedHash() {
  if (typeof window === 'undefined') return ''
  return window.location.hash.replace(/^#/, '').split(/[?&]/)[0]
}

function renderSection(section) {
  if (section === 'inicio') return <HomeView />
  if (section === 'inventario') return <InventoryView />
  if (section === 'config') return <SettingsHubView />
  if (section === 'cuaderno') return <CuadernoView />
  if (section === 'banqueta') return <BanquetaView />
  if (section === 'pdv') return <PdvHubView />
  if (section === 'creditos') return <CreditosView />
  return <PlaceholderView section={section} />
}

function MainOutlet({ section }) {
  const reduceMotion = useReducedMotion()
  return (
    <div
      key={section}
      className={
        reduceMotion
          ? 'flex flex-1 flex-col min-h-0 overflow-hidden'
          : 'flex flex-1 flex-col min-h-0 overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-150'
      }
    >
      {renderSection(section)}
    </div>
  )
}

/** Cuando el panel está abierto en escritorio, el trigger vive en el sidebar; si está colapsado o en móvil, aquí. */
function WindowHeaderSidebarTrigger() {
  const { open, isMobile } = useSidebar()
  const showTrigger = isMobile || !open
  return (
    <div className="flex shrink-0 items-center pl-0.5" style={{ WebkitAppRegion: 'no-drag' }}>
      {showTrigger ? (
        <SidebarTrigger className="size-7 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" />
      ) : (
        <div className="size-7 shrink-0" aria-hidden />
      )}
    </div>
  )
}

function WindowControls() {
  const api = typeof window !== 'undefined' ? window.bazar?.window : undefined
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!api?.isMaximized) return
    api.isMaximized().then(setMaximized).catch(() => {})
  }, [api])

  useEffect(() => {
    if (!api?.onState) return
    const off = api.onState((state) => {
      if (state && typeof state.maximized === 'boolean') setMaximized(state.maximized)
    })
    return off
  }, [api])

  if (!api) return null

  const btn = 'inline-flex size-[30px] items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'

  return (
    <div className="flex items-center -mr-0.5" style={{ WebkitAppRegion: 'no-drag' }}>
      <button type="button" className={btn} aria-label="Minimizar" onClick={() => api.minimize?.()}>
        <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
      </button>
      <button type="button" className={btn} aria-label={maximized ? 'Restaurar' : 'Maximizar'} onClick={() => api.toggleMaximize?.()}>
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="2.5" y="2.5" width="5" height="5" stroke="currentColor" strokeWidth="1" />
            <path d="M3.5 1.5H8.5V6.5" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="inline-flex size-[30px] items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/90 hover:text-white"
        aria-label="Cerrar"
        onClick={() => api.close?.()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

function MainApp() {
  const { section, setSection } = useAppStore()
  const navigateSections = useCallback(
    async (next) => {
      if (section === 'cuaderno' && next !== 'cuaderno') {
        if (!(await ensureCanLeaveCuaderno())) return
      }
      setSection(next)
    },
    [section, setSection],
  )

  const onHistoryBack = useCallback(async () => {
    const s = useAppStore.getState()
    if (s.section === 'config' && s.sectionBeforeConfig != null) {
      s.navigateBack()
      return
    }
    const prev = s.navBackStack[s.navBackStack.length - 1]
    if (s.section === 'cuaderno' && prev != null && prev !== 'cuaderno') {
      if (!(await ensureCanLeaveCuaderno())) return
    }
    s.navigateBack()
  }, [])

  const onHistoryForward = useCallback(async () => {
    const s = useAppStore.getState()
    if (s.navForwardStack.length === 0) return
    const next = s.navForwardStack[0]
    if (s.section === 'cuaderno' && next !== 'cuaderno' && next !== 'config') {
      if (!(await ensureCanLeaveCuaderno())) return
    }
    s.navigateForward()
  }, [])

  usePlatform()

  const [commandOpen, setCommandOpen] = useState(false)
  const platform = typeof window !== 'undefined' ? window.bazar?.runtime?.platform ?? '' : ''
  const hideNativeWindowControls = platform === 'darwin'
  const sectionTitle = NAV_MODULES.find((m) => m.id === section)?.label ?? 'Bazar Monserrat'

  useHotkeys('f1', () => void navigateSections('pdv'), { preventDefault: true })
  useHotkeys('f2', () => void navigateSections('inventario'), { preventDefault: true })
  useHotkeys('f3', () => void navigateSections('creditos'), { preventDefault: true })
  useHotkeys('f4', () => void navigateSections('banqueta'), { preventDefault: true })

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleBarcode = useCallback(
    async (code) => {
      const db = window.bazar?.db

      if (section === 'inventario') {
        const prod = await db?.getProductByCodigo?.(code)
        if (prod) {
          sessionStorage.setItem('bazar.inventoryOpenProductId', String(prod.id))
          window.dispatchEvent(new CustomEvent('bazar:inventory-open-product', { detail: prod.id }))
          toast.success(`${prod.descripcion || code}`)
        } else {
          toast.error(`No se encontró: ${code}`)
        }
        return
      }

      if (section === 'pdv') {
        window.dispatchEvent(new CustomEvent('bazar:pos-scan', { detail: code }))
        return
      }

      if (section === 'banqueta') {
        window.dispatchEvent(new CustomEvent('bazar:banqueta-scan', { detail: code }))
        return
      }

      const prod = await db?.getProductByCodigo?.(code)
      if (prod) {
        sessionStorage.setItem('bazar.inventoryOpenProductId', String(prod.id))
        void navigateSections('inventario')
        toast.success(`${prod.descripcion || code}`)
      } else {
        toast.info(`Código: ${code} — No encontrado en inventario`)
      }
    },
    [section, navigateSections],
  )

  useBarcode(handleBarcode, { minLength: 3, timeout: 80 })

  return (
    <SidebarProvider>
      <AppSidebar
        section={section}
        onNavigate={navigateSections}
        onHistoryBack={onHistoryBack}
        onHistoryForward={onHistoryForward}
        onSearchOpen={() => setCommandOpen(true)}
      />
      <SidebarInset
        data-app-workspace
        className="flex min-h-0 flex-col bg-[#FFFFFF] dark:bg-background"
      >
        <header
          className="relative flex h-11 shrink-0 items-center border-b border-[#ececec] bg-[#F8F8F7] px-2 dark:border-zinc-800 dark:bg-zinc-900"
          style={{ WebkitAppRegion: 'drag' }}
          onDoubleClick={() => {
            const api = window.bazar?.window
            if (api?.toggleMaximize) api.toggleMaximize()
          }}
        >
          <WindowHeaderSidebarTrigger />
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {sectionTitle}
          </span>
          <div className="ml-auto flex items-center">
            {!hideNativeWindowControls && <WindowControls />}
          </div>
        </header>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          <MainOutlet section={section} />
        </div>
      </SidebarInset>
      <AppCommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        currentSection={section}
        onNavigate={navigateSections}
      />
      <Toaster position="bottom-right" />
    </SidebarProvider>
  )
}

function EmbedShell({ title, children }) {
  usePlatform()
  const platform = typeof window !== 'undefined' ? window.bazar?.runtime?.platform ?? '' : ''
  return (
    <div className="embed-shell relative flex h-screen flex-col bg-background" data-app-workspace>
      <header
        className="relative z-20 flex h-11 shrink-0 items-center justify-between border-b border-[#ececec] bg-[#F8F8F7] px-3 dark:border-zinc-800 dark:bg-zinc-900"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <span className="text-[13px] font-medium text-foreground select-none tracking-[-0.01em]">{title}</span>
        {platform !== 'darwin' && <WindowControls />}
      </header>
      <div className="relative min-h-0 flex-1 overflow-auto">{children}</div>
      <Toaster position="bottom-right" />
    </div>
  )
}

function AppContent() {
  const hash = embedHash()
  if (hash === 'devices') return <EmbedShell title="Dispositivos"><DevicesApp /></EmbedShell>
  if (hash === 'rive') return <EmbedShell title="Vista previa Rive"><RivePreviewView /></EmbedShell>
  if (hash === 'pdv-terminal') return <EmbedShell title="Punto de venta"><PdvTerminalView /></EmbedShell>
  return <MainApp />
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}
