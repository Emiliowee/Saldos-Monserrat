"""
Cromo superior estilo Zen: franja mínima + barra completa al hover.
`TitleBar` sigue en main_window para evitar dependencias circulares pesadas.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Callable

from PySide6.QtWidgets import QWidget, QVBoxLayout, QStackedWidget, QApplication
from PySide6.QtCore import Qt, QPoint, QTimer, QEvent

from src.ui.tokens import BG_WINDOW

if TYPE_CHECKING:
    from src.ui.main_window import MainWindow

# Franja superior cuando el cromo está colapsado (px)
CHROME_COLLAPSED_H = 8

_BG = BG_WINDOW


class TopHoverStrip(QWidget):
    """
    Franja fina en el borde superior; al entrar con el ratón despliega la barra completa.
    """

    def __init__(self, win: MainWindow, on_expand: Callable[[], None]):
        super().__init__(win)
        self._win = win
        self._on_expand = on_expand
        self._dragging = False
        self._drag_pos = QPoint()
        self.setFixedHeight(CHROME_COLLAPSED_H)
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet(f"background:{_BG}; border:none;")
        self.setMouseTracking(True)

    def enterEvent(self, event):
        super().enterEvent(event)
        self._on_expand()

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            self._dragging = True
            self._drag_pos = e.globalPosition().toPoint() - self._win.frameGeometry().topLeft()
        super().mousePressEvent(e)

    def mouseMoveEvent(self, e):
        if self._dragging and e.buttons() == Qt.MouseButton.LeftButton:
            if self._win.isMaximized():
                self._win.showNormal()
                self._drag_pos = QPoint(self._win.width() // 2, CHROME_COLLAPSED_H // 2)
            self._win.move(e.globalPosition().toPoint() - self._drag_pos)
        super().mouseMoveEvent(e)

    def mouseReleaseEvent(self, e):
        self._dragging = False
        super().mouseReleaseEvent(e)

    def mouseDoubleClickEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton and hasattr(self._win, "_title_bar"):
            tb = self._win._title_bar
            if hasattr(tb, "_toggle_max"):
                tb._toggle_max()
        super().mouseDoubleClickEvent(e)


class AutoHideChrome(QWidget):
    """
    Cromo superior: por defecto solo franja; al pasar el ratón, menús y controles.
    Si está fijado (configuración), la barra permanece visible.
    """

    def __init__(self, win: MainWindow, pinned: bool = False):
        super().__init__(win)
        self._win = win
        self._pinned = pinned
        self._timer = QTimer(self)
        self._timer.setSingleShot(True)
        self._timer.setInterval(480)
        self._timer.timeout.connect(self._try_collapse)

        self._strip = TopHoverStrip(win, self._expand)
        # Import diferido: main_window ya terminó de cargar cuando se instancia esto
        from src.ui.main_window import TitleBar

        self._bar = TitleBar(win)

        self._stack = QStackedWidget()
        self._stack.addWidget(self._strip)
        self._stack.addWidget(self._bar)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        lay.addWidget(self._stack)

        self._bar.installEventFilter(self)
        self.set_pinned(pinned)

    @property
    def title_bar(self):
        return self._bar

    def set_pinned(self, pinned: bool):
        self._pinned = bool(pinned)
        self._timer.stop()
        self._stack.setCurrentIndex(1 if self._pinned else 0)

    def _expand(self):
        self._timer.stop()
        self._stack.setCurrentIndex(1)

    def _schedule_collapse(self):
        if self._pinned:
            return
        self._timer.start()

    def _try_collapse(self):
        if self._pinned:
            return
        popup = QApplication.activePopupWidget()
        if popup is not None:
            self._timer.start(220)
            return
        self._stack.setCurrentIndex(0)

    def eventFilter(self, obj, ev):
        if obj is self._bar and ev.type() == QEvent.Type.Leave:
            self._schedule_collapse()
        return super().eventFilter(obj, ev)
