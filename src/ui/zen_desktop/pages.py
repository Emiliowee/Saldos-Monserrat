"""Páginas del shell Zen (contenido dentro de la tarjeta blanca)."""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from functools import partial

import qtawesome as qta

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QScrollArea,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from src.ui.zen_desktop import theme as Z

# Enlaces Inicio: azul discreto (tipo hipervínculo, poco chillón)
_HOME_LINK_BLUE = "#4A6788"
_HOME_LINK_BLUE_HOVER = "#3A5575"

_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
_MONTHS = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
]

# Resumen alineado al documento del proyecto (Sistema Bazar Monserrat / Saldos Monserrat).
_HOME_ABOUT_SYSTEM = (
    "Sistema para Saldos Monserrat: inventario de piezas únicas (códigos, marca, "
    "categoría, etiquetas e imágenes), tabla de precios de referencia, punto de venta "
    "con lector, créditos con abonos e historial, e intercambios. Centraliza lo que "
    "antes estaba en cuadernos y notas sueltas."
)

_HOME_BANQUETA = (
    "Las ventas en banqueta son liquidaciones al aire libre (eventos puntuales). "
    "El diseño prevé: ver prendas con mucho tiempo sin venderse, armar lotes para el "
    "evento (manual o con código de barras), registrar el precio real de cada pieza "
    "durante el evento y volver a disponible lo que no se vendió (o dejarlo en el lote). "
    "El plano y flujos completos pueden integrarse desde los módulos legacy del repo si los reactivás."
)

_HOME_SHORTCUTS = (
    "F1 Punto de venta · F2 Inventario · F3 Créditos · F4 Banqueta\n"
    "(con la ventana activa). También podés usar el menú lateral o los accesos de arriba."
)


class _ZenTextLink(QLabel):
    """Enlace de texto sin caja ni aspecto de botón (subrayado solo al pasar el ratón)."""

    activated = Signal()

    def __init__(
        self,
        text: str,
        *,
        color: str,
        hover_color: str,
    ):
        super().__init__(text)
        self._c = color
        self._hc = hover_color
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self._apply(False)

    def _apply(self, hover: bool) -> None:
        c = self._hc if hover else self._c
        dec = "underline" if hover else "none"
        self.setStyleSheet(
            f"color: {c}; font-family: {Z.FONT_UI}; font-size: 11px; "
            f"font-weight: 500; text-decoration: {dec}; background: transparent; "
            f"border: none; padding: 0; margin: 0;"
        )

    def enterEvent(self, event):
        self._apply(True)
        super().enterEvent(event)

    def leaveEvent(self, event):
        self._apply(False)
        super().leaveEvent(event)

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.activated.emit()
        super().mouseReleaseEvent(event)


class _ZenHomeLinkRow(QFrame):
    """
    Fila clicable estilo Zen (lista compacta): icono + texto; tecla a la derecha si se pasa.
    """

    activated = Signal()

    def __init__(self, label: str, icon_name: str, shortcut: str | None):
        super().__init__()
        self.setObjectName("ZenHomeLinkRow")
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setFixedHeight(34)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.setStyleSheet(
            f"""
            QFrame#ZenHomeLinkRow {{
                background: rgba(58, 53, 48, 0.035);
                border: 1px solid rgba(58, 53, 48, 0.07);
                border-radius: 8px;
            }}
            QFrame#ZenHomeLinkRow:hover {{
                background: rgba(58, 53, 48, 0.06);
                border-color: rgba(196, 96, 126, 0.22);
            }}
            """
        )
        h = QHBoxLayout(self)
        h.setContentsMargins(10, 0, 10, 0)
        h.setSpacing(10)

        ic = QLabel()
        ic.setFixedSize(22, 22)
        ic.setAlignment(Qt.AlignmentFlag.AlignCenter)
        ic.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        ic.setStyleSheet("background: transparent; border: none;")
        try:
            pm = qta.icon(icon_name, color=Z.SIDEBAR_ICON).pixmap(16, 16)
            ic.setPixmap(pm)
        except Exception:
            ic.setText("·")
        h.addWidget(ic, 0, Qt.AlignmentFlag.AlignVCenter)

        t = QLabel(label)
        t.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        t.setStyleSheet(
            f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI}; "
            f"font-size: 12px; font-weight: 500; background: transparent; border: none;"
        )
        h.addWidget(t, 1, Qt.AlignmentFlag.AlignVCenter)

        if shortcut:
            sc = QLabel(shortcut)
            sc.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
            sc.setStyleSheet(
                "font-family: 'Consolas', 'Cascadia Mono', ui-monospace, monospace; "
                "font-size: 9px; font-weight: 600; letter-spacing: 0.06em; "
                f"color: rgba(58, 53, 48, 0.28); background: transparent; border: none;"
            )
            h.addWidget(sc, 0, Qt.AlignmentFlag.AlignVCenter)

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.activated.emit()
        super().mouseReleaseEvent(event)


def _zen_home_panel_qss() -> str:
    return f"""
    QFrame#ZenHomePanel {{
        background: rgba(255, 255, 255, 0.42);
        border: 1px solid rgba(58, 53, 48, 0.07);
        border-radius: 12px;
    }}
    QFrame#ZenHomeInfoCard {{
        background: rgba(255, 252, 248, 0.65);
        border: 1px solid rgba(58, 53, 48, 0.06);
        border-radius: 10px;
    }}
    """


def _zen_section_label(text: str) -> QLabel:
    lb = QLabel(text.upper())
    lb.setStyleSheet(
        f"color: rgba(58, 53, 48, 0.38); font-family: {Z.FONT_UI}; "
        f"font-size: 9px; font-weight: 700; letter-spacing: 0.14em; "
        f"background: transparent; border: none; padding: 0 0 2px 0;"
    )
    return lb


def _zen_info_card(title: str, body: str) -> QFrame:
    card = QFrame()
    card.setObjectName("ZenHomeInfoCard")
    v = QVBoxLayout(card)
    v.setContentsMargins(12, 10, 12, 10)
    v.setSpacing(6)
    t = QLabel(title)
    t.setStyleSheet(
        f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI}; "
        f"font-size: 11px; font-weight: 600; background: transparent; border: none;"
    )
    b = QLabel(body)
    b.setWordWrap(True)
    b.setStyleSheet(
        f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; "
        f"font-size: 11px; line-height: 1.45; background: transparent; border: none;"
    )
    v.addWidget(t)
    v.addWidget(b)
    return card


def build_page(title: str, body: str, icon_name: str = "fa5s.layer-group") -> QWidget:
    w = QWidget()
    w.setStyleSheet("background: transparent;")
    lay = QVBoxLayout(w)
    lay.setContentsMargins(28, 28, 28, 28)
    lay.setSpacing(12)

    ic = QLabel()
    ic.setStyleSheet("background: transparent;")
    ic.setFixedSize(44, 44)
    ic.setAlignment(Qt.AlignmentFlag.AlignCenter)
    try:
        ic.setPixmap(qta.icon(icon_name, color=Z.PRIMARY).pixmap(34, 34))
    except Exception:
        ic.setText("◇")
    lay.addWidget(ic, 0, Qt.AlignmentFlag.AlignLeft)

    t = QLabel(title)
    t.setStyleSheet(
        f"color: {Z.PRIMARY}; background: transparent; letter-spacing: -0.35px; "
        f"font-family: {Z.FONT_UI}; font-size: {Z.FONT_SIZE_CARD_TITLE}px; font-weight: 600;"
    )
    lay.addWidget(t)

    accent = QFrame()
    accent.setFixedHeight(3)
    accent.setMaximumWidth(220)
    accent.setStyleSheet(
        f"""
        QFrame {{
            background: qlineargradient(x1:0,y1:0,x2:1,y2:0,
                stop:0 {Z.GOLD},
                stop:0.4 {Z.PRIMARY},
                stop:1 transparent);
            border: none;
            border-radius: 2px;
        }}
        """
    )
    lay.addWidget(accent)
    lay.addSpacing(4)

    d = QLabel(body)
    d.setWordWrap(True)
    body_col = getattr(Z, "CARD_PAGE_BODY", Z.NAV_TEXT_MUTED)
    d.setStyleSheet(
        f"color: {body_col}; font-family: {Z.FONT_UI}; "
        f"font-size: {Z.FONT_SIZE_CARD_BODY}px; line-height: 1.45; background: transparent;"
    )
    lay.addWidget(d)
    lay.addStretch()
    return w


def build_home_page(
    navigate_to: Callable[[str], None],
    *,
    on_quit: Callable[[], None],
    on_open_devices: Callable[[], None],
) -> QWidget:
    """Inicio Zen: saludo, accesos, información y enlaces de texto (dispositivos, salir)."""
    outer = QWidget()
    outer.setStyleSheet("background: transparent;")
    ol = QVBoxLayout(outer)
    ol.setContentsMargins(0, 0, 0, 0)

    scroll = QScrollArea()
    scroll.setWidgetResizable(True)
    scroll.setFrameShape(QFrame.Shape.NoFrame)
    scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
    scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
    scroll.setStyleSheet("QScrollArea { background: transparent; border: none; }")

    inner = QWidget()
    inner.setStyleSheet("background: transparent;\n" + _zen_home_panel_qss())
    lay = QVBoxLayout(inner)
    lay.setContentsMargins(22, 18, 22, 20)
    lay.setSpacing(16)

    d = datetime.now()
    date_str = f"{_DAYS[d.weekday()]}, {d.day} de {_MONTHS[d.month - 1]} de {d.year}"

    # Cabecera estilo Zen: acento vertical + texto (respiración, sin bloques pesados).
    hero = QWidget()
    hero.setStyleSheet("background: transparent;")
    hh = QHBoxLayout(hero)
    hh.setContentsMargins(0, 0, 0, 0)
    hh.setSpacing(14)

    accent = QFrame()
    accent.setFixedWidth(3)
    accent.setMinimumHeight(56)
    accent.setMaximumHeight(72)
    accent.setStyleSheet(
        f"""
        QFrame {{
            background: qlineargradient(x1:0,y1:0,x2:0,y2:1,
                stop:0 {Z.GOLD},
                stop:0.45 {Z.PRIMARY},
                stop:1 rgba(196, 96, 126, 0.25));
            border: none;
            border-radius: 2px;
        }}
        """
    )
    hh.addWidget(accent, 0, Qt.AlignmentFlag.AlignTop)

    hv = QVBoxLayout()
    hv.setSpacing(5)
    hv.setContentsMargins(0, 2, 0, 0)
    hi = QLabel("Hola, Monserrat")
    hi.setStyleSheet(
        f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI}; font-size: 17px; "
        f"font-weight: 600; letter-spacing: -0.35px; background: transparent; border: none;"
    )
    dl = QLabel(date_str)
    dl.setStyleSheet(
        f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; "
        f"font-size: 12px; background: transparent; border: none;"
    )
    hint = QLabel(
        "Elegí abajo un módulo, usá el menú lateral o las teclas de función."
    )
    hint.setWordWrap(True)
    hint.setStyleSheet(
        f"color: rgba(58, 53, 48, 0.42); font-family: {Z.FONT_UI}; "
        f"font-size: 11px; line-height: 1.4; background: transparent; border: none;"
    )
    hv.addWidget(hi)
    hv.addWidget(dl)
    hv.addWidget(hint)
    hh.addLayout(hv, 1)
    lay.addWidget(hero)

    # Panel principal: lista compacta (Zen / ajustes del navegador).
    panel = QFrame()
    panel.setObjectName("ZenHomePanel")
    pv = QVBoxLayout(panel)
    pv.setContentsMargins(10, 10, 10, 10)
    pv.setSpacing(4)
    pv.addWidget(_zen_section_label("Ir a"))
    quick = [
        ("pdv", "Punto de venta", "fa5s.shopping-cart", "F1"),
        ("inventario", "Inventario", "fa5s.tags", "F2"),
        ("creditos", "Créditos", "fa5s.hand-holding-usd", "F3"),
        ("banqueta", "Banqueta", "fa5s.map-marked-alt", "F4"),
    ]
    for key, label, icon_name, sc in quick:
        row = _ZenHomeLinkRow(label, icon_name, sc)
        row.setToolTip(f"{label} · {sc}")
        row.activated.connect(partial(navigate_to, key))
        pv.addWidget(row)

    pv.addSpacing(10)
    link_dev = _ZenTextLink(
        "Configuración · impresoras y lector",
        color=_HOME_LINK_BLUE,
        hover_color=_HOME_LINK_BLUE_HOVER,
    )
    link_dev.activated.connect(on_open_devices)
    pv.addWidget(link_dev, 0, Qt.AlignmentFlag.AlignLeft)

    lay.addWidget(panel)

    # Información útil (basada en el documento del proyecto), sin texto de “Espacio Zen”.
    cards = QHBoxLayout()
    cards.setSpacing(12)
    cards.addWidget(_zen_info_card("Saldos Monserrat", _HOME_ABOUT_SYSTEM), 1)
    cards.addWidget(_zen_info_card("Banqueta y liquidaciones", _HOME_BANQUETA), 1)
    lay.addLayout(cards)

    lay.addWidget(_zen_info_card("Atajos de teclado", _HOME_SHORTCUTS))

    # Misma sangría horizontal que el interior de las tarjetas info (12px).
    quit_indent = QWidget()
    quit_indent.setStyleSheet("background: transparent;")
    qil = QHBoxLayout(quit_indent)
    qil.setContentsMargins(12, 10, 12, 0)
    qil.setSpacing(0)
    link_quit = _ZenTextLink(
        "Salir",
        color="rgba(138, 78, 78, 0.82)",
        hover_color="rgba(112, 58, 58, 0.95)",
    )
    link_quit.activated.connect(on_quit)
    qil.addWidget(link_quit, 0, Qt.AlignmentFlag.AlignLeft)
    qil.addStretch(1)
    lay.addWidget(quit_indent)

    foot = QLabel("Saldos Monserrat")
    foot.setStyleSheet(
        f"color: rgba(58, 53, 48, 0.22); font-family: {Z.FONT_UI}; "
        f"font-size: 9px; letter-spacing: 0.04em; background: transparent; border: none;"
    )
    lay.addWidget(foot, 0, Qt.AlignmentFlag.AlignLeft)

    lay.addStretch()

    scroll.setWidget(inner)
    ol.addWidget(scroll)
    return outer
