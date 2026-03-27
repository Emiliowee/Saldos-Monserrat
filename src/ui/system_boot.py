"""
Selector de arranque — papel/tinta (misma familia que el ERP), sin foto Pillow.

Barra clara propia + dos modos: Tienda (ERP) y Banqueta (mapa).
"""
from __future__ import annotations

from PySide6.QtCore import QPoint, Qt, Signal
from PySide6.QtGui import QColor, QFont, QIcon, QPainter, QPainterPath, QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QFrame,
    QGraphicsDropShadowEffect,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from src.core.paths import APP_WINDOW_ICON_PATH, LOGO_PATH
from src.ui.tokens import (
    BG_APP,
    BG_CONTENT,
    BORDER_MED,
    PRIMARY,
    PRIMARY_HOVER,
    TEXT_BODY,
    TEXT_HEADING,
    TEXT_MUTED,
)

BOOT_WINDOW_W = 420
BOOT_TITLE_H = 34
BOOT_BODY_H = 312
BOOT_WINDOW_H = BOOT_TITLE_H + BOOT_BODY_H

_CHROME_BG = "#F2F2F4"
_CHROME_TEXT = "#4A4A4A"
_CHROME_BTN = "#3D3D3D"
_CHROME_LINE = "#DCDCE0"


class _BootTitleBar(QFrame):
    _BTN_W = 40

    def __init__(self, window: "SystemBootWindow", parent=None):
        super().__init__(parent)
        self._win = window
        self.setFixedHeight(BOOT_TITLE_H)
        self.setObjectName("BootTitleBar")
        self._drag: QPoint | None = None
        self.setStyleSheet(
            f"""
            QFrame#BootTitleBar {{
                background: {_CHROME_BG};
                border: none;
                border-bottom: 1px solid {_CHROME_LINE};
            }}
            QPushButton#BootTitleMin {{
                background: transparent; border: none; color: {_CHROME_BTN};
                font-size: 15px;
            }}
            QPushButton#BootTitleMin:hover {{ background: rgba(0,0,0,0.06); }}
            QPushButton#BootTitleClose {{
                background: transparent; border: none; color: {_CHROME_BTN};
                font-size: 14px; font-weight: 600;
            }}
            QPushButton#BootTitleClose:hover {{
                background: #C42B1C; color: #FFFFFF;
            }}
            """
        )
        row = QHBoxLayout(self)
        row.setContentsMargins(12, 0, 0, 0)
        row.setSpacing(8)

        ic = QLabel()
        ic.setFixedSize(16, 16)
        ic.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        if APP_WINDOW_ICON_PATH.is_file():
            ic.setPixmap(QIcon(str(APP_WINDOW_ICON_PATH)).pixmap(16, 16))
        row.addWidget(ic)

        title = QLabel("Saldos Monserrat")
        title.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        tf = QFont("Segoe UI")
        tf.setPixelSize(12)
        tf.setWeight(QFont.Weight.DemiBold)
        title.setFont(tf)
        title.setStyleSheet(f"color: {_CHROME_TEXT}; background: transparent;")
        row.addWidget(title)
        row.addStretch(1)

        for sym, slot, name in (
            ("−", window.showMinimized, "BootTitleMin"),
            ("×", window.close, "BootTitleClose"),
        ):
            b = QPushButton(sym)
            b.setObjectName(name)
            b.setFixedSize(self._BTN_W, BOOT_TITLE_H)
            b.setCursor(Qt.CursorShape.PointingHandCursor)
            b.clicked.connect(slot)
            row.addWidget(b, 0, Qt.AlignmentFlag.AlignTop)

    def _drag_ok(self, x: float) -> bool:
        return x < self.width() - 2 * self._BTN_W - 4

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton and self._drag_ok(e.position().x()):
            self._drag = e.globalPosition().toPoint() - self._win.frameGeometry().topLeft()
        else:
            self._drag = None
        super().mousePressEvent(e)

    def mouseMoveEvent(self, e):
        if self._drag is not None and e.buttons() & Qt.MouseButton.LeftButton:
            self._win.move(e.globalPosition().toPoint() - self._drag)
        super().mouseMoveEvent(e)

    def mouseReleaseEvent(self, e):
        self._drag = None
        super().mouseReleaseEvent(e)


class _BootBody(QWidget):
    _COL_W = 320

    def __init__(self, window: "SystemBootWindow"):
        super().__init__()
        self._win = window
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet(f"background: {BG_APP};")

        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addStretch(1)

        mid = QWidget()
        mid.setMaximumWidth(self._COL_W)
        mid.setStyleSheet("background: transparent;")
        hl = QHBoxLayout()
        hl.addStretch(1)
        hl.addWidget(mid, 0, Qt.AlignmentFlag.AlignHCenter)
        hl.addStretch(1)
        outer.addLayout(hl)
        outer.addStretch(1)

        v = QVBoxLayout(mid)
        v.setContentsMargins(0, 0, 0, 0)
        v.setSpacing(0)

        logo_row = QHBoxLayout()
        logo_row.addStretch(1)
        logo_lbl = QLabel()
        logo_lbl.setFixedSize(52, 52)
        if LOGO_PATH.is_file():
            raw = QPixmap(str(LOGO_PATH)).scaled(
                48,
                48,
                Qt.AspectRatioMode.KeepAspectRatioByExpanding,
                Qt.TransformationMode.SmoothTransformation,
            )
            circ = QPixmap(48, 48)
            circ.fill(Qt.GlobalColor.transparent)
            p = QPainter(circ)
            p.setRenderHint(QPainter.RenderHint.Antialiasing)
            path = QPainterPath()
            path.addEllipse(0, 0, 48, 48)
            p.setClipPath(path)
            p.drawPixmap(0, 0, raw)
            p.end()
            logo_lbl.setPixmap(circ)
            sh = QGraphicsDropShadowEffect(logo_lbl)
            sh.setBlurRadius(10)
            sh.setOffset(0, 1)
            sh.setColor(QColor(0, 0, 0, 14))
            logo_lbl.setGraphicsEffect(sh)
        logo_row.addWidget(logo_lbl)
        logo_row.addStretch(1)
        v.addLayout(logo_row)

        v.addSpacing(20)
        h1 = QLabel("Saldos Monserrat")
        f1 = QFont("Segoe UI")
        f1.setPixelSize(18)
        f1.setWeight(QFont.Weight.DemiBold)
        h1.setFont(f1)
        h1.setAlignment(Qt.AlignmentFlag.AlignHCenter)
        h1.setStyleSheet(f"color: {TEXT_HEADING}; background: transparent;")
        v.addWidget(h1)

        v.addSpacing(6)
        sub = QLabel("Sistema de tienda · elegí modo")
        sub.setFont(QFont("Segoe UI", 9))
        sub.setAlignment(Qt.AlignmentFlag.AlignHCenter)
        sub.setStyleSheet(f"color: {TEXT_MUTED}; background: transparent;")
        v.addWidget(sub)

        v.addSpacing(28)

        self._btn_erp = QPushButton("Tienda — inventario y caja")
        self._btn_bq = QPushButton("Banqueta — plano de tienda")
        self._btn_erp.setCursor(Qt.CursorShape.PointingHandCursor)
        self._btn_bq.setCursor(Qt.CursorShape.PointingHandCursor)
        self._btn_erp.setMinimumHeight(44)
        self._btn_bq.setMinimumHeight(44)
        self._btn_erp.setFont(QFont("Segoe UI", 10))
        self._btn_bq.setFont(QFont("Segoe UI", 10))

        self._btn_erp.setStyleSheet(
            f"""
            QPushButton {{
                background: {PRIMARY};
                color: #FFFFFF;
                border: none;
                border-radius: 12px;
                padding: 12px 16px;
                text-align: center;
            }}
            QPushButton:hover {{ background: {PRIMARY_HOVER}; }}
            QPushButton:focus {{
                border: 2px solid {TEXT_HEADING};
                padding: 10px 14px;
            }}
            """
        )
        self._btn_bq.setStyleSheet(
            f"""
            QPushButton {{
                background: {BG_CONTENT};
                color: {TEXT_BODY};
                border: 1px solid {BORDER_MED};
                border-radius: 12px;
                padding: 11px 16px;
                text-align: center;
            }}
            QPushButton:hover {{
                background: rgba(255,255,255,0.92);
                border-color: {PRIMARY};
                color: {TEXT_HEADING};
            }}
            QPushButton:focus {{
                border: 2px solid {PRIMARY};
                padding: 10px 15px;
            }}
            """
        )

        self._btn_erp.clicked.connect(lambda: self._win._pick("erp"))
        self._btn_bq.clicked.connect(lambda: self._win._pick("banqueta"))

        v.addWidget(self._btn_erp)
        v.addSpacing(10)
        v.addWidget(self._btn_bq)


class _BootRoot(QWidget):
    def __init__(self, window: SystemBootWindow):
        super().__init__()
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        lay.addWidget(_BootTitleBar(window, self))
        body = _BootBody(window)
        body.setFixedHeight(BOOT_BODY_H)
        lay.addWidget(body, 1)


class SystemBootWindow(QMainWindow):
    system_chosen = Signal(str)

    def __init__(self):
        super().__init__()
        self._picked = False
        self._centered_once = False
        self.setWindowTitle("Saldos Monserrat")
        self.setWindowFlags(Qt.WindowType.Window | Qt.WindowType.FramelessWindowHint)
        self.setFixedSize(BOOT_WINDOW_W, BOOT_WINDOW_H)
        self.setStyleSheet(
            f"""
            QMainWindow {{
                background: {BG_APP};
                border: 1px solid rgba(0, 0, 0, 0.1);
            }}
            """
        )
        if APP_WINDOW_ICON_PATH.is_file():
            self.setWindowIcon(QIcon(str(APP_WINDOW_ICON_PATH)))
        self.setCentralWidget(_BootRoot(self))

    def showEvent(self, event):
        super().showEvent(event)
        if not self._centered_once:
            self._centered_once = True
            scr = QApplication.primaryScreen()
            if scr is not None:
                ag = scr.availableGeometry()
                fg = self.frameGeometry()
                fg.moveCenter(ag.center())
                self.move(fg.topLeft())

    def _pick(self, mode: str):
        self._picked = True
        self.system_chosen.emit(mode)

    def closeEvent(self, event):
        if not self._picked:
            QApplication.instance().quit()
        super().closeEvent(event)
