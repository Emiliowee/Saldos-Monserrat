"""
Ventana principal  ·  Saldos Monserrat
Estilo Zen: fondo del sidebar rodea el panel de contenido por todos lados.
"""
import sys
import os
import ctypes
import ctypes.wintypes

from functools import partial

import qtawesome as qta

from PySide6.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QStackedWidget, QLabel, QPushButton, QFrame,
    QSizePolicy, QMenu, QApplication, QGraphicsDropShadowEffect,
)
from PySide6.QtCore import Qt, Signal, QSize, QPoint
from PySide6.QtGui import (
    QIcon, QColor, QPixmap, QFont, QPainter, QPainterPath,
    QCursor, QAction, QActionGroup, QBitmap, QPolygon,
)

from src.core import producto_prefs as _prefs
from src.core.configuracion.ventana import (
    is_chrome_always_visible,
    set_chrome_always_visible,
)
from src.core.paths import EXIT_ICON_PATH, LOGO_PATH
from src.ui.tokens import *
from src.ui.zen import AutoHideChrome
from src.ui.modules.dashboard import DashboardPage
from src.ui.modules.banqueta_map import BanquetaMapPage

_LOGO = str(LOGO_PATH)
_EXIT = str(EXIT_ICON_PATH)

_NAV = [
    ("fa5s.home",             "Inicio",         "dashboard"),
    ("fa5s.tags",             "Inventario",     "inventario"),
    ("fa5s.shopping-cart",    "Punto de Venta", "pdv"),
    ("fa5s.hand-holding-usd", "Créditos",       "creditos"),
    ("fa5s.book-open",        "Cuaderno",       "cuaderno"),
    ("fa5s.map-marked-alt",   "Banqueta",       "banqueta"),
]
_CFG  = ("fa5s.cog", "Configuración", "config")
_TB_H = TITLEBAR_H

# Textos para páginas aún no implementadas (placeholder centrado)
_BLANK_PAGES: dict[str, tuple[str, str, str]] = {
    "pdv": ("Punto de Venta", "Aquí podrás cobrar, escanear códigos e imprimir tickets.", "fa5s.shopping-cart"),
    "creditos": ("Créditos", "Seguimiento de abonos, saldos y avisos de clientes.", "fa5s.hand-holding-usd"),
    "cuaderno": ("Cuaderno de precios", "Reglas y patrones para etiquetar sin el cuaderno físico.", "fa5s.book-open"),
    "config": ("Configuración", "Etiquetas, impresoras y preferencias del sistema.", "fa5s.cog"),
}

# ── Paleta unificada (BG_WINDOW / CONTENT_RADIUS vienen de tokens) ────────────
_BG      = BG_WINDOW    # ventana + barra título + sidebar — una sola fuente
_BORDER  = CHROME_LINE  # líneas entre cromo y contenido
_TEXT    = TEXT_STRONG  # barra / sidebar — mismo negro suave que tokens
_MUTED   = TEXT_MUTED   # secundario unificado (contraste WCAG sobre blanco)
_CARD_R  = CONTENT_RADIUS
_BTN_R   = RADIUS_LG   # chips sidebar tipo píldora Zen


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _round_pixmap(path: str, size: int) -> QPixmap:
    src = QPixmap(path).scaled(size, size,
        Qt.AspectRatioMode.KeepAspectRatioByExpanding,
        Qt.TransformationMode.SmoothTransformation)
    out = QPixmap(size, size); out.fill(QColor(0, 0, 0, 0))
    p = QPainter(out)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    clip = QPainterPath(); clip.addEllipse(0, 0, size, size)
    p.setClipPath(clip); p.drawPixmap(0, 0, src); p.end()
    return out


# ══════════════════════════════════════════════════════════════════════════════
# INDICADORES DE HARDWARE  ·  incrustados en la barra de título
# ══════════════════════════════════════════════════════════════════════════════

class _HwStatus(QWidget):
    """
    Pequeños iconos de impresora y lector de código casi invisibles.
    Apariencia "incrustada" con fondo hundido y borde sutil.
    Se ubican en el extremo derecho de la barra, antes de los controles.
    """
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        # Efecto "sunken/inset": fondo ligeramente más oscuro + borde interior
        self.setStyleSheet("""
            _HwStatus {
                background: rgba(20,18,16,0.06);
                border-radius: 5px;
                border: 1px solid rgba(20,18,16,0.1);
            }
        """)
        self.setFixedHeight(22)
        self.setToolTip("Estado de dispositivos")

        lay = QHBoxLayout(self)
        lay.setContentsMargins(7, 0, 7, 0)
        lay.setSpacing(7)

        _icons = [
            ("fa5s.print",   "Impresora no detectada"),
            ("fa5s.barcode", "Lector de código no detectado"),
        ]
        for icon_name, tip in _icons:
            lbl = QLabel()
            lbl.setToolTip(tip)
            lbl.setStyleSheet("background:transparent; border:none;")
            try:
                # Opacidad muy baja — "apenas se ven"
                lbl.setPixmap(
                    qta.icon(icon_name, color=_MUTED,
                             options=[{"opacity": 0.38}]).pixmap(13, 13))
            except Exception:
                lbl.setText("·")
            lay.addWidget(lbl)

        self.adjustSize()


# Menús claros: el APP_QSS global define QMenu oscuro; usamos objectName para ganar especificidad.
_CHROME_MENU_OBJ = "TitleBarMenu"


def _light_menu_qss() -> str:
    return f"""
        QMenu#{_CHROME_MENU_OBJ} {{
            background: {BG_CONTENT};
            color: {_TEXT};
            border: 1px solid {_BORDER};
            border-radius: {RADIUS_SM}px;
            padding: {SPACE_HALF}px 0;
            font-size: 9pt;
        }}
        QMenu#{_CHROME_MENU_OBJ}::item {{
            padding: {SPACE_1 - 1}px {SPACE_3}px {SPACE_1 - 1}px {SPACE_2 - 2}px;
        }}
        QMenu#{_CHROME_MENU_OBJ}::item:selected {{
            background: {PRIMARY_PALE};
            color: {TEXT_STRONG};
        }}
        QMenu#{_CHROME_MENU_OBJ}::item:checked {{
            font-weight: 600;
            color: {PRIMARY};
        }}
        QMenu#{_CHROME_MENU_OBJ}::separator {{
            height: 1px;
            background: {DIVIDER};
            margin: {SPACE_HALF}px {SPACE_2 - 2}px;
        }}
    """


def _chrome_menu(parent) -> QMenu:
    m = QMenu(parent)
    m.setObjectName(_CHROME_MENU_OBJ)
    m.setStyleSheet(_light_menu_qss())
    return m


# ══════════════════════════════════════════════════════════════════════════════
# PANEL DE CONTENIDO  ·  tarjeta blanca con esquinas curvadas y sombra
# ══════════════════════════════════════════════════════════════════════════════

def _content_panel_clip_path(w: int, h: int, r: float) -> QPainterPath:
    """Rectángulo redondeado completo — tarjeta flotante tipo Zen."""
    path = QPainterPath()
    if w <= 0 or h <= 0:
        return path
    rr = min(r, w / 2.0, h / 2.0)
    path.addRoundedRect(0.0, 0.0, float(w), float(h), rr, rr)
    return path


class _ContentPanel(QFrame):
    """
    Panel claro que flota sobre el shell — cuatro esquinas redondeadas (Zen).
    """
    def __init__(self):
        super().__init__()
        self.setObjectName("ContentPanel")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet(f"""
            QFrame#ContentPanel {{
                background: {BG_CONTENT};
                border-radius: {_CARD_R}px;
                border: 1px solid rgba(55, 50, 45, 0.06);
            }}
        """)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        w, h = self.width(), self.height()
        bm = QBitmap(w, h)
        bm.fill(Qt.GlobalColor.color0)
        p = QPainter(bm)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setBrush(Qt.GlobalColor.color1)
        p.setPen(Qt.PenStyle.NoPen)
        p.drawPath(_content_panel_clip_path(w, h, float(_CARD_R)))
        p.end()
        self.setMask(bm)


# ══════════════════════════════════════════════════════════════════════════════
# BARRA DE TÍTULO  ·  misma tonalidad que el fondo (no hay quiebre visual)
# ══════════════════════════════════════════════════════════════════════════════

class _WinCtrlBtn(QPushButton):
    def __init__(self, symbol: str, hover_bg: str, hover_fg: str = "#FFFFFF", parent=None):
        super().__init__(symbol, parent)
        self.setFixedSize(46, _TB_H)
        self.setCursor(Qt.CursorShape.ArrowCursor)
        self.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self.setStyleSheet(f"""
            QPushButton {{
                background: transparent; border: none;
                color: {_MUTED}; font-size: 12px;
                font-family: "Segoe MDL2 Assets","Segoe UI Symbol",Arial;
            }}
            QPushButton:hover   {{ background:{hover_bg}; color:{hover_fg}; }}
            QPushButton:pressed {{ background:{hover_bg}; color:{hover_fg}; opacity:.8; }}
        """)


class _MenuBtn(QPushButton):
    _QSS = f"""
        QPushButton {{
            background: transparent; border: none;
            color: {_MUTED}; font-size: 8.5pt;
            padding: 0 {SPACE_2 - 5}px;
            min-height: {_TB_H}px; max-height: {_TB_H}px;
            border-radius: {RADIUS_SM}px;
        }}
        QPushButton:hover   {{ background: {PRIMARY_PALE}; color: {PRIMARY}; }}
        QPushButton:pressed {{ background: {PRIMARY}; color: #FFF; }}
    """
    def __init__(self, text: str, menu: QMenu, parent=None):
        super().__init__(text, parent)
        self._menu = menu
        self.setStyleSheet(self._QSS)
        self.setCursor(Qt.CursorShape.ArrowCursor)
        self.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self.clicked.connect(lambda: self._menu.exec(
            self.mapToGlobal(QPoint(0, self.height()))))


class TitleBar(QWidget):
    def __init__(self, win: "MainWindow"):
        super().__init__(win)
        self._win = win; self._dragging = False; self._drag_pos = QPoint()
        self.setFixedHeight(_TB_H)
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        # Mismo color que el fondo → fusión visual perfecta con el sidebar
        # Sin borde inferior: evita doble línea con el panel y el aspecto “cortado”
        self.setStyleSheet(f"TitleBar {{ background:{_BG}; border: none; }}")

        row = QHBoxLayout(self)
        row.setContentsMargins(SPACE_1, 0, 0, 0)
        row.setSpacing(0)

        # Logo mini
        if LOGO_PATH.is_file():
            lbl = QLabel(); lbl.setFixedSize(_TB_H, _TB_H)
            lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            lbl.setStyleSheet("background:transparent;")
            lbl.setPixmap(_round_pixmap(_LOGO, 22)); row.addWidget(lbl)

        # Solo marca — tipografía más suave (no negro puro), peso medio
        nm = QLabel("Saldos Monserrat")
        f = QFont("Segoe UI", int(FONT_SIZE_CHROME) + 1)
        f.setBold(False)
        f.setWeight(QFont.Weight.Medium)
        nm.setFont(f)
        nm.setStyleSheet(f"color:{TEXT_CHROME};background:transparent;letter-spacing:0.2px;")
        nm.setFixedHeight(_TB_H)
        nm.setAlignment(Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft)
        row.addWidget(nm, 0, Qt.AlignmentFlag.AlignVCenter)

        # Ocultar / mostrar sidebar (evita duplicar logo + nombre en el lateral)
        self._sb_toggle = QPushButton()
        self._sb_toggle.setFixedSize(30, _TB_H)
        self._sb_toggle.setCursor(Qt.CursorShape.ArrowCursor)
        self._sb_toggle.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self._sb_toggle.setToolTip("Ocultar menú lateral")
        try:
            self._sb_toggle.setIcon(qta.icon("fa5s.angle-double-left", color=_MUTED))
            self._sb_toggle.setIconSize(QSize(14, 14))
        except Exception:
            self._sb_toggle.setText("«")
        self._sb_toggle.setStyleSheet(f"""
            QPushButton {{
                background: transparent; border: none; border-radius: 4px;
                color: {_MUTED}; padding: 0;
            }}
            QPushButton:hover {{ background: {PRIMARY_PALE}; color: {PRIMARY}; }}
        """)
        self._sb_toggle.clicked.connect(win._toggle_sidebar)
        row.addWidget(self._sb_toggle)

        row.addSpacing(SPACE_1)

        # Menús
        self._build_menus(row, win); row.addStretch()

        # Indicadores de hardware (incrustados, casi invisibles)
        hw = _HwStatus()
        hw.setFixedHeight(22)
        row.addWidget(hw, 0, Qt.AlignmentFlag.AlignVCenter)
        row.addSpacing(6)

        # Controles de ventana
        min_btn      = _WinCtrlBtn("─",  "#C9C5BE", _TEXT)
        self._maxbtn = _WinCtrlBtn("🗖", "#C9C5BE", _TEXT)
        close_btn    = _WinCtrlBtn("✕",  "#C42B1C")
        min_btn.clicked.connect(win.showMinimized)
        self._maxbtn.clicked.connect(self._toggle_max)
        close_btn.clicked.connect(win.close)
        for b in (min_btn, self._maxbtn, close_btn):
            row.addWidget(b)

    def _build_menus(self, row, win):
        def act(label, slot=None):
            a = QAction(label)
            if slot: a.triggered.connect(slot)
            return a
        m_a = _chrome_menu(self)
        m_a.addAction(act("Nuevo producto", lambda: win._go("inventario")))
        m_a.addSeparator()
        m_a.addAction(act("Salir del sistema", win.close))
        m_m = _chrome_menu(self)
        for _, l, k in _NAV: m_m.addAction(act(l, lambda k=k: win._go(k)))
        m_c = _chrome_menu(self); m_c.addAction(act("Etiquetas de precio", lambda: win._go("config")))
        m_v = win._create_ver_menu(self)
        m_h = _chrome_menu(self); m_h.addAction(act("Acerca de Saldos Monserrat"))
        for t, m in [
            ("Archivo", m_a),
            ("Módulos", m_m),
            ("Configuración", m_c),
            ("Ver", m_v),
            ("Ayuda", m_h),
        ]:
            row.addWidget(_MenuBtn(t, m))

    def _toggle_max(self):
        if self._win.isMaximized():
            self._win.showNormal(); self._maxbtn.setText("🗖")
        else:
            self._win.showMaximized(); self._maxbtn.setText("🗗")

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            self._dragging = True
            self._drag_pos = e.globalPosition().toPoint() - self._win.frameGeometry().topLeft()
        super().mousePressEvent(e)

    def mouseMoveEvent(self, e):
        if self._dragging and e.buttons() == Qt.MouseButton.LeftButton:
            if self._win.isMaximized():
                self._win.showNormal()
                self._drag_pos = QPoint(self._win.width() // 2, _TB_H // 2)
            self._win.move(e.globalPosition().toPoint() - self._drag_pos)
        super().mouseMoveEvent(e)

    def mouseReleaseEvent(self, e): self._dragging = False; super().mouseReleaseEvent(e)
    def mouseDoubleClickEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton: self._toggle_max()
        super().mouseDoubleClickEvent(e)

    def update_sidebar_toggle(self, sidebar_visible: bool):
        """Actualiza icono y tooltip del botón que muestra/oculta el sidebar."""
        try:
            icon_name = "fa5s.angle-double-left" if sidebar_visible else "fa5s.angle-double-right"
            self._sb_toggle.setIcon(qta.icon(icon_name, color=_MUTED))
            self._sb_toggle.setIconSize(QSize(14, 14))
        except Exception:
            self._sb_toggle.setText("«" if sidebar_visible else "»")
        self._sb_toggle.setToolTip(
            "Ocultar menú lateral" if sidebar_visible else "Mostrar menú lateral")


# ══════════════════════════════════════════════════════════════════════════════
# SIDEBAR  ·  chips blancos flotantes sobre el fondo, esquinas más curvadas
# ══════════════════════════════════════════════════════════════════════════════

class _NavBtn(QPushButton):
    _OFF = f"""
        QPushButton {{
            background: transparent; border: none;
            border-radius: {_BTN_R}px; color: {_MUTED};
            text-align: left; padding: 0 16px;
            min-height: 42px; max-height: 42px; font-size: 9pt;
        }}
        QPushButton:hover   {{ background: rgba(255,255,255,0.45); color: {PRIMARY}; }}
        QPushButton:pressed {{ background: {PRIMARY_PALE}; color: {PRIMARY_HOVER}; }}
    """
    _ON = f"""
        QPushButton {{
            background: {BG_CONTENT}; border: 1px solid rgba(55,50,45,0.1);
            border-radius: {_BTN_R}px; color: {PRIMARY};
            text-align: left; padding: 0 16px;
            min-height: 42px; max-height: 42px;
            font-size: 9pt; font-weight: 600;
        }}
        QPushButton:hover {{ background:{BG_CONTENT}; border-color:{BORDER_MED}; }}
    """
    def __init__(self, icon_name: str, label: str, parent=None):
        super().__init__(parent)
        self._icon_name = icon_name; self._label = label
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.setFixedHeight(42); self.set_active(False)

    def set_active(self, v: bool):
        color = PRIMARY if v else _MUTED
        try: self.setIcon(qta.icon(self._icon_name, color=color)); self.setIconSize(QSize(16,16))
        except Exception: pass
        self.setText(f"  {self._label}")
        self.setStyleSheet(self._ON if v else self._OFF)
        # Sombra muy sutil en el chip activo (reducida)
        if v:
            sh = QGraphicsDropShadowEffect(self)
            sh.setBlurRadius(7); sh.setOffset(0, 1); sh.setColor(QColor(0,0,0,16))
            self.setGraphicsEffect(sh)
        else:
            self.setGraphicsEffect(None)


class Sidebar(QFrame):
    navigate = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("Sidebar")
        self.setFixedWidth(SIDEBAR_W)
        self.setStyleSheet(
            f"QFrame#Sidebar {{ background: {BG_SIDEBAR}; border: none; "
            f"border-right: 1px solid rgba(45, 42, 38, 0.08); }}"
        )
        self._btns: dict[str, _NavBtn] = {}

        root = QVBoxLayout(self)
        # Sin bloque de logo/título aquí: ya están en la barra de título
        root.setContentsMargins(10, 14, 10, 14); root.setSpacing(4)
        root.addSpacing(6)

        # Navegación
        for icon, label, key in _NAV:
            btn = _NavBtn(icon, label)
            btn.clicked.connect(lambda _, k=key: self.navigate.emit(k))
            self._btns[key] = btn; root.addWidget(btn)

        root.addStretch(); root.addWidget(self._sep()); root.addSpacing(4)

        # Configuración
        icon, label, key = _CFG
        btn = _NavBtn(icon, label)
        btn.clicked.connect(lambda: self.navigate.emit(key))
        self._btns[key] = btn; root.addWidget(btn); root.addSpacing(4)

        # Salida
        exit_btn = QPushButton()
        exit_btn.setFixedHeight(36); exit_btn.setText("  Salir del sistema")
        exit_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        if EXIT_ICON_PATH.is_file():
            px = QPixmap(_EXIT).scaled(17,17,Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation)
            exit_btn.setIcon(QIcon(px)); exit_btn.setIconSize(QSize(17,17))
        exit_btn.setStyleSheet(f"""
            QPushButton {{
                background:transparent; border:none; border-radius:{_BTN_R}px;
                color:{_MUTED}; text-align:left; padding:0 14px; font-size:8.5pt;
            }}
            QPushButton:hover   {{ background:{PRIMARY_PALE}; color:{PRIMARY}; }}
            QPushButton:pressed {{ background:{PRIMARY_LIGHT}; color:{PRIMARY_HOVER}; }}
        """)
        exit_btn.clicked.connect(QApplication.instance().quit)
        root.addWidget(exit_btn)
        self.set_active("dashboard")

    @staticmethod
    def _sep():
        f = QFrame()
        f.setFrameShape(QFrame.Shape.HLine)
        f.setFixedHeight(1)
        f.setStyleSheet(f"background:rgba(45,42,38,0.09);border:none;")
        return f

    def set_active(self, key: str):
        for k, btn in self._btns.items(): btn.set_active(k == key)


# ══════════════════════════════════════════════════════════════════════════════
# VENTANA PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════

class MainWindow(QMainWindow):

    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Window)
        self.setWindowTitle("Saldos Monserrat")
        self.resize(WIN_DEFAULT_W, WIN_DEFAULT_H)
        self.setMinimumSize(WIN_MIN_W, WIN_MIN_H)
        # Cubre cualquier grieta entre cromo nativo y el central widget
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet(f"QMainWindow {{ background: {_BG}; border: none; }}")
        if LOGO_PATH.is_file():
            self.setWindowIcon(QIcon(_LOGO))
        self._sidebar_visible = True
        self._pages: dict[str, QWidget] = {}

        # ── Raíz: color base unificado (_BG) ──────────────────────
        root = QWidget(self)
        root.setStyleSheet(f"background:{_BG};")
        self.setCentralWidget(root)

        vlay = QVBoxLayout(root)
        vlay.setContentsMargins(0, 0, 0, 0); vlay.setSpacing(0)

        # Cromo superior: estilo Zen (franja fina → barra al pasar el ratón) o fijo (Ver → preferencia)
        self._chrome_host = AutoHideChrome(self, pinned=is_chrome_always_visible())
        vlay.addWidget(self._chrome_host)
        self._title_bar = self._chrome_host.title_bar

        # ── Cuerpo: sidebar | panel flotante ───────────────────────
        body = QHBoxLayout()
        body.setContentsMargins(0, 0, 0, 0); body.setSpacing(0)

        self.sidebar = Sidebar()
        self.sidebar.navigate.connect(self._go)
        self.sidebar.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Expanding)
        body.addWidget(self.sidebar, 0)

        # Envoltorio: aire generoso alrededor de la tarjeta (shell Zen)
        wrap = QWidget()
        wrap.setStyleSheet("background:transparent;")
        wrap.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        wlay = QVBoxLayout(wrap)
        m = CONTENT_SHELL_MARGIN
        wlay.setContentsMargins(m, max(SPACE_1, m - 2), m, m)
        wlay.setSpacing(0)

        # Panel de contenido blanco con esquinas curvadas
        self._panel = _ContentPanel()
        panel_lay = QVBoxLayout(self._panel)
        panel_lay.setContentsMargins(0, 0, 0, 0); panel_lay.setSpacing(0)

        self.stack = QStackedWidget()
        self.stack.setStyleSheet("background:transparent;")
        self.stack.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        panel_lay.addWidget(self.stack)

        # Sombra suave y amplia — la tarjeta “levita” sobre el shell
        sh = QGraphicsDropShadowEffect(self._panel)
        sh.setBlurRadius(52)
        sh.setOffset(0, 10)
        sh.setColor(QColor(22, 20, 18, 38))

        self._panel.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        wlay.addWidget(self._panel, 1)
        body.addWidget(wrap, 1)
        vlay.addLayout(body, 1)

        # Status bar (misma tonalidad)
        self.statusBar().setFixedHeight(20)
        self.statusBar().setStyleSheet(f"""
            QStatusBar {{ background:{_BG}; color:{_MUTED}; border:none;
                          font-size:7.5pt; padding-left:8px; }}
            QStatusBar::item {{ border:none; }}
        """)
        self.statusBar().showMessage("  Saldos Monserrat · Tienda · Listo")

        self._init_pages()
        self.stack.currentChanged.connect(self._on_stack_page_changed)
        self._go("dashboard")

    def _toggle_sidebar(self):
        """Oculta o muestra por completo el menú lateral."""
        self._sidebar_visible = not self._sidebar_visible
        self.sidebar.setVisible(self._sidebar_visible)
        self._title_bar.update_sidebar_toggle(self._sidebar_visible)

    # ── Páginas ───────────────────────────────────────────────────

    def _blank(self, key: str) -> QWidget:
        w = QWidget()
        w.setStyleSheet("background:transparent;")
        title, desc, icon_name = _BLANK_PAGES.get(
            key, ("Próximamente", "Esta sección se habilitará en una siguiente versión.", "fa5s.layer-group")
        )
        lay = QVBoxLayout(w)
        lay.addStretch(1)
        ic = QLabel()
        ic.setAlignment(Qt.AlignmentFlag.AlignCenter)
        try:
            ic.setPixmap(qta.icon(icon_name, color=_MUTED).pixmap(QSize(40, 40)))
        except Exception:
            ic.setText("◇")
        ic.setStyleSheet("background:transparent;")
        lay.addWidget(ic, alignment=Qt.AlignmentFlag.AlignHCenter)
        lay.addSpacing(SPACE_2)
        t = QLabel(title)
        t.setAlignment(Qt.AlignmentFlag.AlignCenter)
        tf = QFont("Segoe UI", 16)
        tf.setBold(True)
        t.setFont(tf)
        t.setStyleSheet(f"color:{_TEXT};background:transparent;")
        lay.addWidget(t)
        lay.addSpacing(SPACE_1)
        d = QLabel(desc)
        d.setAlignment(Qt.AlignmentFlag.AlignCenter)
        d.setWordWrap(True)
        d.setMaximumWidth(420)
        d.setStyleSheet(f"color:{_MUTED};font-size:9.5pt;background:transparent;")
        lay.addWidget(d, alignment=Qt.AlignmentFlag.AlignHCenter)
        hint = QLabel("Usa el menú lateral o las tarjetas del inicio cuando estén listas.")
        hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
        hint.setWordWrap(True)
        hint.setMaximumWidth(400)
        hint.setStyleSheet(f"color:{_MUTED};font-size:8.5pt;background:transparent;margin-top:8px;")
        lay.addWidget(hint, alignment=Qt.AlignmentFlag.AlignHCenter)
        lay.addStretch(2)
        return w

    def _init_pages(self):
        for _, _, key in _NAV:
            if key == "dashboard":
                pg = DashboardPage()
                pg.navigate.connect(self._go)   # tarjetas del dashboard navegan
            elif key == "inventario":
                pg = self._blank(key)
            elif key == "banqueta":
                pg = BanquetaMapPage(standalone=False)
            else:
                pg = self._blank(key)
            self._pages[key] = pg
            self.stack.addWidget(pg)
        key = _CFG[2]
        self._pages[key] = self._blank(key)
        self.stack.addWidget(self._pages[key])

    def _go(self, key: str):
        if key in self._pages:
            self.stack.setCurrentWidget(self._pages[key])
            self.sidebar.set_active(key)
            lmap = {k: l for _, l, k in _NAV + [_CFG]}
            self.statusBar().showMessage(f"  {lmap.get(key, key)}")
            self._sync_ver_menu_checks()
            self._refresh_inventario_view()

    def _create_ver_menu(self, parent: QWidget) -> QMenu:
        """Menú Ver en la barra superior (paneles y autocompletar — mismo lugar que Archivo…)."""
        m = _chrome_menu(parent)

        self._ver_act_et = QAction("Mostrar vista de etiqueta", parent)
        self._ver_act_et.setCheckable(True)
        self._ver_act_et.setChecked(_prefs.is_panel_etiqueta_visible())
        self._ver_act_et.toggled.connect(self._ver_toggle_etiqueta)
        m.addAction(self._ver_act_et)

        self._ver_act_ref = QAction("Mostrar tabla de referencia", parent)
        self._ver_act_ref.setCheckable(True)
        self._ver_act_ref.setChecked(_prefs.is_panel_referencia_visible())
        self._ver_act_ref.toggled.connect(self._ver_toggle_referencia)
        m.addAction(self._ver_act_ref)

        m.addSeparator()
        self._ver_act_chrome_pin = QAction("Barra superior siempre visible", parent)
        self._ver_act_chrome_pin.setCheckable(True)
        self._ver_act_chrome_pin.setChecked(is_chrome_always_visible())
        self._ver_act_chrome_pin.toggled.connect(self._ver_toggle_chrome_pinned)
        m.addAction(self._ver_act_chrome_pin)

        m.addSeparator()
        sub = m.addMenu("Autocompletar precio")
        sub.setObjectName(_CHROME_MENU_OBJ)
        sub.setStyleSheet(_light_menu_qss())
        self._ver_mode_group = QActionGroup(parent)
        self._ver_mode_actions: dict[str, QAction] = {}
        for key, lab in [
            (_prefs.AUTO_FILL_CUADERNO, "Según cuaderno (reglas)"),
            (_prefs.AUTO_FILL_PATRONES, "Por patrones de inventario"),
            (_prefs.AUTO_FILL_OFF, "Desactivado"),
        ]:
            a = QAction(lab, parent)
            a.setCheckable(True)
            self._ver_mode_group.addAction(a)
            self._ver_mode_actions[key] = a
            if _prefs.get_auto_fill_mode() == key:
                a.setChecked(True)
            a.triggered.connect(partial(self._ver_set_auto_mode, key))
            sub.addAction(a)

        return m

    def _ver_toggle_etiqueta(self, on: bool):
        _prefs.set_panel_etiqueta_visible(on)
        self._refresh_inventario_view()

    def _ver_toggle_referencia(self, on: bool):
        _prefs.set_panel_referencia_visible(on)
        self._refresh_inventario_view()

    def _ver_toggle_chrome_pinned(self, on: bool):
        set_chrome_always_visible(on)
        if self._chrome_host is not None:
            self._chrome_host.set_pinned(on)

    def _ver_set_auto_mode(self, mode: str):
        _prefs.set_auto_fill_mode(mode)
        for k, a in self._ver_mode_actions.items():
            a.setChecked(k == mode)
        self._refresh_inventario_view()
        pg = self._pages.get("inventario")
        if pg is not None and hasattr(pg, "sync_prefs_and_pricing"):
            pg.sync_prefs_and_pricing()

    def _sync_ver_menu_checks(self):
        if not hasattr(self, "_ver_act_et"):
            return
        self._ver_act_et.blockSignals(True)
        self._ver_act_ref.blockSignals(True)
        self._ver_act_et.setChecked(_prefs.is_panel_etiqueta_visible())
        self._ver_act_ref.setChecked(_prefs.is_panel_referencia_visible())
        self._ver_act_et.blockSignals(False)
        self._ver_act_ref.blockSignals(False)
        mode = _prefs.get_auto_fill_mode()
        for k, a in self._ver_mode_actions.items():
            a.setChecked(k == mode)
        if hasattr(self, "_ver_act_chrome_pin"):
            self._ver_act_chrome_pin.blockSignals(True)
            self._ver_act_chrome_pin.setChecked(is_chrome_always_visible())
            self._ver_act_chrome_pin.blockSignals(False)

    def _refresh_inventario_view(self):
        """Solo visibilidad de paneles (Ver). El autocompletar no se recalcula aquí."""
        pg = self._pages.get("inventario")
        if pg is not None and hasattr(pg, "apply_view_prefs"):
            pg.apply_view_prefs()

    def _on_stack_page_changed(self, _index: int):
        self._sync_ver_menu_checks()
        self._refresh_inventario_view()

    # ── Windows 11: sombra nativa + esquinas redondeadas ─────────

    def showEvent(self, event):
        super().showEvent(event); self._apply_dwm()

    def _apply_dwm(self):
        if sys.platform != "win32": return
        try:
            hwnd = int(self.winId())
            class MARGINS(ctypes.Structure):
                _fields_ = [("left",ctypes.c_int),("right",ctypes.c_int),
                             ("top",ctypes.c_int),("bottom",ctypes.c_int)]
            # Sin extensión inferior: evita líneas / composición rara con status bar
            ctypes.windll.dwmapi.DwmExtendFrameIntoClientArea(hwnd, ctypes.byref(MARGINS(0, 0, 0, 0)))
            # DWMWA_WINDOW_CORNER_PREFERENCE: DONOTROUND evita huecos redondeados
            # (píxeles del escritorio) en ventanas frameless en Windows 11.
            DWMWCP_DONOTROUND = 1
            pref = ctypes.c_int(DWMWCP_DONOTROUND)
            ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 33, ctypes.byref(pref), ctypes.sizeof(pref))
        except Exception: pass

    # ── Resize nativo (DPI-safe) ──────────────────────────────────

    def nativeEvent(self, eventType, message):
        if sys.platform == "win32" and eventType == b"windows_generic_MSG":
            try:
                msg = ctypes.wintypes.MSG.from_address(int(message))
                if msg.message == 0x0084 and not self.isMaximized():
                    pos = QCursor.pos()
                    rx  = pos.x() - self.x(); ry = pos.y() - self.y()
                    B   = 8; w = self.width(); h = self.height()
                    if rx<B and ry<B:         return True,13
                    if rx>w-B and ry<B:       return True,14
                    if rx<B and ry>h-B:       return True,16
                    if rx>w-B and ry>h-B:     return True,17
                    # Sin HTTOP en todo el borde superior: el centro queda para la franja Zen / arrastre
                    if ry>h-B:                return True,15
                    if rx<B:                  return True,10
                    if rx>w-B:                return True,11
            except Exception: pass
        return super().nativeEvent(eventType, message)
