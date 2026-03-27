"""
Alta de productos: código MSR, validación de tags obligatorios y reglas del cuaderno.
"""
from __future__ import annotations

import re
import statistics
import unicodedata
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from src.db.models import PriceRule, TagGroup, TagOption


def next_codigo_msr(session: Session) -> str:
    """Siguiente código MSR-000001 libre (según existentes en BD)."""
    from src.db.models import Producto

    rows = session.query(Producto.codigo).filter(Producto.codigo.ilike("MSR-%")).all()
    best = 0
    for (codigo,) in rows:
        m = re.match(r"MSR-(\d+)$", (codigo or "").strip(), re.IGNORECASE)
        if m:
            best = max(best, int(m.group(1)))
    return f"MSR-{best + 1:06d}"


def missing_required_groups(session: Session, selected_option_ids: set[int]) -> list[str]:
    """Nombres de grupos obligatorios sin ninguna opción elegida."""
    from src.db.models import TagGroup

    missing: list[str] = []
    groups = (
        session.query(TagGroup)
        .filter(TagGroup.active == True, TagGroup.required == True)
        .order_by(TagGroup.display_order)
        .all()
    )
    for g in groups:
        active_opts = {o.id for o in g.options if o.active}
        if not active_opts:
            continue
        if not (selected_option_ids & active_opts):
            missing.append(g.name)
    return missing


def best_matching_price_rule(
    session: Session, selected_option_ids: set[int]
) -> PriceRule | None:
    """
    Regla activa que coincide: todas sus condiciones están cubiertas por los tags elegidos.
    Si varias coinciden: mayor prioridad; a igual prioridad, **más condiciones** (regla más
    específica); desempate por id.
    """
    from src.db.models import PriceRule

    rules = (
        session.query(PriceRule)
        .filter(PriceRule.active == True)
        .order_by(PriceRule.priority.desc(), PriceRule.id.desc())
        .all()
    )
    matches: list[PriceRule] = []
    for rule in rules:
        cond_opts = {c.option_id for c in rule.conditions}
        if not cond_opts:
            continue
        if cond_opts <= selected_option_ids:
            matches.append(rule)
    if not matches:
        return None
    matches.sort(
        key=lambda r: (
            int(r.priority or 0),
            len(r.conditions),
            r.id,
        ),
        reverse=True,
    )
    return matches[0]


def suggested_price_from_rule(rule: PriceRule | None) -> float | None:
    if rule is None:
        return None
    return (rule.price_min + rule.price_max) / 2.0


def tag_labels_for_selection(session: Session, group_to_option: dict[int, int]) -> list[str]:
    """Etiquetas legibles para chips (Grupo: opción)."""
    from src.db.models import TagGroup, TagOption

    out: list[str] = []
    for gid in sorted(group_to_option.keys()):
        oid = group_to_option[gid]
        g = session.get(TagGroup, gid)
        o = session.get(TagOption, oid)
        if g and o:
            out.append(f"{g.name}: {o.name}")
    return out


def option_name_for_group(session: Session, group_name: str, selected_option_ids: set[int]) -> str:
    """Nombre de la opción elegida para un grupo (p. ej. Talla → columna producto.talla)."""
    from src.db.models import TagGroup, TagOption

    g = session.query(TagGroup).filter(TagGroup.name == group_name).one_or_none()
    if not g:
        return ""
    for o in g.options:
        if o.active and o.id in selected_option_ids:
            return o.name
    return ""


def option_names_in_display_order(
    session: Session, group_to_option: dict[int, int]
) -> list[str]:
    """Nombres de opción en orden de grupo (display_order), sin unir."""
    if not group_to_option:
        return []
    from src.db.models import TagGroup, TagOption

    gids = list(group_to_option.keys())
    groups = (
        session.query(TagGroup)
        .filter(TagGroup.id.in_(gids))
        .order_by(TagGroup.display_order, TagGroup.name)
        .all()
    )
    parts: list[str] = []
    for g in groups:
        oid = group_to_option.get(g.id)
        if oid is None:
            continue
        o = session.get(TagOption, oid)
        if o and o.active:
            parts.append(o.name.replace("-", " ").strip())
    return parts


def _fold_accents(text: str) -> str:
    """Minúsculas + sin tildes para comparar con descripciones reales."""
    t = (text or "").strip().lower()
    if not t:
        return ""
    return "".join(
        c
        for c in unicodedata.normalize("NFD", t)
        if unicodedata.category(c) != "Mn"
    )


def _fragments_for_tag_match(name: str) -> list[str]:
    """Variantes de búsqueda para una opción (guiones, espacios, palabras sueltas)."""
    raw = (name or "").strip()
    if not raw:
        return []
    out: list[str] = []
    for part in {raw, raw.replace("-", " "), raw.replace(" ", "-")}:
        p = part.strip()
        if p and p not in out:
            out.append(p)
    return out


def _earliest_match_in_desc(norm_desc: str, tag_name: str) -> tuple[int, int]:
    """
    Busca el tag en la descripción normalizada.
    Retorna (índice, calidad): calidad 2 = frase completa, 1 = palabra con límite de palabra, -1 = sin match.
    """
    d = norm_desc
    if not d:
        return (-1, -1)

    best_pos = -1
    best_q = -1

    for frag in _fragments_for_tag_match(tag_name):
        f = _fold_accents(frag)
        if len(f) < 2:
            continue
        idx = d.find(f)
        if idx >= 0 and (best_pos < 0 or idx < best_pos):
            best_pos, best_q = idx, 2

    if best_pos >= 0:
        return (best_pos, best_q)

    for frag in _fragments_for_tag_match(tag_name):
        f = _fold_accents(frag)
        for token in re.split(r"[\s\-/]+", f):
            if len(token) < 2:
                continue
            m = re.search(r"(?<!\w)" + re.escape(token) + r"(?!\w)", d)
            if m:
                pos = m.start()
                if best_pos < 0 or pos < best_pos:
                    best_pos, best_q = pos, 1

    return (best_pos, best_q)


def nombre_etiqueta_desde_tags(session: Session, group_to_option: dict[int, int]) -> str:
    """
    Texto tipo «Blusa-Nike-Algodón»: opciones en orden de grupo (display_order),
    unidas con guión. Si no hay tags, cadena vacía.
    """
    parts = option_names_in_display_order(session, group_to_option)
    return "-".join(parts)


def _score_descripcion_vs_tags_ordenados(desc: str, ordered_tag_names: list[str]) -> tuple[int, int]:
    """
    Puntuación: etiquetas halladas en la descripción (tildes/guiones tolerados),
    orden de aparición vs orden de grupos, y bonus si coincide frase completa.
    Retorna (puntos, n_coincidencias) para ordenar candidatos.
    """
    d_raw = (desc or "").strip().lower()
    d = _fold_accents(d_raw)
    if not d or not ordered_tag_names:
        return (-10_000, 0)

    positions: list[int] = []
    hits = 0
    quality_pts = 0

    for nm in ordered_tag_names:
        if not (nm or "").strip():
            positions.append(-1)
            continue
        idx, q = _earliest_match_in_desc(d, nm)
        positions.append(idx)
        if idx >= 0:
            hits += 1
            if q >= 2:
                quality_pts += 22
            elif q >= 1:
                quality_pts += 12

    if hits == 0:
        return (0, 0)

    orden_ok = all(p >= 0 for p in positions) and positions == sorted(positions)
    bonus_orden = 55 if orden_ok else 0
    # Cobertura: favorece descripciones que mencionan más tags con buen match
    return (hits * 18 + quality_pts + bonus_orden, hits)


def _rank_key_todos_los_tags(
    p_oids: set[int],
    selected: set[int],
) -> tuple[int, int, int]:
    """
    Solo tiene sentido si ``selected <= p_oids`` (la prenda incluye **todos** los tags elegidos).
    Orden **descendente**: conjunto exacto (solo esos tags), menos tags extra, menos tags totales.
    """
    exact = 1 if p_oids == selected else 0
    extra = len(p_oids - selected)
    n_p = len(p_oids)
    return (exact, -extra, -n_p)


def nombre_desde_tags_orden_referencia(
    session: Session,
    group_to_option: dict[int, int],
    texto_referencia: str,
) -> str:
    """
    Arma el nombre **solo** con los textos de las opciones que elegiste (p. ej. Blusa, Nike, Mujer),
    ordenados según **en qué orden aparecen** en ``texto_referencia`` (una prenda del inventario).
    No se copian talla, material ni otras palabras que no sean esos tags.

    Si un tag no aparece en el texto, se coloca al final respetando el orden de grupos.
    """
    ordered = option_names_in_display_order(session, group_to_option)
    if not ordered:
        return ""

    d = _fold_accents((texto_referencia or "").strip().lower())
    if not d:
        return " ".join(ordered)

    tail_base = len(d) + 100
    items: list[tuple[int, int, str]] = []
    for idx, nm in enumerate(ordered):
        pos, _q = _earliest_match_in_desc(d, nm)
        if pos >= 0:
            sort_key = pos
        else:
            sort_key = tail_base + idx
        items.append((sort_key, idx, nm.strip()))

    items.sort(key=lambda x: (x[0], x[1]))
    return " ".join(x[2] for x in items)


def _ranked_tag_matches(
    session: Session,
    option_ids: set[int],
    *,
    exclude_codigo: str | None = None,
    limit: int = 2000,
) -> list[tuple[object, int, str, tuple[int, int, int]]]:
    """
    Solo productos que tienen **los mismos tags elegidos** (todos), pudiendo tener más
    (p. ej. Nike + Chamarra + Talla es válido; solo Nike **no** entra).

    Orden: primero conjunto idéntico al elegido, luego menos tags adicionales.
    Cada ítem: (producto, n_tags_elegidos_presentes, nombres_tags_elegidos_en_orden_lectura, rank_key).
    """
    from src.db.models import Producto, TagOption

    if not option_ids:
        return []

    q = session.query(Producto)
    for oid in option_ids:
        q = q.filter(Producto.tags.any(TagOption.id == oid))
    ex = (exclude_codigo or "").strip()
    if ex:
        q = q.filter(Producto.codigo != ex)
    candidates = q.all()

    rows: list[tuple[tuple[int, int, int], object, int, str]] = []
    n_sel = len(option_ids)
    for p in candidates:
        p_tags = list(getattr(p, "tags", None) or [])
        p_oids = {t.id for t in p_tags}
        if not option_ids <= p_oids:
            continue
        rk = _rank_key_todos_los_tags(p_oids, option_ids)
        by_id = {t.id: t for t in p_tags}
        coin_names = ", ".join(
            by_id[i].name for i in sorted(option_ids, key=lambda x: by_id[x].name.lower()) if i in by_id
        )
        rows.append((rk, p, n_sel, coin_names))

    rows.sort(key=lambda x: x[0], reverse=True)
    out: list[tuple[object, int, str, tuple[int, int, int]]] = []
    for rk, p, n, txt in rows[:limit]:
        out.append((p, n, txt, rk))
    return out


def sugerir_nombre_desde_patrones_inventario(
    session: Session,
    group_to_option: dict[int, int],
    *,
    exclude_codigo: str | None = None,
    limit_scan: int = 800,
) -> str | None:
    """
    Usa una prenda del inventario que tenga **todos** tus tags (puede tener más) solo como
    **referencia de orden**: el nombre final son **únicamente** los textos de tus opciones,
    ordenados como aparecen en esa descripción (p. ej. «Blusa Nike…» → «Blusa Nike Mujer» si
    elegiste esos tres y «Mujer» no sale en el texto, va al final). No se copian talla ni material.
    """
    if not group_to_option:
        return None

    option_ids = set(group_to_option.values())
    ordered = option_names_in_display_order(session, group_to_option)
    if not ordered:
        return None

    ranked = _ranked_tag_matches(
        session, option_ids, exclude_codigo=exclude_codigo, limit=limit_scan
    )
    if not ranked:
        return None

    keys_order: list[tuple[int, int, int]] = []
    seen_k: set[tuple[int, int, int]] = set()
    for _p, _n, _t, rk in ranked:
        if rk not in seen_k:
            seen_k.add(rk)
            keys_order.append(rk)

    for rk in keys_order:
        tier_ps = [p for p, _n, _t, k in ranked if k == rk]
        best_raw: str | None = None
        best_sc: tuple[int, int] = (-10_000, 0)
        for p in tier_ps:
            raw = (getattr(p, "descripcion", None) or "").strip()
            if not raw:
                continue
            sc = _score_descripcion_vs_tags_ordenados(raw, ordered)
            if sc > best_sc:
                best_sc = sc
                best_raw = raw
        if not best_raw:
            continue
        nombre = nombre_desde_tags_orden_referencia(
            session, group_to_option, best_raw
        ).strip()
        if nombre:
            return nombre[:220]

    # Hay coincidencias en inventario pero sin descripción útil: orden de grupos, separado por espacio.
    return " ".join(ordered)[:220]


def productos_coincidencia_tags(
    session: Session,
    option_ids: set[int],
    *,
    exclude_codigo: str | None = None,
    limit: int = 30,
) -> list[tuple[object, int, str]]:
    """
    Productos que incluyen **todos** los tags de ``option_ids`` (pueden tener más),
    ordenados: conjunto exacto primero, luego menos tags adicionales.
    """
    if not option_ids:
        return []
    full = _ranked_tag_matches(
        session, option_ids, exclude_codigo=exclude_codigo, limit=max(limit, 500)
    )
    return [(p, n, t) for p, n, t, _rk in full[:limit]]


def inventario_precio_stats_por_tags(
    session: Session,
    option_ids: set[int],
    *,
    exclude_codigo: str | None = None,
    limit: int = 2000,
) -> dict[str, float | int | bool] | None:
    """
    Estadísticas solo entre prendas que tienen **los mismos tags elegidos** (todos),
    pudiendo llevar tags extra. La sugerencia principal es la **mediana** de **todas**
    esas prendas (un solo artículo → su precio).
    """
    if not option_ids:
        return None

    ranked = _ranked_tag_matches(
        session, option_ids, exclude_codigo=exclude_codigo, limit=limit
    )
    if not ranked:
        return None

    prices: list[float] = []
    for p, _n, _t, _rk in ranked:
        try:
            price = float(getattr(p, "precio", 0) or 0)
        except (TypeError, ValueError):
            continue
        if price < 0:
            continue
        prices.append(price)

    if not prices:
        return None

    n_sel = len(option_ids)
    n_exact = sum(1 for row in ranked if row[3][0] == 1)

    return {
        "n": len(prices),
        "min": min(prices),
        "max": max(prices),
        "avg": float(statistics.mean(prices)),
        "median": float(statistics.median(prices)),
        "cobertura": 1.0,
        "tags_coincidentes_mejor": n_sel,
        "tags_elegidos": n_sel,
        "conjunto_exacto": bool(ranked[0][3][0] == 1),
        "n_conjunto_exacto": int(n_exact),
    }


def rule_condition_pairs(session: Session, rule: "PriceRule") -> list[tuple[str, str]]:
    """Condiciones de una regla como (nombre grupo, nombre opción)."""
    conds = list(rule.conditions)
    conds.sort(
        key=lambda c: (
            (c.group.name or "").lower() if c.group else "",
            (c.option.name or "").lower() if c.option else "",
        )
    )
    out: list[tuple[str, str]] = []
    for c in conds:
        gn = c.group.name if c.group else "?"
        on = c.option.name if c.option else "?"
        out.append((gn, on))
    return out


def snapshot_referencia_cuaderno(
    session: Session,
    option_ids: set[int],
    *,
    tags_por_grupo: dict[int, int] | None,
) -> dict:
    """Datos para panel + modal «detalle» (modo cuaderno)."""
    tags_txt = (
        tag_labels_for_selection(session, tags_por_grupo)
        if tags_por_grupo
        else []
    )
    if not option_ids:
        return {
            "modo": "cuaderno",
            "tags_elegidos": tags_txt,
            "encontrado": False,
            "mensaje": "Todavía no elegiste tags en Principal.",
        }

    rule = best_matching_price_rule(session, option_ids)
    if rule is None:
        return {
            "modo": "cuaderno",
            "tags_elegidos": tags_txt,
            "encontrado": False,
            "mensaje": (
                "No hay ninguna regla activa del cuaderno cuyas condiciones queden "
                "todas cubiertas por los tags que elegiste (cada regla exige un conjunto "
                "fijo de opciones; tenés que coincidir con al menos una regla completa)."
            ),
        }

    conds = rule_condition_pairs(session, rule)
    mid = suggested_price_from_rule(rule)
    return {
        "modo": "cuaderno",
        "tags_elegidos": tags_txt,
        "encontrado": True,
        "mensaje": "",
        "rule_name": rule.name,
        "rule_notes": (rule.notes or "").strip(),
        "price_min": float(rule.price_min),
        "price_max": float(rule.price_max),
        "sugerido": float(mid) if mid is not None else None,
        "prioridad": int(rule.priority or 0),
        "condiciones": conds,
    }


def snapshot_referencia_patrones(
    session: Session,
    option_ids: set[int],
    exclude_codigo: str | None,
    *,
    tags_por_grupo: dict[int, int] | None,
) -> dict:
    """Datos para panel + modal «detalle» (modo patrones inventario)."""
    tags_txt = (
        tag_labels_for_selection(session, tags_por_grupo)
        if tags_por_grupo
        else []
    )
    if not option_ids:
        return {
            "modo": "patrones",
            "tags_elegidos": tags_txt,
            "encontrado": False,
            "mensaje": "Todavía no elegiste tags en Principal.",
            "productos": [],
            "stats": None,
        }

    rows = productos_coincidencia_tags(
        session, option_ids, exclude_codigo=exclude_codigo, limit=80
    )
    st = inventario_precio_stats_por_tags(
        session, option_ids, exclude_codigo=exclude_codigo
    )
    prods: list[dict] = []
    for p, n_coinc, coin_txt in rows:
        prods.append(
            {
                "codigo": getattr(p, "codigo", "") or "",
                "nombre": (getattr(p, "descripcion", None) or "")[:220],
                "precio": float(getattr(p, "precio", 0) or 0),
                "imagen_path": (getattr(p, "imagen_path", None) or "").strip(),
                "estado": getattr(p, "estado", "") or "",
                "n_coincidencias": int(n_coinc),
                "tags_coincidentes": coin_txt or "",
            }
        )

    if not rows:
        return {
            "modo": "patrones",
            "tags_elegidos": tags_txt,
            "encontrado": False,
            "mensaje": (
                "No hay artículos que tengan todos los tags que elegiste a la vez "
                "(ninguno cumple la combinación completa), o el código actual excluye las únicas coincidencias."
            ),
            "productos": [],
            "stats": None,
        }

    stats_out: dict[str, float | int | bool] | None = None
    if st:
        stats_out = {
            "n": int(st["n"]),
            "min": float(st["min"]),
            "max": float(st["max"]),
            "avg": float(st["avg"]),
            "median": float(st["median"]),
            "cobertura": float(st.get("cobertura", 1.0)),
            "tags_coincidentes_mejor": int(st.get("tags_coincidentes_mejor", len(option_ids))),
            "tags_elegidos": int(st.get("tags_elegidos", len(option_ids))),
            "conjunto_exacto": bool(st.get("conjunto_exacto", False)),
            "n_conjunto_exacto": int(st.get("n_conjunto_exacto", 0)),
        }

    return {
        "modo": "patrones",
        "tags_elegidos": tags_txt,
        "encontrado": True,
        "mensaje": "",
        "productos": prods,
        "stats": stats_out,
    }


def filas_referencia_precio(
    session: Session,
    option_ids: set[int],
    exclude_codigo: str | None,
    mode: str,
) -> list[tuple[str, str, str]]:
    """
    Filas para la tabla «referencia»: (origen, detalle, precio ref.).
    `mode`: producto_prefs.AUTO_FILL_* — cuaderno, patrones, o ambos si OFF.
    """
    from src.core import producto_prefs as prefs

    out: list[tuple[str, str, str]] = []
    if not option_ids:
        return out

    show_cuaderno = mode in (prefs.AUTO_FILL_CUADERNO, prefs.AUTO_FILL_OFF)
    show_inventario = mode in (prefs.AUTO_FILL_PATRONES, prefs.AUTO_FILL_OFF)

    if show_cuaderno:
        rule = best_matching_price_rule(session, option_ids)
        if rule:
            out.append(
                (
                    "Cuaderno de precios",
                    f"Regla «{rule.name}»",
                    f"${rule.price_min:.0f} – ${rule.price_max:.0f}",
                )
            )
        else:
            out.append(
                (
                    "Cuaderno de precios",
                    "Ninguna regla activa coincide",
                    "—",
                )
            )

    if show_inventario:
        st = inventario_precio_stats_por_tags(
            session, option_ids, exclude_codigo=exclude_codigo
        )
        if st:
            med = float(st.get("median", st["avg"]))
            n_sel = int(st.get("tags_elegidos", 0))
            nex = int(st.get("n_conjunto_exacto", 0))
            ex = f"{nex} solo con esos {n_sel} tags · " if nex else ""
            out.append(
                (
                    "Patrones (inventario)",
                    f"Incluyen los {n_sel} tags elegidos ({ex}{st['n']} artículo(s))",
                    f"mediana ~${med:.0f} · rango ${st['min']:.0f}–${st['max']:.0f}",
                )
            )
        else:
            out.append(
                (
                    "Patrones (inventario)",
                    "No hay otros artículos con estos tags",
                    "—",
                )
            )

    return out


def parse_precio(text: str) -> float | None:
    t = (text or "").strip().replace(",", ".")
    if not t:
        return None
    try:
        v = float(t)
        if v < 0:
            return None
        return v
    except ValueError:
        return None
