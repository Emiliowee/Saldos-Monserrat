from src.db.models import (
    Base,
    PlanoItem,
    PriceRule,
    PriceRuleCondition,
    Producto,
    TagGroup,
    TagOption,
    TiendaPlano,
)
from src.db.connection import engine, SessionLocal
from src.db.coherent_catalog_seed import seed_coherent_catalog
from src.db.sqlite_migrations import apply_sqlite_migrations


# Grupos y opciones por defecto que se crean una sola vez
_DEFAULT_GROUPS = [
    {
        "name": "Marca",
        "use_in_price": True,
        "required": False,
        "display_order": 1,
        "options": [
            "Guess", "Tommy Hilfiger", "Calvin Klein", "Nike", "Adidas",
            "Zara", "Otra marca", "Sin marca",
        ],
    },
    {
        "name": "Público",
        "use_in_price": True,
        "required": False,
        "display_order": 2,
        "options": ["Mujer", "Hombre", "Niño(a)", "Unisex"],
    },
    {
        "name": "Tipo de prenda",
        "use_in_price": True,
        "required": True,
        "display_order": 3,
        "options": [
            "Blusa", "Vestido", "Pantalón", "Falda", "Chamarra",
            "Playera", "Shorts", "Suéter", "Pijama", "Interior",
            "Accesorios", "Zapatos",
        ],
    },
    {
        "name": "Material",
        "use_in_price": True,
        "required": False,
        "display_order": 4,
        "options": ["Algodón", "Poliéster", "Mezclilla", "Satén", "Seda", "Lana", "Licra"],
    },
    {
        "name": "Talla",
        "use_in_price": False,
        "required": False,
        "display_order": 5,
        "options": ["XS", "S", "M", "L", "XL", "XXL", "Única"],
    },
    {
        "name": "Temporada",
        "use_in_price": False,
        "required": False,
        "display_order": 6,
        "options": ["Primavera-Verano", "Otoño-Invierno", "Todo el año"],
    },
]


def init_db():
    Base.metadata.create_all(engine)
    apply_sqlite_migrations(engine)
    ensure_default_cuaderno_tags()
    _seed_sample_price_rules()
    with SessionLocal() as session:
        if session.query(Producto).count() == 0:
            seed_coherent_catalog(session, target_count=168)


def reset_database_completely() -> None:
    """
    Borra **todas** las tablas y vuelve a crear esquema, tags, regla ejemplo
    y catálogo coherente de demostración (~168 artículos).

    Uso: ``python main.py --reset-db``
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(engine)
    apply_sqlite_migrations(engine)
    ensure_default_cuaderno_tags()
    _seed_sample_price_rules()
    with SessionLocal() as session:
        seed_coherent_catalog(session, target_count=168)


def ensure_default_cuaderno_tags() -> None:
    """
    Garantiza los grupos y opciones del cuaderno por defecto.
    Idempotente: si la base ya tenía grupos vacíos o de otra prueba, los completa.
    """
    with SessionLocal() as session:
        for grp_data in _DEFAULT_GROUPS:
            grp = session.query(TagGroup).filter(TagGroup.name == grp_data["name"]).one_or_none()
            if grp is None:
                grp = TagGroup(
                    name=grp_data["name"],
                    use_in_price=grp_data["use_in_price"],
                    required=grp_data["required"],
                    display_order=grp_data["display_order"],
                    active=True,
                )
                session.add(grp)
                session.flush()
            else:
                grp.use_in_price = grp_data["use_in_price"]
                grp.required = grp_data["required"]
                grp.display_order = grp_data["display_order"]
                grp.active = True

            for opt_name in grp_data["options"]:
                opt = (
                    session.query(TagOption)
                    .filter(TagOption.group_id == grp.id, TagOption.name == opt_name)
                    .one_or_none()
                )
                if opt is None:
                    session.add(TagOption(group_id=grp.id, name=opt_name, active=True))
                else:
                    opt.active = True
        session.commit()


# Alias por compatibilidad si algo importaba el nombre antiguo
_seed_defaults = ensure_default_cuaderno_tags


def _seed_sample_price_rules():
    """
    Si no hay reglas de precio, crea un ejemplo (Blusa + Algodón → rango)
    para probar el cuaderno en la pantalla de alta.
    No hace nada si ya existen reglas o faltan tags.
    """
    with SessionLocal() as session:
        if session.query(PriceRule).count() > 0:
            return
        g_tipo = session.query(TagGroup).filter(TagGroup.name == "Tipo de prenda").one_or_none()
        g_mat = session.query(TagGroup).filter(TagGroup.name == "Material").one_or_none()
        if not g_tipo or not g_mat:
            return
        o_blusa = (
            session.query(TagOption)
            .filter(TagOption.group_id == g_tipo.id, TagOption.name == "Blusa")
            .one_or_none()
        )
        o_algodon = (
            session.query(TagOption)
            .filter(TagOption.group_id == g_mat.id, TagOption.name == "Algodón")
            .one_or_none()
        )
        if not o_blusa or not o_algodon:
            return

        rule = PriceRule(
            name="Blusa algodón (ejemplo)",
            price_min=120.0,
            price_max=180.0,
            priority=20,
            active=True,
            notes="Regla de ejemplo; edítala o bórrala desde Cuaderno cuando exista la pantalla.",
        )
        session.add(rule)
        session.flush()
        session.add(
            PriceRuleCondition(rule_id=rule.id, group_id=g_tipo.id, option_id=o_blusa.id)
        )
        session.add(
            PriceRuleCondition(rule_id=rule.id, group_id=g_mat.id, option_id=o_algodon.id)
        )
        session.commit()
