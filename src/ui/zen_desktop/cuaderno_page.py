"""
Cuaderno de precios de Monserrat — gestión de grupos de tags y reglas de precio.

Página integrada en el Zen shell. Permite:
  · Ver, crear, editar y eliminar grupos de etiquetas (Marca, Tipo, Material…).
  · Ver y administrar las opciones dentro de cada grupo.
  · Crear reglas de precio basadas en combinaciones de tags.
  · Configurar el modo de auto-llenado para alta de producto.
"""
from __future__ import annotations

from functools import partial

import qtawesome as qta
from sqlalchemy.exc import IntegrityError

from PySide6.QtCore import Qt, QSize, Signal
from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QDoubleSpinBox,
    QFormLayout,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QSpinBox,
    QVBoxLayout,
    QWidget,
    QCheckBox,
    QComboBox,
    QGridLayout,
)

from src.ui.zen_desktop import theme as Z
from src.core import producto_prefs as prefs


# ── Helpers de estilo ────────────────────────────────────────────────────────

def _section_label(text: str) -> QLabel:
    lb = QLabel(text.upper())
    lb.setStyleSheet(
        f"color: rgba(58, 53, 48, 0.38); font-family: {Z.FONT_UI}; "
        f"font-size: 9px; font-weight: 700; letter-spacing: 0.14em; "
        f"background: transparent; border: none; padding: 0 0 2px 0;"
    )
    return lb


def _card_frame() -> QFrame:
    f = QFrame()
    f.setStyleSheet(
        f"""
        QFrame {{
            background: rgba(255, 255, 255, 0.55);
            border: 1px solid rgba(58, 53, 48, 0.07);
            border-radius: 12px;
        }}
        """
    )
    return f


def _action_btn(text: str, *, primary: bool = False) -> QPushButton:
    b = QPushButton(text)
    b.setCursor(Qt.CursorShape.PointingHandCursor)
    b.setMinimumHeight(32)
    if primary:
        b.setStyleSheet(
            f"""
            QPushButton {{
                background: {Z.PRIMARY}; border: none; border-radius: 8px;
                color: #FFF; font-family: {Z.FONT_UI}; font-size: 11px;
                font-weight: 600; padding: 4px 16px;
            }}
            QPushButton:hover {{ background: {Z.PRIMARY_HOVER}; }}
            """
        )
    else:
        b.setStyleSheet(
            f"""
            QPushButton {{
                background: transparent; border: 1px solid rgba(58, 53, 48, 0.12);
                border-radius: 8px; color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI};
                font-size: 11px; font-weight: 500; padding: 4px 14px;
            }}
            QPushButton:hover {{ border-color: {Z.PRIMARY}; color: {Z.PRIMARY}; }}
            """
        )
    return b


def _chip(text: str, *, selected: bool = False, deletable: bool = False) -> QPushButton:
    b = QPushButton(text)
    b.setCursor(Qt.CursorShape.PointingHandCursor)
    if selected:
        b.setStyleSheet(
            f"""
            QPushButton {{
                background: {Z.PRIMARY}; color: #FFF; border: none;
                border-radius: 14px; font-family: {Z.FONT_UI}; font-size: 11px;
                font-weight: 500; padding: 4px 12px; min-height: 28px;
            }}
            QPushButton:hover {{ background: {Z.PRIMARY_HOVER}; }}
            """
        )
    else:
        b.setStyleSheet(
            f"""
            QPushButton {{
                background: rgba(255, 255, 255, 0.65); color: {Z.NAV_TEXT};
                border: 1px solid rgba(58, 53, 48, 0.10); border-radius: 14px;
                font-family: {Z.FONT_UI}; font-size: 11px; font-weight: 500;
                padding: 4px 12px; min-height: 28px;
            }}
            QPushButton:hover {{
                background: {Z.PRIMARY_PALE}; border-color: {Z.PRIMARY};
                color: {Z.PRIMARY};
            }}
            """
        )
    return b


# ── Diálogos ─────────────────────────────────────────────────────────────────

def _dialog_qss() -> str:
    return f"""
        QDialog {{
            background: {Z.CARD_BG}; border-radius: 12px;
        }}
        QLabel {{
            font-family: {Z.FONT_UI}; color: {Z.NAV_TEXT};
            background: transparent;
        }}
        QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox, QCheckBox {{
            font-family: {Z.FONT_UI}; font-size: 12px;
            background: #FFFFFF; border: 1px solid rgba(58, 53, 48, 0.14);
            border-radius: 6px; padding: 5px 8px; min-height: 28px;
            color: {Z.NAV_TEXT};
        }}
        QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QComboBox:focus {{
            border: 2px solid {Z.PRIMARY};
        }}
    """


class _GroupDialog(QDialog):
    """Crear o editar un grupo de tags."""

    def __init__(self, parent, *, name: str = "", use_in_price: bool = False,
                 required: bool = False, order: int = 0, title: str = "Nuevo grupo"):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setMinimumWidth(360)
        self.setStyleSheet(_dialog_qss())

        lay = QVBoxLayout(self)
        lay.setSpacing(12)
        form = QFormLayout()
        form.setSpacing(8)
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        self._name = QLineEdit(name)
        self._name.setPlaceholderText("Ej: Marca, Material, Talla…")
        form.addRow("Nombre:", self._name)

        self._use_price = QCheckBox("Usar para reglas de precio")
        self._use_price.setChecked(use_in_price)
        form.addRow("", self._use_price)

        self._required = QCheckBox("Obligatorio al registrar producto")
        self._required.setChecked(required)
        form.addRow("", self._required)

        self._order = QSpinBox()
        self._order.setRange(0, 100)
        self._order.setValue(order)
        form.addRow("Orden:", self._order)

        lay.addLayout(form)

        bb = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def result_data(self) -> dict:
        return {
            "name": self._name.text().strip(),
            "use_in_price": self._use_price.isChecked(),
            "required": self._required.isChecked(),
            "display_order": self._order.value(),
        }


class _RuleDialog(QDialog):
    """Crear o editar una regla de precio."""

    def __init__(self, parent, groups_with_opts: list[dict], *,
                 name: str = "", price_min: float = 0, price_max: float = 0,
                 priority: int = 10, notes: str = "",
                 existing_conditions: list[tuple[int, int]] | None = None,
                 title: str = "Nueva regla"):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setMinimumWidth(420)
        self.setStyleSheet(_dialog_qss())

        self._groups = groups_with_opts
        lay = QVBoxLayout(self)
        lay.setSpacing(12)

        form = QFormLayout()
        form.setSpacing(8)

        self._name = QLineEdit(name)
        self._name.setPlaceholderText("Ej: Blusa algodón, Nike zapato…")
        form.addRow("Nombre:", self._name)

        self._price_min = QDoubleSpinBox()
        self._price_min.setRange(0, 99999)
        self._price_min.setPrefix("$ ")
        self._price_min.setDecimals(0)
        self._price_min.setValue(price_min)
        form.addRow("Precio mín:", self._price_min)

        self._price_max = QDoubleSpinBox()
        self._price_max.setRange(0, 99999)
        self._price_max.setPrefix("$ ")
        self._price_max.setDecimals(0)
        self._price_max.setValue(price_max)
        form.addRow("Precio máx:", self._price_max)

        self._priority = QSpinBox()
        self._priority.setRange(1, 100)
        self._priority.setValue(priority)
        self._priority.setToolTip("Si varias reglas coinciden, gana la de mayor prioridad")
        form.addRow("Prioridad:", self._priority)

        self._notes = QLineEdit(notes)
        self._notes.setPlaceholderText("Nota opcional…")
        form.addRow("Notas:", self._notes)

        lay.addLayout(form)

        # Tag condition selectors
        conds_label = QLabel("Condiciones (selecciona un tag por grupo):")
        conds_label.setStyleSheet(
            f"font-weight: 600; font-size: 12px; color: {Z.NAV_TEXT}; background: transparent;"
        )
        lay.addWidget(conds_label)

        existing_map = dict(existing_conditions or [])
        self._combos: list[tuple[int, QComboBox]] = []
        for g in groups_with_opts:
            if not g["options"]:
                continue
            combo = QComboBox()
            combo.addItem("— no usar —", 0)
            for opt in g["options"]:
                combo.addItem(opt["name"], opt["id"])
            pre_opt = existing_map.get(g["id"])
            if pre_opt:
                idx = combo.findData(pre_opt)
                if idx >= 0:
                    combo.setCurrentIndex(idx)
            form2 = QFormLayout()
            form2.addRow(f"{g['name']}:", combo)
            lay.addLayout(form2)
            self._combos.append((g["id"], combo))

        bb = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def result_data(self) -> dict:
        conditions = []
        for gid, combo in self._combos:
            oid = combo.currentData()
            if oid and oid != 0:
                conditions.append((gid, oid))
        return {
            "name": self._name.text().strip(),
            "price_min": self._price_min.value(),
            "price_max": self._price_max.value(),
            "priority": self._priority.value(),
            "notes": self._notes.text().strip(),
            "conditions": conditions,
        }


# ── Widgets de grupo expandible ──────────────────────────────────────────────

class _ExpandableGroupWidget(QFrame):
    """Grupo de tags con header clicable + opciones como chips expandibles."""

    group_edited = Signal(int)
    group_deleted = Signal(int)
    option_added = Signal(int)
    option_deleted = Signal(int, int)

    def __init__(self, group_id: int, name: str, option_count: int,
                 use_in_price: bool, required: bool, options: list[dict]):
        super().__init__()
        self._gid = group_id
        self._expanded = False
        self._options = options

        self.setObjectName("ExpandableGroup")
        self.setStyleSheet(
            f"""
            QFrame#ExpandableGroup {{
                background: rgba(255, 255, 255, 0.55);
                border: 1px solid rgba(58, 53, 48, 0.07);
                border-radius: 10px;
            }}
            """
        )

        v = QVBoxLayout(self)
        v.setContentsMargins(12, 8, 12, 8)
        v.setSpacing(6)

        # Header row
        head = QHBoxLayout()
        head.setSpacing(8)

        self._arrow = QLabel("▸")
        self._arrow.setFixedWidth(14)
        self._arrow.setStyleSheet(
            f"color: {Z.NAV_TEXT_MUTED}; font-size: 12px; background: transparent;"
        )
        head.addWidget(self._arrow)

        self._title = QLabel(name)
        self._title.setCursor(Qt.CursorShape.PointingHandCursor)
        self._title.setStyleSheet(
            f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI}; font-size: 13px; "
            f"font-weight: 600; background: transparent;"
        )
        head.addWidget(self._title, 1)

        badges = QHBoxLayout()
        badges.setSpacing(4)
        if use_in_price:
            bp = QLabel("precio")
            bp.setStyleSheet(
                f"color: {Z.PRIMARY}; font-family: {Z.FONT_UI}; font-size: 9px; "
                f"font-weight: 600; background: {Z.PRIMARY_PALE}; border-radius: 4px; "
                f"padding: 1px 5px;"
            )
            badges.addWidget(bp)
        if required:
            br = QLabel("obligatorio")
            br.setStyleSheet(
                f"color: {Z.GOLD}; font-family: {Z.FONT_UI}; font-size: 9px; "
                f"font-weight: 600; background: rgba(201, 168, 50, 0.12); "
                f"border-radius: 4px; padding: 1px 5px;"
            )
            badges.addWidget(br)
        head.addLayout(badges)

        count = QLabel(f"{option_count}")
        count.setStyleSheet(
            f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; font-size: 11px; "
            f"background: transparent;"
        )
        head.addWidget(count)

        btn_edit = QPushButton()
        btn_edit.setFixedSize(26, 26)
        btn_edit.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_edit.setToolTip("Editar grupo")
        try:
            btn_edit.setIcon(qta.icon("fa5s.pen", color=Z.NAV_TEXT_MUTED))
            btn_edit.setIconSize(QSize(12, 12))
        except Exception:
            btn_edit.setText("✎")
        btn_edit.setStyleSheet(
            "QPushButton { background: transparent; border: none; border-radius: 4px; }"
            f"QPushButton:hover {{ background: rgba(58, 53, 48, 0.08); }}"
        )
        btn_edit.clicked.connect(lambda: self.group_edited.emit(self._gid))
        head.addWidget(btn_edit)

        btn_del = QPushButton()
        btn_del.setFixedSize(26, 26)
        btn_del.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_del.setToolTip("Eliminar grupo")
        try:
            btn_del.setIcon(qta.icon("fa5s.trash-alt", color="rgba(168, 74, 74, 0.6)"))
            btn_del.setIconSize(QSize(12, 12))
        except Exception:
            btn_del.setText("×")
        btn_del.setStyleSheet(
            "QPushButton { background: transparent; border: none; border-radius: 4px; }"
            "QPushButton:hover { background: rgba(168, 74, 74, 0.08); }"
        )
        btn_del.clicked.connect(lambda: self.group_deleted.emit(self._gid))
        head.addWidget(btn_del)

        v.addLayout(head)

        # Body (collapsed by default)
        self._body = QWidget()
        self._body.setVisible(False)
        body_lay = QVBoxLayout(self._body)
        body_lay.setContentsMargins(22, 4, 0, 4)
        body_lay.setSpacing(6)

        self._chips_host = QWidget()
        self._chips_lay = _FlowLayout(self._chips_host, h_spacing=6, v_spacing=6)
        body_lay.addWidget(self._chips_host)

        self._rebuild_chips()

        btn_add_opt = _action_btn("+ Agregar opción")
        btn_add_opt.clicked.connect(lambda: self.option_added.emit(self._gid))
        body_lay.addWidget(btn_add_opt, alignment=Qt.AlignmentFlag.AlignLeft)

        v.addWidget(self._body)

        # Make header clickable
        self._title.mousePressEvent = lambda e: self._toggle()
        self._arrow.mousePressEvent = lambda e: self._toggle()

    def _toggle(self) -> None:
        self._expanded = not self._expanded
        self._body.setVisible(self._expanded)
        self._arrow.setText("▾" if self._expanded else "▸")

    def _rebuild_chips(self) -> None:
        while self._chips_lay.count():
            it = self._chips_lay.takeAt(0)
            if it.widget():
                it.widget().deleteLater()
        for opt in self._options:
            ch = _chip(opt["name"])
            ch.setToolTip(f"Clic derecho para eliminar «{opt['name']}»")
            ch.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
            ch.customContextMenuRequested.connect(
                partial(self._ctx_delete_opt, opt["id"])
            )
            self._chips_lay.addWidget(ch)

    def _ctx_delete_opt(self, opt_id: int, _pos) -> None:
        self.option_deleted.emit(self._gid, opt_id)


class _FlowLayout(QVBoxLayout):
    """Minimal flow-like layout using wrapped rows."""

    def __init__(self, parent=None, h_spacing=6, v_spacing=6):
        super().__init__(parent)
        self.setContentsMargins(0, 0, 0, 0)
        self.setSpacing(v_spacing)
        self._h_spacing = h_spacing
        self._rows: list[QHBoxLayout] = []
        self._current_row: QHBoxLayout | None = None
        self._widget_count = 0

    def addWidget(self, w, *args, **kwargs):
        if self._current_row is None or self._widget_count % 5 == 0:
            self._current_row = QHBoxLayout()
            self._current_row.setSpacing(self._h_spacing)
            self._current_row.setContentsMargins(0, 0, 0, 0)
            self._current_row.setAlignment(Qt.AlignmentFlag.AlignLeft)
            self._rows.append(self._current_row)
            super().addLayout(self._current_row)
        self._current_row.addWidget(w)
        self._widget_count += 1


# ── Widget de regla de precio ────────────────────────────────────────────────

class _RuleCard(QFrame):
    """Tarjeta de una regla de precio con sus condiciones."""

    rule_edited = Signal(int)
    rule_deleted = Signal(int)

    def __init__(self, rule_id: int, name: str, price_min: float, price_max: float,
                 priority: int, notes: str, conditions: list[tuple[str, str]]):
        super().__init__()
        self._rid = rule_id
        self.setStyleSheet(
            f"""
            QFrame {{
                background: rgba(255, 252, 248, 0.65);
                border: 1px solid rgba(58, 53, 48, 0.06);
                border-radius: 10px;
            }}
            """
        )

        v = QVBoxLayout(self)
        v.setContentsMargins(14, 10, 14, 10)
        v.setSpacing(6)

        head = QHBoxLayout()
        title = QLabel(name)
        title.setStyleSheet(
            f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI}; font-size: 12px; "
            f"font-weight: 600; background: transparent;"
        )
        head.addWidget(title, 1)

        price = QLabel(f"${price_min:.0f} – ${price_max:.0f}")
        price.setStyleSheet(
            f"color: {Z.PRIMARY}; font-family: {Z.FONT_UI}; font-size: 13px; "
            f"font-weight: 700; background: transparent;"
        )
        head.addWidget(price)
        v.addLayout(head)

        if conditions:
            tags_text = " + ".join(f"{g}: {o}" for g, o in conditions)
            tags_lb = QLabel(tags_text)
            tags_lb.setWordWrap(True)
            tags_lb.setStyleSheet(
                f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; font-size: 11px; "
                f"background: transparent;"
            )
            v.addWidget(tags_lb)

        foot = QHBoxLayout()
        foot.setSpacing(4)

        pri_lb = QLabel(f"Prioridad: {priority}")
        pri_lb.setStyleSheet(
            f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; font-size: 10px; "
            f"background: transparent;"
        )
        foot.addWidget(pri_lb)

        if notes:
            note_lb = QLabel(f"· {notes}")
            note_lb.setStyleSheet(
                f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; font-size: 10px; "
                f"font-style: italic; background: transparent;"
            )
            foot.addWidget(note_lb)

        foot.addStretch()

        btn_edit = _action_btn("Editar")
        btn_edit.setFixedHeight(26)
        btn_edit.clicked.connect(lambda: self.rule_edited.emit(self._rid))
        foot.addWidget(btn_edit)

        btn_del = _action_btn("Eliminar")
        btn_del.setFixedHeight(26)
        btn_del.clicked.connect(lambda: self.rule_deleted.emit(self._rid))
        foot.addWidget(btn_del)

        v.addLayout(foot)


# ── Página principal ─────────────────────────────────────────────────────────

class CuadernoPage(QWidget):
    """Página del cuaderno de precios, integrada en el Zen shell."""

    def __init__(self):
        super().__init__()
        self.setStyleSheet("background: transparent;")
        self._setup_ui()

    def _setup_ui(self) -> None:
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setStyleSheet("QScrollArea { background: transparent; border: none; }")

        inner = QWidget()
        inner.setStyleSheet("background: transparent;")
        self._lay = QVBoxLayout(inner)
        self._lay.setContentsMargins(28, 24, 28, 24)
        self._lay.setSpacing(16)

        # Header
        header = QHBoxLayout()
        try:
            icon = QLabel()
            icon.setFixedSize(36, 36)
            icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
            icon.setStyleSheet("background: transparent;")
            icon.setPixmap(qta.icon("fa5s.book-open", color=Z.PRIMARY).pixmap(28, 28))
            header.addWidget(icon)
        except Exception:
            pass

        title_col = QVBoxLayout()
        title_col.setSpacing(2)
        title = QLabel("Cuaderno de precios")
        title.setStyleSheet(
            f"color: {Z.PRIMARY}; font-family: {Z.FONT_UI}; "
            f"font-size: {Z.FONT_SIZE_CARD_TITLE}px; font-weight: 600; "
            f"letter-spacing: -0.35px; background: transparent;"
        )
        subtitle = QLabel(
            "Administra las etiquetas y reglas que usan para poner precio a los artículos"
        )
        subtitle.setStyleSheet(
            f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; "
            f"font-size: 12px; background: transparent;"
        )
        title_col.addWidget(title)
        title_col.addWidget(subtitle)
        header.addLayout(title_col, 1)
        self._lay.addLayout(header)

        # Accent line
        accent = QFrame()
        accent.setFixedHeight(3)
        accent.setMaximumWidth(220)
        accent.setStyleSheet(
            f"""
            QFrame {{
                background: qlineargradient(x1:0,y1:0,x2:1,y2:0,
                    stop:0 {Z.GOLD},
                    stop:0.4 {Z.PRIMARY},
                    stop:1 transparent);
                border: none; border-radius: 2px;
            }}
            """
        )
        self._lay.addWidget(accent)

        # ── Sección: Grupos de etiquetas ─────────────────────────────────
        self._lay.addSpacing(8)
        groups_header = QHBoxLayout()
        groups_header.addWidget(_section_label("Grupos de etiquetas"))
        groups_header.addStretch()
        btn_new_group = _action_btn("+ Nuevo grupo", primary=True)
        btn_new_group.clicked.connect(self._on_new_group)
        groups_header.addWidget(btn_new_group)
        self._lay.addLayout(groups_header)

        self._groups_host = QWidget()
        self._groups_host.setStyleSheet("background: transparent;")
        self._groups_lay = QVBoxLayout(self._groups_host)
        self._groups_lay.setContentsMargins(0, 0, 0, 0)
        self._groups_lay.setSpacing(6)
        self._lay.addWidget(self._groups_host)

        # ── Sección: Reglas de precio ────────────────────────────────────
        self._lay.addSpacing(16)
        rules_header = QHBoxLayout()
        rules_header.addWidget(_section_label("Reglas de precio"))
        rules_header.addStretch()
        btn_new_rule = _action_btn("+ Nueva regla", primary=True)
        btn_new_rule.clicked.connect(self._on_new_rule)
        rules_header.addWidget(btn_new_rule)
        self._lay.addLayout(rules_header)

        self._rules_host = QWidget()
        self._rules_host.setStyleSheet("background: transparent;")
        self._rules_lay = QVBoxLayout(self._rules_host)
        self._rules_lay.setContentsMargins(0, 0, 0, 0)
        self._rules_lay.setSpacing(6)
        self._lay.addWidget(self._rules_host)

        # ── Sección: Configuración auto-llenado ─────────────────────────
        self._lay.addSpacing(16)
        self._lay.addWidget(_section_label("Auto-llenado al registrar producto"))

        config_card = _card_frame()
        cl = QVBoxLayout(config_card)
        cl.setContentsMargins(16, 14, 16, 14)
        cl.setSpacing(10)

        mode_row = QHBoxLayout()
        mode_label = QLabel("Modo de precio sugerido:")
        mode_label.setStyleSheet(
            f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI}; font-size: 12px; "
            f"font-weight: 500; background: transparent;"
        )
        mode_row.addWidget(mode_label)

        self._mode_combo = QComboBox()
        self._mode_combo.addItem("Cuaderno (reglas)", prefs.AUTO_FILL_CUADERNO)
        self._mode_combo.addItem("Patrones (inventario)", prefs.AUTO_FILL_PATRONES)
        self._mode_combo.addItem("Desactivado (manual)", prefs.AUTO_FILL_OFF)
        self._mode_combo.setStyleSheet(
            f"""
            QComboBox {{
                background: #FFFFFF; border: 1px solid rgba(58, 53, 48, 0.14);
                border-radius: 6px; padding: 5px 8px; min-height: 28px;
                font-family: {Z.FONT_UI}; font-size: 12px; color: {Z.NAV_TEXT};
            }}
            QComboBox:focus {{ border: 2px solid {Z.PRIMARY}; }}
            """
        )
        current = prefs.get_auto_fill_mode()
        idx = self._mode_combo.findData(current)
        if idx >= 0:
            self._mode_combo.setCurrentIndex(idx)
        self._mode_combo.currentIndexChanged.connect(self._on_mode_changed)
        mode_row.addWidget(self._mode_combo)
        mode_row.addStretch()
        cl.addLayout(mode_row)

        mode_desc = QLabel(
            "<b>Cuaderno:</b> usa las reglas de arriba para sugerir precio según los tags seleccionados.<br>"
            "<b>Patrones:</b> calcula la mediana de productos similares ya registrados.<br>"
            "<b>Desactivado:</b> Monserrat pone el precio manualmente cada vez."
        )
        mode_desc.setWordWrap(True)
        mode_desc.setTextFormat(Qt.TextFormat.RichText)
        mode_desc.setStyleSheet(
            f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; font-size: 11px; "
            f"line-height: 1.45; background: transparent;"
        )
        cl.addWidget(mode_desc)
        self._lay.addWidget(config_card)

        self._lay.addStretch()

        scroll.setWidget(inner)
        outer.addWidget(scroll)

    def showEvent(self, event):
        super().showEvent(event)
        self._refresh_all()

    def _refresh_all(self) -> None:
        self._refresh_groups()
        self._refresh_rules()

    # ── Grupos ───────────────────────────────────────────────────────────

    def _refresh_groups(self) -> None:
        while self._groups_lay.count():
            it = self._groups_lay.takeAt(0)
            if it.widget():
                it.widget().deleteLater()

        try:
            from src.db.connection import SessionLocal
            from src.db.models import TagGroup

            with SessionLocal() as db:
                groups = (
                    db.query(TagGroup)
                    .filter(TagGroup.active == True)
                    .order_by(TagGroup.display_order, TagGroup.name)
                    .all()
                )
                for g in groups:
                    opts = [
                        {"id": o.id, "name": o.name}
                        for o in g.options if o.active
                    ]
                    w = _ExpandableGroupWidget(
                        g.id, g.name, len(opts),
                        g.use_in_price, g.required, opts,
                    )
                    w.group_edited.connect(self._on_edit_group)
                    w.group_deleted.connect(self._on_delete_group)
                    w.option_added.connect(self._on_add_option)
                    w.option_deleted.connect(self._on_delete_option)
                    self._groups_lay.addWidget(w)
        except Exception as e:
            err = QLabel(f"Error al cargar grupos: {e}")
            err.setStyleSheet(f"color: red; font-size: 11px; background: transparent;")
            self._groups_lay.addWidget(err)

        if self._groups_lay.count() == 0:
            empty = QLabel("No hay grupos de etiquetas. Crea uno para empezar.")
            empty.setStyleSheet(
                f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; "
                f"font-size: 12px; padding: 12px; background: transparent;"
            )
            self._groups_lay.addWidget(empty)

    def _on_new_group(self) -> None:
        dlg = _GroupDialog(self, title="Nuevo grupo de etiquetas")
        if dlg.exec() != QDialog.DialogCode.Accepted:
            return
        data = dlg.result_data()
        if not data["name"]:
            QMessageBox.warning(self, "Cuaderno", "El nombre no puede estar vacío.")
            return
        try:
            from src.db.connection import SessionLocal
            from src.db.models import TagGroup

            with SessionLocal() as db:
                g = TagGroup(
                    name=data["name"],
                    use_in_price=data["use_in_price"],
                    required=data["required"],
                    display_order=data["display_order"],
                    active=True,
                )
                db.add(g)
                db.commit()
        except IntegrityError:
            QMessageBox.warning(self, "Cuaderno", f"Ya existe un grupo «{data['name']}».")
            return
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            return
        self._refresh_groups()

    def _on_edit_group(self, gid: int) -> None:
        try:
            from src.db.connection import SessionLocal
            from src.db.models import TagGroup

            with SessionLocal() as db:
                g = db.get(TagGroup, gid)
                if not g:
                    return
                dlg = _GroupDialog(
                    self, name=g.name, use_in_price=g.use_in_price,
                    required=g.required, order=g.display_order,
                    title=f"Editar «{g.name}»",
                )
                if dlg.exec() != QDialog.DialogCode.Accepted:
                    return
                data = dlg.result_data()
                if not data["name"]:
                    return
                g.name = data["name"]
                g.use_in_price = data["use_in_price"]
                g.required = data["required"]
                g.display_order = data["display_order"]
                db.commit()
        except IntegrityError:
            QMessageBox.warning(self, "Cuaderno", "Ya existe un grupo con ese nombre.")
            return
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            return
        self._refresh_groups()

    def _on_delete_group(self, gid: int) -> None:
        try:
            from src.db.connection import SessionLocal
            from src.db.models import TagGroup

            with SessionLocal() as db:
                g = db.get(TagGroup, gid)
                if not g:
                    return
                ans = QMessageBox.question(
                    self, "Eliminar grupo",
                    f"¿Eliminar «{g.name}» y todas sus opciones?\n"
                    f"Las reglas de precio que lo usen perderán esa condición.",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                )
                if ans != QMessageBox.StandardButton.Yes:
                    return
                g.active = False
                for o in g.options:
                    o.active = False
                db.commit()
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            return
        self._refresh_all()

    def _on_add_option(self, gid: int) -> None:
        from PySide6.QtWidgets import QInputDialog
        text, ok = QInputDialog.getText(
            self, "Nueva opción", "Nombre de la opción:"
        )
        if not ok or not text.strip():
            return
        try:
            from src.db.connection import SessionLocal
            from src.db.models import TagOption

            with SessionLocal() as db:
                opt = TagOption(group_id=gid, name=text.strip(), active=True)
                db.add(opt)
                db.commit()
        except IntegrityError:
            QMessageBox.warning(self, "Cuaderno", "Esa opción ya existe en este grupo.")
            return
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            return
        self._refresh_groups()

    def _on_delete_option(self, gid: int, opt_id: int) -> None:
        try:
            from src.db.connection import SessionLocal
            from src.db.models import TagOption

            with SessionLocal() as db:
                opt = db.get(TagOption, opt_id)
                if not opt:
                    return
                ans = QMessageBox.question(
                    self, "Eliminar opción",
                    f"¿Eliminar «{opt.name}»?",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                )
                if ans != QMessageBox.StandardButton.Yes:
                    return
                opt.active = False
                db.commit()
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            return
        self._refresh_groups()

    # ── Reglas ───────────────────────────────────────────────────────────

    def _load_groups_for_dialog(self) -> list[dict]:
        try:
            from src.db.connection import SessionLocal
            from src.db.models import TagGroup

            with SessionLocal() as db:
                groups = (
                    db.query(TagGroup)
                    .filter(TagGroup.active == True, TagGroup.use_in_price == True)
                    .order_by(TagGroup.display_order)
                    .all()
                )
                return [
                    {
                        "id": g.id,
                        "name": g.name,
                        "options": [
                            {"id": o.id, "name": o.name}
                            for o in g.options if o.active
                        ],
                    }
                    for g in groups
                ]
        except Exception:
            return []

    def _refresh_rules(self) -> None:
        while self._rules_lay.count():
            it = self._rules_lay.takeAt(0)
            if it.widget():
                it.widget().deleteLater()

        try:
            from src.db.connection import SessionLocal
            from src.db.models import PriceRule

            with SessionLocal() as db:
                rules = (
                    db.query(PriceRule)
                    .filter(PriceRule.active == True)
                    .order_by(PriceRule.priority.desc())
                    .all()
                )
                for r in rules:
                    conds = [
                        (c.group.name if c.group else "?", c.option.name if c.option else "?")
                        for c in r.conditions
                    ]
                    card = _RuleCard(
                        r.id, r.name, r.price_min, r.price_max,
                        r.priority, r.notes or "", conds,
                    )
                    card.rule_edited.connect(self._on_edit_rule)
                    card.rule_deleted.connect(self._on_delete_rule)
                    self._rules_lay.addWidget(card)
        except Exception as e:
            err = QLabel(f"Error al cargar reglas: {e}")
            err.setStyleSheet("color: red; font-size: 11px; background: transparent;")
            self._rules_lay.addWidget(err)

        if self._rules_lay.count() == 0:
            empty = QLabel(
                "No hay reglas de precio. Crea una para que el sistema sugiera "
                "precios automáticamente al registrar productos."
            )
            empty.setWordWrap(True)
            empty.setStyleSheet(
                f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; "
                f"font-size: 12px; padding: 12px; background: transparent;"
            )
            self._rules_lay.addWidget(empty)

    def _on_new_rule(self) -> None:
        groups = self._load_groups_for_dialog()
        if not groups:
            QMessageBox.information(
                self, "Cuaderno",
                "Primero necesitas al menos un grupo con «Usar para precio» activado "
                "y opciones cargadas.",
            )
            return
        dlg = _RuleDialog(self, groups, title="Nueva regla de precio")
        if dlg.exec() != QDialog.DialogCode.Accepted:
            return
        data = dlg.result_data()
        if not data["name"]:
            QMessageBox.warning(self, "Cuaderno", "El nombre no puede estar vacío.")
            return
        if not data["conditions"]:
            QMessageBox.warning(self, "Cuaderno", "Selecciona al menos una condición de tag.")
            return
        if data["price_min"] <= 0 or data["price_max"] <= 0:
            QMessageBox.warning(self, "Cuaderno", "Los precios deben ser mayores a 0.")
            return

        try:
            from src.db.connection import SessionLocal
            from src.db.models import PriceRule, PriceRuleCondition

            with SessionLocal() as db:
                rule = PriceRule(
                    name=data["name"],
                    price_min=data["price_min"],
                    price_max=data["price_max"],
                    priority=data["priority"],
                    notes=data["notes"],
                    active=True,
                )
                db.add(rule)
                db.flush()
                for gid, oid in data["conditions"]:
                    db.add(PriceRuleCondition(
                        rule_id=rule.id, group_id=gid, option_id=oid,
                    ))
                db.commit()
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            return
        self._refresh_rules()

    def _on_edit_rule(self, rid: int) -> None:
        groups = self._load_groups_for_dialog()
        try:
            from src.db.connection import SessionLocal
            from src.db.models import PriceRule, PriceRuleCondition

            with SessionLocal() as db:
                rule = db.get(PriceRule, rid)
                if not rule:
                    return
                existing = [(c.group_id, c.option_id) for c in rule.conditions]
                dlg = _RuleDialog(
                    self, groups,
                    name=rule.name,
                    price_min=rule.price_min,
                    price_max=rule.price_max,
                    priority=rule.priority,
                    notes=rule.notes or "",
                    existing_conditions=existing,
                    title=f"Editar «{rule.name}»",
                )
                if dlg.exec() != QDialog.DialogCode.Accepted:
                    return
                data = dlg.result_data()
                if not data["name"] or not data["conditions"]:
                    return

                rule.name = data["name"]
                rule.price_min = data["price_min"]
                rule.price_max = data["price_max"]
                rule.priority = data["priority"]
                rule.notes = data["notes"]

                for c in list(rule.conditions):
                    db.delete(c)
                db.flush()
                for gid, oid in data["conditions"]:
                    db.add(PriceRuleCondition(
                        rule_id=rule.id, group_id=gid, option_id=oid,
                    ))
                db.commit()
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            return
        self._refresh_rules()

    def _on_delete_rule(self, rid: int) -> None:
        try:
            from src.db.connection import SessionLocal
            from src.db.models import PriceRule

            with SessionLocal() as db:
                rule = db.get(PriceRule, rid)
                if not rule:
                    return
                ans = QMessageBox.question(
                    self, "Eliminar regla",
                    f"¿Eliminar la regla «{rule.name}»?",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                )
                if ans != QMessageBox.StandardButton.Yes:
                    return
                rule.active = False
                db.commit()
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            return
        self._refresh_rules()

    def _on_mode_changed(self, _idx: int) -> None:
        mode = self._mode_combo.currentData()
        if mode:
            prefs.set_auto_fill_mode(mode)
