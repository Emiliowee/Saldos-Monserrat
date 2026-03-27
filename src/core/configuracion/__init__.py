"""
Configuración persistente (ventana, cromo, etc.) — distinto de preferencias de producto.
"""
from src.core.configuracion.ventana import (
    KEY_CHROME_ALWAYS_VISIBLE,
    is_chrome_always_visible,
    set_chrome_always_visible,
)

__all__ = [
    "KEY_CHROME_ALWAYS_VISIBLE",
    "is_chrome_always_visible",
    "set_chrome_always_visible",
]
