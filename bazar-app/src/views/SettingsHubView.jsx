import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  Printer, FolderOpen, Database, Sun, Moon, Monitor, ChevronRight, Palette,
  ShieldCheck, AlertTriangle, Zap, HardDrive, Building2, Search, X, Info,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from '@/theme/ThemeProvider.jsx'
import { localPathToFileUrl } from '@/lib/localFileUrl'
import { useAppStore } from '@/stores/useAppStore.js'
import { Button } from '@/components/ui/button'
import { appConfirm } from '@/lib/appConfirm'
import { LabelEditor } from '@/components/label-editor/LabelEditor'

const DEFAULT_WORKSPACE_LOGO = '/branding/logo.jpg'

const SECTIONS_PRIMARY = [
  { id: 'workspace', label: 'Espacio de trabajo', Icon: Building2 },
  { id: 'appearance', label: 'Apariencia', Icon: Palette },
  { id: 'autofill', label: 'Alta de productos', Icon: Zap },
  { id: 'printing', label: 'Impresión', Icon: Printer },
]
const SECTIONS_SECONDARY = [
  { id: 'devices', label: 'Dispositivos', Icon: HardDrive },
  { id: 'data', label: 'Datos y copias', Icon: Database },
]
const SECTIONS_META = [{ id: 'about', label: 'Acerca de', Icon: Info }]
const NAV_GROUPS = [
  { key: 'general', heading: 'General', sections: SECTIONS_PRIMARY },
  { key: 'sistema', heading: 'Sistema', sections: SECTIONS_SECONDARY },
  { key: 'info', heading: '', sections: SECTIONS_META },
]

function navFilter(q, items) {
  const s = q.trim().toLowerCase()
  if (!s) return items
  return items.filter((it) => it.label.toLowerCase().includes(s) || it.id.includes(s))
}

function SectionWrap({ title, desc, children }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {desc && <p className="text-sm text-muted-foreground mt-1">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function SettingsGroup({ label, hint, children }) {
  return (
    <div className="space-y-2">
      {label && <h3 className="text-sm font-medium">{label}</h3>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}

function CheckField({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1.5">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 size-4 rounded border accent-primary" />
      <div>
        <span className="text-sm">{label}</span>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </label>
  )
}

function WorkspaceSection() {
  const [settings, setSettings] = useState(null)
  const load = useCallback(async () => { const st = await window.bazar?.settings?.get?.(); if (st) setSettings({ ...st }) }, [])
  useEffect(() => { void load() }, [load])
  const patch = async (partial) => { const next = { ...settings, ...partial }; setSettings(next); await window.bazar?.settings?.set?.(partial) }
  const pickLogo = async () => {
    const pick = window.bazar?.productImage?.pick
    if (!pick) { toast.error('Solo en Electron'); return }
    try { const res = await pick(); if (res?.cancelled || !res?.path) return; await patch({ workspaceLogoPath: res.path }); toast.success('Imagen actualizada') }
    catch (e) { toast.error(String(e?.message || e)) }
  }
  if (!settings) return <p className="text-sm text-muted-foreground py-8">Cargando…</p>
  const logoPreview = settings.workspaceLogoPath ? localPathToFileUrl(String(settings.workspaceLogoPath)) : DEFAULT_WORKSPACE_LOGO
  return (
    <SectionWrap title="Espacio de trabajo" desc="Nombre e imagen que aparecen en el menú lateral.">
      <SettingsGroup label="Nombre visible">
        <input type="text" className="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" value={String(settings.workspaceDisplayName ?? 'Saldos Monserrat')} onChange={(e) => setSettings((s) => ({ ...s, workspaceDisplayName: e.target.value }))} onBlur={(e) => void patch({ workspaceDisplayName: e.target.value.trim() || 'Saldos Monserrat' })} />
      </SettingsGroup>
      <SettingsGroup label="Imagen (avatar)" hint="Cuadrada o circular; se muestra redonda en la barra lateral. Es el logo de la empresa en las etiquetas cuando la plantilla incluye el bloque «Logo empresa» (misma imagen).">
        <div className="flex items-center gap-4">
          <img src={logoPreview} alt="" className="size-14 rounded-lg object-cover border" onError={(e) => { e.currentTarget.src = DEFAULT_WORKSPACE_LOGO }} />
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="outline" onClick={() => void pickLogo()}>Elegir imagen…</Button>
            <Button size="sm" variant="ghost" onClick={() => void patch({ workspaceLogoPath: '' })}>Usar logo por defecto</Button>
          </div>
        </div>
      </SettingsGroup>
    </SectionWrap>
  )
}

function AppearanceSection() {
  const { themePref, setTheme } = useTheme()
  const themes = [
    { id: 'system', Icon: Monitor, label: 'Sistema' },
    { id: 'light', Icon: Sun, label: 'Claro' },
    { id: 'dark', Icon: Moon, label: 'Oscuro' },
  ]
  return (
    <SectionWrap title="Apariencia" desc="Tema de la interfaz.">
      <SettingsGroup label="Tema">
        <div className="flex gap-2">
          {themes.map(({ id, Icon, label }) => (
            <button key={id} type="button" className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${themePref === id ? 'border-primary bg-primary/5 text-foreground font-medium' : 'hover:bg-accent text-muted-foreground'}`} onClick={() => void setTheme(id)}>
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </SettingsGroup>
    </SectionWrap>
  )
}

function AutofillSection() {
  const [settings, setSettings] = useState(null)
  const load = useCallback(async () => { const st = await window.bazar?.settings?.get?.(); if (st) setSettings(st) }, [])
  useEffect(() => { void load() }, [load])
  const patch = async (key, value) => { const next = { ...settings, [key]: value }; setSettings(next); await window.bazar?.settings?.set?.({ [key]: value }) }
  if (!settings) return <p className="text-sm text-muted-foreground py-8">Cargando…</p>
  const modes = [{ id: 'patrones', label: 'Patrones' }, { id: 'cuaderno', label: 'Cuaderno' }, { id: 'off', label: 'Desactivado' }]
  return (
    <SectionWrap title="Autollenado inteligente" desc="Configura cómo se sugieren nombre, precio y código al crear un artículo.">
      <SettingsGroup label="Modo de análisis" hint="«Patrones» analiza el inventario existente. «Cuaderno» usa las reglas por tag.">
        <div className="flex gap-2">
          {modes.map(({ id, label }) => (
            <button key={id} type="button" className={`px-4 py-2 rounded-lg border text-sm transition-colors ${settings.altaAutoFillMode === id ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-accent text-muted-foreground'}`} onClick={() => void patch('altaAutoFillMode', id)}>{label}</button>
          ))}
        </div>
      </SettingsGroup>
      <SettingsGroup label="Opciones individuales">
        <div className="space-y-1">
          <CheckField checked={settings.altaAutofillNombreDesdeTags !== false} onChange={(e) => void patch('altaAutofillNombreDesdeTags', e.target.checked)} label="Sugerir nombre desde tags" hint="Genera el nombre combinando los tags seleccionados." />
          <CheckField checked={settings.altaAutofillPrecioPatrones !== false} onChange={(e) => void patch('altaAutofillPrecioPatrones', e.target.checked)} label="Precio por patrones de inventario" hint="Usa la mediana de precios de artículos similares." />
          <CheckField checked={settings.altaAutofillPrecioCuaderno !== false} onChange={(e) => void patch('altaAutofillPrecioCuaderno', e.target.checked)} label="Precio por cuaderno" hint="Si un tag es regla de precio, usa ese monto." />
          <CheckField checked={settings.altaAutofillCodigoMsrNuevo !== false} onChange={(e) => void patch('altaAutofillCodigoMsrNuevo', e.target.checked)} label="Generar código MSR automático" hint="Asigna MSR-000001, MSR-000002… al crear." />
        </div>
      </SettingsGroup>
    </SectionWrap>
  )
}

function PrintingSection() {
  const [settings, setSettings] = useState(null)
  const [printersList, setPrintersList] = useState([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [templates, setTemplates] = useState({ activeId: null, templates: [] })
  const load = useCallback(async () => {
    const [st, pl, tpl] = await Promise.all([
      window.bazar?.settings?.get?.(),
      window.bazar?.printers?.list?.(),
      window.bazar?.labels?.list?.(),
    ])
    if (st) setSettings(st)
    if (Array.isArray(pl)) setPrintersList(pl)
    if (tpl) setTemplates(tpl)
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { if (!editorOpen) void load() }, [editorOpen, load])
  const patch = async (key, value) => { const next = { ...settings, [key]: value }; setSettings(next); await window.bazar?.settings?.set?.({ [key]: value }) }
  if (!settings) return <p className="text-sm text-muted-foreground py-8">Cargando…</p>
  return (
    <SectionWrap title="Impresión" desc="Etiquetas de producto (Code128) se guardan como PDF.">
      <SettingsGroup label="Carpeta para PDFs de etiqueta">
        <div className="flex items-center gap-2">
          <input type="text" readOnly className="h-9 flex-1 rounded-md border bg-muted px-3 text-xs outline-none" value={String(settings.labelPdfSavePath || '').trim() || '(Descargas)'} />
          <Button size="sm" variant="outline" className="gap-1.5" onClick={async () => {
            const pick = window.bazar?.settings?.pickLabelPdfFolder; if (!pick) { toast.error('Solo en Electron'); return }
            try { const r = await pick(); if (r?.cancelled) return; if (r?.path) { await patch('labelPdfSavePath', r.path); toast.success('Carpeta actualizada') } } catch (e) { toast.error(String(e?.message || e)) }
          }}>
            <FolderOpen className="size-3.5" />
            Elegir
          </Button>
          {String(settings.labelPdfSavePath || '').trim() && (
            <Button size="sm" variant="ghost" onClick={() => void patch('labelPdfSavePath', '')}>Usar Descargas</Button>
          )}
        </div>
      </SettingsGroup>
      <SettingsGroup label="Impresora de etiquetas">
        <select className="h-9 rounded-md border bg-background px-3 text-sm outline-none w-full max-w-sm" value={settings.devicePrinterLabelsName || ''} onChange={(e) => void patch('devicePrinterLabelsName', e.target.value)}>
          <option value="">Predeterminada del sistema</option>
          {printersList.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </SettingsGroup>
      <SettingsGroup label="Impresora de tickets">
        <select className="h-9 rounded-md border bg-background px-3 text-sm outline-none w-full max-w-sm" value={settings.devicePrinterTicketsName || ''} onChange={(e) => void patch('devicePrinterTicketsName', e.target.value)}>
          <option value="">Predeterminada del sistema</option>
          {printersList.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </SettingsGroup>
      <SettingsGroup label="Comportamiento al guardar">
        <CheckField checked={settings.printLabelAfterSave === true} onChange={(e) => void patch('printLabelAfterSave', e.target.checked)} label="Generar etiqueta PDF al crear producto" hint="Al guardar un artículo nuevo, crea el PDF en la carpeta configurada." />
      </SettingsGroup>
      <SettingsGroup label="Diseño de la etiqueta" hint="Personalizá bloques, tamaños, tipografía y plantillas. El aspecto del logo (térmica B/N o color) se ajusta en el editor al seleccionar el bloque «Logo empresa». Podés restaurar siempre el diseño original.">
        <div className="rounded-lg border p-4 flex items-center gap-3">
          <div className="size-9 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Editor visual de etiqueta</p>
            <p className="text-xs text-muted-foreground">
              {templates.templates.length > 0
                ? `${templates.templates.length} plantilla${templates.templates.length === 1 ? '' : 's'} · activa: ${templates.templates.find((t) => t.id === templates.activeId)?.name || '—'}`
                : 'Abrí el editor para crear y previsualizar plantillas.'}
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditorOpen(true)}>
            Abrir editor <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </SettingsGroup>
      <SettingsGroup label="Pruebas">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={async () => { const res = await window.bazar?.printers?.testPrint?.(settings.devicePrinterLabelsName || ''); if (res?.ok) toast.success(res.message); else toast.error(res?.message || 'Error') }}>
          Enviar prueba de impresión <ChevronRight className="size-3.5" />
        </Button>
      </SettingsGroup>
      <LabelEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
    </SectionWrap>
  )
}

function DevicesSection() {
  return (
    <SectionWrap title="Dispositivos" desc="Diagnóstico de impresoras, lector y periféricos.">
      <Button variant="outline" className="gap-1.5" onClick={() => window.bazar?.devices?.open?.()}>
        Abrir ventana de dispositivos <ChevronRight className="size-3.5" />
      </Button>
    </SectionWrap>
  )
}

function DataSection() {
  const [busy, setBusy] = useState(false)
  const resetDb = async () => {
    const api = window.bazar?.db?.resetToFactorySeed
    if (!api) { toast.error('Solo en Electron.'); return }
    if (!(await appConfirm('¿Borrar TODA la base de datos y cargar datos demo?', {
      destructive: true,
      title: 'Reiniciar base de datos',
      confirmLabel: 'Sí, borrar todo',
      description: 'Esta acción no se puede deshacer: se eliminan artículos, ventas y ajustes del espacio y se recargan datos de muestra.',
    }))) return
    setBusy(true)
    try { const res = await api(); if (res?.ok) toast.success(`Base reiniciada: ${res.productCount ?? 0} artículos demo.`); else toast.error(res?.message || 'Error') }
    catch (e) { toast.error(String(e?.message || e)) }
    finally { setBusy(false) }
  }
  return (
    <SectionWrap title="Datos y copias" desc="Respaldos e importación/exportación (en desarrollo).">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" />Zona peligrosa</h3>
        <p className="text-xs text-muted-foreground">Elimina la base, recrea tablas y carga datos de muestra.</p>
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => void resetDb()}>
          {busy ? 'Reiniciando…' : 'Vaciar base y cargar demo'}
        </Button>
      </div>
      <div className="flex items-center gap-3 rounded-lg border p-4 text-muted-foreground">
        <ShieldCheck className="size-6 shrink-0" />
        <p className="text-xs">Próximamente: respaldo, exportar CSV, importar desde otros formatos.</p>
      </div>
    </SectionWrap>
  )
}

function AboutSection() {
  return (
    <SectionWrap title="Acerca de Bazar Monserrat" desc="Aplicación de punto de venta e inventario.">
      <div className="grid grid-cols-3 gap-4">
        {[
          ['Versión', '0.1.0'],
          ['Plataforma', typeof window !== 'undefined' ? window.bazar?.runtime?.platform ?? 'web' : 'web'],
          ['Motor', 'Electron + React'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border p-3">
            <p className="text-[11px] text-muted-foreground">{k}</p>
            <p className="text-sm font-medium">{v}</p>
          </div>
        ))}
      </div>
    </SectionWrap>
  )
}

const SECTION_COMPONENTS = { workspace: WorkspaceSection, appearance: AppearanceSection, autofill: AutofillSection, printing: PrintingSection, devices: DevicesSection, data: DataSection, about: AboutSection }
const SECTION_HEADING = { workspace: 'Espacio de trabajo', appearance: 'Apariencia', autofill: 'Alta de productos', printing: 'Impresión', devices: 'Dispositivos', data: 'Datos y copias', about: 'Acerca de' }

export function SettingsHubView() {
  const closeSettings = useAppStore((s) => s.closeSettings)
  const [activeSection, setActiveSection] = useState('workspace')
  const [navQuery, setNavQuery] = useState('')
  const ActiveComponent = SECTION_COMPONENTS[activeSection] ?? WorkspaceSection

  useEffect(() => {
    const key = sessionStorage.getItem('settingsInitialSection')
    if (key && SECTION_COMPONENTS[key]) { setActiveSection(key); sessionStorage.removeItem('settingsInitialSection') }
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useHotkeys('escape', () => closeSettings())

  const filteredGroups = useMemo(() => NAV_GROUPS.map((g) => ({ ...g, sections: navFilter(navQuery, g.sections) })).filter((g) => g.sections.length > 0), [navQuery])

  const modal = (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={() => closeSettings()} />
      <div className="relative z-10 flex w-full max-w-4xl mx-auto my-8 rounded-xl border bg-card shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Rail */}
        <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col overflow-hidden">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input type="search" className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-ring" placeholder="Buscar" value={navQuery} onChange={(e) => setNavQuery(e.target.value)} autoComplete="off" spellCheck={false} />
            </div>
          </div>
          <nav className="flex-1 overflow-auto px-2 pb-2 space-y-3">
            {filteredGroups.map(({ key, heading, sections }) => (
              <div key={key}>
                {heading && <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{heading}</p>}
                <div className="space-y-0.5">
                  {sections.map(({ id, label, Icon }) => (
                    <button key={id} type="button" className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${activeSection === id ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/50'}`} onClick={() => setActiveSection(id)}>
                      <Icon className="size-4 shrink-0" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="flex items-center justify-between px-6 py-3 border-b shrink-0">
            <h2 className="text-base font-semibold">{SECTION_HEADING[activeSection] ?? 'Configuración'}</h2>
            <button type="button" className="size-8 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground" onClick={() => closeSettings()}>
              <X className="size-4" />
            </button>
          </header>
          <div className="flex-1 overflow-auto px-6 py-6">
            <ActiveComponent />
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return (
    <>
      {createPortal(modal, document.body)}
      <div className="flex-1" aria-hidden />
    </>
  )
}
