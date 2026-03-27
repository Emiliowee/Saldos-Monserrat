"""Arranque de la aplicación (shell Zen; sin cargar el QSS del ERP legacy)."""
from __future__ import annotations

import sys

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import QApplication

from src.ui.qt_fusion import apply_fusion_style
from src.ui.zen_desktop.main_window import ZenShellWindow
from src.ui.zen_desktop.scrollbars_qss import zen_scrollbars_stylesheet


def run_zen_desktop() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("Saldos Monserrat")
    app.setAttribute(Qt.ApplicationAttribute.AA_DontCreateNativeWidgetSiblings)
    # Sin Fusion en Windows, el QSS de scrollbars casi no se aplica (parece que “no pasó nada”)
    apply_fusion_style(app)
    app.setStyleSheet(zen_scrollbars_stylesheet())

    f = QFont()
    f.setFamilies(
        [
            "Segoe UI Variable Text",
            "Segoe UI Variable",
            "Segoe UI",
            "Helvetica Neue",
            "Arial",
        ]
    )
    f.setPointSize(10)
    app.setFont(f)

    win = ZenShellWindow()
    win.show()
    return app.exec()
