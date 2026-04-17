import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Wallet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Phone,
  StickyNote,
  X,
  User,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PageHeader,
  PageHeaderDivider,
  ChipFilter,
  EmptyState,
  SearchField,
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableCell,
  DataTableShell,
} from '@/components/premium'

function db() {
  return typeof window !== 'undefined' ? window.bazar?.db : undefined
}

function formatMovFecha(v) {
  if (!v) return '—'
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v))
  } catch {
    return String(v).slice(0, 16).replace('T', ' ')
  }
}

function Overlay({ children, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] dark:bg-black/55" onClick={onClose} />
      <div className="relative z-10 mx-4" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

const INPUT_BASE =
  'w-full rounded-md border border-border/60 bg-background px-3 text-[13px] outline-none transition-colors focus:ring-1 focus:ring-ring'

function NuevoClienteModal({ open, onClose, onCreated }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [notas, setNotas] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setNombre('')
      setTelefono('')
      setNotas('')
    }
  }, [open])

  const save = async () => {
    const n = nombre.trim()
    if (!n) {
      toast.error('El nombre es obligatorio')
      return
    }
    const api = db()
    if (!api?.addCliente) return
    setBusy(true)
    try {
      await api.addCliente({ nombre: n, telefono: telefono.trim(), notas: notas.trim() })
      toast.success('Cliente creado')
      onCreated?.()
      onClose()
    } catch (e) {
      toast.error(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }
  if (!open) return null
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <h2 className="text-[14px] font-semibold">Nuevo cliente</h2>
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Nombre *</label>
            <input
              className={cn('h-9', INPUT_BASE)}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save()
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Teléfono</label>
            <input className={cn('h-9', INPUT_BASE)} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Notas</label>
            <textarea
              className={cn('resize-none py-1.5', INPUT_BASE)}
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/25 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void save()}>
            Crear
          </Button>
        </div>
      </div>
    </Overlay>
  )
}

function MovimientoModal({ open, cliente, tipo, onClose, onSaved }) {
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setMonto('')
      setDescripcion('')
    }
  }, [open])

  const save = async () => {
    const m = Number(String(monto).replace(',', '.'))
    if (!Number.isFinite(m) || m <= 0) {
      toast.error('Monto inválido')
      return
    }
    const api = db()
    if (!api?.addCreditoMovimiento) return
    setBusy(true)
    try {
      await api.addCreditoMovimiento({
        clienteId: cliente?.id,
        tipo,
        monto: m,
        descripcion: descripcion.trim(),
      })
      toast.success(tipo === 'compra' ? 'Crédito registrado' : 'Pago registrado')
      onSaved?.()
      onClose()
    } catch (e) {
      toast.error(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }
  if (!open || !cliente) return null
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-xs overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <h2 className="text-[14px] font-semibold">{tipo === 'compra' ? 'Compra a crédito' : 'Registrar pago'}</h2>
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-[11px] text-muted-foreground">{cliente.nombre}</p>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Monto</label>
            <input
              type="text"
              className={cn('h-9 tabular-nums', INPUT_BASE)}
              placeholder="0.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save()
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Descripción</label>
            <input
              className={cn('h-9', INPUT_BASE)}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/25 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void save()}>
            {tipo === 'compra' ? 'Registrar deuda' : 'Registrar pago'}
          </Button>
        </div>
      </div>
    </Overlay>
  )
}

const SALDO_FILTER_OPTS = [{ value: 'deuda', label: 'Con saldo pendiente' }]

export function CreditosView() {
  const api = db()
  const hasDb = Boolean(api?.listClientes)

  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saldoFilter, setSaldoFilter] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [movLoading, setMovLoading] = useState(false)
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [movModal, setMovModal] = useState(null)

  const reload = useCallback(async () => {
    const d = db()
    if (!d?.listClientes) {
      setClientes([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const list = await d.listClientes()
      setClientes(Array.isArray(list) ? list : [])
    } catch {
      setClientes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const loadMov = useCallback(async (cid) => {
    const d = db()
    if (!d?.getCreditoMovimientos || !cid) {
      setMovimientos([])
      return
    }
    setMovLoading(true)
    try {
      const list = await d.getCreditoMovimientos({ clienteId: cid })
      setMovimientos(Array.isArray(list) ? list : [])
    } catch {
      setMovimientos([])
    } finally {
      setMovLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) void loadMov(selectedId)
    else setMovimientos([])
  }, [selectedId, loadMov])

  const filtered = useMemo(() => {
    let list = clientes
    if (saldoFilter === 'deuda') list = list.filter((c) => Number(c.saldo_pendiente) > 0)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((c) => String(c.nombre || '').toLowerCase().includes(q))
    return list
  }, [clientes, search, saldoFilter])

  useEffect(() => {
    if (selectedId != null && !filtered.some((c) => c.id === selectedId)) setSelectedId(null)
  }, [filtered, selectedId])

  const selected = clientes.find((c) => c.id === selectedId) || null
  const totalPendiente = clientes.reduce((s, c) => s + (Number(c.saldo_pendiente) || 0), 0)

  const onMovSaved = () => {
    void reload()
    if (selectedId) void loadMov(selectedId)
  }

  const hasListFilters = saldoFilter != null || search.trim() !== ''

  return (
    <div data-app-workspace className="relative flex h-full flex-col overflow-hidden bg-background">
      <NuevoClienteModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} onCreated={() => void reload()} />
      <MovimientoModal
        open={movModal != null}
        cliente={selected}
        tipo={movModal?.tipo || 'compra'}
        onClose={() => setMovModal(null)}
        onSaved={onMovSaved}
      />

      <PageHeader
        icon={<Wallet className="size-5" strokeWidth={1.5} />}
        title="Créditos"
        description="Clientes con compras fiadas y pagos. Registrá movimientos y seguí el saldo pendiente."
        count={hasDb ? clientes.length : undefined}
        actions={
          <button
            type="button"
            disabled={!hasDb}
            onClick={() => setNuevoOpen(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:pointer-events-none disabled:opacity-40 dark:bg-foreground/92"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Nuevo cliente
          </button>
        }
        menuItems={
          hasDb
            ? [
                {
                  id: 'refresh',
                  label: 'Refrescar',
                  icon: <RefreshCw className="size-3.5" strokeWidth={1.75} />,
                  onClick: () => void reload(),
                },
              ]
            : []
        }
      />
      <PageHeaderDivider />

      <div className="relative flex shrink-0 items-center justify-between gap-4 border-b border-border/50 px-10 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <ChipFilter
            label="Saldo"
            options={SALDO_FILTER_OPTS}
            value={saldoFilter}
            onChange={(v) => setSaldoFilter(v)}
            placeholder="Todos"
          />
          {hasListFilters ? (
            <button
              type="button"
              onClick={() => {
                setSaldoFilter(null)
                setSearch('')
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground/80 transition-colors hover:bg-muted/55 hover:text-foreground/85 dark:hover:bg-zinc-800/60"
            >
              Limpiar
            </button>
          ) : null}
        </div>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Nombre del cliente…"
          width="w-72"
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Lista clientes — rail estilo panel Inventario */}
        <aside className="flex w-[min(100%,20rem)] shrink-0 flex-col border-r border-border/50 bg-muted/[0.04] dark:bg-muted/10">
          <div className="shrink-0 space-y-2 border-b border-border/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Clientes</p>
            {totalPendiente > 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-2.5 py-1.5 text-[10.5px] dark:bg-background/50">
                <span className="text-muted-foreground">Total pendiente</span>
                <span className="font-semibold tabular-nums text-primary">{formatPrice(totalPendiente)}</span>
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {!hasDb ? (
              <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">Conectá la app de escritorio.</p>
            ) : loading ? (
              <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">Cargando…</p>
            ) : filtered.length === 0 ? (
              <EmptyState
                size="compact"
                className="py-8"
                icon={<User className="size-6" strokeWidth={1.5} />}
                title={hasListFilters ? 'Sin resultados' : 'Sin clientes'}
                description={
                  hasListFilters
                    ? 'Probá otra búsqueda o quitá el filtro de saldo.'
                    : 'Creá un cliente con «Nuevo cliente» para registrar fiados.'
                }
              />
            ) : (
              <ul className="py-1">
                {filtered.map((c) => {
                  const saldo = Number(c.saldo_pendiente) || 0
                  const active = selectedId === c.id
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2.5 border-l-2 px-4 py-2.5 text-left transition-colors',
                          active
                            ? 'border-primary bg-primary/[0.06] hover:bg-primary/[0.08]'
                            : 'border-transparent hover:bg-muted/55 dark:hover:bg-zinc-800/50',
                        )}
                        onClick={() => setSelectedId(c.id)}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/50 text-[11px] font-semibold text-muted-foreground dark:bg-muted/40">
                          {String(c.nombre || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-foreground/95">{c.nombre}</p>
                          {saldo > 0 ? (
                            <p className="text-[10px] font-medium tabular-nums text-primary">{formatPrice(saldo)}</p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground/80">Al día</p>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Detalle */}
        <main className="flex min-w-0 flex-1 flex-col">
          {!hasDb ? (
            <EmptyState
              icon={<Wallet className="size-6" strokeWidth={1.5} />}
              title="Base no disponible"
              description="Los créditos viven en la base local. Abrí Bazar Monserrat en Electron."
              size="compact"
              className="py-16"
            />
          ) : !selected ? (
            <EmptyState
              icon={<Wallet className="size-6" strokeWidth={1.5} />}
              title="Elegí un cliente"
              description="Seleccioná un nombre en la lista para ver el saldo y el historial de movimientos."
              size="compact"
              className="py-16"
            />
          ) : (
            <>
              <div className="shrink-0 space-y-3 border-b border-border/50 px-10 py-4">
                <div className="rounded-lg border border-border/60 bg-muted/15 p-4 dark:bg-muted/10">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{selected.nombre}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {selected.telefono ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Phone className="size-3 shrink-0 opacity-80" strokeWidth={1.75} />
                            {selected.telefono}
                          </span>
                        ) : null}
                        {selected.notas ? (
                          <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] text-muted-foreground">
                            <StickyNote className="size-3 shrink-0 opacity-80" strokeWidth={1.75} />
                            <span className="truncate">{selected.notas}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Saldo</p>
                      <p
                        className={cn(
                          'text-[22px] font-semibold tabular-nums tracking-tight',
                          Number(selected.saldo_pendiente) > 0 ? 'text-primary' : 'text-success',
                        )}
                      >
                        {formatPrice(selected.saldo_pendiente)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMovModal({ tipo: 'compra' })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90 dark:bg-foreground/92"
                  >
                    <ArrowUpRight className="size-3.5" strokeWidth={2} />
                    Crédito
                  </button>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12.5px]" onClick={() => setMovModal({ tipo: 'pago' })}>
                    <ArrowDownLeft className="size-3.5" strokeWidth={2} />
                    Pago
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden px-10 pb-6 pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Historial</p>
                <DataTableShell className="min-h-0">
                  {movLoading ? (
                    <p className="py-8 text-center text-[12px] text-muted-foreground">Cargando movimientos…</p>
                  ) : movimientos.length === 0 ? (
                    <EmptyState
                      size="compact"
                      className="py-10"
                      icon={<Wallet className="size-5" strokeWidth={1.5} />}
                      title="Sin movimientos"
                      description="Registrá una compra a crédito o un pago con los botones de arriba."
                    />
                  ) : (
                    <DataTable>
                      <DataTableHeader>
                        <DataTableHead width="44px" />
                        <DataTableHead>Tipo</DataTableHead>
                        <DataTableHead>Detalle</DataTableHead>
                        <DataTableHead width="120px" align="right">
                          Monto
                        </DataTableHead>
                        <DataTableHead width="140px">Fecha</DataTableHead>
                      </DataTableHeader>
                      <DataTableBody>
                        {movimientos.map((m) => {
                          const esCompra = m.tipo === 'compra'
                          return (
                            <DataTableRow key={m.id}>
                              <DataTableCell className="px-3">
                                <div
                                  className={cn(
                                    'inline-flex size-7 items-center justify-center rounded-md border',
                                    esCompra
                                      ? 'border-primary/25 bg-primary/[0.08] text-primary'
                                      : 'border-success/25 bg-success/[0.08] text-success dark:text-success-foreground',
                                  )}
                                >
                                  {esCompra ? (
                                    <ArrowUpRight className="size-3.5" strokeWidth={2} />
                                  ) : (
                                    <ArrowDownLeft className="size-3.5" strokeWidth={2} />
                                  )}
                                </div>
                              </DataTableCell>
                              <DataTableCell className="font-medium text-foreground/90">
                                {esCompra ? 'Compra a crédito' : 'Pago'}
                              </DataTableCell>
                              <DataTableCell muted className="max-w-[280px]">
                                <span className="block truncate">{m.descripcion || '—'}</span>
                              </DataTableCell>
                              <DataTableCell align="right" className={cn('font-semibold tabular-nums', esCompra ? 'text-primary' : 'text-success')}>
                                {esCompra ? '+' : '−'}
                                {formatPrice(m.monto)}
                              </DataTableCell>
                              <DataTableCell className="text-[11.5px] tabular-nums text-muted-foreground/85">{formatMovFecha(m.created_at)}</DataTableCell>
                            </DataTableRow>
                          )
                        })}
                      </DataTableBody>
                    </DataTable>
                  )}
                </DataTableShell>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
