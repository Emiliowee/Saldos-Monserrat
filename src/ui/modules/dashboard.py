"""
Dashboard  ·  Saldos Monserrat
· Atajos de teclado (F1…) como overlay absoluto — no mueven el contenido.
· Fondo transparente — el panel blanco principal se ve por detrás.
"""
from datetime import datetime

import qtawesome as qta

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QGraphicsDropShadowEffect, QPushButton,
)
from PySide6.QtCore import Qt, Signal, QSize
from PySide6.QtGui import QFont, QColor, QPixmap, QPainter, QPainterPath, QPen

from src.core.paths import LOGO_PATH
from src.ui.tokens import *

_LOGO_PATH = str(LOGO_PATH)

_DAYS   = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]
_MONTHS = ["enero","febrero","marzo","abril","mayo","junio",
           "julio","agosto","septiembre","octubre","noviembre","diciembre"]


# ── Logo circular ─────────────────────────────────────────────────────────────

class _Logo(QLabel):
    def __init__(self, size: int = 80):
        super().__init__()
        self.setFixedSize(size, size)
        self.setStyleSheet("background:transparent;")
        if not LOGO_PATH.is_file():
            return
        src = QPixmap(_LOGO_PATH).scaled(
            size, size,
            Qt.AspectRatioMode.KeepAspectRatioByExpanding,
            Qt.TransformationMode.SmoothTransformation)
        out = QPixmap(size, size); out.fill(QColor(0, 0, 0, 0))
        p = QPainter(out)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        clip = QPainterPath(); clip.addEllipse(1, 1, size-2, size-2)
        p.setClipPath(clip); p.drawPixmap(0, 0, src)
        pen = QPen(QColor(GOLD)); pen.setWidthF(2)
        p.setClipping(False); p.setPen(pen); p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawEllipse(1, 1, size-2, size-2); p.end()
        self.setPixmap(out)


# ── Tarjeta de acción ─────────────────────────────────────────────────────────

class _ActionCard(QFrame):
    """
    Tarjeta de acción.
    · shortcut  — atajo de teclado como OVERLAY (no mueve nada del layout).
                  Se posiciona en la esquina superior derecha como capa flotante.
    """
    clicked = Signal()
    _n = 0

    def __init__(self, icon: str, title: str, desc: str,
                 primary: bool = True,
                 shortcut: str | None = None,
                 parent=None):
        super().__init__(parent)
        _ActionCard._n += 1
        self._id      = f"AC{_ActionCard._n}"
        self._primary = primary
        self.setObjectName(self._id)
        # 216×192 = 27×24 en unidades de 8px — proporción ~1.125 (cercana a 9:8)
        self.setFixedSize(216, 192)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self._set(False)

        # Sombra más suave
        sh = QGraphicsDropShadowEffect(self)
        sh.setBlurRadius(14 if primary else 10)
        sh.setOffset(0, 3)
        sh.setColor(QColor(0, 0, 0, 28 if primary else 14))
        self.setGraphicsEffect(sh)

        # Layout principal — NO toca el atajo de teclado
        lay = QVBoxLayout(self)
        # 16 + 24 = rejilla 8px; antes 18/22 rompía ritmo
        lay.setContentsMargins(SPACE_2, SPACE_3, SPACE_2, SPACE_3)
        lay.setSpacing(0)
        lay.setAlignment(Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignVCenter)

        # Ícono
        ic = QLabel()
        icon_color = "#FFFFFF" if primary else PRIMARY
        try:
            ic.setPixmap(qta.icon(icon, color=icon_color).pixmap(QSize(36, 36)))
        except Exception:
            pass
        ic.setAlignment(Qt.AlignmentFlag.AlignCenter)
        ic.setStyleSheet("background:transparent;border:none;")
        lay.addWidget(ic, 0, Qt.AlignmentFlag.AlignHCenter)
        lay.addSpacing(SPACE_2)

        # Título
        t = QLabel(title)
        tf = QFont("Segoe UI", int(FONT_SIZE_SUBTITLE))
        tf.setBold(True)
        t.setFont(tf)
        tc = "#FFFFFF" if primary else TEXT_STRONG
        t.setStyleSheet(f"color:{tc};background:transparent;border:none;")
        t.setAlignment(Qt.AlignmentFlag.AlignCenter)
        lay.addWidget(t, 0, Qt.AlignmentFlag.AlignHCenter)
        lay.addSpacing(SPACE_1 - 3)

        # Descripción
        d = QLabel(desc)
        d.setWordWrap(True)
        d.setAlignment(Qt.AlignmentFlag.AlignCenter)
        dc = "rgba(255,255,255,0.72)" if primary else TEXT_MUTED
        d.setStyleSheet(
            f"color:{dc};font-size:{FONT_SIZE_CAPTION}pt;background:transparent;border:none;"
        )
        lay.addWidget(d, 0, Qt.AlignmentFlag.AlignHCenter)

        # ── Atajo de teclado como OVERLAY absoluto ─────────────────
        # No está en el layout → no mueve ni desplaza nada
        if shortcut:
            sc_color = "rgba(255,255,255,0.22)" if primary else "rgba(140,130,155,0.52)"
            self._sc_lbl = QLabel(shortcut, self)   # parent=self → posición absoluta
            self._sc_lbl.setStyleSheet(
                f"color:{sc_color}; font-size:7pt;"
                f"font-family:'Consolas','Courier New',monospace;"
                f"background:transparent; border:none; letter-spacing:0.5px;")
            self._sc_lbl.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)
            self._sc_lbl.adjustSize()
            # Esquina superior derecha con pequeño margen
            self._sc_lbl.move(self.width() - self._sc_lbl.width() - 10, 10)
            self._sc_lbl.raise_()
        else:
            self._sc_lbl = None

    # ── Estados visuales ──────────────────────────────────────────
    def _set(self, pressed: bool):
        off = "margin-top:2px;" if pressed else ""
        if self._primary:
            self.setStyleSheet(f"""
                QFrame#{self._id} {{
                    background: qlineargradient(x1:0,y1:0,x2:0,y2:1,
                        stop:0 {PRIMARY}, stop:1 {PRIMARY_HOVER});
                    border-radius: {RADIUS_LG + 2}px; border:none; {off}
                }}
                QFrame#{self._id}:hover {{
                    background: qlineargradient(x1:0,y1:0,x2:0,y2:1,
                        stop:0 {PRIMARY_HOVER}, stop:1 {PRIMARY_DEEP});
                }}
            """)
        else:
            self.setStyleSheet(f"""
                QFrame#{self._id} {{
                    background: {BG_CONTENT};
                    border-radius: {RADIUS_LG + 2}px;
                    border: 1px solid rgba(55, 50, 45, 0.1); {off}
                }}
                QFrame#{self._id}:hover {{
                    border-color: rgba(196, 96, 126, 0.45); background: {PRIMARY_PALE};
                }}
            """)

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton: self._set(True)
        super().mousePressEvent(e)

    def mouseReleaseEvent(self, e):
        self._set(False)
        if e.button() == Qt.MouseButton.LeftButton: self.clicked.emit()
        super().mouseReleaseEvent(e)

    def leaveEvent(self, e): self._set(False); super().leaveEvent(e)


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardPage(QWidget):
    navigate = Signal(str)   # emite la clave de página destino

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("background:transparent;")

        root = QVBoxLayout(self)
        root.setContentsMargins(44, 36, 44, 36)
        root.setSpacing(0)

        # ── Encabezado ────────────────────────────────────────────
        top = QHBoxLayout(); top.setSpacing(0)

        greet_col = QVBoxLayout(); greet_col.setSpacing(3)
        d = datetime.now()

        hi = QLabel("Bienvenida, Monserrat")
        hf = QFont()
        hf.setFamilies(
            ["Segoe UI Variable Display", "Segoe UI Variable", "Segoe UI", "Helvetica Neue", "Arial"]
        )
        hf.setPixelSize(22)
        hf.setWeight(QFont.Weight.DemiBold)
        hi.setFont(hf)
        hi.setStyleSheet(f"color:{TEXT_HEADING};background:transparent;letter-spacing:-0.3px;")
        greet_col.addWidget(hi)

        date_str = f"{_DAYS[d.weekday()]}, {d.day} de {_MONTHS[d.month-1]} de {d.year}"
        dl = QLabel(date_str)
        dl.setStyleSheet(
            f"color:{TEXT_MUTED};font-size:{FONT_SIZE_BODY}pt;background:transparent;"
        )
        greet_col.addWidget(dl)

        top.addLayout(greet_col)
        top.addStretch()
        logo_sm = _Logo(size=56)  # 7×8px — mejor proporción con título 18pt
        top.addWidget(logo_sm)
        root.addLayout(top)
        root.addSpacing(SPACE_1)

        # Línea de acento muy suave (solo un toque de marca)
        accent = QFrame()
        accent.setFixedHeight(2)
        accent.setStyleSheet(f"""
            QFrame {{
                background: qlineargradient(x1:0,y1:0,x2:1,y2:0,
                    stop:0 rgba(196, 96, 126, 0.22),
                    stop:0.45 rgba(196, 96, 126, 0.08),
                    stop:1 transparent);
                border: none;
            }}
        """)
        root.addWidget(accent)
        root.addSpacing(32)

        # ── Acciones rápidas ──────────────────────────────────────
        sec = QLabel("Acciones rápidas")
        sec.setStyleSheet(
            f"color:{TEXT_MUTED};font-size:{FONT_SIZE_CAPTION + 0.5}pt;font-weight:600;"
            f"letter-spacing:0.06em;background:transparent;text-transform:none;"
        )
        root.addWidget(sec)
        root.addSpacing(SPACE_2)

        tiles = QHBoxLayout()
        tiles.setSpacing(SPACE_2)
        tiles.setAlignment(Qt.AlignmentFlag.AlignLeft)

        pv = _ActionCard(
            "fa5s.shopping-cart", "Punto de Venta", "Cobra y registra ventas",
            primary=True, shortcut="F1")
        pv.clicked.connect(lambda: self.navigate.emit("pdv"))
        cr = _ActionCard(
            "fa5s.hand-holding-usd", "Créditos", "Pagos y saldos",
            primary=False, shortcut="F2")
        cr.clicked.connect(lambda: self.navigate.emit("creditos"))
        bq = _ActionCard(
            "fa5s.map-marked-alt",
            "Banqueta",
            "Mapa visual de la tienda · mismo inventario",
            primary=False,
            shortcut="F3",
        )
        bq.clicked.connect(lambda: self.navigate.emit("banqueta"))

        tiles.addWidget(pv); tiles.addWidget(cr); tiles.addWidget(bq)
        tiles.addStretch()
        root.addLayout(tiles)
        root.addSpacing(SPACE_4)

        sec_inv = QLabel("Inventario")
        sec_inv.setStyleSheet(
            f"color:{TEXT_MUTED};font-size:{FONT_SIZE_CAPTION + 0.5}pt;font-weight:600;"
            f"letter-spacing:0.06em;background:transparent;"
        )
        root.addWidget(sec_inv)
        root.addSpacing(SPACE_2)

        inv = _ActionCard(
            "fa5s.tags", "Agregar producto", "Registra un artículo nuevo",
            primary=False, shortcut="F4")
        inv.clicked.connect(lambda: self.navigate.emit("inventario"))
        inv_row = QHBoxLayout()
        inv_row.setAlignment(Qt.AlignmentFlag.AlignLeft)
        inv_row.addWidget(inv); inv_row.addStretch()
        root.addLayout(inv_row)

        root.addStretch()

        # ── Pie: modo banqueta ─────────────────────────────────────
        foot = QHBoxLayout()
        banq_btn = QPushButton("Abrir plano de tienda (Banqueta)")
        banq_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        banq_btn.clicked.connect(lambda: self.navigate.emit("banqueta"))
        try:
            banq_btn.setIcon(qta.icon("fa5s.map-marked-alt", color=TEXT_MUTED))
            banq_btn.setIconSize(QSize(11, 11))
        except Exception:
            pass
        banq_btn.setStyleSheet(f"""
            QPushButton {{
                background: transparent; border: 1px solid {BORDER};
                border-radius: 20px; color: {TEXT_MUTED};
                font-size: 8pt; padding: 4px 16px; min-height: 26px;
            }}
            QPushButton:hover {{
                border-color: {PRIMARY}; color: {PRIMARY}; background: {PRIMARY_PALE};
            }}
            QPushButton:pressed {{ background: {PRIMARY_LIGHT}; }}
        """)
        foot.addStretch(); foot.addWidget(banq_btn)
        root.addLayout(foot)
