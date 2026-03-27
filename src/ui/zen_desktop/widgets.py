"""Layout rail + menú + tarjeta — colores logo (papel, rosa, dorado)."""
from __future__ import annotations

from typing import Callable

import qtawesome as qta

from PySide6.QtCore import (
    QAbstractAnimation,
    QPoint,
    QEasingCurve,
    QSize,
    QPropertyAnimation,
    QTimer,
    Qt,
    QEvent,
    Signal,
    QVariantAnimation,
)
from PySide6.QtGui import QCursor, QMouseEvent, QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMenu,
    QPushButton,
    QStackedWidget,
    QToolButton,
    QVBoxLayout,
    QWidget,
)

from src.core.paths import LOGO_PATH
from src.ui.zen_desktop import settings as zsettings
from src.ui.zen_desktop import theme as Z


class ZenHwStatusStrip(QWidget):
    """Indicadores discretos: impresora y lector (misma idea que el ERP clásico)."""

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self.setObjectName("ZenHwStatusStrip")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet(
            f"""
            QWidget#ZenHwStatusStrip {{
                background: rgba(58, 53, 48, 0.05);
                border-radius: 5px;
                border: 1px solid rgba(58, 53, 48, 0.08);
            }}
            """
        )
        self.setFixedHeight(max(18, Z.TITLEBAR_H - 10))
        lay = QHBoxLayout(self)
        lay.setContentsMargins(6, 0, 6, 0)
        lay.setSpacing(6)
        self._labels: list[QLabel] = []
        tips = [
            ("fa5s.print", "Impresora"),
            ("fa5s.barcode", "Lector de códigos"),
        ]
        for icon_name, tip in tips:
            lbl = QLabel()
            lbl.setToolTip(tip)
            lbl.setStyleSheet("background: transparent; border: none;")
            try:
                lbl.setPixmap(
                    qta.icon(
                        icon_name,
                        color=Z.TITLEBAR_BTN,
                        options=[{"opacity": 0.4}],
                    ).pixmap(12, 12)
                )
            except Exception:
                lbl.setText("·")
            lay.addWidget(lbl)
            self._labels.append(lbl)


class ZenTitleBar(QFrame):
    """Barra clara acorde al logo; arrastre y controles."""

    def __init__(
        self,
        window: QWidget,
        title: str = "Saldos Monserrat",
        *,
        show_logo: bool = True,
        show_hw_status: bool = True,
    ):
        super().__init__()
        self._win = window
        self._drag: QPoint | None = None
        self._hw_strip: QWidget | None = (
            ZenHwStatusStrip(self) if show_hw_status else None
        )
        self.setFixedHeight(Z.TITLEBAR_H)
        self.setStyleSheet(
            f"""
            ZenTitleBar {{
                background: {Z.TITLEBAR_BG};
                border: none;
            }}
            """
        )
        row = QHBoxLayout(self)
        row.setContentsMargins(8, 0, 4, 0)
        row.setSpacing(6)

        if show_logo and LOGO_PATH.is_file():
            logo_lbl = QLabel()
            logo_sz = max(20, min(24, Z.TITLEBAR_H - 8))
            logo_lbl.setFixedSize(logo_sz, logo_sz)
            logo_lbl.setScaledContents(True)
            logo_lbl.setStyleSheet(
                f"background: transparent; border-radius: {logo_sz // 2}px;"
            )
            px = QPixmap(str(LOGO_PATH)).scaled(
                logo_sz,
                logo_sz,
                Qt.AspectRatioMode.KeepAspectRatioByExpanding,
                Qt.TransformationMode.SmoothTransformation,
            )
            logo_lbl.setPixmap(px)
            row.addWidget(logo_lbl, 0, Qt.AlignmentFlag.AlignVCenter)

        t = QLabel(title)
        t.setStyleSheet(
            f"color: {Z.TITLEBAR_TEXT}; font-family: {Z.FONT_UI}; "
            f"font-size: {Z.FONT_SIZE_CAPTION}px; font-weight: 600; letter-spacing: 0.03em;"
        )
        row.addWidget(t)
        self._menu_host = QWidget()
        self._menu_host.setStyleSheet("background: transparent;")
        self._menu_lay = QHBoxLayout(self._menu_host)
        self._menu_lay.setContentsMargins(6, 0, 0, 0)
        self._menu_lay.setSpacing(2)
        self._menu_lay.setAlignment(Qt.AlignmentFlag.AlignVCenter)
        row.addWidget(self._menu_host, 0, Qt.AlignmentFlag.AlignVCenter)
        row.addStretch()
        self._add_window_buttons(row)

    def title_menu_layout(self) -> QHBoxLayout:
        """Hueco para Archivo / Ver / Ayuda (rellenar desde la ventana principal)."""
        return self._menu_lay

    def _add_window_buttons(self, row: QHBoxLayout) -> None:
        win = self._win
        if self._hw_strip is not None:
            row.addWidget(self._hw_strip, 0, Qt.AlignmentFlag.AlignVCenter)
            row.addSpacing(6)

        def btn(sym: str, slot: Callable[[], None]) -> QPushButton:
            b = QPushButton(sym)
            bh = max(26, Z.TITLEBAR_H - 4)
            b.setFixedSize(40, bh)
            b.setCursor(QCursor(Qt.CursorShape.ArrowCursor))
            b.setStyleSheet(
                f"""
                QPushButton {{
                    background: transparent; border: none; color: {Z.TITLEBAR_BTN};
                    font-size: 13px; font-family: "Segoe MDL2 Assets","Segoe UI Symbol";
                }}
                QPushButton:hover {{
                    background: rgba(58, 53, 48, 0.09);
                    color: {Z.NAV_TEXT};
                }}
                """
            )
            b.clicked.connect(slot)
            return b

        row.addWidget(btn("−", win.showMinimized))
        self._max = btn("□", self._toggle_max)
        row.addWidget(self._max)
        close_b = QPushButton("×")
        close_b.setFixedSize(40, max(26, Z.TITLEBAR_H - 4))
        close_b.setCursor(QCursor(Qt.CursorShape.ArrowCursor))
        close_b.setStyleSheet(
            f"""
            QPushButton {{
                background: transparent; border: none; color: {Z.TITLEBAR_BTN};
                font-size: 13px; font-family: "Segoe MDL2 Assets","Segoe UI Symbol";
            }}
            QPushButton:hover {{
                background: rgba(168, 74, 74, 0.14);
                color: #8A3D3D;
            }}
            """
        )
        close_b.clicked.connect(win.close)
        row.addWidget(close_b)

    def _toggle_max(self):
        if self._win.isMaximized():
            self._win.showNormal()
            self._max.setText("□")
        else:
            self._win.showMaximized()
            self._max.setText("❐")

    def mousePressEvent(self, e: QMouseEvent):
        if e.button() == Qt.MouseButton.LeftButton:
            self._drag = e.globalPosition().toPoint() - self._win.frameGeometry().topLeft()
        super().mousePressEvent(e)

    def mouseMoveEvent(self, e: QMouseEvent):
        if self._drag is not None and e.buttons() & Qt.MouseButton.LeftButton:
            if self._win.isMaximized():
                self._win.showNormal()
            self._win.move(e.globalPosition().toPoint() - self._drag)
        super().mouseMoveEvent(e)

    def mouseReleaseEvent(self, e: QMouseEvent):
        self._drag = None
        super().mouseReleaseEvent(e)

    def mouseDoubleClickEvent(self, e: QMouseEvent):
        if e.button() == Qt.MouseButton.LeftButton:
            self._toggle_max()
        super().mouseDoubleClickEvent(e)


class ZenTitleStrip(QWidget):
    """Franja fina arriba: arrastrar ventana y desplegar barra completa al pasar el ratón."""

    expand_requested = Signal()

    def __init__(self, window: QWidget):
        super().__init__(window)
        self._win = window
        self._drag: QPoint | None = None
        self.setFixedHeight(Z.TITLEBAR_STRIP_H)
        self.setStyleSheet(f"background: {Z.TITLEBAR_BG}; border: none;")
        self.setMouseTracking(True)

    def enterEvent(self, event):
        super().enterEvent(event)
        self.expand_requested.emit()

    def mousePressEvent(self, e: QMouseEvent):
        if e.button() == Qt.MouseButton.LeftButton:
            self._drag = e.globalPosition().toPoint() - self._win.frameGeometry().topLeft()
        super().mousePressEvent(e)

    def mouseMoveEvent(self, e: QMouseEvent):
        if self._drag is not None and e.buttons() & Qt.MouseButton.LeftButton:
            if self._win.isMaximized():
                self._win.showNormal()
            self._win.move(e.globalPosition().toPoint() - self._drag)
        super().mouseMoveEvent(e)

    def mouseReleaseEvent(self, e: QMouseEvent):
        self._drag = None
        super().mouseReleaseEvent(e)

    def mouseDoubleClickEvent(self, e: QMouseEvent):
        if e.button() == Qt.MouseButton.LeftButton:
            stack = self.parentWidget()
            host = stack.parentWidget() if stack else None
            if host is not None and hasattr(host, "_bar"):
                host._bar._toggle_max()
        super().mouseDoubleClickEvent(e)


class AutoHideZenTitleBar(QWidget):
    """
    Barra de título que se reduce a una franja fina; reaparece al pasar el ratón arriba.
    Si está fijada, la barra queda siempre visible.
    """

    # True = solo franja (barra corta); el panel central puede reducir margen superior.
    title_compact_changed = Signal(bool)

    def __init__(self, window: QWidget, pinned: bool = False):
        super().__init__(window)
        self._win = window
        self._pinned = pinned
        self._timer = QTimer(self)
        self._timer.setSingleShot(True)
        self._timer.setInterval(480)
        self._timer.timeout.connect(self._try_collapse)

        self._stack = QStackedWidget()
        self._strip = ZenTitleStrip(window)
        self._strip.expand_requested.connect(self._expand)
        self._bar = ZenTitleBar(window, show_logo=True)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        lay.addWidget(self._stack)

        self._stack.addWidget(self._strip)
        self._stack.addWidget(self._bar)
        self._bar.installEventFilter(self)

        self.set_pinned(pinned)

    def _sync_title_stack_height(self) -> None:
        """Evita que QStackedWidget reserve altura de la barra completa cuando solo se ve la franja."""
        if self._pinned or self._stack.currentIndex() == 1:
            h = Z.TITLEBAR_H
            compact = False
        else:
            h = Z.TITLEBAR_STRIP_H
            compact = True
        self._stack.setFixedHeight(h)
        self.title_compact_changed.emit(compact)

    @property
    def bar(self) -> ZenTitleBar:
        return self._bar

    def set_pinned(self, pinned: bool):
        self._pinned = bool(pinned)
        self._timer.stop()
        self._stack.setCurrentIndex(1 if self._pinned else 0)
        self._sync_title_stack_height()

    def _expand(self):
        self._timer.stop()
        self._stack.setCurrentIndex(1)
        self._sync_title_stack_height()

    def _schedule_collapse(self):
        if self._pinned:
            return
        self._timer.start()

    def _try_collapse(self):
        if self._pinned:
            return
        if QApplication.activePopupWidget() is not None:
            self._timer.start(200)
            return
        self._stack.setCurrentIndex(0)
        self._sync_title_stack_height()

    def eventFilter(self, obj, ev):
        if obj is self._bar and ev.type() == QEvent.Type.Leave:
            self._schedule_collapse()
        return super().eventFilter(obj, ev)


class ZenSearchField(QLineEdit):
    """Búsqueda redonda sobre papel claro."""

    def __init__(self, placeholder: str = "Buscar sección…"):
        super().__init__()
        self.setPlaceholderText(placeholder)
        self.setClearButtonEnabled(True)
        self.setStyleSheet(
            f"""
            ZenSearchField {{
                background: {Z.SEARCH_BG};
                border: 1px solid {Z.SEARCH_BORDER};
                border-radius: {Z.SEARCH_RADIUS}px;
                padding: 6px 12px;
                font-family: {Z.FONT_UI};
                font-size: {Z.FONT_SIZE_SEARCH}px;
                color: {Z.NAV_TEXT};
                min-height: 18px;
            }}
            ZenSearchField:focus {{
                border: 2px solid {Z.PRIMARY};
                background: #FFFFFF;
            }}
            """
        )


class _BanquetaFolderHeader(QFrame):
    """Icono de carpeta + nombre «Banqueta» (sin flecha)."""

    clicked = Signal()

    def __init__(self):
        super().__init__()
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self._expanded_ui = False
        h = QHBoxLayout(self)
        h.setContentsMargins(5, 4, 6, 4)
        h.setSpacing(6)
        self._ico = QLabel()
        self._ico.setFixedSize(18, 18)
        self._ico.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._ico.setStyleSheet("background: transparent; border: none;")
        h.addWidget(self._ico, 0, Qt.AlignmentFlag.AlignVCenter)
        self._title = QLabel("Banqueta")
        self._title.setStyleSheet(
            f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI}; "
            f"font-size: {Z.FONT_SIZE_NAV}px; font-weight: 600; "
            f"background: transparent; border: none;"
        )
        h.addWidget(self._title, 1, Qt.AlignmentFlag.AlignVCenter)
        self.set_expanded(False)

    def _apply_style(self, *, active: bool) -> None:
        bg = "rgba(58, 53, 48, 0.06)" if active else "transparent"
        self.setStyleSheet(
            f"""
            QFrame {{
                background: {bg};
                border: none;
                border-radius: 8px;
            }}
            QFrame:hover {{
                background: {Z.NAV_ROW_HOVER};
            }}
            """
        )

    def set_expanded(self, expanded: bool) -> None:
        self._expanded_ui = expanded
        self._apply_style(active=expanded)
        try:
            icon_name = "fa5s.folder-open" if expanded else "fa5s.folder"
            self._ico.setPixmap(
                qta.icon(icon_name, color=Z.SIDEBAR_ICON).pixmap(14, 14)
            )
        except Exception:
            self._ico.setText("▣" if expanded else "▢")

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.clicked.emit()
        super().mouseReleaseEvent(event)


class ZenBanquetaFolderWidget(QFrame):
    """
    Carpeta tipo Zen: animación de despliegue, contenido con sangría, permanece abierta
    mientras el estado guardado esté abierto (QSettings).
    """

    navigate_banqueta = Signal()
    bar_remove_requested = Signal()

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self.setObjectName("ZenBanquetaFolder")
        self.setStyleSheet(
            """
            QFrame#ZenBanquetaFolder {
                background: transparent;
                border: none;
            }
            """
        )
        self._expanded = False
        self._anim: QPropertyAnimation | None = None
        self._body_target_h = 0
        _muted = (
            f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; "
            f"font-size: 10px; line-height: 1.35; background: transparent; border: none;"
        )

        v = QVBoxLayout(self)
        v.setContentsMargins(0, 0, 0, 0)
        v.setSpacing(0)

        self._head_row = QWidget()
        self._head_row.setMouseTracking(True)
        hl = QHBoxLayout(self._head_row)
        hl.setContentsMargins(0, 0, 0, 0)
        hl.setSpacing(0)
        self._header = _BanquetaFolderHeader()
        self._header.clicked.connect(self._toggle)
        self._header.setToolTip("Mostrar u ocultar resumen de Banqueta")
        hl.addWidget(self._header, 1, Qt.AlignmentFlag.AlignVCenter)

        self._menu_btn = QToolButton()
        self._menu_btn.setAutoRaise(True)
        self._menu_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._menu_btn.setToolTip("Opciones del bloque Banqueta")
        self._menu_btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        try:
            self._menu_btn.setIcon(
                qta.icon("fa5s.ellipsis-v", color=Z.NAV_TEXT_MUTED)
            )
            self._menu_btn.setIconSize(QSize(14, 14))
        except Exception:
            self._menu_btn.setText("⋮")
        self._menu_btn.setStyleSheet(
            """
            QToolButton {
                border: none;
                border-radius: 4px;
                padding: 2px 4px;
                background: transparent;
            }
            QToolButton:hover {
                background: rgba(58, 53, 48, 0.08);
            }
            """
        )
        ctx = QMenu(self)
        ctx.addAction("Colapsar carpeta", self._menu_collapse_folder)
        ctx.addSeparator()
        rm = ctx.addAction("Quitar de la barra lateral…")
        rm.setToolTip("Podés volver a mostrarlo en Ver → Mostrar resumen Banqueta en la barra")
        rm.triggered.connect(self._emit_remove_from_bar)
        self._menu_btn.setMenu(ctx)
        self._menu_btn.setPopupMode(
            QToolButton.ToolButtonPopupMode.InstantPopup
        )
        hl.addWidget(self._menu_btn, 0, Qt.AlignmentFlag.AlignTop)
        self._menu_btn.hide()
        self._head_row.installEventFilter(self)
        self._menu_btn.installEventFilter(self)
        v.addWidget(self._head_row)

        # Cuerpo desplegable: sin líneas decorativas; solo texto y enlace.
        self._body = QWidget()
        self._body.setObjectName("ZenBanquetaFolderDrop")
        self._body.setMaximumHeight(0)
        self._body.setStyleSheet(
            """
            QWidget#ZenBanquetaFolderDrop {
                border: none;
                background: transparent;
            }
            """
        )
        bl = QVBoxLayout(self._body)
        bl.setContentsMargins(2, 2, 4, 6)
        bl.setSpacing(4)
        self._stats_lbl = QLabel()
        self._stats_lbl.setWordWrap(True)
        self._stats_lbl.setStyleSheet(_muted)
        self._plans_lbl = QLabel()
        self._plans_lbl.setWordWrap(True)
        self._plans_lbl.setStyleSheet(_muted)
        self._open_btn = QPushButton("Abrir sección Banqueta")
        self._open_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._open_btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self._open_btn.setAutoDefault(False)
        self._open_btn.setDefault(False)
        self._open_btn.setStyleSheet(
            f"""
            QPushButton {{
                background: transparent;
                border: none;
                color: {Z.PRIMARY};
                font-family: {Z.FONT_UI};
                font-size: 11px;
                font-weight: 600;
                padding: 2px 0 0 0;
                text-align: left;
            }}
            QPushButton:hover {{ color: {Z.PRIMARY_HOVER}; }}
            """
        )
        self._open_btn.clicked.connect(self.navigate_banqueta.emit)
        bl.addWidget(self._stats_lbl)
        bl.addWidget(self._plans_lbl)
        bl.addWidget(self._open_btn)
        v.addWidget(self._body)

    def eventFilter(self, obj, ev):  # noqa: ANN001
        if obj in (self._head_row, self._menu_btn):
            if ev.type() == QEvent.Type.Enter:
                self._menu_btn.show()
            elif ev.type() == QEvent.Type.Leave:
                QTimer.singleShot(100, self._maybe_hide_menu_btn)
        return super().eventFilter(obj, ev)

    def _maybe_hide_menu_btn(self) -> None:
        if QApplication.activePopupWidget() is not None:
            QTimer.singleShot(200, self._maybe_hide_menu_btn)
            return
        w = QApplication.widgetAt(QCursor.pos())
        cur: QWidget | None = w
        while cur is not None:
            if cur in (self._head_row, self._menu_btn):
                return
            cur = cur.parentWidget()
        self._menu_btn.hide()

    def _menu_collapse_folder(self) -> None:
        if self._expanded:
            self._toggle()

    def _emit_remove_from_bar(self) -> None:
        self.bar_remove_requested.emit()

    def refresh_data(self) -> None:
        from src.ui.zen_desktop.banqueta_sidebar_data import zen_banqueta_snapshot

        n_bq, n_disp, planos = zen_banqueta_snapshot()
        self._stats_lbl.setText(
            f"Prendas en estado «en banqueta»: {n_bq}\n"
            f"Disponibles para colocar en plano: {n_disp}"
        )
        if not planos:
            self._plans_lbl.setText("Planos de tienda: todavía no hay ninguno creado.")
        else:
            lines = [f"· {nombre} — {cnt} en plano" for nombre, cnt in planos[:5]]
            if len(planos) > 5:
                lines.append(f"· …y {len(planos) - 5} planos más")
            self._plans_lbl.setText("\n".join(lines))

    def load_initial(self) -> None:
        """Al arrancar: restaurar carpeta abierta/cerrada desde ajustes (sin animación)."""
        if zsettings.nav_banqueta_folder_open():
            self._apply_open_state()

    def sync_from_settings(self) -> None:
        """Tras volver del menú colapsado: mismo estado guardado."""
        if zsettings.nav_banqueta_folder_open():
            self._apply_open_state()
        else:
            self._apply_closed_state(save=False)

    def _apply_open_state(self) -> None:
        if self._anim is not None:
            self._anim.stop()
            self._anim = None
        self._expanded = True
        self._header.set_expanded(True)
        self.refresh_data()
        self._body.show()
        self._body.setMaximumHeight(16777215)
        zsettings.set_nav_banqueta_folder_open(True)

    def _apply_closed_state(self, *, save: bool) -> None:
        if self._anim is not None:
            self._anim.stop()
            self._anim = None
        self._expanded = False
        self._header.set_expanded(False)
        self._body.setMaximumHeight(0)
        if save:
            zsettings.set_nav_banqueta_folder_open(False)

    def _measure_body_height(self) -> int:
        self._body.setMaximumHeight(16777215)
        self._body.adjustSize()
        h = self._body.sizeHint().height()
        self._body.setMaximumHeight(0)
        return min(260, max(56, h))

    def _toggle(self) -> None:
        if (
            self._anim is not None
            and self._anim.state() == QAbstractAnimation.State.Running
        ):
            return
        if self._expanded:
            cur = self._body.height()
            if cur < 12:
                cur = self._body_target_h or self._measure_body_height()
            self._run_height_anim(cur, 0, persist_open=False)
            self._expanded = False
            self._header.set_expanded(False)
        else:
            self._expanded = True
            self._header.set_expanded(True)
            self.refresh_data()
            self._body.show()
            self._body.setMaximumHeight(0)
            target = self._measure_body_height()
            self._body_target_h = target
            self._run_height_anim(0, target, persist_open=True)

    def _run_height_anim(
        self, start: int, end: int, *, persist_open: bool
    ) -> None:
        if self._anim is not None:
            self._anim.stop()
            self._anim = None
        self._body.setMaximumHeight(start)
        self._anim = QPropertyAnimation(self._body, b"maximumHeight", self)
        self._anim.setDuration(280)
        self._anim.setEasingCurve(QEasingCurve.Type.OutCubic)
        self._anim.setStartValue(start)
        self._anim.setEndValue(end)

        def _done() -> None:
            self._anim = None
            if end == 0:
                self._body.setMaximumHeight(0)
                zsettings.set_nav_banqueta_folder_open(False)
            else:
                # Permanece abierta: sin tope fijo para que no “se cierre” sola.
                self._body.setMaximumHeight(16777215)
                if persist_open:
                    zsettings.set_nav_banqueta_folder_open(True)

        self._anim.finished.connect(_done)
        self._anim.start()


class ZenNavPane(QFrame):
    """
    Menú lateral + lista.
    Botón arriba: colapsar a solo iconos (Zen compacto); el panel derecho usa el espacio que libera.
    """

    selected_index = Signal(int)
    collapse_changed = Signal(bool)
    # True = menú retraído al borde (modo Zen); False = menú fijo visible.
    sidebar_retract_toggled = Signal(bool)
    banqueta_nav_requested = Signal()

    def __init__(
        self,
        entries: list[tuple[str, str, str]],
        *,
        stack_key_order: list[str],
        width: int | None = None,
        on_quit: Callable[[], None] | None = None,
        on_settings: Callable[[], None] | None = None,
    ):
        super().__init__()
        self._stack_key_order = list(stack_key_order)
        self._keys = [e[0] for e in entries]
        self._titles = [e[1] for e in entries]
        self._icons = [e[2] for e in entries]
        self._expanded_w = width if width is not None else Z.NAV_W
        self._collapsed = False
        self._width_anim: QVariantAnimation | None = None

        self.setFixedWidth(self._expanded_w)
        self.setStyleSheet(f"ZenNavPane {{ background: {Z.NAV_BG}; border: none; }}")
        self._root_lay = QVBoxLayout(self)
        # Márgenes algo más ajustados para alinear con barra estrecha tipo Zen (~228px).
        self._root_lay.setContentsMargins(6, 8, 6, 8)
        self._root_lay.setSpacing(6)

        # Plegar / desplegar menú (la tarjeta derecha crece al colapsar)
        head = QHBoxLayout()
        head.setContentsMargins(0, 0, 0, 0)
        self._toggle_btn = QPushButton()
        self._toggle_btn.setFixedSize(30, 28)
        self._toggle_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._toggle_btn.setToolTip("Ocultar menú lateral (solo iconos)")
        self._toggle_btn.setStyleSheet(
            f"""
            QPushButton {{
                background: transparent; border: none; border-radius: 8px;
                color: {Z.NAV_TEXT_MUTED};
            }}
            QPushButton:hover {{ background: {Z.NAV_ROW_HOVER}; color: {Z.PRIMARY}; }}
            """
        )
        self._toggle_btn.clicked.connect(self._on_toggle_collapse)
        head.addWidget(self._toggle_btn, 0, Qt.AlignmentFlag.AlignLeft)

        self._hide_edge_btn = QPushButton()
        self._hide_edge_btn.setCheckable(True)
        self._hide_edge_btn.setFixedSize(26, 26)
        self._hide_edge_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._hide_edge_btn.setStyleSheet(
            f"""
            QPushButton {{
                background: transparent; border: none; border-radius: 8px;
                color: {Z.NAV_TEXT_MUTED};
            }}
            QPushButton:hover {{
                background: {Z.NAV_ROW_HOVER}; color: {Z.NAV_TEXT};
            }}
            QPushButton:checked {{
                background: rgba(58, 53, 48, 0.05);
                border: 1px solid rgba(58, 53, 48, 0.09);
                color: rgba(110, 104, 96, 0.72);
            }}
            QPushButton:checked:hover {{
                background: rgba(58, 53, 48, 0.08);
                border-color: rgba(58, 53, 48, 0.12);
                color: {Z.NAV_TEXT_MUTED};
            }}
            """
        )
        self._sync_hide_edge_appearance()
        self._hide_edge_btn.toggled.connect(self._on_hide_edge_toggled)
        head.addWidget(self._hide_edge_btn, 0, Qt.AlignmentFlag.AlignLeft)

        head.addStretch()
        self._root_lay.addLayout(head)
        self._update_toggle_icon()

        self._search = ZenSearchField()
        self._root_lay.addWidget(self._search)

        self._sep = QFrame()
        self._sep.setFixedHeight(2)
        self._sep.setStyleSheet(
            f"""
            QFrame {{
                background: qlineargradient(x1:0,y1:0,x2:1,y2:0,
                    stop:0 {Z.GOLD},
                    stop:0.35 rgba(196, 96, 126, 0.35),
                    stop:1 transparent);
                border: none;
                border-radius: 1px;
            }}
            """
        )
        self._root_lay.addWidget(self._sep)

        self._banqueta_caption = QLabel("BANQUETA · RESUMEN")
        self._banqueta_caption.setStyleSheet(
            f"color: rgba(58, 53, 48, 0.34); font-family: {Z.FONT_UI}; "
            f"font-size: 8px; font-weight: 700; letter-spacing: 0.14em; "
            f"background: transparent; border: none; padding: 4px 2px 0 4px;"
        )
        self._root_lay.addWidget(self._banqueta_caption)

        self._banqueta_folder = ZenBanquetaFolderWidget(self)
        self._banqueta_folder.navigate_banqueta.connect(self.banqueta_nav_requested.emit)
        self._banqueta_folder.bar_remove_requested.connect(
            self._on_banqueta_remove_from_bar_request
        )
        self._root_lay.addWidget(self._banqueta_folder)
        self._banqueta_folder.load_initial()

        self._nav_list_caption = QLabel("NAVEGACIÓN")
        self._nav_list_caption.setStyleSheet(
            f"color: rgba(58, 53, 48, 0.34); font-family: {Z.FONT_UI}; "
            f"font-size: 8px; font-weight: 700; letter-spacing: 0.18em; "
            f"background: transparent; border: none; padding: 8px 2px 2px 4px;"
        )
        self._root_lay.addWidget(self._nav_list_caption)

        self._nav_list_rule = QFrame()
        self._nav_list_rule.setFixedHeight(1)
        self._nav_list_rule.setStyleSheet(
            "background: rgba(58, 53, 48, 0.1); border: none;"
        )
        self._root_lay.addWidget(self._nav_list_rule)

        self._empty_filter = QLabel(
            "Ninguna sección coincide con la búsqueda.\nProbá con otra palabra o borrá el filtro."
        )
        self._empty_filter.setWordWrap(True)
        self._empty_filter.setStyleSheet(
            f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; "
            f"font-size: 10pt; padding: 4px 2px 8px 2px; background: transparent;"
        )
        self._empty_filter.hide()
        self._root_lay.addWidget(self._empty_filter)

        self._list = QListWidget()
        self._list.setFrameShape(QFrame.Shape.NoFrame)
        self._list.setSpacing(2)
        _ic = getattr(Z, "NAV_LIST_ICON", 18)
        self._list.setIconSize(QSize(_ic, _ic))
        self._list.setUniformItemSizes(True)
        self._list.setWordWrap(False)
        self._list.setTextElideMode(Qt.TextElideMode.ElideRight)
        self._list.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self._list.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self._apply_list_style_expanded()
        for key, title, icon_name in entries:
            it = QListWidgetItem(f"  {title}")
            it.setData(Qt.ItemDataRole.UserRole, key)
            try:
                it.setIcon(qta.icon(icon_name, color=Z.SIDEBAR_ICON))
            except Exception:
                pass
            it.setTextAlignment(
                int(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
            )
            self._list.addItem(it)
        self._list.currentRowChanged.connect(self._on_row)
        self._root_lay.addWidget(self._list, 1)

        self._search.textChanged.connect(self._filter)

        # Pie: ajustes (tuerca) a la izquierda, Salir discreto a la derecha.
        self._footer = QWidget()
        fl = QHBoxLayout(self._footer)
        fl.setContentsMargins(2, 6, 2, 4)
        fl.setSpacing(4)
        self._btn_settings = QPushButton()
        self._btn_settings.setFixedSize(32, 28)
        self._btn_settings.setCursor(Qt.CursorShape.PointingHandCursor)
        self._btn_settings.setToolTip("Configuración")
        self._btn_settings.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self._btn_settings.setAutoDefault(False)
        self._btn_settings.setDefault(False)
        try:
            self._btn_settings.setIcon(
                qta.icon("fa5s.cog", color=Z.NAV_TEXT_MUTED)
            )
            self._btn_settings.setIconSize(QSize(16, 16))
        except Exception:
            self._btn_settings.setText("⚙")
        self._btn_settings.setStyleSheet(
            f"""
            QPushButton {{
                background: transparent;
                border: none;
                border-radius: 6px;
                padding: 4px;
            }}
            QPushButton:hover {{ background: {Z.NAV_ROW_HOVER}; }}
            """
        )
        if on_settings is not None:
            self._btn_settings.clicked.connect(on_settings)
        else:
            self._btn_settings.hide()
        fl.addWidget(
            self._btn_settings, 0, Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter
        )
        fl.addStretch(1)
        self._btn_quit = QPushButton("Salir")
        self._btn_quit.setCursor(Qt.CursorShape.PointingHandCursor)
        self._btn_quit.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self._btn_quit.setAutoDefault(False)
        self._btn_quit.setDefault(False)
        self._btn_quit.setStyleSheet(
            f"""
            QPushButton {{
                background: transparent;
                border: none;
                color: rgba(150, 95, 95, 0.78);
                font-family: {Z.FONT_UI};
                font-size: 11px;
                font-weight: 500;
                padding: 4px 6px;
            }}
            QPushButton:hover {{
                color: rgba(130, 78, 78, 0.92);
                text-decoration: underline;
            }}
            """
        )
        if on_quit is not None:
            self._btn_quit.clicked.connect(on_quit)
        else:
            self._btn_quit.hide()
        fl.addWidget(
            self._btn_quit, 0, Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
        )
        self._root_lay.addWidget(self._footer, 0)

        self.apply_banqueta_sidebar_block_visibility()

    def apply_banqueta_sidebar_block_visibility(self) -> None:
        """Muestra u oculta el bloque Banqueta (título + carpeta) según ajustes."""
        vis = zsettings.nav_banqueta_sidebar_block_visible()
        self._banqueta_caption.setVisible(vis)
        self._banqueta_folder.setVisible(vis)

    def _on_banqueta_remove_from_bar_request(self) -> None:
        zsettings.set_nav_banqueta_sidebar_block_visible(False)
        self.apply_banqueta_sidebar_block_visibility()

    def _stack_index_for_key(self, key: str) -> int:
        try:
            return self._stack_key_order.index(key)
        except ValueError:
            return -1

    def _apply_list_style_expanded(self) -> None:
        self._list.setStyleSheet(
            f"""
            QListWidget {{
                background: transparent;
                border: none;
                outline: none;
                font-family: {Z.FONT_UI};
                font-size: {Z.FONT_SIZE_NAV}px;
            }}
            QListWidget::item {{
                color: {Z.NAV_TEXT};
                padding: 6px 10px 6px 8px;
                border-radius: 8px;
                min-height: {Z.ROW_HEIGHT}px;
                border: none;
                border-left: 2px solid transparent;
            }}
            QListWidget::item:hover {{
                background: {Z.NAV_ROW_HOVER};
            }}
            QListWidget::item:selected {{
                background: {Z.NAV_ROW_SELECTED};
                color: {Z.PRIMARY};
                border: none;
                border-left: 2px solid {Z.GOLD};
                padding: 6px 10px 6px 8px;
                font-weight: 600;
            }}
            """
        )

    def _apply_list_style_collapsed(self) -> None:
        self._list.setStyleSheet(
            f"""
            QListWidget {{
                background: transparent;
                border: none;
                outline: none;
                font-family: {Z.FONT_UI};
            }}
            QListWidget::item {{
                color: {Z.NAV_TEXT};
                padding: 8px 4px;
                border-radius: 8px;
                min-height: 40px;
                border: none;
                border-left: 2px solid transparent;
            }}
            QListWidget::item:hover {{
                background: {Z.NAV_ROW_HOVER};
            }}
            QListWidget::item:selected {{
                background: {Z.NAV_ROW_SELECTED};
                color: {Z.PRIMARY};
                border: none;
                border-left: 2px solid {Z.GOLD};
                padding: 8px 4px;
                font-weight: 600;
            }}
            QListWidget QScrollBar:vertical {{
                width: 0px;
                max-width: 0px;
                background: transparent;
            }}
            QListWidget QScrollBar::handle:vertical {{
                min-height: 0px;
                background: transparent;
            }}
            """
        )

    def _update_toggle_icon(self) -> None:
        try:
            name = "fa5s.chevron-left" if not self._collapsed else "fa5s.chevron-right"
            self._toggle_btn.setIcon(qta.icon(name, color=Z.NAV_TEXT_MUTED))
            self._toggle_btn.setIconSize(QSize(15, 15))
        except Exception:
            self._toggle_btn.setText("«" if not self._collapsed else "»")
        self._toggle_btn.setToolTip(
            "Ocultar menú lateral (solo iconos)"
            if not self._collapsed
            else "Mostrar menú lateral completo"
        )

    def _on_toggle_collapse(self) -> None:
        self.set_collapsed(not self._collapsed, animated=True)

    @property
    def is_collapsed(self) -> bool:
        return self._collapsed

    def set_collapsed(self, collapsed: bool, *, animated: bool = True) -> None:
        if collapsed == self._collapsed:
            return
        zc = Z.NAV_COLLAPSED_W

        if collapsed:
            self._collapsed = True
            self._banqueta_folder.hide()
            self._banqueta_caption.hide()
            self._footer.hide()
            self._nav_list_caption.hide()
            self._nav_list_rule.hide()
            self._list.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
            self._search.setVisible(False)
            self._sep.setVisible(False)
            self._empty_filter.hide()
            self._apply_list_style_collapsed()
            _ic = getattr(Z, "NAV_LIST_ICON", 18)
            self._list.setIconSize(QSize(_ic, _ic))
            for i in range(self._list.count()):
                it = self._list.item(i)
                it.setToolTip(self._titles[i])
                it.setText("")
                it.setTextAlignment(
                    int(Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignVCenter)
                )
                try:
                    it.setIcon(qta.icon(self._icons[i], color=Z.SIDEBAR_ICON))
                except Exception:
                    pass
            self._update_toggle_icon()

            def _done_collapse() -> None:
                self.collapse_changed.emit(True)

            self._run_width_anim(self.width(), zc, animated, on_finished=_done_collapse)
        else:
            self._collapsed = False
            self._update_toggle_icon()

            def _after_expand() -> None:
                self._search.setVisible(True)
                self._sep.setVisible(True)
                self.apply_banqueta_sidebar_block_visibility()
                self._footer.show()
                self._nav_list_caption.show()
                self._nav_list_rule.show()
                self._banqueta_folder.sync_from_settings()
                self._list.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
                self._apply_list_style_expanded()
                _ic = getattr(Z, "NAV_LIST_ICON", 18)
                self._list.setIconSize(QSize(_ic, _ic))
                for i in range(self._list.count()):
                    it = self._list.item(i)
                    it.setToolTip("")
                    it.setText(f"  {self._titles[i]}")
                    it.setTextAlignment(
                        int(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
                    )
                    try:
                        it.setIcon(qta.icon(self._icons[i], color=Z.SIDEBAR_ICON))
                    except Exception:
                        pass
                self._filter(self._search.text())
                self.collapse_changed.emit(False)

            self._run_width_anim(self.width(), self._expanded_w, animated, on_finished=_after_expand)

    def _run_width_anim(
        self,
        start: int,
        end: int,
        animated: bool,
        on_finished: Callable[[], None] | None = None,
    ) -> None:
        if self._width_anim is not None:
            self._width_anim.stop()
            self._width_anim = None
        if not animated or start == end:
            self.setFixedWidth(end)
            if on_finished:
                on_finished()
            return

        self._width_anim = QVariantAnimation(self)
        self._width_anim.setDuration(240)
        self._width_anim.setStartValue(start)
        self._width_anim.setEndValue(end)
        self._width_anim.setEasingCurve(QEasingCurve.Type.OutCubic)

        def on_val(v):
            self.setFixedWidth(int(v))

        self._width_anim.valueChanged.connect(on_val)

        def done():
            self._width_anim = None
            if on_finished:
                on_finished()

        self._width_anim.finished.connect(done)
        self._width_anim.start()

    def _sync_hide_edge_appearance(self) -> None:
        checked = self._hide_edge_btn.isChecked()
        # Activo = gris muy suave (casi imperceptible), no rosa de acento.
        col = "#9A9590" if checked else Z.NAV_TEXT_MUTED
        try:
            self._hide_edge_btn.setIcon(qta.icon("fa5s.angle-double-left", color=col))
            self._hide_edge_btn.setIconSize(QSize(14, 14))
        except Exception:
            self._hide_edge_btn.setText("≪")
        self._hide_edge_btn.setToolTip(
            "Menú al borde activo — clic para dejarlo fijo visible"
            if checked
            else "Ocultar menú al borde (pasá el ratón por la franja izquierda para verlo)"
        )

    def _on_hide_edge_toggled(self, checked: bool) -> None:
        self._sync_hide_edge_appearance()
        self.sidebar_retract_toggled.emit(checked)

    def set_retract_checked(self, on: bool) -> None:
        """Sincroniza el interruptor sin emitir señal (p. ej. al restaurar estado guardado)."""
        self._hide_edge_btn.blockSignals(True)
        self._hide_edge_btn.setChecked(on)
        self._hide_edge_btn.blockSignals(False)
        self._sync_hide_edge_appearance()

    def is_retract_checked(self) -> bool:
        return self._hide_edge_btn.isChecked()

    def _on_row(self, row: int):
        if row < 0:
            return
        it = self._list.item(row)
        if it is None:
            return
        key = it.data(Qt.ItemDataRole.UserRole)
        if not key:
            return
        idx = self._stack_index_for_key(str(key))
        if idx >= 0:
            self.selected_index.emit(idx)

    def _filter(self, text: str):
        if self._collapsed:
            for i in range(self._list.count()):
                self._list.item(i).setHidden(False)
            return
        t = text.strip().lower()
        any_vis = False
        for i in range(self._list.count()):
            item = self._list.item(i)
            vis = t in item.text().lower().strip() or not t
            item.setHidden(not vis)
            if vis:
                any_vis = True
        self._empty_filter.setVisible(bool(t) and not any_vis)

    def set_current_row(self, stack_index: int) -> None:
        """Selecciona la fila cuya clave coincide con `stack_key_order[stack_index]`."""
        self._list.blockSignals(True)
        if stack_index < 0 or stack_index >= len(self._stack_key_order):
            self._list.setCurrentRow(-1)
            self._list.blockSignals(False)
            return
        want_key = self._stack_key_order[stack_index]
        found = -1
        for i in range(self._list.count()):
            it = self._list.item(i)
            k = it.data(Qt.ItemDataRole.UserRole)
            if k is not None and str(k) == want_key:
                found = i
                break
        if found >= 0:
            self._list.setCurrentRow(found)
        else:
            self._list.setCurrentRow(-1)
        self._list.blockSignals(False)

    def current_key(self) -> str | None:
        row = self._list.currentRow()
        if row < 0:
            return None
        it = self._list.item(row)
        if it is None:
            return None
        k = it.data(Qt.ItemDataRole.UserRole)
        return str(k) if k else None


class ZenNavEdgeGrip(QWidget):
    """Franja izquierda (estilo Zen): al pasar el ratón aparece el menú si está retraído al borde."""

    def __init__(self, container: "ZenNavSideContainer"):
        super().__init__(container)
        self._container = container
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet(f"background: {Z.SHELL_BG}; border: none;")
        self.setMouseTracking(True)

    def enterEvent(self, event):
        super().enterEvent(event)
        self._container.on_grip_enter()


class ZenNavSideContainer(QWidget):
    """
    [Borde sensible | menú]: interruptor « para retraer al borde; peek al pasar el ratón (Zen).
    """

    def __init__(
        self,
        entries: list[tuple[str, str, str]],
        *,
        stack_key_order: list[str],
        width: int | None = None,
        on_quit: Callable[[], None] | None = None,
        on_settings: Callable[[], None] | None = None,
        parent: QWidget | None = None,
    ):
        super().__init__(parent)
        self._float_peek = False
        self._hide_anim = False

        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        self._grip = ZenNavEdgeGrip(self)
        self._nav = ZenNavPane(
            entries,
            stack_key_order=stack_key_order,
            width=width,
            on_quit=on_quit,
            on_settings=on_settings,
        )
        lay.addWidget(self._grip)
        lay.addWidget(self._nav)

        self._leave_timer = QTimer(self)
        self._leave_timer.setSingleShot(True)
        self._leave_timer.setInterval(320)
        self._leave_timer.timeout.connect(self._maybe_end_float_peek)

        self._nav.sidebar_retract_toggled.connect(self._on_retract_toggled)

        self._grip.setFixedWidth(0)

    @property
    def nav(self) -> ZenNavPane:
        return self._nav

    def apply_start_hidden(self) -> None:
        self._nav.set_retract_checked(True)
        self._apply_hidden_state()

    def _is_sidebar_hidden_at_edge(self) -> bool:
        """Menú ya pegado al borde (sin animación útil)."""
        return (
            not self._nav.isVisible()
            and self._nav.width() <= 1
            and self._grip.width() >= Z.NAV_EDGE_GRIP_W - 1
        )

    def _finalize_hidden_at_edge(self) -> None:
        if not self._nav.is_retract_checked():
            return
        self._nav.setFixedWidth(0)
        self._nav.setVisible(False)
        self._grip.setFixedWidth(Z.NAV_EDGE_GRIP_W)
        self._float_peek = False
        zsettings.set_nav_fully_hidden(True)

    def leaveEvent(self, event):
        super().leaveEvent(event)
        if self._float_peek:
            self._leave_timer.start()

    def enterEvent(self, event):
        super().enterEvent(event)
        self._leave_timer.stop()

    def _maybe_end_float_peek(self) -> None:
        if not self._float_peek or self._hide_anim:
            return
        if not self._nav.is_retract_checked():
            self._float_peek = False
            return
        w = QApplication.widgetAt(QCursor.pos())
        cur: QWidget | None = w
        while cur is not None:
            if cur is self:
                return
            cur = cur.parentWidget()
        self._animate_hide_to_edge()

    def on_grip_enter(self) -> None:
        self._leave_timer.stop()
        if not self._nav.is_retract_checked():
            return
        target = Z.NAV_COLLAPSED_W if self._nav.is_collapsed else self._nav._expanded_w
        if self._nav.isVisible() and self._nav.width() > 2:
            return
        self._float_peek = True
        self._nav.setVisible(True)
        self._grip.setFixedWidth(0)
        cur = max(self._nav.width(), 0)
        # Ya desplegado al ancho correcto (p. ej. tras resize): sin animación.
        if cur > 0 and abs(cur - target) <= 2:
            self._nav.setFixedWidth(target)
            return
        self._nav.setFixedWidth(0)
        use_anim = abs(target) > 2
        self._nav._run_width_anim(0, target, use_anim, on_finished=None)

    def _on_retract_toggled(self, retracted: bool) -> None:
        if retracted:
            self._animate_hide_to_edge()
        else:
            self._expand_sidebar_from_toggle()

    def _expand_sidebar_from_toggle(self) -> None:
        self._leave_timer.stop()
        self._float_peek = False
        self._hide_anim = False
        target = Z.NAV_COLLAPSED_W if self._nav.is_collapsed else self._nav._expanded_w
        cur = max(self._nav.width(), 0)
        self._nav.setVisible(True)
        self._grip.setFixedWidth(0)
        # Ya visible con el ancho objetivo (p. ej. modo peek): no animar de nuevo.
        if cur > 0 and abs(cur - target) <= 2:
            self._nav.setFixedWidth(target)
            zsettings.set_nav_fully_hidden(False)
            return
        start = 0 if cur < 2 else cur
        use_anim = abs(start - target) > 2
        self._nav.setFixedWidth(start)
        self._nav._run_width_anim(start, target, use_anim, on_finished=None)
        zsettings.set_nav_fully_hidden(False)

    def _animate_hide_to_edge(self) -> None:
        if self._is_sidebar_hidden_at_edge():
            self._float_peek = False
            zsettings.set_nav_fully_hidden(True)
            return

        w = max(self._nav.width(), 0)
        # Ya colapsado/invisible: solo asegurar estado sin animar.
        if w <= 0 and not self._nav.isVisible():
            self._hide_anim = False
            self._finalize_hidden_at_edge()
            return

        self._hide_anim = True

        def done() -> None:
            self._hide_anim = False
            if not self._nav.is_retract_checked():
                return
            self._finalize_hidden_at_edge()

        if w <= 0:
            done()
        else:
            use_anim = w > 2
            self._nav._run_width_anim(w, 0, use_anim, on_finished=done)

    def _apply_hidden_state(self) -> None:
        self._leave_timer.stop()
        self._float_peek = False
        self._hide_anim = False
        self._nav.setVisible(False)
        self._nav.setFixedWidth(0)
        self._grip.setFixedWidth(Z.NAV_EDGE_GRIP_W)


class ZenContentCard(QFrame):
    """Panel derecho — superficie más clara y ligeramente brillante frente al shell (tipo Zen)."""

    def __init__(self):
        super().__init__()
        self.setObjectName("ZenContentCard")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet(
            f"""
            QFrame#ZenContentCard {{
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 {Z.CARD_BG_TOP},
                    stop:0.35 {Z.CARD_BG_MID},
                    stop:1 {Z.CARD_BG_BOTTOM});
                border: 1px solid {Z.CARD_BORDER};
                border-radius: {Z.CARD_RADIUS}px;
            }}
            """
        )
