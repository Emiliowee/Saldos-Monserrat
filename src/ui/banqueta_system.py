"""
Ventana independiente Banqueta — mismo mapa y mismos tokens que el ERP (papel/tinta).
"""
from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QAction, QFont
from PySide6.QtWidgets import (
    QApplication,
    QLabel,
    QMainWindow,
    QMenu,
    QMessageBox,
    QVBoxLayout,
    QWidget,
)

from src.ui.modules.banqueta_map import BanquetaMapPage
from src.ui.tokens import BG_WINDOW, CHROME_LINE, PRIMARY, TEXT_BODY, TEXT_MUTED, TEXT_STRONG


class BanquetaSystemWindow(QMainWindow):
    back_to_selector = Signal()

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Banqueta — plano de tienda · Saldos Monserrat")
        self.setMinimumSize(880, 560)
        self.resize(960, 620)
        self.setStyleSheet(
            f"""
            QMainWindow {{ background: {BG_WINDOW}; }}
            QWidget {{ background: {BG_WINDOW}; color: {TEXT_BODY};
                       font-family: "Segoe UI", sans-serif; font-size: 9pt; }}
            """
        )

        mb = self.menuBar()
        mb.setStyleSheet(
            f"""
            QMenuBar {{
                background: {BG_WINDOW};
                border-bottom: 1px solid {CHROME_LINE};
                font-size: 8pt;
            }}
            QMenuBar::item {{ padding: 6px 12px; }}
            QMenuBar::item:selected {{ background: {PRIMARY}; color: white; }}
            QMenu {{
                background: {BG_WINDOW};
                border: 1px solid {CHROME_LINE};
            }}
            QMenu::item:selected {{ background: {PRIMARY}; color: white; }}
            """
        )
        m_sys = QMenu("Sistema", self)
        act_back = QAction("Volver a la pantalla inicial…", self)
        act_back.triggered.connect(self._confirm_back)
        act_exit = QAction("Salir", self)
        act_exit.triggered.connect(QApplication.instance().quit)
        m_sys.addAction(act_back)
        m_sys.addSeparator()
        m_sys.addAction(act_exit)
        mb.addMenu(m_sys)

        central = QWidget()
        self.setCentralWidget(central)
        lay = QVBoxLayout(central)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        hint = QLabel(
            "Mismo inventario que la Tienda. El mapa es el mismo que en el menú Banqueta del ERP."
        )
        hint.setWordWrap(True)
        hint.setFont(QFont("Segoe UI", 9))
        hint.setStyleSheet(
            f"color: {TEXT_MUTED}; background: {BG_WINDOW}; padding: 10px 16px; "
            f"border-bottom: 1px solid {CHROME_LINE};"
        )
        lay.addWidget(hint)

        lay.addWidget(BanquetaMapPage(standalone=True), 1)

    def _confirm_back(self):
        r = QMessageBox.question(
            self,
            "Cambiar de entorno",
            "¿Volver a la pantalla inicial?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if r == QMessageBox.StandardButton.Yes:
            self.back_to_selector.emit()
