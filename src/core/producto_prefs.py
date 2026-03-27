"""
Preferencias para la pantalla de alta de producto (y futuro cuaderno).
Persisten con QSettings — base para menú "Ver" y modos de autocompletado.
"""
from PySide6.QtCore import QSettings

from src.core.qsettings_paths import app_qsettings

# Valores de auto_fill: AUTO_FILL_CUADERNO | AUTO_FILL_PATRONES | AUTO_FILL_OFF
AUTO_FILL_CUADERNO = "cuaderno"
AUTO_FILL_PATRONES = "patrones"
AUTO_FILL_OFF = "off"

KEY_AUTO_FILL = "alta_producto/auto_fill_mode"
KEY_PANEL_ETIQUETA = "alta_producto/panel_vista_etiqueta"
KEY_PANEL_REF = "alta_producto/panel_tabla_referencia"
KEY_AUTOFILL_PRECIO_CUADERNO = "alta_producto/autofill_precio_cuaderno"
KEY_AUTOFILL_PRECIO_PATRONES = "alta_producto/autofill_precio_patrones"
KEY_AUTOFILL_NOMBRE_TAGS = "alta_producto/autofill_nombre_desde_tags"


def _s() -> QSettings:
    return app_qsettings()


def get_auto_fill_mode() -> str:
    v = _s().value(KEY_AUTO_FILL, AUTO_FILL_CUADERNO)
    if v not in (AUTO_FILL_CUADERNO, AUTO_FILL_PATRONES, AUTO_FILL_OFF):
        return AUTO_FILL_CUADERNO
    return v


def set_auto_fill_mode(mode: str) -> None:
    if mode in (AUTO_FILL_CUADERNO, AUTO_FILL_PATRONES, AUTO_FILL_OFF):
        _s().setValue(KEY_AUTO_FILL, mode)


def is_panel_etiqueta_visible() -> bool:
    return _s().value(KEY_PANEL_ETIQUETA, True) in (True, "true", 1, "1")


def set_panel_etiqueta_visible(on: bool) -> None:
    _s().setValue(KEY_PANEL_ETIQUETA, on)


def is_panel_referencia_visible() -> bool:
    return _s().value(KEY_PANEL_REF, True) in (True, "true", 1, "1")


def set_panel_referencia_visible(on: bool) -> None:
    _s().setValue(KEY_PANEL_REF, on)


def _truthy(v: object, default: bool = True) -> bool:
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() not in ("false", "0", "no", "")
    return bool(v)


def autofill_precio_cuaderno() -> bool:
    return _truthy(_s().value(KEY_AUTOFILL_PRECIO_CUADERNO, True), True)


def set_autofill_precio_cuaderno(on: bool) -> None:
    _s().setValue(KEY_AUTOFILL_PRECIO_CUADERNO, bool(on))


def autofill_precio_patrones() -> bool:
    return _truthy(_s().value(KEY_AUTOFILL_PRECIO_PATRONES, True), True)


def set_autofill_precio_patrones(on: bool) -> None:
    _s().setValue(KEY_AUTOFILL_PRECIO_PATRONES, bool(on))


def autofill_nombre_desde_tags() -> bool:
    return _truthy(_s().value(KEY_AUTOFILL_NOMBRE_TAGS, True), True)


def set_autofill_nombre_desde_tags(on: bool) -> None:
    _s().setValue(KEY_AUTOFILL_NOMBRE_TAGS, bool(on))
