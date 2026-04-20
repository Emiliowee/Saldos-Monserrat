import { useEffect, useRef, useState } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Home,
  Package,
  ShoppingCart,
  Wallet,
  MapPin,
  BookOpen,
  Settings,
  Loader2,
  Plus,
  ScanBarcode,
  Truck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const SECTION_ITEMS = [
  { id: 'inicio', label: 'Inicio', Icon: Home },
  { id: 'pdv', label: 'Punto de venta', Icon: ShoppingCart },
  { id: 'inventario', label: 'Inventario', Icon: Package },
  { id: 'cuaderno', label: 'Cuaderno', Icon: BookOpen },
  { id: 'creditos', label: 'Créditos', Icon: Wallet },
  { id: 'banqueta', label: 'Banqueta', Icon: MapPin },
  { id: 'config', label: 'Configuración', Icon: Settings },
]

function statusLabel(raw) {
  const e = String(raw ?? 'disponible').toLowerCase()
  const map = { disponible: 'Disponible', reservado: 'Reservado', vendido: 'Vendido', en_banqueta: 'En banqueta' }
  return map[e] || e.replace(/_/g, ' ')
}

function formatPrice(p) {
  const n = Number(p)
  if (!Number.isFinite(n) || n === 0) return ''
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function AppCommandMenu({ open, onOpenChange, currentSection, onNavigate }) {
  const [query, setQuery] = useState('')
  const [productHits, setProductHits] = useState([])
  const [productLoading, setProductLoading] = useState(false)
  const reqId = useRef(0)

  useEffect(() => {
    if (!open) {
      setProductHits([])
      setProductLoading(false)
      setQuery('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setProductHits([])
      setProductLoading(false)
      return
    }
    const api = window.bazar?.db?.searchProducts
    if (typeof api !== 'function') return

    const id = ++reqId.current
    setProductLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api(q)
        if (id !== reqId.current) return
        setProductHits(Array.isArray(res) ? res.slice(0, 20) : [])
      } catch {
        if (id === reqId.current) setProductHits([])
      } finally {
        if (id === reqId.current) setProductLoading(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [query, open])

  const pickSection = (id) => {
    void onNavigate(id)
    onOpenChange(false)
  }

  const pickProduct = (row) => {
    const pid = row?.id
    void onNavigate('inventario')
    onOpenChange(false)
    queueMicrotask(() => {
      if (pid != null) {
        window.dispatchEvent(new CustomEvent('bazar:inventory-open-product', { detail: pid }))
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.querySelector('input[data-inventory-search]')?.focus?.({ preventScroll: true })
        })
      })
    })
  }

  const quickAction = (action) => {
    onOpenChange(false)
    if (action === 'new-product') {
      try {
        sessionStorage.setItem('bazar.inventoryNewProduct', '1')
      } catch { /* noop */ }
      void onNavigate('inventario')
    } else if (action === 'open-pos') {
      void onNavigate('pdv')
    } else if (action === 'new-salida') {
      sessionStorage.setItem('bazar.banquetaNewSalida', '1')
      void onNavigate('banqueta')
    }
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buscar"
      description="Buscar secciones, artículos, códigos..."
    >
      <CommandInput
        placeholder="Secciones, códigos, nombres, tags..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>

        <CommandGroup heading="Acciones rápidas">
          <CommandItem value="nuevo producto agregar" onSelect={() => quickAction('new-product')}>
            <Plus className="text-primary" />
            <span>Nuevo producto</span>
          </CommandItem>
          <CommandItem value="abrir caja punto venta pos" onSelect={() => quickAction('open-pos')}>
            <ScanBarcode className="text-primary" />
            <span>Abrir caja</span>
          </CommandItem>
          <CommandItem value="nueva salida banqueta" onSelect={() => quickAction('new-salida')}>
            <Truck className="text-primary" />
            <span>Nueva salida banqueta</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Secciones">
          {SECTION_ITEMS.map(({ id, label, Icon }) => (
            <CommandItem key={id} value={`${id} ${label}`} onSelect={() => pickSection(id)}>
              <Icon />
              <span>{label}</span>
              {id === currentSection && (
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                  Actual
                </Badge>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        {query.trim().length >= 2 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Inventario">
              {productLoading ? (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Buscando artículos...</span>
                </div>
              ) : productHits.length > 0 ? (
                productHits.map((row) => (
                  <CommandItem
                    key={row.id}
                    value={`producto ${row.codigo ?? ''} ${row.descripcion ?? ''}`}
                    onSelect={() => pickProduct(row)}
                  >
                    <Package />
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="truncate">
                          {String(row.descripcion || '').trim() || row.codigo || 'Artículo'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.codigo || '—'} · {statusLabel(row.estado)}
                        </span>
                      </div>
                      {formatPrice(row.precio) && (
                        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground/70">
                          {formatPrice(row.precio)}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))
              ) : (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  Sin resultados en inventario.
                </div>
              )}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
