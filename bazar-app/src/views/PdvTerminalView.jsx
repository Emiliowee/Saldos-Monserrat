import { useCallback, useEffect, useRef, useState } from 'react'
import { ShoppingCart, Search, Minus, Plus, X, DollarSign, Receipt, Package, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import { useBarcode } from '@/hooks/useBarcode'

function parsePagoCon(raw) {
  const n = Number(String(raw ?? '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function PdvTerminalView() {
  const [cart, setCart] = useState([])
  const [scanCode, setScanCode] = useState('')
  const [pagoCon, setPagoCon] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastSale, setLastSale] = useState(null)
  const inputRef = useRef(null)
  /** Evita doble cobro (p. ej. Enter repetido antes de re-render con `busy`). */
  const saleLockRef = useRef(false)
  /** `useBarcode` no debe capturar `busy` obsoleto en el closure. */
  const busyRef = useRef(false)
  busyRef.current = busy

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [])

  const addByCode = useCallback(async (code) => {
    if (saleLockRef.current || busyRef.current) return
    const db = window.bazar?.db
    if (!db?.getProductByCodigo) {
      toast.error('Base de datos no disponible.')
      return
    }
    try {
      const prod = await db.getProductByCodigo(code)
      if (!prod) {
        toast.error(`No encontrado: ${code}`)
        return
      }
      const estado = String(prod.estado || '').trim().toLowerCase()
      if (estado === 'vendido') {
        toast.error(`«${code}» ya vendido`)
        return
      }
      if (estado && estado !== 'disponible') {
        toast.error(`«${prod.codigo || code}» no disponible para venta (${estado}).`)
        return
      }
      const piezaUnica = Boolean(prod.pieza_unica)
      const stockMax = piezaUnica ? 1 : Math.max(0, Math.floor(Number(prod.stock) || 0))
      if (stockMax < 1) {
        toast.error(`Sin stock: «${prod.codigo || code}»`)
        return
      }

      setCart((prev) => {
        const existing = prev.find((it) => it.productoId === prod.id)
        if (existing) {
          if (piezaUnica) {
            toast.info('Pieza única — ya en carrito')
            return prev
          }
          const cap = Math.min(stockMax, existing.stockMax ?? stockMax)
          const nextQty = Math.min(cap, existing.cantidad + 1)
          if (nextQty === existing.cantidad) {
            toast.info('Stock máximo en carrito')
            return prev
          }
          return prev.map((it) =>
            it.productoId === prod.id ? { ...it, stockMax: cap, cantidad: nextQty } : it,
          )
        }
        return [
          ...prev,
          {
            productoId: prod.id,
            codigo: prod.codigo || '',
            nombre: prod.descripcion || prod.codigo || 'Artículo',
            precio: Number(prod.precio) || 0,
            cantidad: 1,
            piezaUnica,
            stockMax,
          },
        ]
      })
      toast.success(prod.descripcion || code)
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }, [])

  const onBarcodeScan = useCallback((c) => {
    if (saleLockRef.current || busyRef.current) return
    void addByCode(c)
  }, [addByCode])

  useBarcode(onBarcodeScan, { minLength: 3, timeout: 80 })

  const handleScan = (e) => {
    e.preventDefault()
    if (saleLockRef.current || busyRef.current) return
    const c = scanCode.trim()
    if (!c) return
    void addByCode(c)
    setScanCode('')
    inputRef.current?.focus()
  }

  const updateQty = (idx, delta) => {
    setCart((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it
        const max = it.piezaUnica ? 1 : Math.max(1, Number(it.stockMax) || 1)
        const next = Math.max(1, Math.min(max, it.cantidad + delta))
        return { ...it, cantidad: next }
      }),
    )
  }

  const removeItem = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx))

  const total = cart.reduce((s, it) => s + it.precio * it.cantidad, 0)
  const pagoNum = parsePagoCon(pagoCon)
  const cambio = pagoNum > 0 && pagoNum >= total ? pagoNum - total : null

  const cobrar = useCallback(async () => {
    if (saleLockRef.current || busyRef.current || cart.length === 0) return
    const db = window.bazar?.db
    if (!db?.addSale) {
      toast.error('Función no disponible')
      return
    }
    saleLockRef.current = true
    setBusy(true)
    try {
      const items = cart.map((it) => ({
        productoId: it.productoId,
        codigo: it.codigo,
        nombre: it.nombre,
        precio: it.precio,
        cantidad: it.cantidad,
      }))
      const pagoPayload = pagoNum > 0 ? pagoNum : null
      const result = await db.addSale({ items, pagoCon: pagoPayload, metodo: 'efectivo' })
      const cambioUi = pagoNum > 0 && pagoNum >= result.total ? pagoNum - result.total : null
      setLastSale({
        total: result.total,
        cambio: result.cambio ?? cambioUi,
        lineCount: cart.length,
      })
      setCart([])
      setPagoCon('')
      toast.success(`Venta — ${formatPrice(result.total)}`)
    } catch (e) {
      toast.error(String(e?.message || e))
    } finally {
      saleLockRef.current = false
      setBusy(false)
      inputRef.current?.focus()
    }
  }, [cart, pagoCon])

  const cancelar = () => {
    if (saleLockRef.current || busyRef.current || cart.length === 0) return
    setCart([])
    setPagoCon('')
    setLastSale(null)
    inputRef.current?.focus()
  }

  const onPagoKeyDown = (e) => {
    if (e.key !== 'Enter') return
    if (saleLockRef.current || busyRef.current || cart.length === 0) return
    e.preventDefault()
    void cobrar()
  }

  const inputClass =
    'h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm text-foreground tabular-nums shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

  return (
    <div data-pdv-terminal className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <div className="shrink-0 border-b border-border bg-card px-4 py-3">
        <form onSubmit={handleScan} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              className={inputClass}
              placeholder="Código de barras o MSR…"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </div>
          <Button type="submit" className="h-11 shrink-0 px-6 sm:self-stretch" disabled={!scanCode.trim() || busy}>
            Agregar
          </Button>
        </form>
      </div>

      <div className="flex min-h-0 flex-1 flex-col divide-y divide-border md:flex-row md:divide-x md:divide-y-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
            <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              <ShoppingCart className="size-4 text-primary" strokeWidth={1.75} />
              Líneas ({cart.reduce((s, it) => s + it.cantidad, 0)})
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-background">
            {cart.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                <Package className="size-12 text-border" strokeWidth={1} />
                <p className="max-w-xs text-[12px] leading-relaxed">
                  Listo para escanear. El lector actúa como teclado: foco en el campo de arriba.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cart.map((it, idx) => {
                  const max = it.piezaUnica ? 1 : Math.max(1, Number(it.stockMax) || 1)
                  const atMax = !it.piezaUnica && it.cantidad >= max
                  return (
                    <div
                      key={it.productoId}
                      className="flex flex-wrap items-center gap-2 px-4 py-3 sm:flex-nowrap sm:gap-3"
                    >
                      <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
                        <p className="truncate text-[13px] font-semibold text-foreground">{it.nombre}</p>
                        <p className="text-[11px] text-muted-foreground">{it.codigo}</p>
                      </div>
                      <span className="w-20 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
                        {formatPrice(it.precio)}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {!it.piezaUnica ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0"
                              onClick={() => updateQty(idx, -1)}
                              disabled={it.cantidad <= 1 || busy}
                            >
                              <Minus className="size-3.5" />
                            </Button>
                            <span className="w-9 text-center text-[13px] tabular-nums font-medium text-primary">
                              {it.cantidad}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0"
                              onClick={() => updateQty(idx, 1)}
                              disabled={atMax || busy}
                            >
                              <Plus className="size-3.5" />
                            </Button>
                          </>
                        ) : (
                          <span className="px-2 text-[10px] font-medium uppercase text-muted-foreground">Única</span>
                        )}
                      </div>
                      <span className="w-24 shrink-0 text-right text-[13px] font-bold tabular-nums text-foreground">
                        {formatPrice(it.precio * it.cantidad)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(idx)}
                        disabled={busy}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col border-t border-border bg-card md:w-72 md:border-t-0 md:border-l">
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Total</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-primary">{formatPrice(total)}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pago con</label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  className={inputClass}
                  placeholder="0.00"
                  value={pagoCon}
                  onChange={(e) => setPagoCon(e.target.value)}
                  onKeyDown={onPagoKeyDown}
                  disabled={busy}
                />
              </div>
              {cambio != null && (
                <div className="flex items-center justify-between rounded-md border border-success/35 bg-success/10 px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase text-success">Cambio</span>
                  <span className="text-sm font-bold tabular-nums text-success">{formatPrice(cambio)}</span>
                </div>
              )}
            </div>
            {lastSale ? (
              <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-success">
                  <Receipt className="size-4" strokeWidth={1.75} />
                  <span className="text-[10px] font-semibold uppercase">Última venta</span>
                </div>
                <p className="text-sm font-semibold tabular-nums text-foreground">{formatPrice(lastSale.total)}</p>
                {lastSale.lineCount > 0 ? (
                  <p className="text-[10px] text-muted-foreground">{lastSale.lineCount} línea(s)</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="space-y-2 border-t border-border p-4">
            <Button className="h-12 w-full gap-2 text-[13px]" disabled={cart.length === 0 || busy} onClick={() => void cobrar()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" strokeWidth={1.75} />}
              Cobrar (Enter)
            </Button>
            <Button variant="outline" className="h-10 w-full text-[11px]" disabled={cart.length === 0 || busy} onClick={cancelar}>
              <Trash2 className="mr-1.5 size-3.5" strokeWidth={1.75} />
              Vaciar ticket
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
