"""Rutas del repo (raíz, datos, assets)."""
from __future__ import annotations

from pathlib import Path

ROOT: Path = Path(__file__).resolve().parent.parent.parent

DATA_DIR: Path = ROOT / "data"
DB_PATH: Path = DATA_DIR / "monserrat.db"
PRODUCT_IMAGES_DIR: Path = DATA_DIR / "product_images"

ASSETS_DIR: Path = ROOT / "assets"
LOGO_PATH: Path = ASSETS_DIR / "logo.jpg"
EXIT_ICON_PATH: Path = ASSETS_DIR / "exit.png"
APP_WINDOW_ICON_PATH: Path = ASSETS_DIR / "rose_icon.png"
# Shell Zen — dispositivos (PNG del repo)
ZEN_HW_IMPRESORA_PNG: Path = ASSETS_DIR / "impresora.png"
ZEN_HW_LECTOR_PNG: Path = ASSETS_DIR / "lector.png"


def ensure_data_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PRODUCT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
