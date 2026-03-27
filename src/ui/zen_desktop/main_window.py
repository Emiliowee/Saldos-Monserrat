"""
Ventana principal de la aplicación (interfaz Zen).
Layout: una barra lateral (menú + búsqueda) · tarjeta de contenido (colores logo).
"""
from __future__ import annotations

import os
import subprocess
import sys
import ctypes
import ctypes.wintypes
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QCursor, QIcon, QKeySequence, QShortcut
from PySide6.QtWidgets import (
    QApplication,
    QGraphicsDropShadowEffect,
    QHBoxLayout,
    QMainWindow,
    QMenu,
    QMessageBox,
    QPushButton,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

from src.core.paths import APP_WINDOW_ICON_PATH
from src.ui.zen_desktop.animations import StackFadeController
from src.ui.zen_desktop import settings as zsettings
from src.ui.zen_desktop import theme as Z
from src.ui.zen_desktop.config_page import build_zen_config_page
from src.ui.zen_desktop.cuaderno_page import CuadernoPage
from src.ui.zen_desktop.pages import build_home_page, build_page
from src.ui.zen_desktop.producto_page import ProductoPage
from src.ui.zen_desktop.widgets import (
    AutoHideZenTitleBar,
    ZenContentCard,
    ZenNavSideContainer,
)

# (clave, título en menú, icono, contenido de la tarjeta)
_NAV_DEF: list[tuple[str, str, str, tuple[str, str, str]]] = [
    (
        "dashboard",
        "Inicio",
        "fa5s.home",
        (
            "Inicio",
            "Resumen del día y accesos rápidos. El detalle de módulos se irá enlazando aquí conforme avance el desarrollo.",
            "fa5s.home",
        ),
    ),
    (
        "inventario",
        "Inventario",
        "fa5s.tags",
        (
            "Inventario",
            "Alta de productos con tags, vista de etiqueta y referencias — formulario en esta ventana (F2).",
            "fa5s.tags",
        ),
    ),
    (
        "pdv",
        "Punto de venta",
        "fa5s.shopping-cart",
        (
            "Punto de venta",
            "Cobros, tickets e impresión — en desarrollo. Misma base de datos que el ERP clásico.",
            "fa5s.shopping-cart",
        ),
    ),
    (
        "creditos",
        "Créditos",
        "fa5s.hand-holding-usd",
        (
            "Créditos",
            "Seguimiento de abonos y saldos de clientes — en desarrollo.",
            "fa5s.hand-holding-usd",
        ),
    ),
    (
        "cuaderno",
        "Cuaderno de precios",
        "fa5s.book-open",
        (
            "Cuaderno de precios",
            "Reglas y patrones para etiquetar — en desarrollo.",
            "fa5s.book-open",
        ),
    ),
    (
        "banqueta",
        "Banqueta",
        "fa5s.map-marked-alt",
        (
            "Banqueta",
            "Plano visual de la tienda. El modo mapa completo puede reutilizar el código legacy de Banqueta en el repo.",
            "fa5s.map-marked-alt",
        ),
    ),
    (
        "config",
        "Ajustes",
        "fa5s.cog",
        (
            "Configuración",
            "Etiquetas, impresoras y preferencias — en desarrollo.",
            "fa5s.cog",
        ),
    ),
]


class ZenShellWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Saldos Monserrat")
        self.setWindowFlags(
            Qt.WindowType.Window | Qt.WindowType.FramelessWindowHint
        )
        self.setMinimumSize(1024, 680)
        self.resize(1320, 800)
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet(f"QMainWindow {{ background: {Z.SHELL_BG}; border: none; }}")

        if APP_WINDOW_ICON_PATH.is_file():
            self.setWindowIcon(QIcon(str(APP_WINDOW_ICON_PATH)))

        geom = zsettings.load_window_geometry()
        if geom is not None:
            self.restoreGeometry(geom)

        # Layout tipo Zen: menú lateral a altura completa; minimizar/cerrar solo sobre el panel derecho.
        # Así al ocultar la barra de título no queda “hueco” ni desalineación encima del sidebar.
        root = QWidget()
        root.setStyleSheet(f"background: {Z.SHELL_BG};")
        self.setCentralWidget(root)
        root_h = QHBoxLayout(root)
        root_h.setContentsMargins(0, 0, 0, 0)
        root_h.setSpacing(0)

        nav_entries = [(d[0], d[1], d[2]) for d in _NAV_DEF if d[0] != "config"]
        stack_key_order = [d[0] for d in _NAV_DEF]
        self._nav_shell = ZenNavSideContainer(
            nav_entries,
            stack_key_order=stack_key_order,
            width=zsettings.nav_width(),
            on_settings=lambda: self._zen_go_nav_key("config"),
        )
        self._nav = self._nav_shell.nav
        self._nav.selected_index.connect(self._on_nav_index)
        self._nav.banqueta_nav_requested.connect(
            lambda: self._zen_go_nav_key("banqueta")
        )
        self._nav.collapse_changed.connect(zsettings.set_nav_sidebar_collapsed)
        if zsettings.nav_sidebar_collapsed():
            self._nav.set_collapsed(True, animated=False)
        if zsettings.nav_fully_hidden():
            self._nav_shell.apply_start_hidden()
        root_h.addWidget(self._nav_shell, 0)

        right = QWidget()
        right.setStyleSheet("background: transparent;")
        right_col = QVBoxLayout(right)
        right_col.setContentsMargins(0, 0, 0, 0)
        right_col.setSpacing(0)

        self._title_host = AutoHideZenTitleBar(
            self, pinned=zsettings.titlebar_always_visible()
        )
        right_col.addWidget(self._title_host, 0)

        shell = QWidget()
        shell.setStyleSheet("background: transparent;")
        sl = QVBoxLayout(shell)
        self._shell_lay = sl
        m = Z.SHELL_MARGIN
        ml = Z.SHELL_MARGIN_LEFT
        sl.setContentsMargins(ml, m, m, m)
        sl.setSpacing(0)

        self._card = ZenContentCard()
        cl = QVBoxLayout(self._card)
        cl.setContentsMargins(0, 0, 0, 0)
        cl.setSpacing(0)

        self._stack = QStackedWidget()
        self._stack.setStyleSheet("background: transparent;")
        self._producto_page: ProductoPage | None = None
        for d in _NAV_DEF:
            key = d[0]
            title, text, ico = d[3]
            if key == "dashboard":
                self._stack.addWidget(
                    build_home_page(
                        self._zen_go_nav_key,
                        on_quit=self.close,
                        on_open_devices=self._open_devices_modal,
                    )
                )
            elif key == "inventario":
                pp = ProductoPage()
                pp.navigate.connect(self._zen_go_nav_key)
                self._producto_page = pp
                self._stack.addWidget(pp)
            elif key == "cuaderno":
                self._stack.addWidget(CuadernoPage())
            elif key == "config":
                self._stack.addWidget(build_zen_config_page())
            else:
                self._stack.addWidget(build_page(title, text, ico))
        cl.addWidget(self._stack)

        sh = QGraphicsDropShadowEffect(self._card)
        # Sombra suave y baja: ilusión de lámina encastrada, no bloque flotando lejos.
        sh.setBlurRadius(26)
        sh.setOffset(0, 4)
        r, g, b = Z.CARD_SHADOW_RGB
        alpha = getattr(Z, "CARD_SHADOW_ALPHA", 48)
        sh.setColor(QColor(r, g, b, alpha))
        self._card.setGraphicsEffect(sh)

        sl.addWidget(self._card, 1)
        right_col.addWidget(shell, 1)
        root_h.addWidget(right, 1)

        # Altura real del área de título + margen superior del contenido cuando solo hay franja.
        self._title_host.title_compact_changed.connect(self._on_title_compact_changed)
        self._on_title_compact_changed(not zsettings.titlebar_always_visible())

        self._setup_title_bar_menus()

        self._anim = StackFadeController(
            self._stack, enabled=zsettings.animations_enabled()
        )

        self._nav.set_current_row(0)
        self._stack.setCurrentIndex(0)

        # Atajos alineados con los accesos rápidos del Inicio (F1–F4).
        for nav_key, seq in (
            ("pdv", "F1"),
            ("inventario", "F2"),
            ("creditos", "F3"),
            ("banqueta", "F4"),
        ):
            ks = QShortcut(QKeySequence(seq), self)
            ks.setContext(Qt.ShortcutContext.WindowShortcut)
            ks.activated.connect(lambda k=nav_key: self._zen_go_nav_key(k))

        self._setup_context_menu()

    def _setup_context_menu(self):
        self.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.customContextMenuRequested.connect(self._ctx_menu)

    def _title_menu_stylesheet(self) -> str:
        return f"""
            QMenu {{
                background: {Z.CARD_BG};
                color: {Z.NAV_TEXT};
                border: 1px solid {Z.NAV_BORDER};
                border-radius: 10px;
                padding: 4px 0;
            }}
            QMenu::item {{ padding: 6px 22px; }}
            QMenu::item:selected {{ background: {Z.PRIMARY_PALE}; color: {Z.PRIMARY}; }}
            """

    def _make_title_menu_button(self, label: str, menu: QMenu) -> QPushButton:
        b = QPushButton(label)
        b.setMenu(menu)
        b.setCursor(Qt.CursorShape.PointingHandCursor)
        b.setStyleSheet(
            f"""
            QPushButton {{
                background: transparent; border: none; border-radius: 4px;
                color: {Z.TITLEBAR_TEXT};
                font-family: {Z.FONT_UI};
                font-size: 11px;
                font-weight: 500;
                padding: 3px 8px;
            }}
            QPushButton:hover {{ background: {Z.TITLEBAR_BTN_HOVER}; }}
            QPushButton::menu-indicator {{ image: none; width: 0px; height: 0px; }}
            """
        )
        return b

    def _setup_title_bar_menus(self) -> None:
        lay = self._title_host.bar.title_menu_layout()
        qss = self._title_menu_stylesheet()

        m_file = QMenu(self)
        m_file.setStyleSheet(qss)
        m_file.addAction("Salir", QApplication.instance().quit)
        lay.addWidget(self._make_title_menu_button("Archivo", m_file))

        m_ver = QMenu(self)
        m_ver.setStyleSheet(qss)
        self._menu_act_anim = m_ver.addAction("Animaciones al cambiar de sección")
        self._menu_act_anim.setCheckable(True)
        self._menu_act_anim.toggled.connect(self._toggle_anim)
        self._menu_act_titlebar = m_ver.addAction("Barra de título siempre visible")
        self._menu_act_titlebar.setCheckable(True)
        self._menu_act_titlebar.toggled.connect(self._toggle_titlebar_pinned)
        m_ver.addSeparator()
        self._menu_act_banqueta_bar = m_ver.addAction(
            "Mostrar resumen Banqueta en la barra"
        )
        self._menu_act_banqueta_bar.setCheckable(True)
        self._menu_act_banqueta_bar.toggled.connect(self._toggle_banqueta_sidebar_block)
        m_ver.addSeparator()
        self._menu_act_max = m_ver.addAction("Maximizar ventana")
        self._menu_act_max.triggered.connect(self._menu_toggle_maximize)
        m_ver.aboutToShow.connect(self._sync_title_ver_menu)
        lay.addWidget(self._make_title_menu_button("Ver", m_ver))

        m_help = QMenu(self)
        m_help.setStyleSheet(qss)
        m_help.addAction("Acerca de…", self._menu_acerca_de)
        m_help.addAction("Documentación interfaz Zen…", self._menu_zen_docs)
        m_help.addSeparator()
        m_help.addAction("Atajos de teclado…", self._menu_atajos)
        lay.addWidget(self._make_title_menu_button("Ayuda", m_help))

    def _sync_title_ver_menu(self) -> None:
        self._menu_act_anim.blockSignals(True)
        self._menu_act_titlebar.blockSignals(True)
        self._menu_act_anim.setChecked(zsettings.animations_enabled())
        self._menu_act_titlebar.setChecked(zsettings.titlebar_always_visible())
        self._menu_act_anim.blockSignals(False)
        self._menu_act_titlebar.blockSignals(False)
        self._menu_act_max.setText(
            "Restaurar ventana" if self.isMaximized() else "Maximizar ventana"
        )
        self._menu_act_banqueta_bar.blockSignals(True)
        self._menu_act_banqueta_bar.setChecked(
            zsettings.nav_banqueta_sidebar_block_visible()
        )
        self._menu_act_banqueta_bar.blockSignals(False)

    def _menu_toggle_maximize(self) -> None:
        self._title_host.bar._toggle_max()

    def _menu_acerca_de(self) -> None:
        QMessageBox.about(
            self,
            "Acerca de",
            "<h3 style='margin:0'>Saldos Monserrat</h3>"
            "<p style='margin-top:8px'>Interfaz de escritorio. Comparte la base de datos "
            "y la carpeta <code>data/</code> con el resto del proyecto.</p>",
        )

    def _menu_zen_docs(self) -> None:
        readme = Path(__file__).resolve().parents[3] / "docs" / "zen_desktop" / "README.md"
        if not readme.is_file():
            QMessageBox.information(
                self,
                "Documentación",
                "No se encontró docs/zen_desktop/README.md en el proyecto.",
            )
            return
        try:
            if sys.platform == "win32":
                os.startfile(str(readme))
            elif sys.platform == "darwin":
                subprocess.run(["open", str(readme)], check=False)
            else:
                subprocess.run(["xdg-open", str(readme)], check=False)
        except Exception as e:
            QMessageBox.warning(
                self,
                "Documentación",
                f"No se pudo abrir el archivo:\n{e}",
            )

    def _menu_atajos(self) -> None:
        QMessageBox.information(
            self,
            "Atajos de teclado",
            "Los atajos globales se definirán aquí cuando enlacemos más pantallas.\n\n"
            "Por ahora: <b>clic derecho</b> en la ventana para opciones rápidas.",
        )

    def _ctx_menu(self, pos):
        m = QMenu(self)
        m.setStyleSheet(
            f"""
            QMenu {{
                background: {Z.CARD_BG};
                color: {Z.NAV_TEXT};
                border: 1px solid {Z.NAV_BORDER};
                border-radius: 10px;
                padding: 4px 0;
            }}
            QMenu::item {{ padding: 8px 24px; }}
            QMenu::item:selected {{ background: {Z.PRIMARY_PALE}; color: {Z.PRIMARY}; }}
            """
        )
        a_anim = m.addAction("Animaciones al cambiar de sección")
        a_anim.setCheckable(True)
        a_anim.setChecked(zsettings.animations_enabled())
        a_anim.toggled.connect(self._toggle_anim)
        a_bar = m.addAction("Barra de título siempre visible")
        a_bar.setCheckable(True)
        a_bar.setChecked(zsettings.titlebar_always_visible())
        a_bar.toggled.connect(self._toggle_titlebar_pinned)
        m.addSeparator()
        m.addAction("Salir", QApplication.instance().quit)
        m.exec(self.mapToGlobal(pos))

    def _toggle_anim(self, on: bool):
        zsettings.set_animations_enabled(on)
        self._anim.set_animations_enabled(on)

    def _toggle_titlebar_pinned(self, on: bool):
        zsettings.set_titlebar_always_visible(on)
        self._title_host.set_pinned(on)

    def _toggle_banqueta_sidebar_block(self, on: bool) -> None:
        zsettings.set_nav_banqueta_sidebar_block_visible(on)
        self._nav.apply_banqueta_sidebar_block_visibility()

    def _on_title_compact_changed(self, compact: bool) -> None:
        """Márgenes del área de la tarjeta (más pegado arriba si solo hay franja de título)."""
        m = Z.SHELL_MARGIN
        ml = Z.SHELL_MARGIN_LEFT
        top = Z.SHELL_MARGIN_TOP_COMPACT if compact else m
        self._shell_lay.setContentsMargins(ml, top, m, m)

    def _toggle_nav_collapsed(self, on: bool):
        self._nav.set_collapsed(on, animated=True)

    def _open_devices_modal(self) -> None:
        from src.ui.zen_desktop.devices_modal import open_zen_devices_dialog

        open_zen_devices_dialog(self)

    def _zen_go_nav_key(self, key: str) -> None:
        """Navegación desde la página Inicio (mismas claves que `_NAV_DEF`)."""
        for idx, row in enumerate(_NAV_DEF):
            if row[0] == key:
                self._on_nav_index(idx)
                return

    def _on_nav_index(self, index: int):
        if index < 0 or index >= self._stack.count():
            return
        self._nav.set_current_row(index)
        self._anim.show_index(index)

    def closeEvent(self, event):
        zsettings.save_window_geometry(self.saveGeometry())
        super().closeEvent(event)

    def showEvent(self, event):
        super().showEvent(event)
        self._apply_dwm()

    def _apply_dwm(self):
        if sys.platform != "win32":
            return
        try:
            hwnd = int(self.winId())

            class MARGINS(ctypes.Structure):
                _fields_ = [
                    ("left", ctypes.c_int),
                    ("right", ctypes.c_int),
                    ("top", ctypes.c_int),
                    ("bottom", ctypes.c_int),
                ]

            ctypes.windll.dwmapi.DwmExtendFrameIntoClientArea(
                hwnd, ctypes.byref(MARGINS(0, 0, 0, 0))
            )
            DWMWCP_DONOTROUND = 1
            pref = ctypes.c_int(DWMWCP_DONOTROUND)
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hwnd, 33, ctypes.byref(pref), ctypes.sizeof(pref)
            )
        except Exception:
            pass

    def nativeEvent(self, eventType, message):
        if sys.platform == "win32" and eventType == b"windows_generic_MSG":
            try:
                msg = ctypes.wintypes.MSG.from_address(int(message))
                if msg.message == 0x0084 and not self.isMaximized():
                    pos = QCursor.pos()
                    rx = pos.x() - self.x()
                    ry = pos.y() - self.y()
                    B = 8
                    w, h = self.width(), self.height()
                    if rx < B and ry < B:
                        return True, 13
                    if rx > w - B and ry < B:
                        return True, 14
                    if rx < B and ry > h - B:
                        return True, 16
                    if rx > w - B and ry > h - B:
                        return True, 17
                    if ry > h - B:
                        return True, 15
                    if rx < B:
                        return True, 10
                    if rx > w - B:
                        return True, 11
            except Exception:
                pass
        return super().nativeEvent(eventType, message)
