"""Datos de resumen para la carpeta Banqueta en el sidebar Zen (SQLite compartido con el ERP)."""
from __future__ import annotations


def zen_banqueta_snapshot() -> tuple[int, int, list[tuple[str, int]]]:
    """
    Retorna:
    - cantidad de productos con estado ``en_banqueta``
    - cantidad ``disponible`` (útiles para colocar en plano)
    - lista (nombre_plano, prendas_en_plano) ordenada por nombre
    """
    try:
        from src.db.connection import SessionLocal
        from src.db.models import PlanoItem, Producto, TiendaPlano
    except Exception:
        return 0, 0, []

    try:
        with SessionLocal() as s:
            n_bq = s.query(Producto).filter(Producto.estado == "en_banqueta").count()
            n_disp = s.query(Producto).filter(Producto.estado == "disponible").count()
            planos: list[tuple[str, int]] = []
            for p in s.query(TiendaPlano).order_by(TiendaPlano.nombre).all():
                cnt = (
                    s.query(PlanoItem).filter(PlanoItem.plano_id == p.id).count()
                )
                planos.append((p.nombre, int(cnt)))
            return int(n_bq), int(n_disp), planos
    except Exception:
        return 0, 0, []
