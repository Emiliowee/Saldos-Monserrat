"""
QSS solo de barras de desplazamiento para el shell zen_desktop.

El shell Zen no carga `APP_QSS` del ERP clásico; sin esto Qt usa scrollbars gruesas por defecto.
Criterio: carril transparente, thumb fino (2px), tono del fondo del shell — casi invisible.
"""
from __future__ import annotations

from src.ui.zen_desktop import theme as Z


def zen_scrollbars_stylesheet() -> str:
    w = Z.SCROLLBAR_W
    h = Z.SCROLLBAR_HANDLE
    hh = Z.SCROLLBAR_HANDLE_HOVER
    m = Z.SCROLLBAR_MIN_THUMB
    return f"""
QScrollArea {{ background: transparent; border: none; }}

QScrollBar:vertical {{
    background: transparent;
    width: {w}px;
    margin: 0;
    border: none;
}}
QScrollBar::handle:vertical {{
    background: {h};
    border-radius: 1px;
    min-height: {m}px;
    margin: 0;
}}
QScrollBar::handle:vertical:hover {{ background: {hh}; }}
QScrollBar::add-page:vertical,
QScrollBar::sub-page:vertical {{ background: transparent; }}
QScrollBar::add-line:vertical,
QScrollBar::sub-line:vertical {{ height: 0; width: 0; }}

QScrollBar:horizontal {{
    background: transparent;
    height: {w}px;
    margin: 0;
    border: none;
}}
QScrollBar::handle:horizontal {{
    background: {h};
    border-radius: 1px;
    min-width: {m}px;
    margin: 0;
}}
QScrollBar::handle:horizontal:hover {{ background: {hh}; }}
QScrollBar::add-page:horizontal,
QScrollBar::sub-page:horizontal {{ background: transparent; }}
QScrollBar::add-line:horizontal,
QScrollBar::sub-line:horizontal {{ width: 0; height: 0; }}
"""
