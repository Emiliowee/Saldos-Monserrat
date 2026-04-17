import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Home,
  Package,
  ShoppingCart,
  Wallet,
  MapPin,
  BookOpen,
  Settings,
  LogOut,
  Search,
  ChevronDown,
  CheckCircle2,
  Circle,
  Plus,
  MoreHorizontal,
  EyeOff,
  Folder,
  FolderOpen,
  Keyboard,
  PanelLeftIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { localPathToFileUrl } from '@/lib/localFileUrl'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/useAppStore'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const DEFAULT_LOGO = '/branding/logo.jpg'

const SEARCH_KBD =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform) ? '⌘K' : 'Ctrl+K'

const NAV_MAIN = [
  { id: 'inicio', label: 'Inicio', Icon: Home, kbd: null },
  { id: 'pdv', label: 'Punto de venta', Icon: ShoppingCart, kbd: 'F1' },
  { id: 'inventario', label: 'Inventario', Icon: Package, kbd: 'F2' },
  { id: 'cuaderno', label: 'Cuaderno', Icon: BookOpen, kbd: null },
]

const NAV_MORE = [
  { id: 'creditos', label: 'Créditos', Icon: Wallet, kbd: 'F3' },
  { id: 'banqueta', label: 'Banqueta', Icon: MapPin, kbd: 'F4' },
]

/** Notion-style: 8px grid, 22px icon column, 30px search, 6px section gaps, #f1f0ef hover, warm grays (no jump to black). */
const ROW_HOVER = 'hover:bg-[#f1f0ef] dark:hover:bg-zinc-800/80'
const ROW_ACTIVE = 'bg-[#f1f0ef] dark:bg-zinc-800/55'
const TEXT_ROW = 'text-muted-foreground'
/** Hover: ligeramente más oscuro que muted, sin negro puro */
const TEXT_ROW_HOVER =
  'hover:text-foreground/80 dark:hover:text-zinc-200/90'
const ICON_STROKE = 1.5
/** Columna de iconos alineada (22px) — glifo 15px centrado */
const ICON_COL =
  'inline-flex size-[22px] shrink-0 items-center justify-center text-muted-foreground'
const ICON_COL_HOVER = 'group-hover:text-foreground/75 dark:group-hover:text-zinc-300/95'
const PAD_X = 'px-4'

/** Botones discretos en cabecera (tipo Linear/Notion): poco contraste hasta hover */
const HEADER_ICON_BTN = cn(
  'inline-flex size-[22px] shrink-0 items-center justify-center rounded-md p-0',
  'text-muted-foreground/55 opacity-90 transition-[opacity,background-color,color] duration-150',
  'hover:bg-[#f1f0ef] hover:text-foreground/70 hover:opacity-100 dark:hover:bg-zinc-800/75 dark:hover:text-zinc-300/90',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20',
)

const headerDrag = { WebkitAppRegion: 'drag' }
const noDrag = { WebkitAppRegion: 'no-drag' }

function SidebarPanelButton({ className }) {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      aria-label="Alternar barra lateral"
      onClick={() => toggleSidebar()}
      className={className}
    >
      <PanelLeftIcon className="size-[15px]" strokeWidth={ICON_STROKE} aria-hidden />
    </button>
  )
}

function formatFechaCorta(raw) {
  if (!raw) return ''
  const s = String(raw).trim()
  if (!s) return ''
  let d
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, dd] = s.split('-').map((n) => Number(n))
    d = new Date(y, (m || 1) - 1, dd || 1)
  } else {
    d = new Date(s)
  }
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

const BANQUETA_FOLDER_HIDDEN_KEY = 'bazar.banquetaFolderHidden'
const BANQUETA_FOLDER_OPEN_KEY = 'bazar.banquetaFolderOpen'

function readBanquetaFolderHidden() {
  try { return localStorage.getItem(BANQUETA_FOLDER_HIDDEN_KEY) === '1' } catch { return false }
}
function readBanquetaFolderOpen() {
  try {
    const v = localStorage.getItem(BANQUETA_FOLDER_OPEN_KEY)
    return v == null ? true : v === '1'
  } catch { return true }
}

export function useBanquetaFolderVisibility() {
  const [hidden, setHidden] = useState(() => (typeof window !== 'undefined' ? readBanquetaFolderHidden() : false))
  useEffect(() => {
    const h = () => setHidden(readBanquetaFolderHidden())
    window.addEventListener('bazar:banqueta-folder-visibility', h)
    window.addEventListener('storage', h)
    return () => {
      window.removeEventListener('bazar:banqueta-folder-visibility', h)
      window.removeEventListener('storage', h)
    }
  }, [])
  const setVisible = useCallback((visible) => {
    try { localStorage.setItem(BANQUETA_FOLDER_HIDDEN_KEY, visible ? '0' : '1') } catch { /* noop */ }
    setHidden(!visible)
    window.dispatchEvent(new CustomEvent('bazar:banqueta-folder-visibility'))
  }, [])
  return { hidden, setVisible }
}

function BanquetaSalidasSection({ onOpenSalida, onCreate, onGoSection, onHide }) {
  const [open, setOpen] = useState(() => (typeof window !== 'undefined' ? readBanquetaFolderOpen() : true))
  const [salidas, setSalidas] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v
      try { localStorage.setItem(BANQUETA_FOLDER_OPEN_KEY, next ? '1' : '0') } catch { /* noop */ }
      return next
    })
  }

  const reload = useCallback(async () => {
    const api = window.bazar?.db
    if (!api?.listBanquetaSalidas) { setSalidas([]); setLoaded(true); return }
    try {
      const list = await api.listBanquetaSalidas()
      setSalidas(Array.isArray(list) ? list : [])
    } catch { setSalidas([]) }
    finally { setLoaded(true) }
  }, [])

  useEffect(() => {
    void reload()
    const h = () => { void reload() }
    window.addEventListener('bazar:banqueta-salidas-changed', h)
    return () => window.removeEventListener('bazar:banqueta-salidas-changed', h)
  }, [reload])

  const { activa, borradores, cerradas } = useMemo(() => {
    const a = []
    const b = []
    const c = []
    for (const s of salidas) {
      const st = String(s.estado || '').toLowerCase()
      if (st === 'activa') a.push(s)
      else if (st === 'borrador') b.push(s)
      else c.push(s)
    }
    return { activa: a[0] || null, borradores: b, cerradas: c.slice(0, 5) }
  }, [salidas])

  const totalVisible = (activa ? 1 : 0) + borradores.length + cerradas.length

  return (
    <div className="group/section mt-3 flex flex-col gap-px">
      <div className="flex h-[26px] items-center gap-0.5 pr-1">
        <button
          type="button"
          onClick={toggleOpen}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left transition-colors',
            'text-muted-foreground/80',
            'hover:bg-muted/55 hover:text-foreground/80 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-300/90',
          )}
          aria-expanded={open}
        >
          <span
            className={cn(
              'inline-flex size-[15px] shrink-0 items-center justify-center text-muted-foreground/75 transition-transform duration-200',
              open ? 'text-foreground/65' : 'rotate-[-6deg] text-muted-foreground/65',
            )}
            aria-hidden
          >
            {open ? (
              <FolderOpen className="size-[13px] transition-transform duration-200" strokeWidth={1.6} />
            ) : (
              <Folder className="size-[13px] transition-transform duration-200" strokeWidth={1.6} />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium tracking-[-0.003em]">
            Salidas
          </span>
          {totalVisible > 0 && (
            <span className="shrink-0 rounded bg-muted/40 px-1 text-[9px] font-medium tabular-nums text-muted-foreground/70 group-hover/section:bg-muted/60">
              {totalVisible}
            </span>
          )}
        </button>
        <button
          type="button"
          title="Nueva salida"
          aria-label="Nueva salida"
          onClick={(e) => { e.stopPropagation(); onCreate?.() }}
          className={cn(
            'inline-flex size-[20px] shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity',
            'text-muted-foreground/70 hover:bg-muted/55 hover:text-foreground/80 dark:hover:bg-zinc-800/70',
            'group-hover/section:opacity-100 focus-visible:opacity-100',
          )}
        >
          <Plus className="size-[12px]" strokeWidth={2} />
        </button>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Opciones"
              aria-label="Opciones de la carpeta"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'inline-flex size-[20px] shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity',
                'text-muted-foreground/70 hover:bg-muted/55 hover:text-foreground/80 dark:hover:bg-zinc-800/70',
                'group-hover/section:opacity-100 focus-visible:opacity-100',
                menuOpen && 'bg-muted/55 opacity-100 dark:bg-zinc-800/70',
              )}
            >
              <MoreHorizontal className="size-[12px]" strokeWidth={2} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={4} className="w-52">
            <DropdownMenuItem inset={false} onClick={() => onCreate?.()} className="gap-2 text-[12.5px]">
              <Plus className="size-3.5 opacity-70" />
              Nueva salida
            </DropdownMenuItem>
            <DropdownMenuItem inset={false} onClick={() => onGoSection?.()} className="gap-2 text-[12.5px]">
              <FolderOpen className="size-3.5 opacity-70" />
              Ver todas
            </DropdownMenuItem>
            <DropdownMenuSeparator className="" />
            <DropdownMenuItem inset={false} onClick={() => onHide?.()} className="gap-2 text-[12.5px]">
              <EyeOff className="size-3.5 opacity-70" />
              Ocultar de la barra
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open && (
        <div className="flex flex-col gap-px pb-1">
          {!loaded ? (
            <div className="h-[22px]" />
          ) : totalVisible === 0 ? (
            <button
              type="button"
              onClick={() => onCreate?.()}
              className={cn(
                'flex h-[26px] items-center gap-2 rounded-md pl-[28px] pr-2 text-left text-[12px] italic',
                'text-muted-foreground/55 hover:bg-[#f1f0ef] hover:text-foreground/75',
                'dark:hover:bg-zinc-800/60 dark:hover:text-zinc-300/85',
              )}
            >
              <Plus className="size-[11px]" strokeWidth={1.75} />
              Nueva salida…
            </button>
          ) : (
            <>
              {activa && (
                <SalidaRow
                  key={`a-${activa.id}`}
                  salida={activa}
                  variant="activa"
                  onClick={() => onOpenSalida?.(activa.id)}
                />
              )}
              {borradores.map((s) => (
                <SalidaRow
                  key={`b-${s.id}`}
                  salida={s}
                  variant="borrador"
                  onClick={() => onOpenSalida?.(s.id)}
                />
              ))}
              {cerradas.map((s) => (
                <SalidaRow
                  key={`c-${s.id}`}
                  salida={s}
                  variant="cerrada"
                  onClick={() => onOpenSalida?.(s.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => onGoSection?.()}
                className={cn(
                  'mt-px flex h-[22px] items-center gap-1 rounded-md pl-[28px] pr-2 text-left text-[10.5px]',
                  'text-muted-foreground/55 hover:bg-[#f1f0ef] hover:text-foreground/75',
                  'dark:hover:bg-zinc-800/60 dark:hover:text-zinc-300/80',
                )}
              >
                Ver todas
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SalidaRow({ salida, variant, onClick }) {
  const nombre = String(salida.nombre || `Salida #${salida.id}`)
  const count = Number(salida.item_count) || 0
  const fecha = formatFechaCorta(salida.fecha_planeada)
  const isActiva = variant === 'activa'
  const isCerrada = variant === 'cerrada'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group/sal flex h-[26px] w-full items-center gap-1.5 rounded-md pl-[22px] pr-2 text-left transition-colors',
        'hover:bg-[#f1f0ef] dark:hover:bg-zinc-800/70',
        isActiva && 'bg-primary/[0.04] hover:bg-primary/[0.08]',
      )}
    >
      <span className="inline-flex size-[14px] shrink-0 items-center justify-center">
        {isActiva ? (
          <span className="relative inline-flex size-[7px]">
            <span className="absolute inset-0 rounded-full bg-primary" />
            <span className="absolute -inset-[2px] animate-ping rounded-full bg-primary/40" />
          </span>
        ) : isCerrada ? (
          <CheckCircle2 className="size-[11px] text-muted-foreground/55" strokeWidth={1.75} />
        ) : (
          <Circle className="size-[8px] text-muted-foreground/55 fill-muted-foreground/20" strokeWidth={0} />
        )}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[12px] leading-none tracking-[-0.005em]',
          isActiva ? 'font-medium text-foreground/90' : isCerrada ? 'text-muted-foreground/80' : 'text-foreground/80',
        )}
      >
        {nombre}
      </span>
      {fecha && (
        <span className="shrink-0 text-[9.5px] tabular-nums text-muted-foreground/55 group-hover/sal:text-muted-foreground/70">
          {fecha}
        </span>
      )}
      {count > 0 && (
        <span className="shrink-0 text-[9.5px] font-medium tabular-nums text-muted-foreground/55">
          {count}
        </span>
      )}
    </button>
  )
}

/**
 * @param {object} p
 * @param {string} p.label
 * @param {import('lucide-react').LucideIcon} p.Icon
 * @param {string | null | undefined} [p.kbd]
 * @param {boolean} p.active
 * @param {() => void} p.onClick
 * @param {import('react').ReactNode} [p.trailing]
 */
function NavItem({ label, Icon, kbd, active, onClick, trailing = null }) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className={cn(
        'group flex h-8 w-full items-center gap-2 rounded-lg pr-2 pl-0 text-left text-[13px] font-medium leading-snug tracking-[-0.01em] transition-[background-color,color] duration-100',
        active ? cn(ROW_ACTIVE, 'text-foreground') : cn(TEXT_ROW, TEXT_ROW_HOVER, ROW_HOVER),
      )}
    >
      <span className={cn(ICON_COL, !active && ICON_COL_HOVER, active && 'text-foreground')} aria-hidden>
        <Icon className="size-[15px]" strokeWidth={ICON_STROKE} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
      {kbd ? (
        <kbd className="hidden h-4 items-center rounded border border-border/70 bg-background/50 px-1 font-mono text-[9px] text-muted-foreground tabular-nums sm:inline-flex">
          {kbd}
        </kbd>
      ) : null}
    </button>
  )
}

export function AppSidebar({ section, onNavigate, onSearchOpen, onHistoryBack, onHistoryForward }) {
  const navigateBackStore = useAppStore((s) => s.navigateBack)
  const navigateForwardStore = useAppStore((s) => s.navigateForward)
  const navigateBack = onHistoryBack ?? (() => navigateBackStore())
  const navigateForward = onHistoryForward ?? (() => navigateForwardStore())
  const navBackStack = useAppStore((s) => s.navBackStack)
  const navForwardStack = useAppStore((s) => s.navForwardStack)
  const sectionBeforeConfig = useAppStore((s) => s.sectionBeforeConfig)
  const requestOpenBanquetaSalida = useAppStore((s) => s.requestOpenBanquetaSalida)
  const { hidden: banquetaFolderHidden, setVisible: setBanquetaFolderVisible } = useBanquetaFolderVisibility()

  const openBanquetaSalida = useCallback(
    (id) => {
      requestOpenBanquetaSalida(Number(id) || null)
      onNavigate('banqueta')
    },
    [onNavigate, requestOpenBanquetaSalida],
  )

  const createBanquetaSalida = useCallback(() => {
    try { sessionStorage.setItem('bazar.banquetaNewSalida', '1') } catch { /* noop */ }
    onNavigate('banqueta')
  }, [onNavigate])

  const canGoBack =
    (section === 'config' && sectionBeforeConfig != null) || navBackStack.length > 0
  const canGoForward = navForwardStack.length > 0

  const [workspaceName, setWorkspaceName] = useState('Bazar Monserrat')
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO)

  const loadIdentity = useCallback(async () => {
    const st = await window.bazar?.settings?.get?.()
    if (!st || typeof st !== 'object') return
    setWorkspaceName(String(st.workspaceDisplayName || 'Bazar Monserrat'))
    const p = String(st.workspaceLogoPath || '').trim()
    setLogoSrc(p ? localPathToFileUrl(p) : DEFAULT_LOGO)
  }, [])

  useEffect(() => {
    void loadIdentity()
  }, [loadIdentity])

  const goWorkspaceSettings = () => {
    sessionStorage.setItem('settingsInitialSection', 'workspace')
    onNavigate('config')
  }

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar" className="">
      <SidebarHeader className={cn(PAD_X, 'pb-0 pt-[3px]')} style={headerDrag}>
        <div className="flex min-h-[24px] items-center gap-0.5" style={noDrag}>
          <button
            type="button"
            className={cn(HEADER_ICON_BTN, !canGoBack && 'opacity-35')}
            aria-label="Ir atrás en el historial de secciones"
            title="Atrás"
            disabled={!canGoBack}
            onClick={() => void navigateBack()}
          >
            <ChevronLeft className="size-[15px]" strokeWidth={ICON_STROKE} aria-hidden />
          </button>
          <button
            type="button"
            className={cn(HEADER_ICON_BTN, !canGoForward && 'opacity-35')}
            aria-label="Ir adelante en el historial de secciones"
            title="Adelante"
            disabled={!canGoForward}
            onClick={() => void navigateForward()}
          >
            <ChevronRight className="size-[15px]" strokeWidth={ICON_STROKE} aria-hidden />
          </button>
          <span className="min-w-[2px] flex-1" aria-hidden />
          <SidebarPanelButton
            className={cn(
              'inline-flex size-[22px] shrink-0 items-center justify-center p-0 text-muted-foreground/70 transition-colors',
              'hover:bg-[#f1f0ef] hover:text-foreground/80 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200/90',
            )}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'mt-[5px] flex w-full items-center gap-2.5 rounded-lg py-1.5 pl-0 pr-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
                ROW_HOVER,
              )}
              style={noDrag}
            >
              <img
                src={logoSrc}
                alt=""
                width={80}
                height={80}
                className="h-9 w-auto max-h-9 max-w-[2.75rem] shrink-0 object-contain object-left [image-rendering:auto] select-none"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_LOGO
                }}
                decoding="async"
              />
              <span className="flex-1 truncate text-[13px] font-medium leading-snug tracking-[-0.01em] text-foreground/90">
                {workspaceName}
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={ICON_STROKE} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" sideOffset={4} className="w-52 rounded-lg">
            <DropdownMenuItem inset={false} onClick={goWorkspaceSettings} className="gap-2 text-[13px]">
              <Settings className="size-3.5 opacity-70" />
              Configuración del espacio
            </DropdownMenuItem>
            <DropdownMenuSeparator className="" />
            <DropdownMenuItem
              inset={false}
              variant="destructive"
              onClick={() => window.bazar?.window?.close?.()}
              className="gap-2 text-[13px] text-destructive focus:text-destructive"
            >
              <LogOut className="size-3.5 opacity-70" />
              Cerrar aplicación
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className={cn('flex flex-col gap-1.5 pb-2 pt-3', PAD_X)}>
        <button
          type="button"
          onClick={onSearchOpen}
          className={cn(
            'flex h-[30px] w-full items-center gap-2 rounded-lg border-0 pl-0 pr-2.5 text-[12.5px] font-medium leading-none shadow-none transition-colors',
            TEXT_ROW,
            'bg-muted/30 dark:bg-zinc-800/40',
            'hover:bg-muted/45 hover:text-foreground/82 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200/90',
            ROW_HOVER,
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/25',
          )}
        >
          <span className={cn(ICON_COL)} aria-hidden>
            <Search className="size-[14px]" strokeWidth={ICON_STROKE} />
          </span>
          <span className="min-w-0 flex-1 truncate text-left tracking-[-0.01em]">Buscar…</span>
          <kbd className="pointer-events-none inline-flex h-4 shrink-0 select-none items-center rounded-none border-0 bg-transparent px-1 font-mono text-[9px] text-muted-foreground/65 shadow-none">
            {SEARCH_KBD}
          </kbd>
        </button>

        <nav aria-label="Principal" className="flex min-h-[131px] flex-col gap-px">
          {NAV_MAIN.map(({ id, label, Icon, kbd }) => (
            <NavItem
              key={id}
              label={label}
              Icon={Icon}
              kbd={kbd}
              active={section === id}
              onClick={() => onNavigate(id)}
            />
          ))}
        </nav>

        <div className="flex flex-col gap-px">
          <div className="flex h-[30px] shrink-0 items-center pl-[30px] pr-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Más
            </span>
          </div>
          <nav aria-label="Más" className="flex flex-col gap-px">
            {NAV_MORE.map(({ id, label, Icon, kbd }) => (
              <NavItem
                key={id}
                label={label}
                Icon={Icon}
                kbd={kbd}
                active={section === id}
                onClick={() => onNavigate(id)}
              />
            ))}
          </nav>
        </div>

        {!banquetaFolderHidden && (
          <BanquetaSalidasSection
            onOpenSalida={openBanquetaSalida}
            onCreate={createBanquetaSalida}
            onGoSection={() => onNavigate('banqueta')}
            onHide={() => setBanquetaFolderVisible(false)}
          />
        )}
      </SidebarContent>

      <SidebarFooter className={cn('pb-3 pt-1', PAD_X)}>
        <div className="space-y-px">
          <NavItem
            label="Configuración"
            Icon={Settings}
            kbd={null}
            active={section === 'config'}
            onClick={() => onNavigate('config')}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-2 pl-0 pr-2 text-[10px] leading-snug text-muted-foreground">
          <span className={ICON_COL}>
            <Keyboard className="size-[14px]" strokeWidth={ICON_STROKE} />
          </span>
          <span>Ctrl+B ocultar sidebar</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
