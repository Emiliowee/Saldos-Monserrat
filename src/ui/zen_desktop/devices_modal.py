"""
Ventana «Configuración» (hardware de caja): impresoras y lector de código de barras
para el punto de venta. Misma ventana modal desde Inicio y desde la página Configuración.

Diseño con tokens fijos (espaciado, radios, tipografía) y barra de título nativa.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QColor, QIcon, QPalette, QPixmap, QWheelEvent
from PySide6.QtWidgets import (
    QApplication,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QStackedWidget,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from src.core.paths import ZEN_HW_IMPRESORA_PNG, ZEN_HW_LECTOR_PNG
from src.ui.zen_desktop import settings as zsettings
from src.ui.zen_desktop import theme as Z
from src.ui.zen_desktop import barcode_probe
from src.ui.zen_desktop import hw_services


class _ComboNoWheelUnlessFocused(QComboBox):
    """
    No cambia de ítem con la rueda del ratón si el combo no tiene el foco
    (así el scroll del área principal no altera la impresora elegida).
    """

    def wheelEvent(self, event: QWheelEvent) -> None:
        if self.hasFocus():
            super().wheelEvent(event)
        else:
            event.ignore()


# —— Tokens de diseño (8 px base) ——
_T = {
    "bg_page": "#F0F0F0",
    "bg_sidebar": "#EBEBEB",
    "bg_card": "#FFFFFF",
    "bg_input": "#FFFFFF",
    "line": "#DCDCDC",
    "line_strong": "#C8C8C8",
    "text": "#1A1A1A",
    "muted": "#4A4A4A",
    "subtle": "#737373",
    "accent": "#0067C0",
    "accent_hover": "#005A9E",
    "btn_secondary": "#E8E8E8",
    "btn_secondary_hover": "#DEDEDE",
    "font": Z.FONT_UI,
    "r_sm": "6px",
    "r_md": "8px",
    "r_lg": "10px",
    "space_1": 8,
    "space_2": 12,
    "space_3": 16,
    "space_4": 24,
    "space_5": 32,
    "sidebar_w": 236,
    "nav_h": 44,
}


def _printer_window_icon() -> QIcon:
    pm = QPixmap(str(ZEN_HW_IMPRESORA_PNG))
    if pm.isNull():
        return QIcon()
    ico = QIcon()
    for s in (16, 24, 32, 48):
        ico.addPixmap(
            pm.scaled(
                s,
                s,
                Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation,
            )
        )
    return ico


def _lbl_page_title(text: str) -> QLabel:
    lb = QLabel(text)
    x = _T
    lb.setStyleSheet(
        f"color: {x['text']}; font-family: {x['font']}; font-size: 22px; "
        f"font-weight: 600; letter-spacing: -0.02em; padding: 0 0 2px 0; "
        f"background: transparent; border: none;"
    )
    return lb


def _lbl_lead(text: str) -> QLabel:
    lb = QLabel(text)
    lb.setWordWrap(True)
    x = _T
    lb.setStyleSheet(
        f"color: {x['muted']}; font-family: {x['font']}; font-size: 13px; "
        f"line-height: 1.5; padding: 0 0 {x['space_4']}px 0; "
        f"background: transparent; border: none;"
    )
    return lb


def _lbl_card_title(text: str) -> QLabel:
    lb = QLabel(text)
    x = _T
    lb.setStyleSheet(
        f"color: {x['text']}; font-family: {x['font']}; font-size: 14px; "
        f"font-weight: 600; padding: 0 0 {x['space_2']}px 0; "
        f"background: transparent; border: none;"
    )
    return lb


def _lbl_body(text: str) -> QLabel:
    lb = QLabel(text)
    lb.setWordWrap(True)
    x = _T
    lb.setStyleSheet(
        f"color: {x['muted']}; font-family: {x['font']}; font-size: 12px; "
        f"line-height: 1.5; background: transparent; border: none;"
    )
    return lb


def _lbl_caption(text: str) -> QLabel:
    lb = QLabel(text)
    lb.setWordWrap(True)
    x = _T
    lb.setStyleSheet(
        f"color: {x['subtle']}; font-family: {x['font']}; font-size: 11px; "
        f"line-height: 1.45; background: transparent; border: none;"
    )
    return lb


def _card() -> QFrame:
    f = QFrame()
    x = _T
    f.setObjectName("DevicesCard")
    f.setStyleSheet(
        f"""
        QFrame#DevicesCard {{
            background: {x['bg_card']};
            border: 1px solid {x['line']};
            border-radius: {x['r_lg']};
        }}
        """
    )
    return f


def _combo_qss() -> str:
    x = _T
    return f"""
        QComboBox {{
            background: {x['bg_input']};
            border: 1px solid {x['line_strong']};
            border-radius: {x['r_sm']};
            padding: 9px 12px;
            font-family: {x['font']};
            font-size: 13px;
            color: {x['text']};
            min-height: 22px;
        }}
        QComboBox:hover {{ border-color: #A0A0A0; }}
        QComboBox:focus {{ border: 2px solid {x['accent']}; padding: 8px 11px; }}
        QComboBox::drop-down {{ border: none; width: 28px; }}
        QComboBox QAbstractItemView {{
            background: {x['bg_input']};
            color: {x['text']};
            selection-background-color: #CCE4F7;
            selection-color: {x['text']};
            border: 1px solid {x['line_strong']};
            border-radius: {x['r_sm']};
            padding: 4px;
            outline: none;
        }}
    """


def _btn_qss(*, primary: bool = False) -> str:
    x = _T
    if primary:
        return f"""
            QPushButton {{
                background: {x['accent']};
                color: #FFFFFF;
                border: none;
                border-radius: {x['r_sm']};
                padding: 10px 18px;
                font-family: {x['font']};
                font-size: 13px;
                font-weight: 600;
                min-height: 20px;
            }}
            QPushButton:hover {{ background: {x['accent_hover']}; }}
            QPushButton:disabled {{ background: #A8A8A8; color: #ECECEC; }}
        """
    return f"""
        QPushButton {{
            background: {x['btn_secondary']};
            border: 1px solid {x['line_strong']};
            border-radius: {x['r_sm']};
            padding: 9px 16px;
            font-family: {x['font']};
            font-size: 13px;
            color: {x['text']};
            min-height: 20px;
        }}
        QPushButton:hover {{
            background: {x['btn_secondary_hover']};
            border-color: #A8A8A8;
        }}
    """


def _line_h() -> QFrame:
    line = QFrame()
    line.setFrameShape(QFrame.Shape.HLine)
    line.setFixedHeight(1)
    line.setStyleSheet(f"background: {_T['line']}; border: none; max-height: 1px;")
    return line


def _side_icon(path: Path, size: int = 24) -> QLabel:
    lab = QLabel()
    lab.setFixedSize(size + 4, size + 4)
    lab.setAlignment(Qt.AlignmentFlag.AlignCenter)
    lab.setStyleSheet("background: transparent; border: none;")
    if path.is_file():
        pm = QPixmap(str(path))
        if not pm.isNull():
            lab.setPixmap(
                pm.scaled(
                    size,
                    size,
                    Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation,
                )
            )
            return lab
    lab.setText("·")
    return lab


class _NavItem(QFrame):
    selected = Signal()

    def __init__(self, icon_path: Path, title: str, subtitle: str = ""):
        super().__init__()
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self._on = False
        self.setFixedHeight(_T["nav_h"])
        h = QHBoxLayout(self)
        h.setContentsMargins(12, 8, 14, 8)
        h.setSpacing(12)
        h.addWidget(_side_icon(icon_path, 24))
        tv = QVBoxLayout()
        tv.setSpacing(0)
        t = QLabel(title)
        t.setStyleSheet(
            f"color: {_T['text']}; font-family: {_T['font']}; font-size: 13px; "
            f"font-weight: 600; background: transparent; border: none;"
        )
        tv.addWidget(t)
        if subtitle:
            st = QLabel(subtitle)
            st.setStyleSheet(
                f"color: {_T['subtle']}; font-family: {_T['font']}; font-size: 10px; "
                f"background: transparent; border: none; padding-top: 1px;"
            )
            tv.addWidget(st)
        h.addLayout(tv, 1)
        self._paint()

    def _paint(self) -> None:
        x = _T
        if self._on:
            self.setStyleSheet(
                f"QFrame {{ background: #E0E0E0; border: none; border-radius: {x['r_md']}; "
                f"border-left: 3px solid {x['accent']}; }}"
            )
        else:
            self.setStyleSheet(
                f"QFrame {{ background: transparent; border: none; border-radius: {x['r_md']}; "
                f"border-left: 3px solid transparent; }}"
                f"QFrame:hover {{ background: {x['btn_secondary']}; }}"
            )

    def set_selected(self, on: bool) -> None:
        self._on = on
        self._paint()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.selected.emit()
        super().mouseReleaseEvent(event)


def _text_view_dialog(parent: QWidget, title: str, body: str) -> None:
    dlg = QDialog(parent)
    dlg.setWindowTitle(title)
    dlg.setModal(True)
    dlg.resize(560, 420)
    x = _T
    dlg.setStyleSheet(f"QDialog {{ background: {x['bg_card']}; }}")
    v = QVBoxLayout(dlg)
    v.setContentsMargins(20, 20, 20, 16)
    v.setSpacing(12)
    te = QTextEdit()
    te.setReadOnly(True)
    te.setPlainText(body)
    te.setStyleSheet(
        f"""
        QTextEdit {{
            background: {x['bg_page']};
            border: 1px solid {x['line']};
            border-radius: {x['r_md']};
            padding: 12px;
            font-family: Consolas, 'Cascadia Mono', ui-monospace, monospace;
            font-size: 11px;
            color: {x['text']};
        }}
        """
    )
    v.addWidget(te, 1)
    bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Close)
    bb.rejected.connect(dlg.reject)
    v.addWidget(bb)
    dlg.exec()


class ZenDevicesDialog(QDialog):
    """Modal de configuración: impresoras y lector (sección hardware de caja)."""

    @staticmethod
    def _geometry() -> tuple[int, int, int, int]:
        app = QApplication.instance()
        scr = app.primaryScreen() if app else None
        if scr is None:
            return 440, 360, 800, 560
        ag = scr.availableGeometry()
        pad = 40
        max_w = max(380, ag.width() - pad)
        max_h = max(320, ag.height() - pad)
        min_w = min(440, max_w)
        min_h = min(360, max_h)
        w = min(820, int(ag.width() * 0.88), max_w)
        h = min(580, int(ag.height() * 0.78), max_h)
        return min_w, min_h, max(min_w, w), max(min_h, h)

    def _center(self, parent: QWidget | None) -> None:
        if parent is not None:
            try:
                pr = parent.frameGeometry()
                if pr.isValid() and pr.width() > 0:
                    g = self.frameGeometry()
                    g.moveCenter(pr.center())
                    self.move(g.topLeft())
                    return
            except Exception:
                pass
        app = QApplication.instance()
        scr = app.primaryScreen() if app else None
        if scr:
            ag = scr.availableGeometry()
            g = self.frameGeometry()
            g.moveCenter(ag.center())
            self.move(g.topLeft())

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self.setWindowTitle("Configuración")
        self.setWindowIcon(_printer_window_icon())
        self.setWindowFlags(
            self.windowFlags() | Qt.WindowType.WindowMinMaxButtonsHint
        )
        self.setModal(True)
        mw, mh, rw, rh = self._geometry()
        self.setMinimumSize(mw, mh)
        self.resize(rw, rh)
        self._center(parent)

        x = _T
        self.setStyleSheet(
            f"""
            QDialog {{ background: {x['bg_page']}; }}
            QMessageBox {{ background: {x['bg_card']}; }}
            QMessageBox QLabel {{
                color: {x['text']};
                font-family: {x['font']};
                font-size: 12px;
            }}
            QMessageBox QPushButton {{
                background: {x['btn_secondary']};
                border: 1px solid {x['line_strong']};
                border-radius: {x['r_sm']};
                padding: 8px 20px;
                min-width: 88px;
                font-family: {x['font']};
                font-size: 12px;
            }}
            QMessageBox QPushButton:default {{
                background: {x['accent']};
                color: #FFFFFF;
                border: none;
            }}
            """
        )

        self._status = QLabel("")
        self._status.setWordWrap(True)
        self._status.setMinimumHeight(18)
        self._status.setStyleSheet(
            f"color: {x['subtle']}; font-family: {x['font']}; font-size: 11px; "
            f"padding: {x['space_2']}px 0 0 0; background: transparent; border: none;"
        )
        self._status_timer = QTimer(self)
        self._status_timer.setSingleShot(True)
        self._status_timer.timeout.connect(lambda: self._status.setText(""))

        def set_status(msg: str, *, ms: int = 5000) -> None:
            self._status.setText(msg)
            self._status_timer.stop()
            if ms > 0:
                self._status_timer.start(ms)

        self._set_status = set_status

        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # —— Barra lateral ——
        side = QWidget()
        side.setFixedWidth(x["sidebar_w"])
        side.setStyleSheet(f"background: {x['bg_sidebar']};")
        sl = QVBoxLayout(side)
        sl.setContentsMargins(16, x["space_5"], 12, x["space_4"])
        sl.setSpacing(x["space_3"])

        side_head = QLabel("CONFIGURACIÓN")
        side_head.setStyleSheet(
            f"color: {x['subtle']}; font-family: {x['font']}; font-size: 10px; "
            f"font-weight: 700; letter-spacing: 0.12em; background: transparent; border: none;"
        )
        sl.addWidget(side_head)
        side_sub = QLabel("Hardware de caja")
        side_sub.setStyleSheet(
            f"color: {x['muted']}; font-family: {x['font']}; font-size: 11px; "
            f"line-height: 1.35; background: transparent; border: none; padding: 0 0 4px 0;"
        )
        sl.addWidget(side_sub)
        sl.addWidget(_line_h())

        self._nav_print = _NavItem(
            ZEN_HW_IMPRESORA_PNG,
            "Impresoras",
            "Etiquetas y tickets",
        )
        self._nav_scan = _NavItem(
            ZEN_HW_LECTOR_PNG,
            "Lector en caja",
            "Código de barras",
        )
        sl.addWidget(self._nav_print)
        sl.addWidget(self._nav_scan)
        sl.addStretch(1)
        root.addWidget(side)

        div = QFrame()
        div.setFixedWidth(1)
        div.setStyleSheet(f"background: {x['line']}; border: none;")
        root.addWidget(div)

        # —— Área principal ——
        main = QWidget()
        main.setStyleSheet(f"background: {x['bg_page']};")
        ml = QVBoxLayout(main)
        ml.setContentsMargins(x["space_5"], x["space_5"], x["space_5"], x["space_3"])
        ml.setSpacing(0)

        self._stack = QStackedWidget()
        self._stack.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self._stack.setStyleSheet("background: transparent;")
        self._stack.setSizePolicy(
            QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding
        )

        host = QWidget()
        host.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        hl = QVBoxLayout(host)
        hl.setContentsMargins(0, 0, 0, 0)
        hl.addWidget(self._stack)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        # Sin esto, un clic en la tarjeta (barras, textos) deja el foco en el scroll/viewport
        # y el lector USB manda teclas ahí: no aparecen en el QLineEdit.
        scroll.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        scroll.viewport().setFocusPolicy(Qt.FocusPolicy.NoFocus)
        scroll.setStyleSheet(
            "QScrollArea { background: transparent; border: none; }"
            "QScrollArea > QWidget > QWidget { background: transparent; }"
        )
        scroll.setWidget(host)
        ml.addWidget(scroll, 1)
        ml.addWidget(self._status)

        page_p, page_s, scan_lector_le = self._build_pages(set_status)
        self._stack.addWidget(page_p)
        self._stack.addWidget(page_s)
        self._scan_lector_le = scan_lector_le

        root.addWidget(main, 1)

        def _focus_lector_line() -> None:
            w = getattr(self, "_scan_lector_le", None)
            if w is not None and w.isVisible():
                self.activateWindow()
                self.raise_()
                w.setFocus(Qt.FocusReason.ActiveWindowFocusReason)

        def select(i: int) -> None:
            self._stack.setCurrentIndex(i)
            self._nav_print.set_selected(i == 0)
            self._nav_scan.set_selected(i == 1)
            if i == 1:
                QTimer.singleShot(0, _focus_lector_line)

        self._nav_print.selected.connect(lambda: select(0))
        self._nav_scan.selected.connect(lambda: select(1))

        def _on_stack_page(idx: int) -> None:
            if idx == 1:
                QTimer.singleShot(0, _focus_lector_line)

        self._stack.currentChanged.connect(_on_stack_page)
        select(0)

        if hasattr(self, "_on_refresh"):
            self._on_refresh()

    def _build_pages(self, set_status):
        x = _T
        DEFAULT_ITEM = "Predeterminada de Windows"

        def fill_combo(cb: _ComboNoWheelUnlessFocused, saved: str) -> None:
            cb.blockSignals(True)
            cb.clear()
            cb.addItem(DEFAULT_ITEM, "")
            for n in sorted(hw_services.list_printer_names(), key=str.lower):
                cb.addItem(n, n)
            idx = 0
            if saved and saved in hw_services.list_printer_names():
                for i in range(cb.count()):
                    if cb.itemData(i) == saved:
                        idx = i
                        break
            cb.setCurrentIndex(idx)
            cb.blockSignals(False)

        # —————————————————————————————————————————————————————————
        # Impresoras
        # —————————————————————————————————————————————————————————
        page_p = QWidget()
        page_p.setStyleSheet("background: transparent;")
        pv = QVBoxLayout(page_p)
        pv.setContentsMargins(0, 0, 0, 0)
        pv.setSpacing(0)

        pv.addWidget(_lbl_page_title("Impresoras"))
        pv.addWidget(
            _lbl_lead(
                "Asigná qué impresora usa cada función en el local. Las opciones son las "
                "mismas que en Windows. Para una prueba sin papel, elegí «Microsoft Print to PDF»: "
                "se genera un PDF y se abre para guardarlo si querés."
            )
        )

        card1 = _card()
        c1 = QVBoxLayout(card1)
        c1.setContentsMargins(x["space_4"], x["space_4"], x["space_4"], x["space_4"])
        c1.setSpacing(x["space_3"])
        c1.addWidget(_lbl_card_title("Asignación"))

        grid = QGridLayout()
        grid.setHorizontalSpacing(x["space_3"])
        grid.setVerticalSpacing(x["space_3"])
        grid.setColumnStretch(1, 1)

        lb_l = QLabel("Etiquetas")
        lb_l.setStyleSheet(
            f"color: {x['text']}; font-family: {x['font']}; font-size: 13px; "
            f"background: transparent; border: none;"
        )
        lb_l.setToolTip("Típico: impresora térmica de etiquetas o código de barras")
        cb_labels = _ComboNoWheelUnlessFocused()
        cb_labels.setStyleSheet(_combo_qss())
        cb_labels.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        cb_labels.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        grid.addWidget(lb_l, 0, 0, Qt.AlignmentFlag.AlignVCenter)
        grid.addWidget(cb_labels, 0, 1)

        lb_t = QLabel("Tickets")
        lb_t.setStyleSheet(
            f"color: {x['text']}; font-family: {x['font']}; font-size: 13px; "
            f"background: transparent; border: none;"
        )
        lb_t.setToolTip("Recibos o comprobantes de venta")
        cb_tickets = _ComboNoWheelUnlessFocused()
        cb_tickets.setStyleSheet(_combo_qss())
        cb_tickets.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        cb_tickets.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        grid.addWidget(lb_t, 1, 0, Qt.AlignmentFlag.AlignVCenter)
        grid.addWidget(cb_tickets, 1, 1)

        c1.addLayout(grid)
        pv.addWidget(card1)

        card2 = _card()
        c2 = QVBoxLayout(card2)
        c2.setContentsMargins(x["space_4"], x["space_4"], x["space_4"], x["space_4"])
        c2.setSpacing(x["space_3"])
        c2.addWidget(_lbl_card_title("Acciones"))

        row1 = QHBoxLayout()
        row1.setSpacing(x["space_2"])
        btn_refresh = QPushButton("Actualizar lista")
        btn_refresh.setStyleSheet(_btn_qss())
        btn_refresh.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_diag = QPushButton("Diagnóstico…")
        btn_diag.setStyleSheet(_btn_qss())
        btn_diag.setCursor(Qt.CursorShape.PointingHandCursor)
        row1.addWidget(btn_refresh, 0)
        row1.addWidget(btn_diag, 0)
        row1.addStretch(1)
        c2.addLayout(row1)

        row2 = QHBoxLayout()
        row2.setSpacing(x["space_2"])
        btn_test_l = QPushButton("Probar etiquetas")
        btn_test_l.setStyleSheet(_btn_qss(primary=True))
        btn_test_l.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_test_t = QPushButton("Probar tickets")
        btn_test_t.setStyleSheet(_btn_qss(primary=True))
        btn_test_t.setCursor(Qt.CursorShape.PointingHandCursor)
        row2.addWidget(btn_test_l, 1)
        row2.addWidget(btn_test_t, 1)
        c2.addLayout(row2)

        pv.addWidget(card2)
        pv.addStretch(1)

        def on_refresh() -> None:
            fill_combo(cb_labels, zsettings.device_printer_labels_name())
            fill_combo(cb_tickets, zsettings.device_printer_tickets_name())
            set_status("Lista actualizada.", ms=3500)

        def save_labels(_: int = 0) -> None:
            d = cb_labels.currentData()
            zsettings.set_device_printer_labels_name(str(d) if d else "")

        def save_tickets(_: int = 0) -> None:
            d = cb_tickets.currentData()
            zsettings.set_device_printer_tickets_name(str(d) if d else "")

        def _after_print() -> None:
            self.raise_()
            self.activateWindow()
            QApplication.alert(self)

        def do_test_labels() -> None:
            name_s = str(cb_labels.currentData() or "")
            ok, msg = hw_services.send_test_print(
                name_s or None, job_title="Prueba — Etiquetas"
            )
            if ok:
                set_status(msg, ms=7000)
                _after_print()
            else:
                QMessageBox.warning(self, "Impresión", msg)

        def do_test_tickets() -> None:
            name_s = str(cb_tickets.currentData() or "")
            ok, msg = hw_services.send_test_print(
                name_s or None, job_title="Prueba — Tickets"
            )
            if ok:
                set_status(msg, ms=7000)
                _after_print()
            else:
                QMessageBox.warning(self, "Impresión", msg)

        def do_diag() -> None:
            body = "\n".join(hw_services.printer_info_lines())
            _text_view_dialog(self, "Impresoras instaladas", body)

        self._on_refresh = on_refresh
        btn_refresh.clicked.connect(on_refresh)
        cb_labels.currentIndexChanged.connect(save_labels)
        cb_tickets.currentIndexChanged.connect(save_tickets)
        btn_test_l.clicked.connect(do_test_labels)
        btn_test_t.clicked.connect(do_test_tickets)
        btn_diag.clicked.connect(do_diag)

        # —————————————————————————————————————————————————————————
        # Lector en caja (mismo concepto que pistola en tienda)
        # —————————————————————————————————————————————————————————
        page_s = QWidget()
        page_s.setStyleSheet("background: transparent;")
        sv = QVBoxLayout(page_s)
        sv.setContentsMargins(0, 0, 0, 0)
        sv.setSpacing(0)

        sv.addWidget(_lbl_page_title("Lector en caja"))
        sv.addWidget(
            _lbl_lead(
                "Generamos un código al azar y sus barras. Con el foco en el recuadro, escaneá: "
                "se comprueba solo (Enter del lector o al terminar de escribir). ✓ o ✗ aparece "
                "al lado del código de barras."
            )
        )

        expected_holder: dict[str, str] = {"payload": ""}

        card_gen = _card()
        cg = QVBoxLayout(card_gen)
        cg.setContentsMargins(x["space_4"], x["space_4"], x["space_4"], x["space_4"])
        cg.setSpacing(x["space_3"])

        cg.addWidget(_lbl_card_title("Probar lector con código en pantalla"))

        cg.addWidget(
            _lbl_body(
                "Code 128 en pantalla. Pasá el lector por las barras: verás puntos (•) mientras entra "
                "el código, sin el número legible. No hace falta ningún botón: al mandar Enter "
                "o cuando el lector deja de escribir, se envía y compara solo."
            )
        )

        barcode_img = QLabel()
        barcode_img.setMinimumHeight(140)
        barcode_img.setAlignment(Qt.AlignmentFlag.AlignCenter)
        barcode_img.setStyleSheet(
            f"background: #FFFFFF; border: 1px solid {x['line']}; "
            f"border-radius: {x['r_sm']}; padding: 12px;"
        )
        barcode_img.setWordWrap(True)
        result_badge = QLabel()
        result_badge.setFixedSize(56, 56)
        result_badge.setAlignment(Qt.AlignmentFlag.AlignCenter)
        result_badge.hide()
        row_barcode = QHBoxLayout()
        row_barcode.setSpacing(14)
        row_barcode.addWidget(barcode_img, 1)
        row_barcode.addWidget(
            result_badge,
            0,
            Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignRight,
        )
        cg.addLayout(row_barcode)

        code_holder: dict[str, str] = {"value": ""}
        code_show_lbl = QLabel()
        code_show_lbl.setWordWrap(True)
        code_show_lbl.setTextFormat(Qt.TextFormat.RichText)
        code_show_lbl.setStyleSheet(
            f"color: {x['text']}; font-family: {x['font']}; font-size: 13px; "
            f"line-height: 1.5; background: {x['bg_page']}; border: 1px solid {x['line']}; "
            f"border-radius: {x['r_sm']}; padding: 12px 14px;"
        )
        cg.addWidget(code_show_lbl)

        row_new = QHBoxLayout()
        row_new.addStretch(1)
        btn_nuevo = QPushButton("Generar otro código de prueba")
        btn_nuevo.setStyleSheet(_btn_qss(primary=True))
        btn_nuevo.setCursor(Qt.CursorShape.PointingHandCursor)
        row_new.addWidget(btn_nuevo, 0)
        row_new.addStretch(1)
        cg.addLayout(row_new)

        cg.addWidget(_line_h())

        cg.addWidget(
            _lbl_caption(
                "Al abrir esta pestaña el foco va al recuadro: escaneá las barras de arriba. "
                "El resultado ✓ o ✗ queda al lado de la imagen del código de barras."
            )
        )

        scan_le = QLineEdit()
        scan_le.setPlaceholderText("Listo para escanear…")
        scan_le.setClearButtonEnabled(False)
        scan_le.setText("")
        scan_le.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        # Puntos en lugar del número: se nota que llega el lector sin mostrar el código.
        scan_le.setEchoMode(QLineEdit.EchoMode.Password)
        _cap_bg = x["bg_card"]
        _ph = scan_le.palette()
        _ph.setColor(QPalette.ColorRole.PlaceholderText, QColor(x["subtle"]))
        scan_le.setPalette(_ph)
        scan_le.setStyleSheet(
            f"""
            QLineEdit {{
                background: {_cap_bg};
                border: 2px dashed {x['accent']};
                border-radius: {x['r_sm']};
                padding: 18px 16px;
                font-family: {x['font']};
                font-size: 18px;
                font-weight: 600;
                letter-spacing: 2px;
                color: {x['text']};
                selection-background-color: #CCE4F7;
                selection-color: {x['text']};
            }}
            QLineEdit:focus {{
                border: 2px solid {x['accent']};
                padding: 18px 16px;
            }}
            """
        )
        cg.addWidget(scan_le)

        # Si el lector no manda Enter, tras esta pausa sin nuevas teclas se envía igual (típico USB).
        _scan_idle_ms = 280
        scan_idle_timer = QTimer(scan_le)
        scan_idle_timer.setSingleShot(True)

        sv.addWidget(card_gen)

        sv.addStretch(1)

        def _apply_result_badge(ok: bool | None) -> None:
            if ok is None:
                result_badge.hide()
                result_badge.setText("")
            elif ok is True:
                result_badge.setText("✓")
                result_badge.setStyleSheet(
                    "QLabel { background: #DFF6DD; color: #0B5D0B; border-radius: 28px; "
                    "font-size: 30px; font-weight: 700; border: 1px solid #A7E0A3; }"
                )
                result_badge.show()
            else:
                result_badge.setText("✗")
                result_badge.setStyleSheet(
                    "QLabel { background: #FDE7E9; color: #A4262C; border-radius: 28px; "
                    "font-size: 28px; font-weight: 700; border: 1px solid #F1B5B8; }"
                )
                result_badge.show()

        def _render_code_display(norm: str) -> None:
            code_show_lbl.setText(
                "<span style='color:#4A4A4A;font-size:12px;'>Código generado (debe coincidir con la lectura):</span><br/>"
                f"<span style='font-size:22px;font-weight:700;letter-spacing:3px;"
                f"font-family:Consolas,'Cascadia Mono',monospace;color:#1A1A1A;'>{norm}</span>"
            )

        def refresh_barcode_image() -> None:
            raw = code_holder["value"]
            pm, err = barcode_probe.code128_to_pixmap(raw)
            if err:
                barcode_img.clear()
                barcode_img.setPixmap(QPixmap())
                barcode_img.setText(err)
                expected_holder["payload"] = ""
                code_show_lbl.setText(f"<span style='color:#A4262C;'>{err}</span>")
                _apply_result_badge(None)
                return
            barcode_img.setText("")
            # Copia para no depender del buffer del archivo temporal ya borrado.
            barcode_img.setPixmap(pm.copy() if not pm.isNull() else pm)
            norm = barcode_probe.normalize_code128_payload(raw)
            expected_holder["payload"] = norm
            _render_code_display(norm)
            _apply_result_badge(None)

        def _schedule_refocus_scan() -> None:
            """Tras leer o limpiar, Qt suele sacar el foco del QLineEdit; sin esto el lector USB no vuelve a escribir ahí."""
            win = scan_le.window()

            def _do() -> None:
                if win is not None:
                    win.activateWindow()
                    win.raise_()
                if scan_le.isVisible():
                    scan_le.setFocus(Qt.FocusReason.OtherReason)

            QTimer.singleShot(0, _do)

        def nuevo_codigo_prueba() -> None:
            scan_idle_timer.stop()
            scan_le.blockSignals(True)
            scan_le.clear()
            scan_le.blockSignals(False)
            code_holder["value"] = barcode_probe.random_numeric_payload()
            _apply_result_badge(None)
            refresh_barcode_image()
            barcode_img.update()
            code_show_lbl.update()
            card_gen.update()
            app = QApplication.instance()
            if app is not None:
                app.processEvents()
            _schedule_refocus_scan()

        def confirm_scan(*, silent_if_empty: bool = False) -> None:
            scan_idle_timer.stop()
            got_raw = scan_le.text().strip().replace("\r", "").replace("\n", "")
            got = barcode_probe.normalize_code128_payload(got_raw)
            if not got:
                _apply_result_badge(None)
                if not silent_if_empty:
                    set_status(
                        "Esperando lectura: el foco debe estar en el recuadro punteado.",
                        ms=4500,
                    )
                _schedule_refocus_scan()
                return
            exp = expected_holder["payload"]
            if not exp:
                _apply_result_badge(None)
                set_status("Generá un código de prueba primero.", ms=4000)
                scan_le.clear()
                _schedule_refocus_scan()
                return
            if got == exp:
                _apply_result_badge(True)
                set_status("Lectura correcta.", ms=4000)
            else:
                _apply_result_badge(False)
                set_status("La lectura no coincide con el código generado.", ms=5000)
            scan_le.clear()
            _schedule_refocus_scan()

        def _on_scan_text_changed(_: str) -> None:
            scan_idle_timer.stop()
            raw = scan_le.text().strip().replace("\r", "").replace("\n", "")
            got = barcode_probe.normalize_code128_payload(raw)
            if not got:
                return
            exp = expected_holder["payload"]
            if not exp:
                scan_idle_timer.start(_scan_idle_ms)
                return
            if len(got) < len(exp):
                # No cortar a medias: esperamos más teclas del lector.
                return
            # Ya hay al menos la longitud del código generado: pausa breve y enviar (lector sin Enter).
            scan_idle_timer.start(120)

        def _on_scan_idle() -> None:
            if not scan_le.text().strip():
                return
            confirm_scan(silent_if_empty=True)

        scan_le.textChanged.connect(_on_scan_text_changed)
        scan_idle_timer.timeout.connect(_on_scan_idle)
        scan_le.returnPressed.connect(lambda: confirm_scan(silent_if_empty=True))

        btn_nuevo.clicked.connect(nuevo_codigo_prueba)
        nuevo_codigo_prueba()

        return page_p, page_s, scan_le


def open_zen_devices_dialog(parent: QWidget | None = None) -> None:
    dlg = ZenDevicesDialog(parent)
    dlg.exec()
