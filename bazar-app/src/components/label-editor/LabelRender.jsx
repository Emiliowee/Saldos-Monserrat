import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { normalizeCode128Payload } from '@/lib/barcode128'
import { blockTextForData, MM_PER_PT } from '@/lib/labelModel'
import { localPathToFileUrl } from '@/lib/localFileUrl'

/**
 * Renderiza una etiqueta a SVG a partir del template + datos.
 * - Coordenadas en mm (mismo sistema que el generador PDF).
 * - El SVG escala con `width` en CSS pixels; el viewBox siempre usa mm.
 * - Si `interactive` es true, habilita eventos para el editor (onBlockPointerDown,
 *   onCanvasPointerDown) y pinta handles de selección.
 */
export function LabelRender({
  template,
  data,
  scale = 4,
  className = '',
  interactive = false,
  selectedId = null,
  onSelectBlock = null,
  onCanvasPointerDown = null,
  onBlockPointerDown = null,
  onResizeHandlePointerDown = null,
  showGrid = false,
}) {
  const W = Number(template?.width_mm) || 60
  const H = Number(template?.height_mm) || 40
  const widthPx = W * scale
  const heightPx = H * scale

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={widthPx}
      height={heightPx}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ display: 'block', userSelect: 'none' }}
      onPointerDown={interactive ? onCanvasPointerDown : undefined}
    >
      <rect x={0} y={0} width={W} height={H} fill={template?.background || '#ffffff'} />

      {showGrid && <GridPattern w={W} h={H} />}

      {template?.border?.enabled && (
        <rect
          x={0.5}
          y={0.5}
          width={W - 1}
          height={H - 1}
          fill="none"
          stroke={template.border.color || '#C6C6C7'}
          strokeWidth={Number(template.border.width) || 0.5}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {(template?.blocks || []).map((b) => {
        if (b.visible === false && !interactive) return null
        const isSel = interactive && selectedId === b.id
        return (
          <g key={b.id}>
            <BlockRender block={b} data={data} opacity={b.visible === false ? 0.22 : 1} />
            {interactive && (
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill="transparent"
                stroke={isSel ? '#3b82f6' : 'transparent'}
                strokeWidth={isSel ? 0.25 : 0}
                vectorEffect="non-scaling-stroke"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onBlockPointerDown?.(e, b)
                  onSelectBlock?.(b.id)
                }}
                style={{ cursor: isSel ? 'move' : 'pointer' }}
              />
            )}
            {isSel && (
              <ResizeHandles
                block={b}
                onPointerDown={(e, corner) => {
                  e.stopPropagation()
                  onResizeHandlePointerDown?.(e, b, corner)
                }}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

function GridPattern({ w, h }) {
  const lines = []
  for (let x = 5; x < w; x += 5) {
    lines.push(
      <line key={`vx-${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#eceae6" strokeWidth={0.1} vectorEffect="non-scaling-stroke" />,
    )
  }
  for (let y = 5; y < h; y += 5) {
    lines.push(
      <line key={`hy-${y}`} x1={0} y1={y} x2={w} y2={y} stroke="#eceae6" strokeWidth={0.1} vectorEffect="non-scaling-stroke" />,
    )
  }
  return <g>{lines}</g>
}

function ResizeHandles({ block, onPointerDown }) {
  const s = 1.5
  const handles = [
    { id: 'nw', x: block.x, y: block.y },
    { id: 'ne', x: block.x + block.w, y: block.y },
    { id: 'sw', x: block.x, y: block.y + block.h },
    { id: 'se', x: block.x + block.w, y: block.y + block.h },
  ]
  const cursorMap = { nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize' }
  return (
    <g>
      {handles.map((h) => (
        <rect
          key={h.id}
          x={h.x - s / 2}
          y={h.y - s / 2}
          width={s}
          height={s}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={0.25}
          vectorEffect="non-scaling-stroke"
          style={{ cursor: cursorMap[h.id] }}
          onPointerDown={(e) => onPointerDown?.(e, h.id)}
        />
      ))}
    </g>
  )
}

function BlockRender({ block, data, opacity = 1 }) {
  const common = { opacity }
  switch (block.type) {
    case 'codigo_barras':
      return <BarcodeBlock block={block} data={data} {...common} />
    case 'separador':
      return (
        <line
          x1={block.x}
          y1={block.y + block.h / 2}
          x2={block.x + block.w}
          y2={block.y + block.h / 2}
          stroke={block.color || '#C6C6C7'}
          strokeWidth={Number(block.thickness) || 0.5}
          vectorEffect="non-scaling-stroke"
          {...common}
        />
      )
    case 'logo':
      return <LogoBlock block={block} data={data} {...common} />
    case 'precio':
      return <PrecioBlock block={block} data={data} {...common} />
    default:
      return <TextBlock block={block} data={data} {...common} />
  }
}

function BarcodeBlock({ block, data, ...rest }) {
  const ref = useRef(null)
  const codigo = String(data?.codigo || '').trim()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const c = normalizeCode128Payload(codigo)
    el.innerHTML = ''
    if (!c) return
    try {
      JsBarcode(el, c, {
        format: 'CODE128',
        width: 2,
        height: 40,
        displayValue: false,
        margin: 0,
        background: block.background || '#ffffff',
        lineColor: block.barColor || '#000000',
      })
    } catch {
      /* payload inválido */
    }
  }, [codigo, block.barColor, block.background])
  return (
    <g {...rest}>
      <foreignObject x={block.x} y={block.y} width={block.w} height={block.h}>
        <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: block.background || '#ffffff' }}>
          <svg ref={ref} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none" />
        </div>
      </foreignObject>
    </g>
  )
}

function LogoBlock({ block, data, ...rest }) {
  const path = String(data?.logoPath || '').trim()
  if (!path) {
    return (
      <g {...rest}>
        <rect x={block.x} y={block.y} width={block.w} height={block.h} fill="hsl(240 5% 96%)" stroke="hsl(240 4% 84%)" strokeWidth={0.15} vectorEffect="non-scaling-stroke" />
        <text x={block.x + block.w / 2} y={block.y + block.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={5 * MM_PER_PT} fontFamily="Helvetica, Arial, sans-serif" fill="#9ca3af">Logo</text>
      </g>
    )
  }
  const url = localPathToFileUrl(path)
  return (
    <g {...rest}>
      <image href={url} x={block.x} y={block.y} width={block.w} height={block.h} preserveAspectRatio="xMidYMid meet" />
    </g>
  )
}

function PrecioBlock({ block, data, ...rest }) {
  const value = blockTextForData(block, data)
  const fontSizePt = Math.max(3, Number(block.fontSize) || 10)
  const sizeMm = fontSizePt * MM_PER_PT
  const color = block.color || '#141417'
  const cy = block.y + block.h / 2
  const fontFamily = 'Helvetica, Arial, sans-serif'
  const weight = block.fontWeight === 'bold' ? 700 : 400
  if (block.showLabel === false) {
    return (
      <TextBlock block={{ ...block, text: value }} data={data} {...rest} />
    )
  }
  const labelFontPt = Math.max(3, Number(block.labelFontSize) || fontSizePt * 0.75)
  const labelSizeMm = labelFontPt * MM_PER_PT
  const labelColor = block.labelColor || color
  return (
    <g {...rest}>
      <text
        x={block.x + 0.5}
        y={cy}
        fontSize={labelSizeMm}
        fontFamily={fontFamily}
        fontWeight={700}
        fill={labelColor}
        dominantBaseline="central"
      >
        {block.labelText || 'PRECIO:'}
      </text>
      <text
        x={block.x + block.w - 0.5}
        y={cy}
        fontSize={sizeMm}
        fontFamily={fontFamily}
        fontWeight={weight}
        fill={color}
        textAnchor="end"
        dominantBaseline="central"
      >
        {value}
      </text>
    </g>
  )
}

function TextBlock({ block, data, ...rest }) {
  const text = block.type === 'texto_libre' ? String(block.text || '') : blockTextForData(block, data)
  const fontSizePt = Math.max(3, Number(block.fontSize) || 8)
  const sizeMm = fontSizePt * MM_PER_PT
  const color = block.color || '#141417'
  const fontFamily = 'Helvetica, Arial, sans-serif'
  const weight = block.fontWeight === 'bold' ? 700 : 400
  const align = block.align || 'left'
  const maxLines = Math.max(1, Number(block.maxLines) || 1)
  const lines = wrapText(text, estimateCharsPerMm(block.w, fontSizePt), maxLines)

  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
  let ax = block.x + 0.5
  if (align === 'center') ax = block.x + block.w / 2
  else if (align === 'right') ax = block.x + block.w - 0.5

  const lineHeight = sizeMm * 1.15
  const totalH = lines.length * lineHeight
  let ty = block.y + (block.h - totalH) / 2 + lineHeight * 0.78

  return (
    <g {...rest}>
      {lines.map((ln, i) => (
        <text
          key={i}
          x={ax}
          y={ty + i * lineHeight}
          fontSize={sizeMm}
          fontFamily={fontFamily}
          fontWeight={weight}
          fill={color}
          textAnchor={anchor}
        >
          {ln}
        </text>
      ))}
    </g>
  )
}

function estimateCharsPerMm(widthMm, fontSizePt) {
  /* Conversion pt→mm ≈ 0.353; carácter Helvetica avance ≈ 0.55 × size */
  const charAdvanceMm = 0.55 * fontSizePt * 0.353
  return Math.max(1, Math.floor(Number(widthMm) / charAdvanceMm))
}

function wrapText(text, maxChars, maxLines) {
  const t = String(text || '').trim() || '—'
  if (t === '—') return ['—']
  const words = t.split(/\s+/)
  const out = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length <= maxChars) cur = next
    else {
      if (cur) out.push(cur)
      cur = w.length > maxChars ? `${w.slice(0, Math.max(1, maxChars - 1))}…` : w
    }
  }
  if (cur) out.push(cur)
  return out.slice(0, Math.max(1, maxLines))
}
