"""SQLite: columnas nuevas en tablas ya existentes."""
from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def apply_sqlite_migrations(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return
    insp = inspect(engine)
    if not insp.has_table("productos"):
        return
    have = {c["name"] for c in insp.get_columns("productos")}
    needed: list[tuple[str, str]] = [
        ("pieza_unica", "INTEGER NOT NULL DEFAULT 0"),
        ("color", "TEXT NOT NULL DEFAULT ''"),
        ("talla", "TEXT NOT NULL DEFAULT ''"),
        ("imagen_path", "TEXT NOT NULL DEFAULT ''"),
        ("estado", "TEXT NOT NULL DEFAULT 'disponible'"),
        ("fecha_ingreso", "TEXT"),
        ("created_at", "TEXT"),
        ("updated_at", "TEXT"),
    ]
    with engine.begin() as cx:
        for col, decl in needed:
            if col in have:
                continue
            cx.execute(text(f"ALTER TABLE productos ADD COLUMN {col} {decl}"))
