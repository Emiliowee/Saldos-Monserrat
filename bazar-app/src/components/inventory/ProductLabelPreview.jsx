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
  const [labelLogoOpts, setLabelLogoOpts] = useState({
    labelLogoStyle: 'thermal',
    labelLogoWarmth: 0,
    labelLogoContrast: 100,
    labelLogoSaturation: 100,
  })
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
      setLabelLogoOpts({
        labelLogoStyle: s?.labelLogoStyle === 'original' ? 'original' : 'thermal',
        labelLogoWarmth: Number.isFinite(Number(s?.labelLogoWarmth)) ? Number(s.labelLogoWarmth) : 0,
        labelLogoContrast: Number.isFinite(Number(s?.labelLogoContrast)) ? Number(s.labelLogoContrast) : 100,
        labelLogoSaturation: Number.isFinite(Number(s?.labelLogoSaturation)) ? Number(s.labelLogoSaturation) : 100,
      })
    } catch { /* noop */ }
  }

  useEffect(() => {
    if (editorOpen) return
    void load()
  }, [editorOpen])

  const data = {
    empresa: empresa || workspaceName,
    nombre: String(nombre || '').trim() || '—',
    precio: precioStrEtiqueta(precio),
    codigo: String(codigo || '').trim() || '—',
    logoPath,
    ...labelLogoOpts,
  }

  /* escala automática: queremos ~280 px de ancho para la vista previa */
  const targetWidth = 280
  const widthMm = Number.isFinite(Number(template.width_mm)) ? Number(template.width_mm) : 60
  const scale = Math.max(3, Math.min(10, targetWidth / widthMm))

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="inline-block rounded-sm ring-1 ring-black/10 shadow-sm overflow-hidden bg-white"
        style={{
          width: widthMm * scale,
          height: (Number.isFinite(Number(template.height_mm)) ? Number(template.height_mm) : 35) * scale,
        }}
      >
        <LabelRender template={template} data={data} scale={scale} />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>Vista previa · {template.name} · logo = avatar del espacio</span>
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
