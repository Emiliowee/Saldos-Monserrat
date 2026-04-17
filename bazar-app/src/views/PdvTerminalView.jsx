import { useCallback, useEffect, useRef, useState } from 'react'
import { ShoppingCart, Search, Minus, Plus, X, DollarSign, Receipt, Package, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import { useBarcode } from '@/hooks/useBarcode'

export function PdvTerminalView() {
  const [cart, setCart] = useState([])
  const [scanCode, setScanCode] = useState('')
  const [pagoCon, setPagoCon] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastSale, setLastSale] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [])

  const addByCode = useCallback(async (code) => {
    const db = window.bazar?.db
    if (!db?.getProductByCodigo) return
    try {
      const prod = await db.getProductByCodigo(code)
      if (!prod) { toast.error(`No encontrado: ${code}`); return }
      const estado = String(prod.estado || '').toLowerCase()
      if (estado === 'vendido') { toast.error(`«${code}» ya vendido`); return }
      setCart(prev => {
        const existing = prev.find(it => it.productoId === prod.id)
        if (existing) {
          if (prod.pieza_unica) { toast.info('Pieza única — ya en carrito'); return prev }
          return prev.map(it => it.productoId === prod.id ? { ...it, cantidad: it.cantidad + 1 } : it)
        }
        return [...prev, {
          productoId: prod.id,
          codigo: prod.codigo || '',
          nombre: prod.descripcion || prod.codigo || 'Artículo',
          precio: Number(prod.precio) || 0,
          cantidad: 1,
          piezaUnica: Boolean(prod.pieza_unica),
        }]
      })
      toast.success(prod.descripcion || code)
    } catch (e) { toast.error(String(e?.message || e)) }
  }, [])

  useBarcode((code) => { void addByCode(code) }, { minLength: 3, timeout: 80 })

  const handleScan = (e) => {
    e.preventDefault()
    const c = scanCode.trim()
    if (!c) return
    void addByCode(c)
    setScanCode('')
    inputRef.current?.focus()
  }

  const updateQty = (idx, delta) => {
    setCart(prev => prev.map((it, i) => i !== idx ? it : { ...it, cantidad: Math.max(1, it.cantidad + delta) }))
  }
  const removeItem = (idx) => setCart(prev => prev.filter((_, i) => i !== idx))

  const total = cart.reduce((s, it) => s + it.precio * it.cantidad, 0)
  const pagoNum = Number(String(pagoCon).replace(',', '.')) || 0
  const cambio = pagoNum > 0 && pagoNum >= total ? pagoNum - total : null

  const cobrar = async () => {
    if (cart.length === 0) return
    const db = window.bazar?.db
    if (!db?.addSale) { toast.error('Función no disponible'); return }
    setBusy(true)
    try {
      const items = cart.map(it => ({ productoId: it.productoId, codigo: it.codigo, nombre: it.nombre, precio: it.precio, cantidad: it.cantidad }))
      const result = await db.addSale({ items, total, pagoCon: pagoNum > 0 ? pagoNum : null, metodo: 'efectivo' })
      setLastSale({ total, cambio: result.cambio ?? cambio, items: cart.length })
      setCart([])
      setPagoCon('')
      toast.success(`Venta — ${formatPrice(total)}`)
    } catch (e) { toast.error(String(e?.message || e)) }
    finally { setBusy(false); inputRef.current?.focus() }
  }

  const cancelar = () => {
    if (cart.length === 0) return
    setCart([])
    setPagoCon('')
    setLastSale(null)
    inputRef.current?.focus()
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b px-4 py-3">
        <form onSubmit={handleScan} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Escanear o buscar código..."
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={!scanCode.trim()}>Agregar</Button>
        </form>
      </div>

      <div className="flex flex-1 min-h-0 divide-x">
        <div className="flex flex-1 flex-col min-w-0">
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b bg-muted/20">
            <span className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="size-4" />
              Carrito ({cart.reduce((s, it) => s + it.cantidad, 0)})
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Package className="size-10" strokeWidth={1} />
                <p className="text-sm">Escanea un producto</p>
              </div>
            ) : (
              <div className="divide-y">
                {cart.map((it, idx) => (
                  <div key={it.productoId} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{it.nombre}</p>
                      <p className="text-xs text-muted-foreground font-mono">{it.codigo}</p>
                    </div>
                    <span className="text-sm tabular-nums shrink-0 w-20 text-right">{formatPrice(it.precio)}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {!it.piezaUnica ? (
                        <>
                          <button type="button" className="size-7 inline-flex items-center justify-center rounded border hover:bg-accent" onClick={() => updateQty(idx, -1)} disabled={it.cantidad <= 1}><Minus className="size-3" /></button>
                          <span className="w-8 text-center text-sm tabular-nums">{it.cantidad}</span>
                          <button type="button" className="size-7 inline-flex items-center justify-center rounded border hover:bg-accent" onClick={() => updateQty(idx, 1)}><Plus className="size-3" /></button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground px-2">Único</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0 w-20 text-right">{formatPrice(it.precio * it.cantidad)}</span>
                    <button type="button" className="size-7 inline-flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => removeItem(idx)}><X className="size-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-64 shrink-0 flex flex-col bg-muted/10">
          <div className="flex-1 p-4 flex flex-col gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight">{formatPrice(total)}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Pago con</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input type="text" className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring" placeholder="0.00" value={pagoCon} onChange={(e) => setPagoCon(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void cobrar() }} />
              </div>
              {cambio != null && (
                <div className="flex items-center justify-between rounded-lg bg-success/10 px-3 py-2">
                  <span className="text-xs text-success font-medium">Cambio</span>
                  <span className="text-sm font-bold tabular-nums text-success">{formatPrice(cambio)}</span>
                </div>
              )}
            </div>
            {lastSale && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-1">
                <div className="flex items-center gap-2 text-success"><Receipt className="size-4" /><span className="text-xs font-medium">Última venta</span></div>
                <p className="text-sm font-semibold tabular-nums">{formatPrice(lastSale.total)}</p>
              </div>
            )}
          </div>
          <div className="p-4 pt-0 space-y-2">
            <Button className="w-full h-11 text-base gap-2" disabled={cart.length === 0 || busy} onClick={() => void cobrar()}><Receipt className="size-4" />Cobrar</Button>
            <Button variant="outline" className="w-full" disabled={cart.length === 0 || busy} onClick={cancelar}><Trash2 className="size-3.5 mr-1.5" />Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
