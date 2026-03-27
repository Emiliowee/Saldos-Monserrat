"""
Colores y medidas alineados al **logo Saldos Monserrat**:
rosa #C4607E, dorado #C9A832, fondos papel (no grises fríos ni barra negra).
"""
from __future__ import annotations

# ── Marca (logo) ─────────────────────────────────────────────────────────────
PRIMARY = "#C4607E"
PRIMARY_HOVER = "#A84E6A"
PRIMARY_LIGHT = "#F7D6E2"
PRIMARY_PALE = "#FDF0F4"
GOLD = "#C9A832"
GOLD_MUTED = "#D4B84A"

# Compatibilidad con nombre anterior
ACCENT = PRIMARY
ACCENT_HOVER = PRIMARY_HOVER
ACCENT_MUTED = "rgba(196, 96, 126, 0.16)"
ACCENT_GLOW = "rgba(196, 96, 126, 0.22)"

# ── Capas: papel y tela (tienda) ───────────────────────────────────────────────
# Fondo general detrás de la tarjeta (referencia para sidebar/título tipo Zen)
SHELL_BG = "#DDD8CF"

# Iconos en la lista del menú lateral (rosa tierra, legible sobre el mismo fondo)
SIDEBAR_ICON = "#8E5F72"

# Columna menú + búsqueda: **mismo color que el shell** — se funde con el fondo (Zen)
NAV_BG = SHELL_BG
NAV_BORDER = "rgba(58, 53, 48, 0.06)"
NAV_TEXT = "#3A3530"
NAV_TEXT_MUTED = "#6E6860"
NAV_ROW_HOVER = "rgba(58, 53, 48, 0.05)"
NAV_ROW_SELECTED = "rgba(196, 96, 126, 0.12)"

# Barra título: **mismo tono que el fondo**; borde apenas perceptible
TITLEBAR_BG = SHELL_BG
TITLEBAR_TEXT = "#3A3530"
TITLEBAR_BORDER = "rgba(58, 53, 48, 0.07)"
TITLEBAR_BTN = "#5C5650"
TITLEBAR_BTN_HOVER = "rgba(58, 53, 48, 0.07)"

# Búsqueda: velo claro sobre el mismo fondo (no “caja” de otro color)
SEARCH_BG = "rgba(255, 252, 246, 0.55)"
SEARCH_BORDER = "rgba(58, 53, 48, 0.10)"

# Tarjeta central: más clara / “viva” (tipo contenido web en Zen — más contraste)
CARD_BG_TOP = "#FFFFFF"
CARD_BG_MID = "#FFFEFA"
CARD_BG_BOTTOM = "#FFF6EC"
CARD_BORDER = "rgba(201, 168, 50, 0.13)"
# Compat: sólido si algún QSS no usa gradiente
CARD_BG = CARD_BG_MID
CARD_SHADOW_RGB = (115, 92, 72)
CARD_SHADOW_ALPHA = 42
CARD_PAGE_BODY = "#4A433C"

# ── Medidas (px) ─────────────────────────────────────────────────────────────
# Ancho tipo Zen Browser: barra más estrecha (~15% en ventanas anchas vs. ~20% con 276px).
NAV_W = 228
NAV_COLLAPSED_W = 56  # Solo iconos (tipo Zen compacto)
NAV_EDGE_GRIP_W = 5  # Franja izquierda para mostrar el menú al pasar el ratón (Zen)
TITLEBAR_H = 34
TITLEBAR_STRIP_H = 6  # Franja superior cuando la barra está oculta
CARD_RADIUS = 18
# Panel central casi “encajado” (estilo Zen): poco aire; la tarjeta se lee por sombra + radio.
SHELL_MARGIN = 6
SHELL_MARGIN_LEFT = 2
# Margen superior cuando solo hay franja de título (sigue pegado al área útil).
SHELL_MARGIN_TOP_COMPACT = 3
SEARCH_RADIUS = 999
# Lista lateral Zen: filas más compactas (más cercano al sidebar del navegador Zen).
ROW_HEIGHT = 34
NAV_LIST_ICON = 18  # px lado icono en QListWidget

# ── Tipografía (legible en Windows; sin forzar Inter) ────────────────────────
FONT_UI = '"Segoe UI Variable Text", "Segoe UI", "Helvetica Neue", system-ui, sans-serif'
FONT_SIZE_NAV = 12
FONT_SIZE_SEARCH = 11
FONT_SIZE_CARD_TITLE = 21
FONT_SIZE_CARD_BODY = 13
FONT_SIZE_CAPTION = 11

# ── Scrollbars: más finas, thumb del **mismo tono** que el fondo (casi invisible)
SCROLLBAR_W = 2
SCROLLBAR_HANDLE = "rgba(90, 82, 72, 0.09)"
SCROLLBAR_HANDLE_HOVER = "rgba(90, 82, 72, 0.20)"
SCROLLBAR_MIN_THUMB = 16
