import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar, CheckCircle2, CircleDot, FolderOpen, MapPin, Package, Plus, Printer,
  RefreshCw, ScanLine, Shirt, Trash2, X, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/useAppStore'
import { formatPrice } from '@/lib/format.js'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBanquetaFolderVisibility } from '@/components/shell/AppSidebar'
import { PageHeader, PageHeaderDivider, EmptyState } from '@/components/premium'

/* ── Helpers ─────────────────────────────────────────────────────────── */
function estadoLabel(estado) {
  const e = String(estado || '').toLowerCase()
  if (e === 'activa') return 'Activa'
  if (e === 'cerrada') return 'Cerrada'
  return 'Borrador'
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatFechaLarga(raw) {
  if (!raw) return ''
  const s = String(raw).trim()
  let d
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, dd] = s.split('-').map((n) => Number(n))
    d = new Date(y, (m || 1) - 1, dd || 1)
  } else {
    d = new Date(s)
  }
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function formatFechaCorta(raw) {
  if (!raw) return ''
  const s = String(raw).trim()
  let d
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, dd] = s.split('-').map((n) => Number(n))
    d = new Date(y, (m || 1) - 1, dd || 1)
  } else {
    d = new Date(s)
  }
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function toDateInputValue(raw) {
  if (!raw) return ''
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Hoja de trabajo imprimible: columnas en blanco para apuntar a mano. */
function buildPrintHtml(detail) {
  if (!detail?.salida) return ''
  const salida = detail.salida
  const items = Array.isArray(detail.items) ? detail.items : []
  const title = String(salida.nombre || `Salida #${salida.id}`)
  const fecha = formatFechaLarga(salida.fecha_planeada)
  const lugar = String(salida.lugar || '').trim()
  const totalRef = items.reduce((s, it) => s + (Number(it.precio_snapshot ?? it.precio_actual) || 0), 0)

  const rows = items.map((it, idx) => {
    const cod = String(it.codigo_snapshot || it.codigo_actual || '').trim()
    const nom = String(it.nombre_snapshot || it.descripcion_actual || cod).trim()
    const pr = formatPrice(Number(it.precio_snapshot ?? it.precio_actual) || 0)
    return `<tr>
      <td class="num">${idx + 1}</td>
      <td class="mono">${escapeHtml(cod)}</td>
      <td>${escapeHtml(nom)}</td>
      <td class="price">${escapeHtml(pr)}</td>
      <td class="chk"></td>
      <td class="write"></td>
      <td class="write wide"></td>
    </tr>`
  }).join('')

  const metaLine = [
    fecha && `<span class="meta-item"><b>Fecha:</b> ${escapeHtml(fecha)}</span>`,
    lugar && `<span class="meta-item"><b>Lugar:</b> ${escapeHtml(lugar)}</span>`,
    `<span class="meta-item"><b>Piezas:</b> ${items.length}</span>`,
  ].filter(Boolean).join('')

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  /* Paleta alineada a tokens claros (foreground / muted / border) — hoja siempre legible en papel */
  :root {
    --bq-fg: hsl(240 10% 9%);
    --bq-fg-strong: hsl(240 10% 4%);
    --bq-muted: hsl(240 4% 38%);
    --bq-muted-2: hsl(240 3% 46%);
    --bq-border: hsl(240 6% 88%);
    --bq-border-strong: hsl(240 6% 18%);
    --bq-meta-bg: hsl(240 5% 96%);
    --bq-row: hsl(240 5% 94%);
  }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; padding: 24px 28px; color: var(--bq-fg); max-width: 860px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; font-weight: 600; letter-spacing: -0.01em; color: var(--bq-fg-strong); }
  .sub { font-size: 11px; color: var(--bq-muted-2); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
  .meta { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; color: var(--bq-muted); margin-bottom: 20px; padding: 10px 14px; border-radius: 10px; background: var(--bq-meta-bg); border: 1px solid var(--bq-border); }
  .meta-item b { font-weight: 600; color: var(--bq-fg-strong); margin-right: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  thead th { font-weight: 600; font-size: 9.5px; text-transform: uppercase; color: var(--bq-muted); letter-spacing: 0.06em; border-bottom: 1px solid var(--bq-border-strong); padding: 8px 6px; text-align: left; }
  tbody td { border-bottom: 1px solid var(--bq-border); padding: 10px 6px; vertical-align: middle; }
  td.num { width: 26px; color: var(--bq-muted-2); text-align: center; font-size: 11px; }
  td.mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; width: 76px; color: var(--bq-fg); }
  td.price { width: 72px; text-align: right; color: var(--bq-muted); font-variant-numeric: tabular-nums; font-size: 11.5px; }
  th.chk, td.chk { width: 34px; text-align: center; }
  td.chk::before { content: ""; display: inline-block; width: 14px; height: 14px; border: 1.3px solid var(--bq-border-strong); border-radius: 3px; }
  td.write { border-bottom: 1px solid var(--bq-border); background: linear-gradient(to bottom, transparent, hsl(240 5% 98%)); }
  th.write-col, td.write { width: 110px; }
  th.wide, td.wide { width: 170px; }
  tfoot td { padding-top: 14px; font-size: 11px; color: var(--bq-muted); }
  .total { text-align: right; font-weight: 600; font-size: 13px; color: var(--bq-fg-strong); padding-top: 16px; }
  .foot { margin-top: 26px; font-size: 10px; color: var(--bq-muted-2); display: flex; justify-content: space-between; border-top: 1px solid var(--bq-border); padding-top: 10px; }
  @media print {
    body { padding: 14px 18px; }
    .no-print { display: none; }
  }
</style></head>
<body>
  <div class="sub">Hoja de trabajo · Banqueta</div>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${metaLine}</div>
  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>Código</th>
        <th>Descripción</th>
        <th class="price">Precio ref.</th>
        <th class="chk">✓</th>
        <th class="write-col">$ Vendido</th>
        <th class="wide">Notas</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total referencia: ${escapeHtml(formatPrice(totalRef))}</div>
  <div class="foot">
    <span>Impreso: ${escapeHtml(new Date().toLocaleString('es-MX'))}</span>
    <span>Firma: ____________________</span>
  </div>
</body></html>`
}

function emitChange() { window.dispatchEvent(new CustomEvent('bazar:banqueta-salidas-changed')) }

async function runPrint(detail) {
  if (!detail?.salida) return
  const api = window.bazar?.banqueta?.printSheet
  /* Fallback (modo web, sin Electron): ventana emergente con HTML. */
  if (!api) {
    const html = buildPrintHtml(detail); if (!html) return
    const w = window.open('', '_blank', 'noopener,noreferrer'); if (!w) { toast.error('Ventana bloqueada.'); return }
    w.document.write(html); w.document.close(); w.focus()
    setTimeout(() => { try { w.print() } catch { /* noop */ } }, 250)
    return
  }
  try {
    const res = await api(detail)
    if (res?.ok) toast.success(res.message || 'Hoja generada')
    else toast.error(res?.message || 'No se pudo generar la hoja')
  } catch (e) {
    toast.error(String(e?.message || e))
  }
}

/* ── Overlay primitivo ───────────────────────────────────────────────── */
function Overlay({ children, onClose, widthClass = 'w-full max-w-sm' }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] dark:bg-black/55" onClick={onClose} />
      <div className={cn('relative z-10 mx-4', widthClass)} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body,
  )
}

/* ── Modal: nueva salida ─────────────────────────────────────────────── */
function ModalNueva({ open, onClose, onCreate, busy }) {
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [lugar, setLugar] = useState('')
  useEffect(() => { if (open) { setNombre(''); setFecha(''); setLugar('') } }, [open])
  if (!open) return null
  const submit = () => { void onCreate({ nombre: nombre.trim(), fechaPlaneada: fecha || null, lugar: lugar.trim() }) }
  return (
    <Overlay onClose={onClose}>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">Nueva salida</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Planifica una venta de banqueta</p>
          </div>
          <button type="button" className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground" onClick={onClose}><X className="size-4" /></button>
        </div>
        <div className="space-y-3.5 px-5 py-4">
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Nombre</label>
            <input
              className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-[13px] outline-none focus:ring-1 focus:ring-ring"
              placeholder="Feria del sábado"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Calendar className="size-3" /> Fecha planeada</label>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-[12.5px] outline-none focus:ring-1 focus:ring-ring"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1"><MapPin className="size-3" /> Lugar</label>
              <input
                className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-[12.5px] outline-none focus:ring-1 focus:ring-ring"
                placeholder="Banqueta del local"
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Después agregás las prendas escaneando o escribiendo el código.</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/25 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={submit}><Plus className="size-3.5" />Crear</Button>
        </div>
      </div>
    </Overlay>
  )
}

/* ── Modal: confirm genérico ─────────────────────────────────────────── */
function ModalConfirm({ open, title, body, confirmLabel, danger, onClose, onConfirm, busy }) {
  if (!open) return null
  return (
    <Overlay onClose={onClose}>
      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-2xl">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {typeof body === 'string' ? <p className="text-[12px] text-muted-foreground">{body}</p> : body}
        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant={danger ? 'destructive' : 'default'} disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Overlay>
  )
}

/* ── Modal: preview de impresión ─────────────────────────────────────── */
function ModalPrintPreview({ open, detail, onClose, onPrint }) {
  if (!open || !detail?.salida) return null
  const html = buildPrintHtml(detail)
  return (
    <Overlay onClose={onClose} widthClass="w-full max-w-3xl">
      <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">Vista previa</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Hoja para apuntar a mano durante la venta</p>
          </div>
          <button type="button" className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground" onClick={onClose}><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 bg-muted/20 p-4"><iframe className="h-full w-full rounded-lg border border-border/60 bg-background" title="Vista previa" srcDoc={html} /></div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/25 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
          <Button size="sm" className="gap-1.5" onClick={onPrint}><Printer className="size-3.5" />Imprimir</Button>
        </div>
      </div>
    </Overlay>
  )
}

/* ── Modal: cierre con resumen ───────────────────────────────────────── */
function ModalCloseSummary({ open, detail, onClose, onConfirm, busy }) {
  if (!open || !detail?.salida) return null
  const items = Array.isArray(detail.items) ? detail.items : []
  const vendidos = items.filter((i) => Number(i.vendido) === 1)
  const pendientes = items.filter((i) => Number(i.vendido) !== 1)
  const total = vendidos.reduce((s, i) => s + (Number(i.precio_vendido) || 0), 0)
  const ref = vendidos.reduce((s, i) => s + (Number(i.precio_snapshot ?? i.precio_actual) || 0), 0)
  const diff = total - ref
  return (
    <Overlay onClose={onClose} widthClass="w-full max-w-md">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
        <div className="border-b border-border/60 px-5 py-3">
          <h2 className="text-[14px] font-semibold">Cerrar salida</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Revisá el resumen antes de cerrar</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
              <p className="text-[9.5px] uppercase tracking-widest text-muted-foreground font-medium">Vendidas</p>
              <p className="text-[18px] font-semibold tabular-nums mt-0.5">{vendidos.length}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
              <p className="text-[9.5px] uppercase tracking-widest text-muted-foreground font-medium">Regresan</p>
              <p className="text-[18px] font-semibold tabular-nums mt-0.5">{pendientes.length}</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2.5">
              <p className="text-[9.5px] uppercase tracking-widest text-primary/80 font-medium">Total</p>
              <p className="text-[18px] font-semibold tabular-nums mt-0.5">{formatPrice(total)}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 px-3 py-2 text-[11.5px] text-muted-foreground space-y-0.5">
            <p>Las prendas <b className="text-foreground/85">vendidas</b> quedarán como vendidas en el inventario.</p>
            <p>Las <b className="text-foreground/85">{pendientes.length} prendas no marcadas</b> volverán a <b>disponibles</b> automáticamente.</p>
            {ref > 0 && (
              <p className="pt-1 text-[10.5px]">
                Referencia: {formatPrice(ref)} ·{' '}
                <span className={cn('font-medium tabular-nums', diff >= 0 ? 'text-success' : 'text-warning-foreground dark:text-warning')}>
                  {diff >= 0 ? '+' : ''}{formatPrice(diff)}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/25 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant="default" disabled={busy} onClick={onConfirm}>Cerrar salida</Button>
        </div>
      </div>
    </Overlay>
  )
}

/* ── Fila de ítem en el workspace ────────────────────────────────────── */
function ItemRow({ item, editable, showResult, busy, onRemove, onToggleVendido, onPriceChange }) {
  const cod = String(item.codigo_snapshot || item.codigo_actual || '')
  const nom = String(item.nombre_snapshot || item.descripcion_actual || cod)
  const ref = Number(item.precio_snapshot ?? item.precio_actual) || 0
  const vendido = Number(item.vendido) === 1
  const pVal = item.precio_vendido == null ? '' : String(item.precio_vendido)
  const [local, setLocal] = useState(pVal)
  useEffect(() => { setLocal(pVal) }, [pVal])

  return (
    <div
      className={cn(
        'group/item flex items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 transition-colors',
        vendido ? 'border-success/25 bg-success/[0.07]' : 'hover:bg-muted/55 dark:hover:bg-zinc-800/60',
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn('text-[12.5px] truncate leading-tight', vendido && 'text-foreground/85')}>{nom}</p>
        <p className="text-[10px] font-mono text-muted-foreground/70 leading-tight mt-0.5">{cod}</p>
      </div>
      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 min-w-[56px] text-right">{formatPrice(ref)}</span>

      {showResult && (
        <>
          <button
            type="button"
            onClick={() => onToggleVendido?.(!vendido)}
            disabled={busy}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors',
              vendido
                ? 'border-success/40 bg-success/[0.12] text-success dark:text-success-foreground hover:bg-success/[0.18]'
                : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/50',
            )}
          >
            <CheckCircle2 className={cn('size-3.5', vendido ? 'opacity-100' : 'opacity-40')} strokeWidth={2} />
            {vendido ? 'Vendida' : 'Marcar'}
          </button>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder={ref ? String(ref) : '$'}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => {
              if (local === pVal) return
              onPriceChange?.(local)
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            disabled={busy || !vendido}
            className={cn(
              'h-7 w-[84px] rounded-md border border-border/60 bg-background px-2 text-[12px] tabular-nums outline-none focus:ring-1 focus:ring-ring text-right',
              'disabled:opacity-40',
            )}
          />
        </>
      )}

      {editable && (
        <button
          type="button"
          className="size-6 inline-flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/item:opacity-100 transition-opacity"
          onClick={onRemove}
          disabled={busy}
          title="Quitar (vuelve al inventario)"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/* ── Workspace de una salida ─────────────────────────────────────────── */
function SalidaWorkspace({
  open, salidaId, api, onClose, onRefresh, onOpenPrint, onRequestDelete, onRequestDeleteHistorial, onRequestClose,
}) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [notas, setNotas] = useState('')
  const [lugar, setLugar] = useState('')
  const [fecha, setFecha] = useState('')
  const [busy, setBusy] = useState(false)
  const idRef = useRef(null); idRef.current = salidaId
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    if (!open || !salidaId || !api?.getBanquetaSalidaDetail) return
    setLoading(true)
    try {
      const d = await api.getBanquetaSalidaDetail(salidaId)
      if (salidaId !== idRef.current) return
      setDetail(d)
      if (d?.salida) {
        setNombre(String(d.salida.nombre || ''))
        setNotas(String(d.salida.notas || ''))
        setLugar(String(d.salida.lugar || ''))
        setFecha(toDateInputValue(d.salida.fecha_planeada))
      }
    } catch (e) { toast.error(String(e?.message || e)); setDetail(null) }
    finally { if (salidaId === idRef.current) setLoading(false) }
  }, [open, salidaId, api])

  useEffect(() => { if (!open || !salidaId) { setDetail(null); setLoading(false); return }; void load() }, [open, salidaId, load])
  useEffect(() => { if (open) { const t = setTimeout(() => inputRef.current?.focus(), 120); return () => clearTimeout(t) } }, [open, salidaId])

  const salida = detail?.salida
  const items = useMemo(() => (Array.isArray(detail?.items) ? detail.items : []), [detail])
  const estado = String(salida?.estado || '').toLowerCase()
  const readOnly = estado === 'cerrada'
  const isActiva = estado === 'activa'
  const isBorrador = estado === 'borrador'
  const vendidos = items.filter((i) => Number(i.vendido) === 1)
  const totalVendido = vendidos.reduce((s, i) => s + (Number(i.precio_vendido) || 0), 0)
  const totalRef = items.reduce((s, i) => s + (Number(i.precio_snapshot ?? i.precio_actual) || 0), 0)

  const saveMeta = async (patch) => {
    if (!api?.updateBanquetaSalida || !salidaId || readOnly) return
    setBusy(true)
    try { await api.updateBanquetaSalida({ id: salidaId, ...patch }); await load(); await onRefresh(); emitChange() }
    catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const addCodigo = async (e) => {
    e?.preventDefault?.()
    const c = codigo.trim()
    if (!c || !api?.addProductToBanquetaSalida || !salidaId || readOnly) return
    setBusy(true)
    try {
      const d = await api.addProductToBanquetaSalida({ salidaId, codigo: c })
      setDetail(d); setCodigo(''); await onRefresh(); emitChange()
      inputRef.current?.focus()
    }
    catch (err) { toast.error(String(err?.message || err)) } finally { setBusy(false) }
  }

  const removeItem = async (itemId) => {
    if (!api?.removeBanquetaSalidaItem || readOnly) return; setBusy(true)
    try { await api.removeBanquetaSalidaItem(itemId); await load(); await onRefresh(); emitChange() }
    catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const toggleVendido = async (itemId, vendido, currentPrice) => {
    if (!api?.setBanquetaSalidaItemResult || readOnly) return; setBusy(true)
    try {
      const precio = vendido ? (currentPrice != null ? currentPrice : null) : null
      const d = await api.setBanquetaSalidaItemResult({ itemId, vendido, precioVendido: precio })
      setDetail(d); await onRefresh(); emitChange()
    }
    catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const setPrecio = async (itemId, value) => {
    if (!api?.setBanquetaSalidaItemResult || readOnly) return
    const precio = value === '' || value == null ? null : Number(value)
    setBusy(true)
    try {
      const d = await api.setBanquetaSalidaItemResult({ itemId, vendido: true, precioVendido: Number.isFinite(precio) ? precio : null })
      setDetail(d); await onRefresh(); emitChange()
    }
    catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const activate = async () => {
    if (!api?.activateBanquetaSalida || !salidaId) return; setBusy(true)
    try { const d = await api.activateBanquetaSalida(salidaId); setDetail(d); await onRefresh(); emitChange(); toast.success('Salida activa') }
    catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  if (!open || !salidaId) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] dark:bg-black/55" onClick={onClose} />
      <div
        className="relative z-10 mx-4 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex size-[14px] shrink-0 items-center justify-center">
              {isActiva ? (
                <span className="relative inline-flex size-[7px]">
                  <span className="absolute inset-0 rounded-full bg-primary" />
                  <span className="absolute -inset-[2px] animate-ping rounded-full bg-primary/40" />
                </span>
              ) : readOnly ? (
                <CheckCircle2 className="size-[12px] text-muted-foreground/55" strokeWidth={1.75} />
              ) : (
                <span className="inline-block size-[7px] rounded-full bg-muted-foreground/35" />
              )}
            </span>
            <h2 className="text-[13.5px] font-medium truncate tracking-[-0.005em]">
              {salida ? String(salida.nombre || `Salida #${salida.id}`) : 'Salida'}
            </h2>
            <span className="text-[10.5px] font-medium text-muted-foreground/70 shrink-0">
              · {estadoLabel(estado)}
            </span>
          </div>
          <button type="button" className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground" onClick={onClose}>
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="size-4 animate-spin mr-2" />Cargando…
            </div>
          ) : (
            <>
              {/* Metadata: nombre / fecha / lugar / notas */}
              <div className="rounded-lg border border-border/60 bg-muted/15 p-3.5 dark:bg-muted/10">
                <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9.5px] font-medium uppercase tracking-widest text-muted-foreground">Nombre</label>
                  <input
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2.5 text-[12.5px] outline-none transition-colors focus:ring-1 focus:ring-ring"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    disabled={readOnly || busy}
                    onBlur={() => nombre !== String(salida?.nombre || '') && void saveMeta({ nombre })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Calendar className="size-3" /> Fecha planeada</label>
                  <input
                    type="date"
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2.5 text-[12.5px] outline-none focus:ring-1 focus:ring-ring"
                    value={fecha}
                    onChange={(e) => { setFecha(e.target.value); void saveMeta({ fechaPlaneada: e.target.value || null }) }}
                    disabled={readOnly || busy}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1"><MapPin className="size-3" /> Lugar</label>
                  <input
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2.5 text-[12.5px] outline-none focus:ring-1 focus:ring-ring"
                    value={lugar}
                    onChange={(e) => setLugar(e.target.value)}
                    disabled={readOnly || busy}
                    onBlur={() => lugar !== String(salida?.lugar || '') && void saveMeta({ lugar })}
                    placeholder="Feria sábado"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-medium uppercase tracking-widest text-muted-foreground">Notas</label>
                  <input
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2.5 text-[12.5px] outline-none focus:ring-1 focus:ring-ring"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    disabled={readOnly || busy}
                    onBlur={() => notas !== String(salida?.notas || '') && void saveMeta({ notas })}
                    placeholder="Observaciones"
                  />
                </div>
                </div>
              </div>

              {/* Scanner */}
              {!readOnly && (
                <form className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/10 p-2.5 dark:bg-muted/5" onSubmit={addCodigo}>
                  <div className="relative flex-1">
                    <ScanLine className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={inputRef}
                      className="h-9 w-full rounded-md border border-border/60 bg-background pl-8 pr-3 text-[12.5px] outline-none transition-colors focus:ring-1 focus:ring-ring"
                      placeholder="Escanear o escribir código…"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      disabled={busy}
                      autoComplete="off"
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={busy || !codigo.trim()}>Agregar</Button>
                </form>
              )}

              {/* Resumen */}
              <div className="flex items-center justify-between border-t border-dashed border-border/50 py-1 pt-3 text-[11px]">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground/85 tabular-nums">{items.length}</span>
                    {' '}{items.length === 1 ? 'prenda' : 'prendas'}
                  </span>
                  {(isActiva || readOnly) && vendidos.length > 0 && (
                    <span className="text-success">
                      <span className="font-semibold tabular-nums">{vendidos.length}</span> vendidas
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  {totalVendido > 0 && (
                    <span className="text-foreground/85 font-semibold tabular-nums">{formatPrice(totalVendido)}</span>
                  )}
                  <span className="tabular-nums text-[10.5px]">ref {formatPrice(totalRef)}</span>
                </div>
              </div>

              {/* Ítems */}
              {items.length === 0 ? (
                <EmptyState
                  size="compact"
                  className="py-8"
                  icon={<Package className="size-6" strokeWidth={1.5} />}
                  title={readOnly ? 'Sin ítems en el registro' : 'Todavía no hay prendas'}
                  description={
                    readOnly
                      ? 'Esta salida cerrada no tiene líneas guardadas o el detalle no está disponible.'
                      : 'Escaneá o escribí códigos: pasan a «en banqueta» y salen del inventario disponible hasta cerrar la salida.'
                  }
                />
              ) : (
                <div className="space-y-1 rounded-lg border border-border/50 bg-muted/[0.04] p-2 dark:bg-muted/10">
                  {items.map((it) => (
                    <ItemRow
                      key={it.id}
                      item={it}
                      editable={!readOnly}
                      showResult={isActiva || readOnly}
                      busy={busy}
                      onRemove={() => void removeItem(Number(it.id))}
                      onToggleVendido={(v) => void toggleVendido(Number(it.id), v, it.precio_vendido ?? it.precio_snapshot)}
                      onPriceChange={(v) => void setPrecio(Number(it.id), v)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {!loading && salida && (
          <footer className="flex shrink-0 items-center gap-2 border-t border-border/60 bg-muted/25 px-5 py-3">
            {isBorrador && (
              <>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive text-[11px]" disabled={busy} onClick={() => onRequestDelete?.(salidaId)}>
                  Eliminar borrador
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" className="gap-1.5 text-[11px]" disabled={busy || items.length === 0} onClick={() => detail && onOpenPrint(detail)}>
                  <Printer className="size-3" />Imprimir hoja
                </Button>
                <Button size="sm" className="gap-1.5 text-[11px]" disabled={busy || items.length === 0} onClick={() => void activate()}>
                  <Zap className="size-3" />Activar
                </Button>
              </>
            )}
            {isActiva && (
              <>
                <Button variant="ghost" size="sm" className="text-[11px]" disabled={busy} onClick={() => onRequestClose?.(salidaId)}>
                  Cerrar salida…
                </Button>
                <div className="flex-1" />
                <Button size="sm" className="gap-1.5 text-[11px]" disabled={busy || items.length === 0} onClick={() => detail && onOpenPrint(detail)}>
                  <Printer className="size-3" />Hoja de trabajo
                </Button>
              </>
            )}
            {readOnly && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  disabled={busy}
                  onClick={() => onRequestDeleteHistorial?.(salidaId)}
                >
                  Quitar del historial…
                </Button>
                <div className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                  Cerrada · {vendidos.length} vendidas · {formatPrice(totalVendido)}
                </div>
                <Button size="sm" variant="ghost" className="gap-1.5 text-[11px]" onClick={() => detail && onOpenPrint(detail)}>
                  <Printer className="size-3" />Reimprimir
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" className="text-[11px]" onClick={onClose}>Cerrar</Button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

/* ── Lista principal ─────────────────────────────────────────────────── */

function SalidaCard({ salida, variant, onOpen, onDelete, onDeleteHistorial }) {
  const count = Number(salida.item_count) || 0
  const sold = Number(salida.sold_count) || 0
  const total = Number(salida.sold_total) || 0
  const fecha = formatFechaCorta(salida.fecha_planeada)
  const lugar = String(salida.lugar || '').trim()
  const isActiva = variant === 'activa'
  const isCerrada = variant === 'cerrada'

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl border transition-colors',
        isActiva ? 'border-primary/25 bg-primary/[0.04] hover:bg-primary/[0.07]' : 'border-border/60 hover:bg-muted/45 dark:hover:bg-zinc-800/40',
        'px-4 py-3',
      )}
    >
      <button type="button" onClick={onOpen} className="flex-1 flex items-center gap-3 text-left min-w-0">
        {isActiva ? (
          <CircleDot className="size-4 text-primary shrink-0" />
        ) : isCerrada ? (
          <CheckCircle2 className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <div className="size-1.5 rounded-full bg-muted-foreground/30 shrink-0 ml-1" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isActiva && <span className="text-[9.5px] uppercase tracking-widest font-medium text-primary">Activa</span>}
            <p className={cn('text-[13px] font-medium truncate', isCerrada && 'text-muted-foreground')}>
              {salida.nombre || `Salida #${salida.id}`}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground mt-0.5">
            {fecha && <span className="inline-flex items-center gap-1"><Calendar className="size-2.5" />{fecha}</span>}
            {lugar && <span className="inline-flex items-center gap-1"><MapPin className="size-2.5" />{lugar}</span>}
            <span>·</span>
            <span>{count} {count === 1 ? 'prenda' : 'prendas'}</span>
            {isCerrada && sold > 0 && (
              <>
                <span>·</span>
                <span className="text-success">{sold} vendidas</span>
              </>
            )}
          </div>
        </div>
        {isCerrada && total > 0 && (
          <span className="text-[12px] font-semibold tabular-nums shrink-0 text-foreground/85">
            {formatPrice(total)}
          </span>
        )}
      </button>
      {variant === 'borrador' && onDelete && (
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Eliminar borrador"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
      {variant === 'cerrada' && onDeleteHistorial && (
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onDeleteHistorial() }}
          title="Quitar del historial (no cambia el inventario)"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function BanquetaView() {
  const api = typeof window !== 'undefined' ? window.bazar?.db : undefined
  const hasDb = Boolean(api)
  const { hidden: folderHidden, setVisible: setFolderVisible } = useBanquetaFolderVisibility()
  const [salidas, setSalidas] = useState([])
  const [activeSalida, setActiveSalida] = useState(null)
  const [busy, setBusy] = useState(false)
  const [modalNueva, setModalNueva] = useState(false)
  const [workspaceId, setWorkspaceId] = useState(null)
  const [printDetail, setPrintDetail] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [closeSummaryDetail, setCloseSummaryDetail] = useState(null)

  const loadSalidas = useCallback(async () => {
    if (!api?.listBanquetaSalidas || !api?.getActiveBanquetaSalida) { setSalidas([]); setActiveSalida(null); return }
    try {
      const [list, active] = await Promise.all([api.listBanquetaSalidas(), api.getActiveBanquetaSalida()])
      setSalidas(Array.isArray(list) ? list : [])
      setActiveSalida(active && typeof active === 'object' ? active : null)
    } catch { setSalidas([]); setActiveSalida(null) }
  }, [api])

  useEffect(() => { if (hasDb) void loadSalidas() }, [hasDb, loadSalidas])

  const banquetaOpenSalidaId = useAppStore((s) => s.banquetaOpenSalidaId)
  const clearBanquetaOpenSalida = useAppStore((s) => s.clearBanquetaOpenSalida)
  useEffect(() => {
    if (banquetaOpenSalidaId != null) { setWorkspaceId(banquetaOpenSalidaId); clearBanquetaOpenSalida() }
  }, [banquetaOpenSalidaId, clearBanquetaOpenSalida])

  useEffect(() => {
    const handler = async (e) => {
      const code = e?.detail
      if (!code || !api?.addProductToBanquetaSalida) return
      const active = await api.getActiveBanquetaSalida?.()
      if (!active?.id) { toast.error('No hay una salida activa.'); return }
      try { await api.addProductToBanquetaSalida({ salidaId: active.id, codigo: code }); toast.success(`Agregado a ${active.nombre || 'salida activa'}`); void loadSalidas(); emitChange() }
      catch (err) { toast.error(String(err?.message || err)) }
    }
    window.addEventListener('bazar:banqueta-scan', handler)
    return () => window.removeEventListener('bazar:banqueta-scan', handler)
  }, [api, loadSalidas])

  useEffect(() => {
    try {
      const flag = sessionStorage.getItem('bazar.banquetaNewSalida')
      if (flag) { sessionStorage.removeItem('bazar.banquetaNewSalida'); setModalNueva(true) }
    } catch { /* noop */ }
  }, [])

  const onCreate = async (payload) => {
    if (!api?.createBanquetaSalida) return
    setBusy(true)
    try {
      const r = await api.createBanquetaSalida(payload || {})
      setModalNueva(false)
      if (r?.id) { setWorkspaceId(r.id); await loadSalidas(); emitChange(); toast.success('Salida creada') }
    }
    catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const deleteSalidaConfirmed = async () => {
    const id = confirm?.id
    const mode = confirm?.mode
    if (id == null || !api?.deleteBanquetaSalida) return
    setBusy(true)
    try {
      await api.deleteBanquetaSalida(id)
      if (workspaceId === id) setWorkspaceId(null)
      await loadSalidas()
      emitChange()
      toast.success(mode === 'cerrada' ? 'Salida quitada del historial' : 'Borrador eliminado')
    }
    catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false); setConfirm(null) }
  }

  const requestClose = async (id) => {
    if (!api?.getBanquetaSalidaDetail) return
    try {
      const d = await api.getBanquetaSalidaDetail(id)
      setCloseSummaryDetail(d)
    } catch (e) { toast.error(String(e?.message || e)) }
  }

  const confirmClose = async () => {
    const id = closeSummaryDetail?.salida?.id
    if (!id || !api?.closeBanquetaSalida) return
    setBusy(true)
    try {
      const r = await api.closeBanquetaSalida(id)
      setCloseSummaryDetail(null)
      if (workspaceId === id) setWorkspaceId(null)
      await loadSalidas(); emitChange()
      const parts = []
      if (r?.sold) parts.push(`${r.sold} vendidas`)
      if (r?.returned) parts.push(`${r.returned} devueltas`)
      toast.success(`Salida cerrada${parts.length ? ` · ${parts.join(', ')}` : ''}`)
    }
    catch (e) { toast.error(String(e?.message || e)) } finally { setBusy(false) }
  }

  const borradores = salidas.filter((s) => String(s.estado || '').toLowerCase() === 'borrador')
  const cerradas = salidas.filter((s) => String(s.estado || '').toLowerCase() === 'cerrada')

  return (
    <div data-app-workspace className="relative flex h-full flex-col overflow-hidden bg-background">
      <ModalNueva open={modalNueva} onClose={() => setModalNueva(false)} onCreate={onCreate} busy={busy} />
      <ModalPrintPreview
        open={printDetail != null}
        detail={printDetail}
        onClose={() => setPrintDetail(null)}
        onPrint={() => { if (printDetail) void runPrint(printDetail); setPrintDetail(null) }}
      />
      <ModalConfirm
        open={confirm != null}
        title={confirm?.mode === 'cerrada' ? '¿Quitar del historial?' : '¿Eliminar borrador?'}
        body={
          confirm?.mode === 'cerrada'
            ? 'Solo se elimina el registro de esta salida cerrada. El inventario no cambia (ventas y devoluciones ya quedaron aplicadas).'
            : 'Se borran los ítems. Las prendas vuelven al inventario disponible.'
        }
        confirmLabel="Eliminar"
        danger
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => void deleteSalidaConfirmed()}
      />
      <ModalCloseSummary
        open={closeSummaryDetail != null}
        detail={closeSummaryDetail}
        busy={busy}
        onClose={() => setCloseSummaryDetail(null)}
        onConfirm={() => void confirmClose()}
      />
      {hasDb && api && (
        <SalidaWorkspace
          open={workspaceId != null}
          salidaId={workspaceId}
          api={api}
          onClose={() => setWorkspaceId(null)}
          onRefresh={loadSalidas}
          onOpenPrint={(d) => setPrintDetail(d)}
          onRequestDelete={(id) => { setWorkspaceId(null); setConfirm({ mode: 'borrador', id }) }}
          onRequestDeleteHistorial={(id) => setConfirm({ mode: 'cerrada', id })}
          onRequestClose={(id) => { void requestClose(id) }}
        />
      )}

      <PageHeader
        icon={<MapPin className="size-5" strokeWidth={1.5} />}
        title="Banqueta"
        description="Salidas de venta: ferias o mostrador. Las prendas salen del inventario disponible y vuelven al cerrar, salvo las vendidas."
        count={hasDb ? salidas.length : undefined}
        actions={(
          <>
            {folderHidden ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-[11px] text-muted-foreground hover:bg-muted/50"
                onClick={() => { setFolderVisible(true); toast.success('Carpeta «Salidas» visible en la barra lateral') }}
                title="Mostrar la carpeta Salidas en la barra lateral"
              >
                <FolderOpen className="size-3" strokeWidth={1.75} />
                Anclar
              </Button>
            ) : null}
            <button
              type="button"
              disabled={!hasDb || busy}
              onClick={() => setModalNueva(true)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:pointer-events-none disabled:opacity-40 dark:bg-foreground/92"
            >
              <Plus className="size-3.5" strokeWidth={2} />
              Nueva salida
            </button>
          </>
        )}
        menuItems={
          hasDb
            ? [{ id: 'refresh', label: 'Refrescar lista', icon: <RefreshCw className="size-3.5" strokeWidth={1.75} />, onClick: () => void loadSalidas() }]
            : []
        }
      />
      <PageHeaderDivider />

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-2xl space-y-6 px-10 pb-10 pt-6">
          {!hasDb ? (
            <EmptyState
              icon={<Package className="size-6" strokeWidth={1.5} />}
              title="Conectá la app de escritorio"
              description="La banqueta usa la base local: abrí Bazar Monserrat en Electron para ver y gestionar salidas."
              size="compact"
            />
          ) : (
            <>
              {activeSalida ? (
                <section className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/80">En curso</p>
                  <SalidaCard
                    salida={activeSalida}
                    variant="activa"
                    onOpen={() => setWorkspaceId(activeSalida.id)}
                  />
                </section>
              ) : (
                <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-3 text-[12px] text-muted-foreground">
                  <Zap className="size-3.5 shrink-0 text-muted-foreground/80" strokeWidth={1.75} />
                  Sin salida activa. Creá un borrador, agregá prendas y activalo para imprimir la hoja.
                </div>
              )}

              {borradores.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Borradores</p>
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums">{borradores.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {borradores.map((s) => (
                      <SalidaCard
                        key={s.id}
                        salida={s}
                        variant="borrador"
                        onOpen={() => setWorkspaceId(s.id)}
                        onDelete={() => setConfirm({ type: 'delete', id: s.id })}
                      />
                    ))}
                  </div>
                </section>
              )}

              {cerradas.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Historial</p>
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums">{cerradas.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {cerradas.map((s) => (
                      <SalidaCard
                        key={s.id}
                        salida={s}
                        variant="cerrada"
                        onOpen={() => setWorkspaceId(s.id)}
                        onDeleteHistorial={() => setConfirm({ mode: 'cerrada', id: s.id })}
                      />
                    ))}
                  </div>
                </section>
              )}

              {salidas.length === 0 && (
                <EmptyState
                  icon={<Shirt className="size-6" strokeWidth={1.5} />}
                  title="Sin salidas todavía"
                  description="Creá tu primera salida, agregá las prendas y planificá cuándo las vas a vender."
                  action={(
                    <button
                      type="button"
                      onClick={() => setModalNueva(true)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90 dark:bg-foreground/92"
                    >
                      <Plus className="size-3.5" strokeWidth={2} />
                      Crear salida
                    </button>
                  )}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
