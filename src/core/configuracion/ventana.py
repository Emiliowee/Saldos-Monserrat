"""
Preferencias de ventana (barra superior, cromo tipo Zen).
Persisten en el mismo QSettings que el resto de la app.
"""
from src.core.qsettings_paths import app_qsettings

KEY_CHROME_ALWAYS_VISIBLE = "window/chrome_always_visible"


def is_chrome_always_visible() -> bool:
    """True = barra Archivo / minimizar siempre visible; False = franja Zen (aparece al pasar el ratón)."""
    v = app_qsettings().value(KEY_CHROME_ALWAYS_VISIBLE, False)
    return v in (True, "true", 1, "1")


def set_chrome_always_visible(on: bool) -> None:
    app_qsettings().setValue(KEY_CHROME_ALWAYS_VISIBLE, on)
