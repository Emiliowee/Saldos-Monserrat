"""
Catálogo de demostración: nombres legibles («Tenis Nike», «Blusa Nike talla S»)
y precios según tipo de prenda × marca.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from random import Random

from sqlalchemy.orm import Session

from src.db.models import Producto, TagGroup, TagOption
from src.services.producto_alta import next_codigo_msr

# Texto visible del tipo (la opción en BD sigue siendo p. ej. «Zapatos»).
NOMBRE_VISIBLE_TIPO: dict[str, str] = {
    "Zapatos": "Tenis",
    "Interior": "Ropa interior",
}

# Precio base por opción «Tipo de prenda» (antes de multiplicar por marca).
PRECIO_BASE_POR_TIPO: dict[str, float] = {
    "Blusa": 118.0,
    "Playera": 85.0,
    "Vestido": 188.0,
    "Pantalón": 152.0,
    "Falda": 102.0,
    "Chamarra": 255.0,
    "Shorts": 88.0,
    "Suéter": 142.0,
    "Pijama": 98.0,
    "Interior": 45.0,
    "Accesorios": 62.0,
    "Zapatos": 285.0,
}

# Patrón de precio por marca (sobre el base del tipo).
MULT_PRECIO_MARCA: dict[str, float] = {
    "Nike": 1.20,
    "Adidas": 1.18,
    "Tommy Hilfiger": 1.14,
    "Calvin Klein": 1.12,
    "Guess": 1.08,
    "Zara": 1.0,
    "Otra marca": 0.88,
    "Sin marca": 0.70,
}


def _titulo_tipo(opcion_tipo: str) -> str:
    return NOMBRE_VISIBLE_TIPO.get(opcion_tipo, opcion_tipo)


def _armar_nombre(
    tipo_opcion: str,
    marca: str,
    talla: str,
    material: str | None,
    rng: Random,
) -> str:
    """
    Ej.: «Blusa Nike talla S», «Tenis Adidas», «Pantalón Zara mezclilla talla M».
    """
    t = _titulo_tipo(tipo_opcion)
    partes = [t, marca]
    nombre = " ".join(partes)

    talla = (talla or "").strip()
    if talla and talla != "Única":
        nombre = f"{nombre} talla {talla}"

    # A veces material en el nombre (coherente con tag si viene de BD)
    if (
        material
        and material.strip()
        and tipo_opcion not in ("Zapatos", "Accesorios")
        and rng.random() < 0.28
    ):
        m = material.strip().lower()
        nombre = f"{nombre} {m}"

    return nombre


def _calcular_precio(tipo_opcion: str, marca: str, rng: Random) -> float:
    base = PRECIO_BASE_POR_TIPO.get(tipo_opcion, 95.0)
    mult = MULT_PRECIO_MARCA.get(marca, 1.0)
    v = base * mult * rng.uniform(0.94, 1.06)
    if rng.random() < 0.18:
        v = float(int(round(v)) + 0.9)
    else:
        v = round(v, 2)
    return float(max(39.0, v))


def seed_coherent_catalog(session: Session, *, target_count: int = 168) -> int:
    """
    Inserta productos de prueba. Hace ``commit`` al terminar.
    Requiere grupos por defecto (Tipo de prenda, Marca, …).
    """
    groups = (
        session.query(TagGroup)
        .filter(TagGroup.active == True)
        .order_by(TagGroup.display_order, TagGroup.name)
        .all()
    )
    opts_por_grupo: dict[str, list[TagOption]] = {}
    for g in groups:
        act = [o for o in g.options if o.active]
        if act:
            opts_por_grupo[g.name] = act

    tipos = opts_por_grupo.get("Tipo de prenda")
    marcas = opts_por_grupo.get("Marca")
    if not tipos:
        return 0
    if not marcas:
        return 0

    pubs = opts_por_grupo.get("Público", [])
    mats = opts_por_grupo.get("Material", [])
    tallas = opts_por_grupo.get("Talla", [])
    temps = opts_por_grupo.get("Temporada", [])

    first = next_codigo_msr(session)
    m = re.match(r"MSR-(\d+)$", first.strip(), re.IGNORECASE)
    start_n = int(m.group(1)) if m else 1

    rng_master = Random(20260323)
    n_ins = 0

    for k in range(target_count):
        rng = Random(rng_master.randint(1, 99_999_999))
        o_tipo = rng.choice(tipos)
        o_marca = rng.choice(marcas)
        o_pub = rng.choice(pubs) if pubs and rng.random() < 0.78 else None
        o_mat = rng.choice(mats) if mats and rng.random() < 0.82 else None
        o_talla = rng.choice(tallas) if tallas else None
        o_temp = rng.choice(temps) if temps and rng.random() < 0.45 else None

        marca_n = o_marca.name
        talla_n = (o_talla.name if o_talla else "") or "Única"
        mat_n = o_mat.name if o_mat else ""

        descripcion = _armar_nombre(o_tipo.name, marca_n, talla_n, mat_n or None, rng)
        precio = _calcular_precio(o_tipo.name, marca_n, rng)

        estado = rng.choices(
            ["disponible", "en_banqueta", "vendido"],
            weights=[0.88, 0.08, 0.04],
            k=1,
        )[0]
        fecha = datetime.now() - timedelta(days=rng.randint(0, 130))

        colores = ("Negro", "Blanco", "Azul marino", "Beige", "Gris", "Rosa")
        color_txt = rng.choice(colores) if rng.random() < 0.42 else ""

        p = Producto(
            codigo=f"MSR-{start_n + k:06d}",
            descripcion=descripcion[:500],
            precio=precio,
            pieza_unica=rng.random() < 0.025,
            color=color_txt,
            talla="" if talla_n == "Única" else talla_n,
            imagen_path="",
            estado=estado,
            fecha_ingreso=fecha,
        )
        p.tags.append(o_tipo)
        p.tags.append(o_marca)
        if o_pub:
            p.tags.append(o_pub)
        if o_mat:
            p.tags.append(o_mat)
        if o_talla:
            p.tags.append(o_talla)
        if o_temp:
            p.tags.append(o_temp)

        session.add(p)
        n_ins += 1

    session.commit()
    return n_ins
