"""
Diálogo para elegir tags de producto (un combo por grupo activo).
"""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QLabel,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from src.ui.zen_desktop import theme as Z


def _dialog_qss() -> str:
    return f"""
        QDialog {{
            background: {Z.CARD_BG};
            border-radius: 12px;
        }}
        QLabel {{
            font-family: {Z.FONT_UI};
            color: {Z.NAV_TEXT};
            background: transparent;
        }}
        QComboBox {{
            font-family: {Z.FONT_UI};
            font-size: 12px;
            background: #FFFFFF;
            border: 1px solid rgba(58, 53, 48, 0.14);
            border-radius: 6px;
            padding: 5px 8px;
            min-height: 28px;
            color: {Z.NAV_TEXT};
        }}
        QComboBox:focus {{
            border: 2px solid {Z.PRIMARY};
        }}
        QComboBox QAbstractItemView {{
            background-color: #FFFFFF;
            color: #3A3530;
            selection-background-color: #FDF0F4;
            selection-color: #3A3530;
            border: 1px solid rgba(58, 53, 48, 0.14);
            outline: none;
            padding: 2px;
        }}
        QComboBox QAbstractItemView::item {{
            color: #3A3530;
            min-height: 24px;
            padding: 4px 8px;
        }}
        QComboBox QAbstractItemView::item:selected {{
            background-color: #FDF0F4;
            color: #3A3530;
        }}
        QComboBox QAbstractItemView::item:hover {{
            background-color: rgba(196, 96, 126, 0.14);
            color: #3A3530;
        }}
    """


class ProductoTagsDialog(QDialog):
    """
    Selección de un tag por grupo (todos los grupos activos con opciones).
    Devuelve mapa group_id -> option_id (solo grupos con opción elegida).
    """

    def __init__(
        self,
        parent: QWidget | None,
        *,
        initial: dict[int, int] | None = None,
        title: str = "Tags del producto",
    ):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setMinimumWidth(400)
        self.setStyleSheet(_dialog_qss())

        initial = initial or {}
        self._combos: list[tuple[int, QComboBox]] = []

        root = QVBoxLayout(self)
        root.setSpacing(10)

        hint = QLabel(
            "Elige una opción por grupo. Los grupos marcados como obligatorios en el "
            "Cuaderno deben tener selección al guardar."
        )
        hint.setWordWrap(True)
        hint.setStyleSheet(
            f"color: {Z.NAV_TEXT_MUTED}; font-size: 11px; background: transparent;"
        )
        root.addWidget(hint)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        scroll.setStyleSheet("QScrollArea { background: transparent; border: none; }")

        inner = QWidget()
        inner.setStyleSheet("background: transparent;")
        form = QFormLayout(inner)
        form.setSpacing(10)
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

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
                    opts = [o for o in g.options if o.active]
                    if not opts:
                        continue
                    combo = QComboBox()
                    combo.addItem("— sin elegir —", None)
                    for o in sorted(opts, key=lambda x: x.name):
                        combo.addItem(o.name, o.id)
                    pre = initial.get(g.id)
                    if pre is not None:
                        ix = combo.findData(pre)
                        if ix >= 0:
                            combo.setCurrentIndex(ix)
                    form.addRow(f"{g.name}:", combo)
                    self._combos.append((g.id, combo))
        except Exception as e:
            err = QLabel(f"No se pudieron cargar los grupos: {e}")
            err.setWordWrap(True)
            err.setStyleSheet("color: #a44; font-size: 11px;")
            form.addRow(err)

        scroll.setWidget(inner)
        root.addWidget(scroll, 1)

        # Refuerzo en Windows: el popup a veces ignora parte del QSS del diálogo.
        _pop_qss = """
            QAbstractItemView {
                background-color: #FFFFFF;
                color: #3A3530;
                selection-background-color: #FDF0F4;
                selection-color: #3A3530;
                outline: none;
                padding: 2px;
            }
        """
        for _gid, combo in self._combos:
            combo.view().setStyleSheet(_pop_qss)

        bb = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        root.addWidget(bb)

    def result_selection(self) -> dict[int, int]:
        out: dict[int, int] = {}
        for gid, combo in self._combos:
            oid = combo.currentData()
            if oid is not None:
                out[gid] = int(oid)
        return out


def open_producto_tags_dialog(
    parent: QWidget | None,
    *,
    initial: dict[int, int] | None = None,
    title: str = "Tags del producto",
) -> dict[int, int] | None:
    dlg = ProductoTagsDialog(parent, initial=initial, title=title)
    if dlg.exec() != QDialog.DialogCode.Accepted:
        return None
    return dlg.result_selection()
