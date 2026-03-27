"""
Banqueta — plano visual de la tienda (mismo inventario SQLite).
"""
from __future__ import annotations

import re

from PySide6.QtCore import QPoint, QRect, Qt, Signal
from PySide6.QtGui import QColor, QFont, QPainter, QPen
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QSpinBox,
    QVBoxLayout,
    QWidget,
)

from src.db.connection import SessionLocal
from src.db.models import PlanoItem, Producto, TiendaPlano
from src.ui.tokens import (
    BG_CONTENT,
    BORDER_MED,
    PRIMARY,
    PRIMARY_PALE,
    RADIUS_SM,
    TEXT_BODY,
    TEXT_MUTED,
    TEXT_STRONG,
)

_CELL = 42
_GAP = 2
_MARGIN = 10


def _hex_for_producto(p: Producto, override: str = "") -> str:
    o = (override or "").strip()
    if re.match(r"^#[0-9A-Fa-f]{6}$", o):
        return o
    raw = (p.color or "").strip()
    if re.match(r"^#[0-9A-Fa-f]{6}$", raw):
        return raw
    qc = QColor(raw)
    if qc.isValid() and raw:
        return qc.name()
    h = sum(ord(c) for c in p.codigo) % 360
    c = QColor.fromHsl(h, 48, 78, 255)
    return c.name()


class StoreGridWidget(QWidget):
    cellSelected = Signal(object)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._cols = 14
        self._rows = 10
        self._cells: dict[tuple[int, int], tuple[str, str, str]] = {}
        self._sel: tuple[int, int] | None = None
        self.setMouseTracking(True)
        self.setCursor(Qt.CursorShape.CrossCursor)

    def set_dimensions(self, cols: int, rows: int) -> None:
        self._cols = max(4, min(32, cols))
        self._rows = max(4, min(24, rows))
        self._resize_to_grid()
        self.update()

    def set_cells(self, data: dict[tuple[int, int], tuple[str, str, str]]) -> None:
        self._cells = dict(data)
        self._resize_to_grid()
        self.update()

    def clear_selection(self) -> None:
        self._sel = None
        self.update()

    def _resize_to_grid(self) -> None:
        cw = _CELL + _GAP
        w = _MARGIN * 2 + self._cols * cw - _GAP
        h = _MARGIN * 2 + self._rows * cw - _GAP
        self.setMinimumSize(w, h)
        self.resize(w, h)

    def _at(self, pos: QPoint) -> tuple[int, int] | None:
        x = pos.x() - _MARGIN
        y = pos.y() - _MARGIN
        cw = _CELL + _GAP
        if x < 0 or y < 0:
            return None
        cx = int(x // cw)
        cy = int(y // cw)
        if x - cx * cw > _CELL or y - cy * cw > _CELL:
            return None
        if 0 <= cx < self._cols and 0 <= cy < self._rows:
            return cx, cy
        return None

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            c = self._at(e.position().toPoint())
            self._sel = c
            self.cellSelected.emit(c)
            self.update()

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.fillRect(self.rect(), QColor("#F0EEEB"))
        pen_grid = QPen(QColor("#D8D5D0"))
        pen_grid.setWidth(1)
        p.setPen(pen_grid)
        cw = _CELL + _GAP
        for gy in range(self._rows):
            for gx in range(self._cols):
                x = _MARGIN + gx * cw
                y = _MARGIN + gy * cw
                r = QRect(x, y, _CELL, _CELL)
                key = (gx, gy)
                if key in self._cells:
                    codigo, hx, _ = self._cells[key]
                    p.fillRect(r, QColor(hx))
                    p.setPen(QPen(QColor("#2A2A2A"), 1))
                    p.drawRect(r)
                    p.setPen(QPen(QColor("#1A1A1A")))
                    p.setFont(QFont("Segoe UI", 7))
                    p.drawText(
                        r.adjusted(2, 2, -2, -2),
                        Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignTop,
                        codigo[:8],
                    )
                else:
                    p.fillRect(r, QColor(BG_CONTENT))
                    p.setPen(pen_grid)
                    p.drawRect(r)
                if self._sel == key:
                    p.setPen(QPen(QColor(PRIMARY), 2))
                    p.drawRect(r.adjusted(1, 1, -1, -1))


class _NuevoPlanoDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Nuevo plano de tienda")
        self._nombre = QLineEdit()
        self._nombre.setPlaceholderText("Ej. Salón principal, Feria…")
        self._cols = QSpinBox()
        self._cols.setRange(8, 28)
        self._cols.setValue(14)
        self._rows = QSpinBox()
        self._rows.setRange(6, 20)
        self._rows.setValue(10)
        form = QFormLayout()
        form.addRow("Nombre:", self._nombre)
        form.addRow("Columnas:", self._cols)
        form.addRow("Filas:", self._rows)
        bb = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay = QVBoxLayout(self)
        lay.addLayout(form)
        lay.addWidget(bb)

    def values(self) -> tuple[str, int, int]:
        return self._nombre.text().strip() or "Sin nombre", self._cols.value(), self._rows.value()


class _ElegirProductoDialog(QDialog):
    def __init__(self, productos: list[Producto], parent=None):
        super().__init__(parent)
        self.setWindowTitle("Colocar artículo")
        self.setMinimumSize(340, 420)
        self._all = productos
        self._picked: Producto | None = None
        self._filter = QLineEdit()
        self._filter.setPlaceholderText("Buscar por código o descripción…")
        self._list = QListWidget()
        self._list.setAlternatingRowColors(True)
        self._list.setStyleSheet(
            f"""
            QListWidget {{
                background-color: {BG_CONTENT};
                color: {TEXT_BODY};
                alternate-background-color: #FAF8F6;
                border: 1px solid {BORDER_MED};
                border-radius: 6px;
            }}
            QListWidget::item {{
                padding: 6px 8px;
            }}
            QListWidget::item:selected {{
                background-color: {PRIMARY_PALE};
                color: {TEXT_STRONG};
            }}
            QListWidget::item:selected:!active {{
                background-color: {PRIMARY_PALE};
                color: {TEXT_STRONG};
            }}
            """
        )
        for pr in productos:
            it = QListWidgetItem(
                f"{pr.codigo}  ·  ${pr.precio:.2f}  ·  {(pr.descripcion or '')[:40]}"
            )
            it.setData(Qt.ItemDataRole.UserRole, pr.id)
            self._list.addItem(it)
        self._filter.textChanged.connect(self._refilter)
        self._list.itemDoubleClicked.connect(lambda _: self._ok())
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Cancel)
        bb.rejected.connect(self.reject)
        ok = QPushButton("Usar selección")
        ok.clicked.connect(self._ok)
        bb.addButton(ok, QDialogButtonBox.ButtonRole.AcceptRole)
        lay = QVBoxLayout(self)
        lay.addWidget(self._filter)
        lay.addWidget(self._list, 1)
        lay.addWidget(bb)

    def _refilter(self, t: str):
        t = t.lower().strip()
        self._list.clear()
        for pr in self._all:
            blob = f"{pr.codigo} {(pr.descripcion or '')}".lower()
            if t and t not in blob:
                continue
            it = QListWidgetItem(
                f"{pr.codigo}  ·  ${pr.precio:.2f}  ·  {(pr.descripcion or '')[:40]}"
            )
            it.setData(Qt.ItemDataRole.UserRole, pr.id)
            self._list.addItem(it)

    def _ok(self):
        it = self._list.currentItem()
        if not it:
            return
        pid = it.data(Qt.ItemDataRole.UserRole)
        self._picked = next((p for p in self._all if p.id == pid), None)
        if self._picked:
            self.accept()

    def producto(self) -> Producto | None:
        return self._picked


class BanquetaMapPage(QWidget):
    def __init__(self, standalone: bool = False, parent=None):
        super().__init__(parent)
        self._standalone = standalone
        self._plano_id: int | None = None
        self._cell: tuple[int, int] | None = None

        root = QHBoxLayout(self)
        root.setContentsMargins(16, 16, 16, 16)
        root.setSpacing(16)

        left = QVBoxLayout()
        left.setSpacing(10)
        tit = QLabel("Plano de tienda")
        tit.setFont(QFont("Segoe UI", 14, QFont.Weight.DemiBold))
        tit.setStyleSheet(f"color: {TEXT_STRONG};")
        left.addWidget(tit)
        expl = QLabel(
            "Mismo inventario que el ERP. Cada celda es un lugar; el color resume la prenda."
        )
        expl.setWordWrap(True)
        expl.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 9pt; max-width: 220px;")
        left.addWidget(expl)

        self._combo = QComboBox()
        self._combo.currentIndexChanged.connect(self._on_plano_changed)
        left.addWidget(QLabel("Planos"))
        left.addWidget(self._combo)

        bn = QPushButton("Nuevo plano…")
        bn.clicked.connect(self._nuevo_plano)
        bd = QPushButton("Eliminar plano")
        bd.clicked.connect(self._eliminar_plano)
        left.addWidget(bn)
        left.addWidget(bd)
        left.addStretch(1)
        root.addLayout(left, 0)

        self._grid = StoreGridWidget()
        self._grid.cellSelected.connect(self._on_cell)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(self._grid)
        scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        root.addWidget(scroll, 1)

        right = QVBoxLayout()
        right.setSpacing(8)
        self._detail_title = QLabel("Celda")
        self._detail_title.setFont(QFont("Segoe UI", 10, QFont.Weight.DemiBold))
        self._detail_title.setStyleSheet(f"color: {TEXT_STRONG};")
        right.addWidget(self._detail_title)
        self._detail_body = QLabel("Seleccioná una celda en la cuadrícula.")
        self._detail_body.setWordWrap(True)
        self._detail_body.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 9pt;")
        self._detail_body.setMinimumWidth(200)
        right.addWidget(self._detail_body)
        self._btn_place = QPushButton("Colocar artículo aquí")
        self._btn_remove = QPushButton("Quitar de esta celda")
        self._btn_place.clicked.connect(self._colocar)
        self._btn_remove.clicked.connect(self._quitar)
        self._btn_place.setVisible(False)
        self._btn_remove.setVisible(False)
        for b in (self._btn_place, self._btn_remove):
            b.setStyleSheet(
                f"""
                QPushButton {{
                    background: {BG_CONTENT}; color: {TEXT_BODY};
                    border: 1px solid {BORDER_MED}; border-radius: {RADIUS_SM}px;
                    padding: 8px 12px; text-align: left;
                }}
                QPushButton:hover {{ border-color: {PRIMARY}; color: {TEXT_STRONG}; }}
                """
            )
            right.addWidget(b)
        right.addStretch(1)
        root.addLayout(right, 0)

        self._reload_planes()

    def _reload_planes(self):
        self._combo.blockSignals(True)
        self._combo.clear()
        with SessionLocal() as s:
            self._ensure_default(s)
            planes = s.query(TiendaPlano).order_by(TiendaPlano.nombre).all()
            for pl in planes:
                self._combo.addItem(pl.nombre, pl.id)
        if self._combo.count() == 0:
            self._plano_id = None
            self._combo.blockSignals(False)
            return
        if self._plano_id is None:
            self._combo.setCurrentIndex(0)
            self._plano_id = self._combo.currentData()
        else:
            idx = self._combo.findData(self._plano_id)
            self._combo.setCurrentIndex(0 if idx < 0 else idx)
            self._plano_id = self._combo.currentData()
        self._combo.blockSignals(False)
        self._refresh_grid_data()

    def _ensure_default(self, s) -> None:
        if s.query(TiendaPlano).count() == 0:
            p = TiendaPlano(nombre="Salón principal", notas="Plano por defecto", cols=14, rows=10)
            s.add(p)
            s.commit()

    def _on_plano_changed(self, idx: int):
        if idx < 0 or self._combo.count() == 0:
            return
        self._plano_id = self._combo.currentData()
        self._cell = None
        self._grid.clear_selection()
        self._detail_body.setText("Seleccioná una celda en la cuadrícula.")
        self._detail_body.setTextFormat(Qt.TextFormat.PlainText)
        self._btn_place.setVisible(False)
        self._btn_remove.setVisible(False)
        self._refresh_grid_data()

    def _refresh_grid_data(self):
        if self._plano_id is None:
            return
        cells: dict[tuple[int, int], tuple[str, str, str]] = {}
        with SessionLocal() as s:
            pl = s.get(TiendaPlano, self._plano_id)
            if not pl:
                return
            cols, rows = pl.cols, pl.rows
            q = (
                s.query(PlanoItem, Producto)
                .join(Producto, PlanoItem.producto_id == Producto.id)
                .filter(PlanoItem.plano_id == pl.id)
            )
            for pi, pr in q:
                hx = _hex_for_producto(pr, pi.display_color or "")
                desc = (pr.descripcion or "")[:24]
                cells[(pi.grid_x, pi.grid_y)] = (pr.codigo, hx, desc)
        self._grid.set_dimensions(cols, rows)
        self._grid.set_cells(cells)

    def _on_cell(self, c: object) -> None:
        self._cell = c  # type: ignore
        if not c or self._plano_id is None:
            self._detail_title.setText("Celda")
            self._detail_body.setText("Seleccioná una celda en la cuadrícula.")
            self._detail_body.setTextFormat(Qt.TextFormat.PlainText)
            self._btn_place.setVisible(False)
            self._btn_remove.setVisible(False)
            return
        gx, gy = c
        self._detail_title.setText(f"Celda ({gx + 1}, {gy + 1})")
        with SessionLocal() as s:
            row = (
                s.query(PlanoItem, Producto)
                .join(Producto, PlanoItem.producto_id == Producto.id)
                .filter(
                    PlanoItem.plano_id == self._plano_id,
                    PlanoItem.grid_x == gx,
                    PlanoItem.grid_y == gy,
                )
                .one_or_none()
            )
        if row:
            pi, pr = row
            hx = _hex_for_producto(pr, pi.display_color or "")
            self._detail_body.setText(
                f"<b>{pr.codigo}</b><br/>"
                f"${pr.precio:.2f} · {pr.estado}<br/>"
                f"{(pr.descripcion or '—')[:200]}<br/>"
                f"<span style='color:{TEXT_MUTED}'>Color vista: <b style='color:{hx}'>{hx}</b></span>"
            )
            self._detail_body.setTextFormat(Qt.TextFormat.RichText)
            self._btn_place.setVisible(False)
            self._btn_remove.setVisible(True)
        else:
            self._detail_body.setText("Celda vacía. Podés colocar un artículo del inventario.")
            self._detail_body.setTextFormat(Qt.TextFormat.PlainText)
            self._btn_place.setVisible(True)
            self._btn_remove.setVisible(False)

    def _productos_disponibles(self) -> list[Producto]:
        with SessionLocal() as s:
            ocupados = set()
            if self._plano_id:
                for pi in s.query(PlanoItem).filter(PlanoItem.plano_id == self._plano_id):
                    ocupados.add(pi.producto_id)
            q = (
                s.query(Producto)
                .filter(Producto.estado.in_(["disponible", "en_banqueta"]))
                .order_by(Producto.codigo)
            )
            return [p for p in q if p.id not in ocupados]

    def _colocar(self):
        if self._cell is None or self._plano_id is None:
            return
        prods = self._productos_disponibles()
        if not prods:
            QMessageBox.information(
                self,
                "Inventario",
                "No hay artículos disponibles (disponible / en banqueta) "
                "sin colocar ya en este plano.",
            )
            return
        d = _ElegirProductoDialog(prods, self)
        if d.exec() != QDialog.DialogCode.Accepted or not d.producto():
            return
        pr = d.producto()
        gx, gy = self._cell
        with SessionLocal() as s:
            ex = (
                s.query(PlanoItem)
                .filter(
                    PlanoItem.plano_id == self._plano_id,
                    PlanoItem.grid_x == gx,
                    PlanoItem.grid_y == gy,
                )
                .one_or_none()
            )
            if ex:
                return
            s.add(
                PlanoItem(
                    plano_id=self._plano_id,
                    producto_id=pr.id,
                    grid_x=gx,
                    grid_y=gy,
                    display_color="",
                )
            )
            s.commit()
        self._refresh_grid_data()
        self._on_cell(self._cell)

    def _quitar(self):
        if self._cell is None or self._plano_id is None:
            return
        gx, gy = self._cell
        with SessionLocal() as s:
            row = (
                s.query(PlanoItem)
                .filter(
                    PlanoItem.plano_id == self._plano_id,
                    PlanoItem.grid_x == gx,
                    PlanoItem.grid_y == gy,
                )
                .one_or_none()
            )
            if row:
                s.delete(row)
                s.commit()
        self._refresh_grid_data()
        self._on_cell(self._cell)

    def _nuevo_plano(self):
        d = _NuevoPlanoDialog(self)
        if d.exec() != QDialog.DialogCode.Accepted:
            return
        nombre, cols, rows = d.values()
        with SessionLocal() as s:
            p = TiendaPlano(nombre=nombre, cols=cols, rows=rows)
            s.add(p)
            s.commit()
            new_id = p.id
        self._plano_id = new_id
        self._reload_planes()

    def _eliminar_plano(self):
        if self._plano_id is None:
            return
        name = self._combo.currentText()
        if (
            QMessageBox.question(
                self,
                "Eliminar plano",
                f"¿Eliminar «{name}» y todas las prendas colocadas en él?",
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        with SessionLocal() as s:
            pl = s.get(TiendaPlano, self._plano_id)
            if pl:
                s.delete(pl)
                s.commit()
        self._plano_id = None
        self._cell = None
        self._reload_planes()
