"""
Design tokens  ·  Saldos Monserrat
Inspirado en el logo (rosa + dorado) y en la cáscara visual tipo **Zen**:
fondo apagado, panel claro flotante, radios amplios, pocas líneas duras.
"""

# ── Colores principales ───────────────────────────────────────────────────────
PRIMARY        = "#C4607E"   # Rosa del logo — botones, activos, íconos seleccionados
PRIMARY_HOVER  = "#A84E6A"   # Rosa oscurecido — hover
PRIMARY_LIGHT  = "#F7D6E2"   # Rosa muy claro — fondos de ítem activo sidebar
PRIMARY_PALE   = "#FDF0F4"   # Rosa casi blanco — hover en sidebar
# Extremo oscuro del degradado en tarjetas primarias (antes #8A3060 suelto en código)
PRIMARY_DEEP   = "#8A3F5C"   # entre PRIMARY_HOVER y sombra profunda

GOLD           = "#C9A832"   # Dorado del logo — borde del logo circular
GOLD_MUTED     = "#D4B84A"   # acentos UI muy sutiles (líneas, puntos)

# ── Capa Zen (shell): fondo detrás de la tarjeta + columna navegación ─────────
BG_SHELL       = "#CDCCC6"   # Gris cálido apagado (como el lienzo detrás del panel en Zen)
BG_NAV_PANE    = "#D8D6D0"   # Columna lateral — un tono más claro que el shell
BG_APP         = BG_SHELL    # Fondo general de la app
BG_WINDOW      = BG_SHELL    # Barra título / status / raíz ventana
BG_SIDEBAR     = BG_NAV_PANE
BG_SIDEBAR_B   = "#D0CEC8"   # Hover suave en zona lateral
BG_CONTENT     = "#FEFEFE"  # Tarjeta principal (casi blanco, contraste con shell)
CONTENT_RADIUS = 20          # Esquinas amplias tipo “hoja flotante”
CONTENT_SHELL_MARGIN = 14    # Aire entre shell y tarjeta (px)
CHROME_LINE    = "#C4C0B8"   # Líneas muy suaves (no gris frío)
BORDER         = "#D5D1CA"   # Bordes de tarjetas secundarias
BORDER_MED     = "#BAB6AE"   # Inputs

TEXT_STRONG    = "#2A2927"   # Tinta fuerte (carbón, no negro puro)
TEXT_HEADING   = "#353432"   # Títulos de pantalla (Zen: jerarquía suave)
TEXT_BODY      = "#454340"   # Cuerpo
TEXT_CHROME    = "#5C5955"   # Marca en barra — discreta
TEXT_MUTED     = "#6E6A65"   # Secundario
TEXT_DISABLED  = "#B0ACA5"   # Deshabilitado

DIVIDER        = "#DDD9D2"   # Separadores internos

# ── Sidebar ───────────────────────────────────────────────────────────────────
SIDEBAR_W      = 220         # Ancho sidebar expandida (px)
SIDEBAR_W_COL  = 56          # Ancho sidebar colapsada (px)

# ── Tipografía ────────────────────────────────────────────────────────────────
FONT_FAMILY    = '"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", "Helvetica Neue", system-ui, sans-serif'
FONT_MONO      = '"Consolas", "Courier New", monospace'
# Escala modular (~1.2× entre niveles; base BODY 9pt)
FONT_SIZE_CAPTION    = 7.5   # secciones MAYÚSCULAS, leyendas
FONT_SIZE_BODY       = 9
FONT_SIZE_BODY_LG    = 10    # formularios densos
FONT_SIZE_SUBTITLE   = 11    # títulos de tarjeta
FONT_SIZE_TITLE      = 14    # pantalla (ej. Nuevo artículo)
FONT_SIZE_DISPLAY_SM = 16
FONT_SIZE_DISPLAY    = 18    # saludo dashboard
FONT_SIZE_CHROME     = 8     # barra de título nombre app
FONT_SIZE_EMPHASIS   = 13    # precio, datos que deben destacar sin ser título

# ── Espaciado (rejilla 8 px; medios 4 px) ───────────────────────────────────────
SPACE_HALF     = 4   # 0.5 × 8
SPACE_1        = 8   # 1 × 8
SPACE_2        = 16  # 2 × 8
SPACE_3        = 24  # 3 × 8
SPACE_4        = 32  # 4 × 8
SPACE_5        = 40  # 5 × 8 — útil para targets táctiles mínimos

RADIUS_SM      = 6
RADIUS_MD      = 10
RADIUS_LG      = 16   # Tarjetas / chips grandes (Zen)

# ── Foco teclado / accesibilidad ──────────────────────────────────────────────
FOCUS_BORDER_W = 2   # grosor borde :focus en inputs y botones

# ── Controles formulario (altura alineada a múltiplos de 8) ────────────────────
CONTROL_MIN_H  = 32  # QLineEdit / QComboBox densidad estándar

# ── Scrollbars (discretas: finas, thumb casi del color del fondo hasta hover) ─
SCROLLBAR_TRACK_W     = 3    # px — ancho total muy fino (tipo Zen / Fluent)
SCROLLBAR_HANDLE_MIN  = 24   # px altura/ancho mínimo del thumb
# Mismo matiz que la tinta del papel, muy baja opacidad → se funde con BG
SCROLLBAR_HANDLE      = "rgba(58, 52, 46, 0.10)"
SCROLLBAR_HANDLE_HOVER = "rgba(58, 52, 46, 0.28)"

# ── Sombras (para efectos manuales) ───────────────────────────────────────────
SHADOW_SM      = (0, 2, 8, 18)    # offset_x, offset_y, blur, alpha (0-255)
SHADOW_MD      = (0, 4, 18, 35)
SHADOW_LG      = (0, 8, 28, 50)

# ── Layout: ventana principal ─────────────────────────────────────────────────
TITLEBAR_H     = 38            # Altura barra de título custom (px)
WIN_DEFAULT_W  = 1280
WIN_DEFAULT_H  = 780
WIN_MIN_W      = 960
WIN_MIN_H      = 640

# ── Layout: inventario / alta de producto (alineación visual) ────────────────
INVENTARIO_DOCK_W        = 336   # Carril derecho (etiqueta + referencia)
INVENTARIO_BREAKPOINT_W  = 860   # Por debajo: dock oculto, botones abajo
THUMB_PRODUCTO_FORM      = 88    # Vista previa en formulario
THUMB_PRODUCTO_ETIQUETA  = 72    # Miniatura en panel etiqueta
THUMB_REFERENCIA_ROW     = 44    # Miniatura fila tabla referencia
