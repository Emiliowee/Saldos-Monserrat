import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { LabelRender } from '@/components/label-editor/LabelRender'
import { createDefaultTemplate, normalizeTemplate } from '@/lib/labelModel'
import { LabelEditor } from '@/components/label-editor/LabelEditor'

function precioStrEtiqueta(val) {
  const n = Number(val)
  if (!Number.isFinite(n)) return '$0'
  if (Math.abs(n - Math.round(n)) < 1e-9) return `$${Math.round(n)}`
  return `$${n.toFixed(2)}`
}

/**
 * Vista previa alineada al PDF impreso: usa la plantilla activa configurada
 * por el usuario. El mismo renderer dibuja el editor y el preview, por lo
 * que lo que ves es lo que imprimís.
 */
export function ProductLabelPreview({
  empresa,
  nombre,
  precio,
  codigo,
}) {
  const [template, setTemplate] = useState(() => createDefaultTemplate())
  const [logoPath, setLogoPath] = useState('')
  const [workspaceName, setWorkspaceName] = useState('Saldos Monserrat')
  const [editorOpen, setEditorOpen] = useState(false)

  const load = async () => {
    try {
      const t = await window.bazar?.labels?.getActive?.()
      if (t) setTemplate(normalizeTemplate(t))
    } catch { /* noop */ }
    try {
      const s = await window.bazar?.settings?.get?.()
      setLogoPath(String(s?.workspaceLogoPath || ''))
      setWorkspaceName(String(s?.workspaceDisplayName || 'Saldos Monserrat'))
    } catch { /* noop */ }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => { if (!editorOpen) void load() }, [editorOpen])

  const data = {
    empresa: empresa || workspaceName,
    nombre: String(nombre || '').trim() || '—',
    precio: precioStrEtiqueta(precio),
    codigo: String(codigo || '').trim() || '—',
    logoPath,
  }

  /* escala automática: queremos ~280 px de ancho para la vista previa */
  const targetWidth = 280
  const scale = Math.max(3, Math.min(10, targetWidth / (template.width_mm || 60)))

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="inline-block rounded-sm ring-1 ring-black/10 shadow-sm overflow-hidden bg-white"
        style={{ width: template.width_mm * scale, height: template.height_mm * scale }}
      >
        <LabelRender template={template} data={data} scale={scale} />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>Vista previa · {template.name}</span>
        <span className="opacity-40">·</span>
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-foreground/80 hover:bg-accent transition-colors"
        >
          <Settings2 className="size-3" />
          Editar plantilla
        </button>
      </div>
      <LabelEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
    </div>
  )
}
