"""Persistencia específica del shell Zen (no pisa preferencias del main clásico)."""
from __future__ import annotations

from PySide6.QtCore import QByteArray, QSettings

_ORG = "SaldosMonserrat"
_APP = "BazarMonserratZenShell"

KEY_WIN_GEOM = "window/geometry"
KEY_ANIMATIONS = "ui/animations_enabled"
KEY_NAV_WIDTH = "ui/nav_width"
KEY_TITLEBAR_PINNED = "ui/titlebar_always_visible"
KEY_NAV_COLLAPSED = "ui/nav_sidebar_collapsed"
# True = menú oculto al borde (solo reaparece al pasar el ratón por la franja izquierda).
KEY_NAV_FULLY_HIDDEN = "ui/nav_sidebar_fully_hidden"
# Carpeta Banqueta en el sidebar: expandida o cerrada (como Zen).
KEY_NAV_BANQUETA_FOLDER_OPEN = "ui/nav_banqueta_folder_expanded"


def _s() -> QSettings:
    return QSettings(_ORG, _APP)


def save_window_geometry(geom: QByteArray) -> None:
    _s().setValue(KEY_WIN_GEOM, geom)


def load_window_geometry() -> QByteArray | None:
    v = _s().value(KEY_WIN_GEOM)
    if isinstance(v, QByteArray) and not v.isEmpty():
        return v
    return None


def animations_enabled() -> bool:
    return _s().value(KEY_ANIMATIONS, True) not in (False, "false", 0, "0")


def set_animations_enabled(on: bool) -> None:
    _s().setValue(KEY_ANIMATIONS, on)


def nav_width() -> int:
    v = _s().value(KEY_NAV_WIDTH, 228)
    try:
        w = int(v)
        return max(200, min(340, w))
    except (TypeError, ValueError):
        return 228


def set_nav_width(w: int) -> None:
    _s().setValue(KEY_NAV_WIDTH, max(200, min(340, w)))


def titlebar_always_visible() -> bool:
    """True = barra título siempre visible; False = solo franja fina hasta pasar el ratón arriba."""
    v = _s().value(KEY_TITLEBAR_PINNED, False)
    return v in (True, "true", 1, "1")


def set_titlebar_always_visible(on: bool) -> None:
    _s().setValue(KEY_TITLEBAR_PINNED, on)


def nav_sidebar_collapsed() -> bool:
    """Menú lateral reducido a solo iconos."""
    v = _s().value(KEY_NAV_COLLAPSED, False)
    return v in (True, "true", 1, "1")


def set_nav_sidebar_collapsed(on: bool) -> None:
    _s().setValue(KEY_NAV_COLLAPSED, on)


def nav_fully_hidden() -> bool:
    v = _s().value(KEY_NAV_FULLY_HIDDEN, False)
    return v in (True, "true", 1, "1")


def set_nav_fully_hidden(on: bool) -> None:
    _s().setValue(KEY_NAV_FULLY_HIDDEN, on)


def nav_banqueta_folder_open() -> bool:
    v = _s().value(KEY_NAV_BANQUETA_FOLDER_OPEN, False)
    return v in (True, "true", 1, "1")


def set_nav_banqueta_folder_open(on: bool) -> None:
    _s().setValue(KEY_NAV_BANQUETA_FOLDER_OPEN, on)


# False = bloque Banqueta (etiqueta + carpeta) quitado de la barra hasta Ver → reactivar.
KEY_NAV_BANQUETA_SIDEBAR_BLOCK = "ui/nav_banqueta_sidebar_block_visible"


def nav_banqueta_sidebar_block_visible() -> bool:
    v = _s().value(KEY_NAV_BANQUETA_SIDEBAR_BLOCK, True)
    return v not in (False, "false", 0, "0")


def set_nav_banqueta_sidebar_block_visible(on: bool) -> None:
    _s().setValue(KEY_NAV_BANQUETA_SIDEBAR_BLOCK, on)


# Dispositivos
KEY_DEVICE_PRINTER_LABELS = "devices/printer_labels_name"
KEY_DEVICE_PRINTER_TICKETS = "devices/printer_tickets_name"
# Reservado para futuro (p. ej. filtrado con Raw Input). La UI ya no escribe aquí.
KEY_DEVICE_SCANNER_INSTANCE_ID = "devices/scanner_pnp_instance_id"


def device_printer_labels_name() -> str:
    v = _s().value(KEY_DEVICE_PRINTER_LABELS, "")
    return str(v).strip() if v else ""


def set_device_printer_labels_name(name: str) -> None:
    _s().setValue(KEY_DEVICE_PRINTER_LABELS, (name or "").strip())


def device_printer_tickets_name() -> str:
    v = _s().value(KEY_DEVICE_PRINTER_TICKETS, "")
    return str(v).strip() if v else ""


def set_device_printer_tickets_name(name: str) -> None:
    _s().setValue(KEY_DEVICE_PRINTER_TICKETS, (name or "").strip())


def device_scanner_instance_id() -> str:
    v = _s().value(KEY_DEVICE_SCANNER_INSTANCE_ID, "")
    return str(v).strip() if v else ""


def set_device_scanner_instance_id(instance_id: str) -> None:
    _s().setValue(KEY_DEVICE_SCANNER_INSTANCE_ID, (instance_id or "").strip())
