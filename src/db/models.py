from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, DateTime,
    ForeignKey, Text, UniqueConstraint, Table,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class TagGroup(Base):
    """
    Grupo de tags creado por Monserrat.
    Ej: "Tipo de prenda", "Material", "Marca", "Talla".
    """
    __tablename__ = "tag_groups"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False, unique=True)
    use_in_price = Column(Boolean, default=False)
    required = Column(Boolean, default=False)
    active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

    options = relationship(
        "TagOption", back_populates="group",
        cascade="all, delete-orphan",
        order_by="TagOption.name"
    )

    def __repr__(self):
        return f"<TagGroup {self.name}>"


class TagOption(Base):
    """
    Opción dentro de un grupo.
    Ej: dentro de "Tipo de prenda" → Blusa, Chamarra, Pantalón.
    """
    __tablename__ = "tag_options"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("tag_groups.id"), nullable=False)
    name = Column(String(120), nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

    group = relationship("TagGroup", back_populates="options")

    __table_args__ = (
        UniqueConstraint("group_id", "name", name="uq_group_option"),
    )

    def __repr__(self):
        return f"<TagOption {self.name} ({self.group.name if self.group else '?'})>"


class PriceRule(Base):
    """
    Regla del Cuaderno de Precios.
    Combinación de tags → rango de precio sugerido.
    """
    __tablename__ = "price_rules"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    price_min = Column(Float, nullable=False)
    price_max = Column(Float, nullable=False)
    priority = Column(Integer, default=10)
    active = Column(Boolean, default=True)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    conditions = relationship(
        "PriceRuleCondition", back_populates="rule",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<PriceRule {self.name} ${self.price_min}-${self.price_max}>"


# ── Tabla de unión Producto ↔ TagOption ───────────────────────────────────────
_producto_tags = Table(
    "producto_tags",
    Base.metadata,
    Column("producto_id",    Integer, ForeignKey("productos.id"),    primary_key=True),
    Column("tag_option_id",  Integer, ForeignKey("tag_options.id"),  primary_key=True),
)


class Producto(Base):
    """
    Artículo de ropa registrado en el inventario de Saldos Monserrat.
    """
    __tablename__ = "productos"

    id            = Column(Integer, primary_key=True)
    codigo        = Column(String(60),  unique=True, nullable=False, index=True)
    descripcion   = Column(Text,        default="")
    precio        = Column(Float,       nullable=False, default=0.0)
    pieza_unica   = Column(Boolean,     default=False)
    color         = Column(String(100), default="")
    talla         = Column(String(50),  default="")
    imagen_path   = Column(String(500), default="")
    estado        = Column(String(30),  default="disponible")
    # disponible | vendido | en_banqueta | reservado
    fecha_ingreso = Column(DateTime,    default=datetime.now)
    created_at    = Column(DateTime,    default=datetime.now)
    updated_at    = Column(DateTime,    default=datetime.now, onupdate=datetime.now)

    tags = relationship("TagOption", secondary=_producto_tags, lazy="joined")

    def __repr__(self):
        return f"<Producto {self.codigo} ${self.precio}>"


class TiendaPlano(Base):
    __tablename__ = "tienda_planos"

    id = Column(Integer, primary_key=True)
    nombre = Column(String(120), nullable=False)
    notas = Column(Text, default="")
    cols = Column(Integer, nullable=False, default=14)
    rows = Column(Integer, nullable=False, default=10)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    items = relationship(
        "PlanoItem",
        back_populates="plano",
        cascade="all, delete-orphan",
    )


class PlanoItem(Base):
    __tablename__ = "plano_items"

    id = Column(Integer, primary_key=True)
    plano_id = Column(Integer, ForeignKey("tienda_planos.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    grid_x = Column(Integer, nullable=False)
    grid_y = Column(Integer, nullable=False)
    display_color = Column(String(20), default="")

    plano = relationship("TiendaPlano", back_populates="items")
    producto = relationship("Producto")

    __table_args__ = (
        UniqueConstraint("plano_id", "grid_x", "grid_y", name="uq_plano_celda"),
        UniqueConstraint("plano_id", "producto_id", name="uq_plano_producto"),
    )


class PriceRuleCondition(Base):
    """
    Cada condición de una regla: grupo + opción.
    Ej: Tipo=Blusa, Material=Algodón.
    """
    __tablename__ = "price_rule_conditions"

    id = Column(Integer, primary_key=True)
    rule_id = Column(Integer, ForeignKey("price_rules.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("tag_groups.id"), nullable=False)
    option_id = Column(Integer, ForeignKey("tag_options.id"), nullable=False)

    rule = relationship("PriceRule", back_populates="conditions")
    group = relationship("TagGroup")
    option = relationship("TagOption")

    __table_args__ = (
        UniqueConstraint("rule_id", "group_id", name="uq_rule_group"),
    )
