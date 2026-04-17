/**
 * Renderiza una etiqueta a PDF usando un modelo de bloques (ver label-model.cjs).
 *
 * Conversión:
 *  - Coordenadas del modelo: mm, eje Y hacia abajo desde arriba-izquierda.
 *  - PDF: puntos (pt), eje Y hacia arriba desde abajo-izquierda.
 *
 * El texto se dibuja con la baseline del bloque (parte inferior del primer
 * carácter en fontSize). Se calcula esa baseline centrando el texto dentro
 * de `h` como referencia.
 */

const fs = require('fs')
const path = require('path')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const { mmToPt, blockTextForData } = require('./label-model.cjs')

function getBwipJs() {
  try {
    return require('bwip-js/node')
  } catch (e1) {
    const direct = path.join(__dirname, '..', 'node_modules', 'bwip-js', 'dist', 'bwip-js-node.js')
    try {
      return require(direct)
    } catch (e2) {
      console.error('[label-pdf-render] No se pudo cargar bwip-js:', e1?.message || e1, '|', e2?.message || e2)
      throw e1
    }
  }
}

function hexToRgb01(hex, fallback) {
  const s = String(hex || '').trim()
  const m = /^#([0-9a-f]{6})$/i.exec(s)
  if (!m) return fallback
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 0xff) / 255
  const g = ((n >> 8) & 0xff) / 255
  const b = (n & 0xff) / 255
  return rgb(r, g, b)
}

function normalizeCode128Payload(raw) {
  let s = String(raw == null ? '' : raw).trim()
  if (!s) return ''
  s = s.replace(/[\x00-\x1f\x7f]/g, '')
  return s.slice(0, 64)
}

/**
 * Parte el texto en líneas respetando maxLen (en caracteres) y maxLines.
 * Si la línea no cabe, corta con ellipsis. (Nota: maxLen es aproximado porque
 * se usa sin medición real; para el preview SVG alcanza.)
 */
function wrapLines(text, maxLen, maxLines) {
  const t = String(text || '').trim() || '—'
  if (t === '—') return ['—']
  const words = t.split(/\s+/)
  const out = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length <= maxLen) cur = next
    else {
      if (cur) out.push(cur)
      cur = w.length > maxLen ? `${w.slice(0, maxLen - 1)}…` : w
    }
  }
  if (cur) out.push(cur)
  return out.slice(0, Math.max(1, maxLines || 1))
}

/**
 * Estima cuántos caracteres caben en `widthMm` con una fuente de `fontSizePt`.
 * Helvetica ≈ 0.55 × fontSize en avance horizontal promedio.
 */
function estimateMaxChars(widthMm, fontSizePt) {
  const widthPt = mmToPt(widthMm)
  const avg = Math.max(1, 0.55 * fontSizePt)
  return Math.max(1, Math.floor(widthPt / avg))
}

/**
 * Renderiza `template` + `data` en el PDF `outPath`. Devuelve metadata sobre
 * el código de barras (si se pudo generar).
 */
async function renderLabelPdf(outPath, template, data) {
  const W_mm = Number(template.width_mm) || 60
  const H_mm = Number(template.height_mm) || 40
  const PW = mmToPt(W_mm)
  const PH = mmToPt(H_mm)

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([PW, PH])
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const reg = await pdf.embedFont(StandardFonts.Helvetica)

  const bgColor = hexToRgb01(template.background, rgb(1, 1, 1))
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: bgColor })

  if (template.border && template.border.enabled) {
    const bw = Number(template.border.width) || 0.5
    const bc = hexToRgb01(template.border.color, rgb(0.78, 0.78, 0.8))
    page.drawRectangle({
      x: 0.5, y: 0.5, width: PW - 1, height: PH - 1,
      color: bgColor, borderColor: bc, borderWidth: bw,
    })
  }

  let barcodeOk = false
  let barcodeNote = ''

  for (const block of template.blocks || []) {
    if (!block || block.visible === false) continue
    const x = mmToPt(Number(block.x) || 0)
    const y = mmToPt(Number(block.y) || 0)
    const w = mmToPt(Math.max(1, Number(block.w) || 0))
    const h = mmToPt(Math.max(1, Number(block.h) || 0))

    /* pdf-lib usa origen abajo-izquierda; el modelo usa arriba-izquierda */
    const yBottom = PH - y - h
    const fontSizePt = Math.max(3, Number(block.fontSize) || 8)
    const font = block.fontWeight === 'bold' ? bold : reg
    const color = hexToRgb01(block.color, rgb(0.08, 0.08, 0.09))

    try {
      if (block.type === 'codigo_barras') {
        const payload = normalizeCode128Payload(String(data?.codigo || ''))
        if (!payload) {
          barcodeNote = 'Sin código para generar barras'
          continue
        }
        const bwipjs = getBwipJs()
        const pngBuf = await bwipjs.toBuffer({
          bcid: 'code128',
          text: payload,
          scale: 2,
          height: Math.max(6, Math.round((h / mmToPt(1)) * 0.9)),
          includetext: false,
          backgroundcolor: String(block.background || 'FFFFFF').replace('#', ''),
          barcolor: String(block.barColor || '000000').replace('#', ''),
        })
        const buf = Buffer.isBuffer(pngBuf) ? pngBuf : Buffer.from(pngBuf)
        const img = await pdf.embedPng(buf)
        const scale = Math.min(w / img.width, h / img.height, 1)
        const dw = img.width * scale
        const dh = img.height * scale
        page.drawImage(img, {
          x: x + (w - dw) / 2,
          y: yBottom + (h - dh) / 2,
          width: dw,
          height: dh,
        })
        barcodeOk = true
        continue
      }

      if (block.type === 'separador') {
        const thickness = Math.max(0.2, Number(block.thickness) || 0.5)
        const lineColor = hexToRgb01(block.color, rgb(0.78, 0.78, 0.8))
        page.drawLine({
          start: { x, y: yBottom + h / 2 },
          end: { x: x + w, y: yBottom + h / 2 },
          thickness,
          color: lineColor,
        })
        continue
      }

      if (block.type === 'logo' && data?.logoPath) {
        try {
          const raw = fs.readFileSync(data.logoPath)
          let img
          try {
            img = await pdf.embedPng(raw)
          } catch {
            img = await pdf.embedJpg(raw)
          }
          const scale = Math.min(w / img.width, h / img.height)
          const dw = img.width * scale
          const dh = img.height * scale
          page.drawImage(img, {
            x: x + (w - dw) / 2,
            y: yBottom + (h - dh) / 2,
            width: dw,
            height: dh,
          })
        } catch (err) {
          console.error('[label-pdf-render] logo:', err)
        }
        continue
      }

      /* Bloque precio: "LABEL    VALUE" */
      if (block.type === 'precio' && block.showLabel !== false) {
        const valueStr = blockTextForData(block, data)
        const labelStr = String(block.labelText || 'PRECIO:')
        const labelPt = Math.max(3, Number(block.labelFontSize) || fontSizePt * 0.75)
        const labelColor = hexToRgb01(block.labelColor || block.color, color)
        const labelWidth = bold.widthOfTextAtSize(labelStr, labelPt)
        const valueWidth = font.widthOfTextAtSize(valueStr, fontSizePt)
        const midY = yBottom + h / 2 - fontSizePt / 2 + fontSizePt * 0.28
        page.drawText(labelStr, { x: x + 2, y: midY, size: labelPt, font: bold, color: labelColor })
        page.drawText(valueStr, {
          x: x + w - valueWidth - 2,
          y: midY,
          size: fontSizePt,
          font,
          color,
        })
        continue
      }

      /* Resto de bloques texto (empresa / nombre / código / texto_libre / precio sin label) */
      const text = blockTextForData(block, data)
      const maxLines = Math.max(1, Number(block.maxLines) || 1)
      const approxPerLine = estimateMaxChars(Math.max(1, Number(block.w) || 10), fontSizePt)
      const lines = wrapLines(text, approxPerLine, maxLines)
      const lineGap = Math.round(fontSizePt * 0.25 * 100) / 100
      const totalH = lines.length * fontSizePt + (lines.length - 1) * lineGap
      let ty = yBottom + h - (h - totalH) / 2 - fontSizePt
      for (const line of lines) {
        const lw = font.widthOfTextAtSize(line, fontSizePt)
        let lx = x + 2
        if (block.align === 'center') lx = x + (w - lw) / 2
        else if (block.align === 'right') lx = x + w - lw - 2
        page.drawText(line, { x: lx, y: ty, size: fontSizePt, font, color })
        ty -= fontSizePt + lineGap
      }
    } catch (err) {
      console.error('[label-pdf-render] bloque', block.type, err)
    }
  }

  fs.writeFileSync(outPath, await pdf.save())
  return { barcodeOk, barcodeNote: barcodeOk ? undefined : barcodeNote }
}

module.exports = { renderLabelPdf }
