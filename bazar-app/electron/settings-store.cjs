const fs = require('fs')
const path = require('path')

const DEFAULTS = {
  /** system | light | dark */
  theme: 'system',
  devicePrinterLabelsName: '',
  devicePrinterTicketsName: '',
  /** cuaderno | patrones | off — paridad con `producto_prefs.py`; patrones = mediana inventario (más liviano que cuaderno) */
  altaAutoFillMode: 'patrones',
  altaAutofillPrecioCuaderno: true,
  altaAutofillPrecioPatrones: true,
  altaAutofillNombreDesdeTags: true,
  /** Si el código queda vacío en artículo nuevo, sugerir el siguiente MSR */
  altaAutofillCodigoMsrNuevo: true,
  /** Imprimir etiqueta automáticamente después de guardar un producto nuevo */
  printLabelAfterSave: false,
  /** Carpeta absoluta para PDFs de etiqueta; vacío = carpeta Descargas del sistema */
  labelPdfSavePath: '',
  /** Nombre mostrado en la cabecera del sidebar (tipo Notion workspace) */
  workspaceDisplayName: 'Saldos Monserrat',
  /** Ruta absoluta a imagen personalizada; vacío = logo por defecto `/branding/logo.jpg` */
  workspaceLogoPath: '',
  /** Carpeta Banqueta en sidebar: expandida al estilo Zen/Python */
  navBanquetaFolderOpen: true,
  /** Barra lateral colapsada (legacy; migrar a sidebarHidden) */
  sidebarCollapsed: false,
  /** Barra lateral totalmente oculta (se muestra al pasar el ratón por el borde o con el botón) */
  sidebarHidden: false,
  /** Vidrio Raycast en sesión (gradiente + backdrop-filter). false = carril y pozo planos como antes */
  shellGlassEnabled: true,
}

/**
 * @param {string} userDataPath
 */
function createSettingsStore(userDataPath) {
  const file = path.join(userDataPath, 'bazar-settings.json')

  function read() {
    try {
      const raw = fs.readFileSync(file, 'utf8')
      const data = JSON.parse(raw)
      return { ...DEFAULTS, ...data }
    } catch {
      return { ...DEFAULTS }
    }
  }

  function write(data) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
  }

  return {
    getAll() {
      return read()
    },
    /** @param {Partial<typeof DEFAULTS>} patch */
    merge(patch) {
      const next = { ...read(), ...patch }
      write(next)
      return next
    },
  }
}

module.exports = { createSettingsStore, DEFAULTS }
