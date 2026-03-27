"""
Página Configuración Zen: preferencias del shell y acceso al modal de hardware (impresoras / lector).
"""
from __future__ import annotations

import qtawesome as qta

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from src.ui.zen_desktop import theme as Z
from src.ui.zen_desktop.devices_modal import open_zen_devices_dialog
from src.ui.zen_desktop.pages import (
    _HOME_LINK_BLUE,
    _HOME_LINK_BLUE_HOVER,
    _ZenTextLink,
)


def build_zen_config_page() -> QWidget:
    outer = QWidget()
    outer.setStyleSheet("background: transparent;")
    ol = QVBoxLayout(outer)
    ol.setContentsMargins(0, 0, 0, 0)

    scroll = QScrollArea()
    scroll.setWidgetResizable(True)
    scroll.setFrameShape(QFrame.Shape.NoFrame)
    scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
    scroll.setStyleSheet("QScrollArea { background: transparent; border: none; }")

    inner = QWidget()
    inner.setStyleSheet("background: transparent;")
    lay = QVBoxLayout(inner)
    lay.setContentsMargins(24, 22, 24, 24)
    lay.setSpacing(18)

    head = QHBoxLayout()
    head.setSpacing(12)
    ic = QLabel()
    ic.setFixedSize(40, 40)
    ic.setStyleSheet("background: transparent;")
    try:
        ic.setPixmap(qta.icon("fa5s.cog", color=Z.PRIMARY).pixmap(30, 30))
    except Exception:
        ic.setText("⚙")
    head.addWidget(ic, 0, Qt.AlignmentFlag.AlignTop)
    hv = QVBoxLayout()
    hv.setSpacing(4)
    title = QLabel("Configuración")
    title.setStyleSheet(
        f"color: {Z.PRIMARY}; font-family: {Z.FONT_UI}; font-size: {Z.FONT_SIZE_CARD_TITLE}px; "
        f"font-weight: 600; letter-spacing: -0.3px; background: transparent; border: none;"
    )
    sub = QLabel(
        "Centro de ajustes del shell. El hardware de caja (impresoras y lector USB) tiene su propia "
        "ventana con menú lateral, estilo configuración moderna de Windows. Más abajo, otras "
        "preferencias que iremos sumando (tema, teclas, idioma…)."
    )
    sub.setWordWrap(True)
    sub.setStyleSheet(
        f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; font-size: 11px; "
        f"line-height: 1.4; background: transparent; border: none;"
    )
    hv.addWidget(title)
    hv.addWidget(sub)
    head.addLayout(hv, 1)
    lay.addLayout(head)

    card = QFrame()
    card.setObjectName("ZenConfigShortcutCard")
    card.setStyleSheet(
        f"""
        QFrame#ZenConfigShortcutCard {{
            background: rgba(255, 255, 255, 0.5);
            border: 1px solid rgba(58, 53, 48, 0.08);
            border-radius: 12px;
        }}
        """
    )
    cv = QVBoxLayout(card)
    cv.setContentsMargins(16, 16, 16, 16)
    cv.setSpacing(10)
    cap = QLabel("HARDWARE DE CAJA")
    cap.setStyleSheet(
        f"color: rgba(58, 53, 48, 0.38); font-family: {Z.FONT_UI}; "
        f"font-size: 9px; font-weight: 700; letter-spacing: 0.14em; "
        f"background: transparent; border: none;"
    )
    cv.addWidget(cap)
    desc = QLabel(
        "Impresoras de Windows, prueba de impresión, diagnóstico y prueba del lector de código de "
        "barras (modo teclado USB)."
    )
    desc.setWordWrap(True)
    desc.setStyleSheet(
        f"color: {Z.CARD_PAGE_BODY}; font-family: {Z.FONT_UI}; font-size: 11px; "
        f"line-height: 1.45; background: transparent; border: none;"
    )
    cv.addWidget(desc)
    link_dev = _ZenTextLink(
        "Abrir configuración (impresoras y lector)…",
        color=_HOME_LINK_BLUE,
        hover_color=_HOME_LINK_BLUE_HOVER,
    )
    link_dev.activated.connect(lambda: open_zen_devices_dialog(outer.window()))
    cv.addWidget(link_dev, 0, Qt.AlignmentFlag.AlignLeft)

    lay.addWidget(card)

    def _placeholder_card(section: str, body: str) -> QFrame:
        f = QFrame()
        f.setObjectName("ZenConfigPlaceholderCard")
        f.setStyleSheet(
            f"""
            QFrame#ZenConfigPlaceholderCard {{
                background: rgba(255, 255, 255, 0.35);
                border: 1px dashed rgba(58, 53, 48, 0.12);
                border-radius: 12px;
            }}
            """
        )
        fv = QVBoxLayout(f)
        fv.setContentsMargins(16, 14, 16, 14)
        fv.setSpacing(6)
        c = QLabel(section)
        c.setStyleSheet(
            f"color: rgba(58, 53, 48, 0.38); font-family: {Z.FONT_UI}; "
            f"font-size: 9px; font-weight: 700; letter-spacing: 0.14em; "
            f"background: transparent; border: none;"
        )
        fv.addWidget(c)
        b = QLabel(body)
        b.setWordWrap(True)
        b.setStyleSheet(
            f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; font-size: 11px; "
            f"line-height: 1.45; background: transparent; border: none;"
        )
        fv.addWidget(b)
        return f

    lay.addWidget(
        _placeholder_card(
            "APARIENCIA",
            "Tema claro / oscuro y acentos al estilo «Zen browser»: próximamente en esta misma página.",
        )
    )
    lay.addWidget(
        _placeholder_card(
            "TECLADO E IDIOMA",
            "Atajos personalizables, combinaciones y idioma de la interfaz: próximamente.",
        )
    )
    lay.addStretch()

    scroll.setWidget(inner)
    ol.addWidget(scroll)
    return outer
