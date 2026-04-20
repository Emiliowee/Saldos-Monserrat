import { useEffect, useState } from 'react'
import { Receipt, Info } from 'lucide-react'
import { formatPrice } from '@/lib/format'

/**
 * Referencia de ventas para cajero / base de un flujo de devoluciones.
 */
export function PdvReturnsView() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)

  useEffect(() => {
    const fn = window.bazar?.db?.getSales
    if (typeof fn !== 'function') {
      setErr('Base de datos no disponible.')
      return
    }
    void fn({ limit: 20 })
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e) => setErr(String(e?.message || e)))
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto bg-background p-4 text-foreground">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
          <div className="space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Devoluciones</span> — consulta de las últimas ventas
              registradas en el POS. El flujo de anulación o reverso de stock se puede enlazar en una siguiente versión.
            </p>
            <p>
              Si el bazar <span className="font-medium text-foreground">no hace corte formal</span>, conviene registrar
              igual quién devuelve y en qué ticket.
            </p>
          </div>
        </div>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card shadow-sm">
        <div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Receipt className="size-3.5" strokeWidth={1.75} />
          Últimas ventas (POS)
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-[12px] text-muted-foreground">Sin ventas cargadas todavía.</p>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Ítems</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-3 py-2 tabular-nums font-medium text-primary">{s.id}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.created_at ? String(s.created_at).replace('T', ' ').slice(0, 16) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{formatPrice(s.total)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{Number(s.item_count) || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
