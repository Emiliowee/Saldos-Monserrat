/**
 * Modelo de etiqueta basado en bloques posicionados en milímetros (mm).
 *
 * El mismo JSON lo consumen:
 *  - El renderer React (vista previa + editor canvas) — `LabelRender.jsx`.
 *  - El generador PDF en Electron — `label-pdf-render.cjs` (pdf-lib).
 *
 * Convenciones:
 *  - Unidades de caja (x, y, w, h): milímetros (`mm`).
 *  - `fontSize`, `labelFontSize`: puntos tipográficos (**pt**), igual que el PDF.
 *    En `LabelRender.jsx` se convierten a mm para el SVG (viewBox en mm).
 *  - Ejes: origen arriba-izquierda (como CSS/SVG). El PDF invierte Y internamente.
 *  - Colores: hex string `#RRGGBB` (siempre 7 chars).
 *  - Fuentes: Helvetica (compatibilidad con pdf-lib sin embed externo).
 */

export const MM_PER_PT = 1 / 2.8346456693
export const PT_PER_MM = 2.8346456693

export function mmToPt(mm) {
  return Number(mm) * PT_PER_MM
}
export function ptToMm(pt) {
  return Number(pt) * MM_PER_PT
}

export const BLOCK_TYPES = Object.freeze({
  empresa: 'empresa',
  logo: 'logo',
  nombre: 'nombre',
  precio: 'precio',
  codigo: 'codigo',
  codigo_barras: 'codigo_barras',
  texto_libre: 'texto_libre',
  separador: 'separador',
})

export const BLOCK_META = {
  empresa: {
    label: 'Empresa',
    icon: 'building',
    sample: 'Saldos Monserrat',
    defaults: { fontSize: 6, fontWeight: 'bold', align: 'center', color: '#6B4A52' },
  },
  logo: { label: 'Logo', icon: 'image', sample: null, defaults: { objectFit: 'contain' } },
  nombre: {
    label: 'Nombre',
    icon: 'type',
    sample: 'Artículo',
    defaults: { fontSize: 6.5, fontWeight: 'normal', align: 'left', color: '#141417', maxLines: 2 },
  },
  precio: {
    label: 'Precio',
    icon: 'tag',
    sample: '$0',
    defaults: {
      fontSize: 10,
      fontWeight: 'bold',
      align: 'center',
      color: '#141417',
      showLabel: false,
      labelText: 'PRECIO:',
      labelFontSize: 6.5,
      labelColor: '#141417',
    },
  },
  codigo: {
    label: 'Código',
    icon: 'hash',
    sample: 'MSR-0001',
    defaults: { fontSize: 6, fontWeight: 'bold', align: 'center', color: '#141417' },
  },
  codigo_barras: {
    label: 'Código de barras',
    icon: 'barcode',
    sample: null,
    defaults: { barColor: '#000000', background: '#FFFFFF' },
  },
  texto_libre: {
    label: 'Texto',
    icon: 'text',
    sample: 'Texto',
    defaults: { fontSize: 6.5, fontWeight: 'normal', align: 'center', color: '#141417', text: 'Texto' },
  },
  separador: {
    label: 'Separador',
    icon: 'minus',
    sample: null,
    defaults: { thickness: 0.5, color: '#C6C6C7' },
  },
}

export function createBlock(type, overrides = {}) {
  const meta = BLOCK_META[type]
  if (!meta) throw new Error(`Tipo de bloque desconocido: ${type}`)
  return {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `b_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    type,
    x: 2,
    y: 2,
    w: 40,
    h: 6,
    visible: true,
    ...meta.defaults,
    ...overrides,
  }
}

/** IDs de plantillas que vienen con la app (no eliminables). */
export const BUILTIN_TEMPLATE_IDS = Object.freeze(['default', 'bazar_ticket', 'gondola', 'precio_destacado'])

export function isBuiltinTemplateId(id) {
  return BUILTIN_TEMPLATE_IDS.includes(String(id || ''))
}

/**
 * Plantillas listas para bazar / tienda de ropa (tamaños típicos de etiqueta adhesiva o ticket).
 */
export function createBuiltinTemplates() {
  return [tplEstandarBazar(), tplTicketCompacto(), tplGondola(), tplPrecioDestacado()]
}

export function createDefaultTemplate() {
  return tplEstandarBazar()
}

/** 50×35 mm — equilibrada: tienda, nombre, precio, barras, SKU. */
function tplEstandarBazar() {
  const W = 50
  const H = 35
  return {
    id: 'default',
    name: 'Estándar bazar',
    createdAt: null,
    updatedAt: null,
    width_mm: W,
    height_mm: H,
    autoHeight: false,
    padding_mm: 2,
    background: '#FFFFFF',
    border: { enabled: true, width: 0.45, color: '#D4D2CE' },
    blocks: [
      {
        id: 'b_empresa',
        type: 'empresa',
        x: 2,
        y: 1.2,
        w: W - 4,
        h: 3,
        visible: true,
        fontSize: 5.5,
        fontWeight: 'bold',
        align: 'center',
        color: '#6B4A52',
      },
      {
        id: 'b_nombre',
        type: 'nombre',
        x: 2,
        y: 4.2,
        w: W - 4,
        h: 10.5,
        visible: true,
        fontSize: 6.5,
        fontWeight: 'normal',
        align: 'left',
        color: '#141417',
        maxLines: 2,
      },
      {
        id: 'b_precio',
        type: 'precio',
        x: 2,
        y: 15,
        w: W - 4,
        h: 6.2,
        visible: true,
        fontSize: 10,
        fontWeight: 'bold',
        align: 'center',
        color: '#141417',
        showLabel: false,
        labelText: 'PRECIO:',
        labelFontSize: 6,
        labelColor: '#141417',
      },
      {
        id: 'b_barcode',
        type: 'codigo_barras',
        x: 3,
        y: 21.5,
        w: W - 6,
        h: 9,
        visible: true,
        barColor: '#000000',
        background: '#FFFFFF',
      },
      {
        id: 'b_codigo',
        type: 'codigo',
        x: 2,
        y: 30.8,
        w: W - 4,
        h: 3.2,
        visible: true,
        fontSize: 5.5,
        fontWeight: 'bold',
        align: 'center',
        color: '#3F3F46',
      },
    ],
  }
}

/** 40×30 mm — ticket térmico pequeño, precio claro. */
function tplTicketCompacto() {
  const W = 40
  const H = 30
  return {
    id: 'bazar_ticket',
    name: 'Ticket compacto',
    createdAt: null,
    updatedAt: null,
    width_mm: W,
    height_mm: H,
    autoHeight: false,
    padding_mm: 2,
    background: '#FFFFFF',
    border: { enabled: true, width: 0.4, color: '#D4D2CE' },
    blocks: [
      {
        id: 'bc_cod',
        type: 'codigo',
        x: 2,
        y: 1.5,
        w: W - 4,
        h: 2.8,
        visible: true,
        fontSize: 5.5,
        fontWeight: 'bold',
        align: 'center',
        color: '#52525B',
      },
      {
        id: 'bc_bar',
        type: 'codigo_barras',
        x: 2.5,
        y: 4.5,
        w: W - 5,
        h: 8,
        visible: true,
        barColor: '#000000',
        background: '#FFFFFF',
      },
      {
        id: 'bc_precio',
        type: 'precio',
        x: 2,
        y: 13,
        w: W - 4,
        h: 7,
        visible: true,
        fontSize: 11,
        fontWeight: 'bold',
        align: 'center',
        color: '#141417',
        showLabel: false,
      },
      {
        id: 'bc_nombre',
        type: 'nombre',
        x: 2,
        y: 20,
        w: W - 4,
        h: 6,
        visible: true,
        fontSize: 6,
        fontWeight: 'normal',
        align: 'center',
        color: '#141417',
        maxLines: 2,
      },
      {
        id: 'bc_emp',
        type: 'empresa',
        x: 2,
        y: 26.5,
        w: W - 4,
        h: 2.8,
        visible: true,
        fontSize: 5,
        fontWeight: 'bold',
        align: 'center',
        color: '#6B4A52',
      },
    ],
  }
}

/** 58×26 mm — góndola: nombre a la izquierda, precio a la derecha, barras abajo. */
function tplGondola() {
  const W = 58
  const H = 26
  return {
    id: 'gondola',
    name: 'Góndola (nombre + precio)',
    createdAt: null,
    updatedAt: null,
    width_mm: W,
    height_mm: H,
    autoHeight: false,
    padding_mm: 2,
    background: '#FFFFFF',
    border: { enabled: true, width: 0.45, color: '#D4D2CE' },
    blocks: [
      {
        id: 'go_nom',
        type: 'nombre',
        x: 2,
        y: 2,
        w: 36,
        h: 11,
        visible: true,
        fontSize: 6.5,
        fontWeight: 'normal',
        align: 'left',
        color: '#141417',
        maxLines: 2,
      },
      {
        id: 'go_pre',
        type: 'precio',
        x: 40,
        y: 3,
        w: W - 42,
        h: 9,
        visible: true,
        fontSize: 10,
        fontWeight: 'bold',
        align: 'center',
        color: '#141417',
        showLabel: false,
      },
      {
        id: 'go_bar',
        type: 'codigo_barras',
        x: 2,
        y: 13.5,
        w: W - 4,
        h: 8,
        visible: true,
        barColor: '#000000',
        background: '#FFFFFF',
      },
      {
        id: 'go_cod',
        type: 'codigo',
        x: 2,
        y: 22,
        w: W - 4,
        h: 3.5,
        visible: true,
        fontSize: 5.5,
        fontWeight: 'bold',
        align: 'center',
        color: '#52525B',
      },
    ],
  }
}

/** 42×28 mm — precio muy visible (liquidación / promoción). */
function tplPrecioDestacado() {
  const W = 42
  const H = 28
  return {
    id: 'precio_destacado',
    name: 'Precio destacado',
    createdAt: null,
    updatedAt: null,
    width_mm: W,
    height_mm: H,
    autoHeight: false,
    padding_mm: 2,
    background: '#FFFFFF',
    border: { enabled: true, width: 0.5, color: '#C6C6C7' },
    blocks: [
      {
        id: 'pd_pre',
        type: 'precio',
        x: 2,
        y: 2,
        w: W - 4,
        h: 9,
        visible: true,
        fontSize: 13,
        fontWeight: 'bold',
        align: 'center',
        color: '#141417',
        showLabel: false,
      },
      {
        id: 'pd_nom',
        type: 'nombre',
        x: 2,
        y: 11.5,
        w: W - 4,
        h: 8,
        visible: true,
        fontSize: 6,
        fontWeight: 'normal',
        align: 'center',
        color: '#141417',
        maxLines: 2,
      },
      {
        id: 'pd_bar',
        type: 'codigo_barras',
        x: 2.5,
        y: 19.5,
        w: W - 5,
        h: 6,
        visible: true,
        barColor: '#000000',
        background: '#FFFFFF',
      },
      {
        id: 'pd_cod',
        type: 'codigo',
        x: 2,
        y: 25.5,
        w: W - 4,
        h: 2.5,
        visible: true,
        fontSize: 5,
        fontWeight: 'bold',
        align: 'center',
        color: '#71717A',
      },
    ],
  }
}

/**
 * Rellena campos faltantes de una plantilla persistida con defaults del tipo,
 * asegurando que SIEMPRE haya valores utilizables para renderizar.
 */
export function normalizeTemplate(input) {
  if (!input || typeof input !== 'object') return createDefaultTemplate()
  const base = createDefaultTemplate()
  const t = {
    ...base,
    ...input,
    border: { ...base.border, ...(input.border || {}) },
    blocks: Array.isArray(input.blocks) ? input.blocks.slice() : [],
  }
  const normBlocks = []
  for (const b of t.blocks) {
    if (!b || !BLOCK_META[b.type]) continue
    const meta = BLOCK_META[b.type]
    normBlocks.push({
      ...meta.defaults,
      ...b,
      id:
        b.id ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `b_${Date.now()}_${Math.floor(Math.random() * 10000)}`),
      x: Number.isFinite(b.x) ? Number(b.x) : 2,
      y: Number.isFinite(b.y) ? Number(b.y) : 2,
      w: Number.isFinite(b.w) ? Math.max(2, Number(b.w)) : 40,
      h: Number.isFinite(b.h) ? Math.max(1, Number(b.h)) : 6,
      visible: b.visible !== false,
    })
  }
  t.blocks = normBlocks
  t.width_mm = Number.isFinite(Number(t.width_mm)) ? Math.max(15, Number(t.width_mm)) : base.width_mm
  t.height_mm = Number.isFinite(Number(t.height_mm)) ? Math.max(10, Number(t.height_mm)) : base.height_mm
  return t
}

/** Resuelve el texto a imprimir de un bloque para un producto concreto. */
export function blockTextForData(block, data) {
  if (!block) return ''
  const d = data || {}
  switch (block.type) {
    case 'empresa':
      return String(d.empresa ?? 'Saldos Monserrat')
    case 'nombre':
      return String(d.nombre ?? '').trim() || '—'
    case 'precio':
      return String(d.precio ?? '$0')
    case 'codigo':
      return String(d.codigo ?? '').trim() || '—'
    case 'texto_libre':
      return String(block.text ?? '')
    default:
      return ''
  }
}

/** Deep clone seguro (sin structuredClone para mantener compatibilidad). */
export function cloneTemplate(t) {
  return JSON.parse(JSON.stringify(t))
}
