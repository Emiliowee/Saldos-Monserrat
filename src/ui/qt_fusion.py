"""
En Windows, el estilo nativo (Vista/Windows11) a menudo **ignora** QSS en QScrollBar.
Fusion hace que `setStyleSheet` se respete en scrollbars y otros controles.
"""
from __future__ import annotations

from PySide6.QtWidgets import QApplication, QStyleFactory


def apply_fusion_style(app: QApplication) -> bool:
    style = QStyleFactory.create("Fusion")
    if style is None:
        return False
    app.setStyle(style)
    return True
