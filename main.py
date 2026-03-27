#!/usr/bin/env python3
"""
Saldos Monserrat / Bazar Monserrat — aplicación de escritorio (interfaz Zen).

Punto de entrada principal. Usa la misma base de datos y carpeta `data/` que siempre.

    python main.py

    Para **borrar toda la base** y volver a crear datos de demostración (nombres/precios coherentes):

    python main.py --reset-db

Preferencias de ventana (QSettings: SaldosMonserrat / BazarMonserratZenShell):
    geometría, animaciones, barra lateral, dispositivos, etc.
"""
from __future__ import annotations

import sys

from src.core.paths import ensure_data_dirs
from src.db.setup import init_db
from src.ui.zen_desktop import run_zen_desktop


def main() -> None:
    ensure_data_dirs()
    argv = sys.argv[:]
    reset = "--reset-db" in argv[1:]
    sys.argv = [argv[0]] + [a for a in argv[1:] if a != "--reset-db"]
    if reset:
        from src.db.setup import reset_database_completely

        reset_database_completely()
    else:
        init_db()
    sys.exit(run_zen_desktop())


if __name__ == "__main__":
    main()
