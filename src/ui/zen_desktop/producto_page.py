"""
Módulo Productos / Inventario — alta de producto y listado (SQLite).

Dos columnas: formulario (tono cálido) | inventario (blanco suave).
Acciones: AGREGAR guarda en BD; tabla y filtros enlazados a `productos`.
"""
from __future__ import annotations

import shutil
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable

import qtawesome as qta
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from PySide6.QtCore import Qt, QSize, Signal, QTimer
from PySide6.QtGui import QAction, QActionGroup, QColor, QFontMetrics, QPixmap, QResizeEvent, QShowEvent
from PySide6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QStyle,
    QDoubleSpinBox,
    QFileDialog,
    QFrame,
    QGraphicsDropShadowEffect,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QInputDialog,
    QMenu,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QSplitter,
    QTabWidget,
    QTableWidget,
    QTableWidgetItem,
    QToolButton,
    QVBoxLayout,
    QWidget,
)

from src.core.paths import PRODUCT_IMAGES_DIR, ensure_data_dirs
from src.core import producto_prefs as prefs
from src.services import producto_alta as alta
from src.ui.zen_desktop import barcode_probe, hw_services, theme as Z
from src.ui.zen_desktop import settings as zsettings
from src.ui.zen_desktop.producto_referencia_detalle_dialog import open_referencia_detalle
from src.ui.zen_desktop.producto_tags_dialog import open_producto_tags_dialog

def _safe_unlink_product_image(imagen_path: str) -> None:
    """Borra archivo de imagen solo si está bajo ``product_images`` (evita rutas arbitrarias)."""
    p = (imagen_path or "").strip()
    if not p:
        return
    try:
        fp = Path(p).resolve()
        base = PRODUCT_IMAGES_DIR.resolve()
        if not fp.is_file():
            return
        if base not in fp.parents and fp.parent != base:
            return
        fp.unlink(missing_ok=True)
    except OSError:
        pass


def _normalize_codigo_lookup(raw: str) -> str:
    """Limpia entrada manual o de lector de código de barras."""
    s = (raw or "").strip()
    if not s:
        return ""
    n = barcode_probe.normalize_code128_payload(s)
    return (n or s).strip()


# Columna formulario: ancha mínima delgada; la tabla se come el resto
_FORM_COL_MIN = 328
_FORM_COL_DEFAULT = 336

# Zona superior izquierda (etiquetas + iconos); calibrada con título+filtros+gap derecho
_RIGHT_TOP_BLOCK_H = 80
# Hueco bajo filtros (derecha) para alinear pestañas con la columna formulario
_RIGHT_PRE_TABS_GAP_H = 10

_ESTADO_LABEL = {
    "disponible": "Disponible",
    "vendido": "Vendido",
    "en_banqueta": "En banqueta",
    "reservado": "Reservado",
}


def _confirmar_ajuste_precios_con_lista(
    parent: QWidget,
    *,
    n: int,
    resumen: str,
    lista_txt: str,
) -> bool:
    """
    Advertencia modal: muestra la lista de artículos y precios antes de tocar la base.
    Devuelve True si el usuario confirma.
    """
    dlg = QDialog(parent)
    dlg.setWindowTitle("Advertencia — confirmar cambio de precios")
    dlg.setModal(True)
    dlg.setMinimumSize(560, 480)
    dlg.setStyleSheet(
        f"QDialog {{ background-color: #FDF9F7; color: {Z.NAV_TEXT}; }}"
        f"QLabel {{ color: {Z.NAV_TEXT}; }}"
        f"QPlainTextEdit {{ background-color: #FFFFFF; color: {Z.NAV_TEXT}; "
        f"border: 1px solid rgba(58,53,48,0.15); border-radius: 6px; padding: 8px; "
        "font-family: Consolas, 'Cascadia Mono', monospace; font-size: 10px; }}"
        f"QPushButton {{ min-width: 120px; padding: 8px 14px; font-family: {Z.FONT_UI}; }}"
    )
    root = QVBoxLayout(dlg)
    root.setContentsMargins(16, 16, 16, 12)
    root.setSpacing(12)

    top = QHBoxLayout()
    ic = QLabel()
    pm = dlg.style().standardIcon(
        QStyle.StandardPixmap.SP_MessageBoxWarning
    ).pixmap(QSize(44, 44))
    ic.setPixmap(pm)
    top.addWidget(ic, 0, Qt.AlignmentFlag.AlignTop)
    head = QLabel(
        f"<b>Vas a cambiar el precio de {n} artículo(s).</b><br><br>"
        "Revisá la lista abajo. Si no coincide con lo que querés, tocá "
        "<b>Cancelar</b>. Esto <b>no se deshace</b> solo."
    )
    head.setWordWrap(True)
    head.setTextFormat(Qt.TextFormat.RichText)
    top.addWidget(head, 1)
    root.addLayout(top)

    sub = QLabel(resumen)
    sub.setWordWrap(True)
    sub.setStyleSheet(f"font-size: 11px; color: {Z.NAV_TEXT_MUTED};")
    root.addWidget(sub)

    root.addWidget(QLabel("<b>Detalle (código · precio actual → nuevo · descripción):</b>"))
    te = QPlainTextEdit()
    te.setReadOnly(True)
    te.setPlainText(lista_txt)
    te.setMinimumHeight(300)
    root.addWidget(te, 1)

    bb = QDialogButtonBox()
    btn_ok = bb.addButton(
        "Sí, aplicar cambios", QDialogButtonBox.ButtonRole.YesRole
    )
    btn_cancel = bb.addButton("Cancelar", QDialogButtonBox.ButtonRole.RejectRole)
    btn_cancel.setDefault(True)
    btn_ok.setAutoDefault(False)
    btn_cancel.setAutoDefault(True)
    bb.accepted.connect(dlg.accept)
    bb.rejected.connect(dlg.reject)
    root.addWidget(bb)

    return dlg.exec() == QDialog.DialogCode.Accepted


class AjustarPreciosDialog(QDialog):
    """
    Ajuste masivo por tags elegidos en el mismo diálogo.
    Modos: %, suma/resta, o precio fijo. Coincidencia de tags: amplia o exacta.
    """

    # Máximo de filas en la lista de la advertencia al aplicar (evita congelar la UI).
    _MAX_LISTA_ADVERTENCIA = 2500

    def __init__(
        self,
        parent: QWidget,
        *,
        initial_tags: dict[int, int],
        query_builder: Callable[[Any, bool, set[int]], Any],
        on_done: Callable[[], None],
    ) -> None:
        super().__init__(parent)
        self.setObjectName("AjustarPreciosDialog")
        self.setWindowTitle("Ajustar precios por tags")
        self.setMinimumWidth(560)
        self.setMinimumHeight(380)
        self._tags_by_group: dict[int, int] = dict(initial_tags)
        self._query_builder = query_builder
        self._on_done = on_done
        self.setStyleSheet(_ajustar_precios_dialog_qss())

        root = QVBoxLayout(self)
        root.setContentsMargins(16, 16, 16, 12)
        root.setSpacing(10)

        intro = QLabel(
            "Elegí los tags, cómo deben coincidir y cómo cambia el precio. "
            "Al tocar «Aplicar a la base» vas a ver una advertencia con la lista de artículos "
            "y precios (actual → nuevo) para confirmar o cancelar."
        )
        intro.setWordWrap(True)
        intro.setStyleSheet(f"font-family: {Z.FONT_UI}; font-size: 11px;")
        root.addWidget(intro)

        gb_tags = QGroupBox("Tags a filtrar")
        lt = QVBoxLayout(gb_tags)
        lt.setSpacing(8)
        self._lbl_tags_pick = QLabel("—")
        self._lbl_tags_pick.setWordWrap(True)
        self._lbl_tags_pick.setStyleSheet(
            f"font-family: {Z.FONT_UI}; font-size: 11px; color: {Z.NAV_TEXT}; "
            "background: transparent;"
        )
        lt.addWidget(self._lbl_tags_pick)
        btn_tags = QPushButton("Elegir o cambiar tags…")
        btn_tags.setObjectName("AjusteTagsBtn")
        btn_tags.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_tags.clicked.connect(self._on_pick_tags)
        lt.addWidget(btn_tags, 0, Qt.AlignmentFlag.AlignLeft)
        root.addWidget(gb_tags)

        gb_match = QGroupBox("¿Qué artículos entran según esos tags?")
        ml = QVBoxLayout(gb_match)
        ml.setSpacing(6)
        ml.addWidget(QLabel("Criterio:"))
        self._cb_match = QComboBox()
        self._cb_match.setMinimumWidth(420)
        self._cb_match.addItem(
            "Al menos esos tags (debe tener todos; puede tener otros además)",
            "loose",
        )
        self._cb_match.addItem(
            "Solo esos tags (exactamente el mismo conjunto, ni más ni menos)",
            "strict",
        )
        ml.addWidget(self._cb_match)
        _hint_m = QLabel(
            "Elegí en la lista: «al menos» incluye artículos con tags extra; "
            "«solo esos» exige que no tengan ningún tag de más."
        )
        _hint_m.setWordWrap(True)
        _hint_m.setStyleSheet(
            f"font-size: 10px; color: {Z.NAV_TEXT_MUTED}; background: transparent;"
        )
        ml.addWidget(_hint_m)
        root.addWidget(gb_match)

        gb = QGroupBox("Cómo ajustar el precio")
        gl = QVBoxLayout(gb)
        gl.setSpacing(6)
        gl.addWidget(QLabel("Tipo de ajuste:"))
        self._cb_adj = QComboBox()
        self._cb_adj.setMinimumWidth(420)
        self._cb_adj.addItem("Porcentaje sobre el precio actual", "pct")
        self._cb_adj.addItem("Sumar o restar un monto fijo", "sum")
        self._cb_adj.addItem("Precio fijo (todos pasan a ese monto)", "fix")
        self._cb_adj.currentIndexChanged.connect(lambda _i: self._sync_adjustment_controls())
        gl.addWidget(self._cb_adj)

        self._sp_pct = QDoubleSpinBox()
        self._sp_pct.setRange(-90.0, 500.0)
        self._sp_pct.setDecimals(1)
        self._sp_pct.setSuffix(" %")
        self._sp_pct.setValue(0.0)
        self._sp_pct.setToolTip("Ej.: 10 = sube 10 %, -15 = baja 15 %")
        hp = QHBoxLayout()
        hp.setSpacing(10)
        hp.addWidget(QLabel("Valor %:"))
        hp.addWidget(self._sp_pct, 1)
        gl.addLayout(hp)

        self._sp_sum = QDoubleSpinBox()
        self._sp_sum.setRange(-999_999.0, 999_999.0)
        self._sp_sum.setDecimals(2)
        self._sp_sum.setPrefix("$ ")
        self._sp_sum.setValue(0.0)
        hs = QHBoxLayout()
        hs.setSpacing(10)
        hs.addWidget(QLabel("Monto ±:"))
        hs.addWidget(self._sp_sum, 1)
        gl.addLayout(hs)

        self._sp_fixed = QDoubleSpinBox()
        self._sp_fixed.setRange(0.0, 999_999.0)
        self._sp_fixed.setDecimals(2)
        self._sp_fixed.setPrefix("$ ")
        self._sp_fixed.setValue(0.0)
        self._sp_fixed.setToolTip("Ej.: 150 — todos los que coincidan quedan en ese precio.")
        hf = QHBoxLayout()
        hf.setSpacing(10)
        hf.addWidget(QLabel("Precio fijo:"))
        hf.addWidget(self._sp_fixed, 1)
        gl.addLayout(hf)

        root.addWidget(gb)

        round_wrap = QVBoxLayout()
        round_row = QHBoxLayout()
        round_row.addWidget(QLabel("Redondeo (solo % o suma):"))
        self._cb_round = QComboBox()
        self._cb_round.addItem("Sin cambio (2 decimales)", "centavos")
        self._cb_round.addItem("Entero más cercano", "entero")
        self._cb_round.addItem("A .00 o .50", "medio")
        self._cb_round.addItem("Terminar en .90 (suelo tienda)", "punto90")
        round_row.addWidget(self._cb_round, 1)
        round_wrap.addLayout(round_row)
        self._lbl_round_hint = QLabel(
            "Con «precio fijo» el redondeo no aplica: se guarda el monto exacto del recuadro."
        )
        self._lbl_round_hint.setWordWrap(True)
        self._lbl_round_hint.setStyleSheet(
            f"font-family: {Z.FONT_UI}; font-size: 10px; color: {Z.NAV_TEXT_MUTED};"
        )
        self._lbl_round_hint.hide()
        round_wrap.addWidget(self._lbl_round_hint)
        root.addLayout(round_wrap)

        self._update_tags_summary_label()
        self._sync_adjustment_controls()

        bb = QDialogButtonBox()
        btn_apply = bb.addButton(
            "Aplicar a la base", QDialogButtonBox.ButtonRole.ApplyRole
        )
        bb.addButton("Cerrar", QDialogButtonBox.ButtonRole.RejectRole)
        btn_apply.clicked.connect(self._on_apply)
        bb.rejected.connect(self.reject)
        root.addWidget(bb)

    def _strict_exact_tags(self) -> bool:
        return self._cb_match.currentData() == "strict"

    def _adj_mode(self) -> str:
        m = self._cb_adj.currentData()
        return str(m) if m is not None else "pct"

    def _tag_option_ids(self) -> set[int]:
        return set(self._tags_by_group.values())

    def _update_tags_summary_label(self) -> None:
        oids = self._tag_option_ids()
        if not oids:
            self._lbl_tags_pick.setText(
                "Todavía no elegiste tags. Usá «Elegir o cambiar tags…» (se copian los del "
                "formulario Principal si venías de ahí)."
            )
            return
        try:
            from src.db.connection import SessionLocal
            from src.db.models import TagOption

            with SessionLocal() as db:
                names = [
                    r.name
                    for r in db.query(TagOption)
                    .filter(TagOption.id.in_(oids))
                    .order_by(TagOption.name)
                    .all()
                ]
            self._lbl_tags_pick.setText(
                "Selección actual: " + (", ".join(names) if names else str(oids))
            )
        except Exception as e:
            self._lbl_tags_pick.setText(f"Tags elegidos (ids): {sorted(oids)} — ({e})")

    def _on_pick_tags(self) -> None:
        sel = open_producto_tags_dialog(
            self,
            initial=dict(self._tags_by_group),
            title="Tags para ajustar precios",
        )
        if sel is None:
            return
        self._tags_by_group = dict(sel)
        self._update_tags_summary_label()

    def _sync_adjustment_controls(self) -> None:
        mode = self._adj_mode()
        self._sp_pct.setEnabled(mode == "pct")
        self._sp_sum.setEnabled(mode == "sum")
        self._sp_fixed.setEnabled(mode == "fix")
        use_round = mode != "fix"
        self._cb_round.setEnabled(use_round)
        self._lbl_round_hint.setVisible(mode == "fix")

    def _modo_desc(self) -> str:
        mode = self._adj_mode()
        if mode == "fix":
            return f"precio fijo ${self._sp_fixed.value():.2f}"
        if mode == "pct":
            return f"{self._sp_pct.value():+.1f} %"
        return f"{self._sp_sum.value():+.2f} $"

    def _redondeo_desc(self) -> str:
        if self._adj_mode() == "fix":
            return "no aplica (precio exacto)"
        return self._cb_round.currentText()

    @staticmethod
    def _round_price(p: float, mode: str) -> float:
        import math

        p = max(0.0, float(p))
        if mode == "centavos":
            return round(p, 2)
        if mode == "entero":
            return float(round(p))
        if mode == "medio":
            return round(p * 2.0) / 2.0
        if mode == "punto90":
            if p < 5.0:
                return round(p, 2)
            return round(math.floor(p) + 0.9, 2)
        return round(p, 2)

    def _compute_new_price(self, old: float) -> float:
        mode = self._adj_mode()
        if mode == "fix":
            return max(0.0, round(float(self._sp_fixed.value()), 2))
        old = float(old or 0.0)
        if mode == "pct":
            new = old * (1.0 + self._sp_pct.value() / 100.0)
        else:
            new = old + self._sp_sum.value()
        mode = self._cb_round.currentData()
        return self._round_price(new, mode)

    def _format_preview_block(
        self,
        rows: list,
        *,
        max_lines: int,
        tag_names: str,
        criterio: str,
        modo: str,
        redondeo: str,
        n_total: int,
    ) -> str:
        lines: list[str] = []
        lines.append(f"Tags filtro: {tag_names}")
        lines.append(f"Criterio: {criterio}")
        lines.append(f"Ajuste indicado: {modo} · Redondeo: {redondeo}")
        lines.append(f"Total de artículos afectados: {n_total}")
        lines.append("")
        lines.append("código          precio actual → nuevo   descripción")
        lines.append("-" * 72)
        shown = 0
        for p in rows:
            if shown >= max_lines:
                rest = max(0, n_total - max_lines)
                lines.append("")
                lines.append(f"… y {rest} artículo(s) más (no mostrados). Revisá el total arriba.")
                break
            cod = (p.codigo or "").strip() or "—"
            old = float(p.precio or 0)
            new = self._compute_new_price(old)
            desc = ((p.descripcion or "").replace("\n", " "))[:42]
            lines.append(f"{cod[:14]:<14}  ${old:>8.2f} → ${new:>8.2f}  {desc}")
            shown += 1
        return "\n".join(lines)

    def _on_apply(self) -> None:
        from src.db.connection import SessionLocal
        from src.db.models import Producto, TagOption

        strict = self._strict_exact_tags()
        mode = self._adj_mode()
        if mode == "pct":
            if abs(self._sp_pct.value()) < 1e-9:
                QMessageBox.warning(self, "Ajustar precios", "Indicá un porcentaje distinto de 0.")
                return
        elif mode == "sum":
            if abs(self._sp_sum.value()) < 1e-9:
                QMessageBox.warning(self, "Ajustar precios", "Indicá un monto distinto de 0.")
                return
        else:
            if self._sp_fixed.value() < 0:
                QMessageBox.warning(self, "Ajustar precios", "El precio fijo no puede ser negativo.")
                return

        try:
            with SessionLocal() as db:
                oids = self._tag_option_ids()
                if not oids:
                    QMessageBox.warning(
                        self,
                        "Ajustar precios",
                        "Elegí al menos un tag antes de aplicar.",
                    )
                    return
                q = self._query_builder(db, strict, oids)
                n = q.count()
                if n == 0:
                    QMessageBox.warning(
                        self,
                        "Ajustar precios",
                        "No hay artículos que cumplan ese criterio de tags.",
                    )
                    return
                rows = q.order_by(Producto.codigo.asc()).all()
        except Exception as e:
            QMessageBox.critical(self, "Ajustar precios", str(e))
            return

        modo_txt = self._modo_desc()
        rnd_txt = self._redondeo_desc()
        criterio = (
            "Solo esos tags (exacto)"
            if strict
            else "Al menos esos tags (puede haber más)"
        )
        names = []
        try:
            with SessionLocal() as db:
                names = [
                    r.name
                    for r in db.query(TagOption)
                    .filter(TagOption.id.in_(oids))
                    .order_by(TagOption.name)
                    .all()
                ]
        except Exception:
            pass
        tag_line = ", ".join(names) if names else "(tags)"

        cap = min(len(rows), self._MAX_LISTA_ADVERTENCIA)
        lista_rows = rows[:cap]
        detail = self._format_preview_block(
            lista_rows,
            max_lines=cap,
            tag_names=tag_line,
            criterio=criterio,
            modo=modo_txt,
            redondeo=rnd_txt,
            n_total=n,
        )
        if n > cap:
            detail += (
                f"\n\n… Lista truncada en pantalla: se muestran {cap} de {n} artículos. "
                "El ajuste igual afectará a todos los que cumplan el filtro."
            )

        resumen = (
            f"Tags: {tag_line}\n"
            f"Criterio: {criterio}\n"
            f"Ajuste: {modo_txt} · Redondeo: {rnd_txt}"
        )
        if not _confirmar_ajuste_precios_con_lista(
            self, n=n, resumen=resumen, lista_txt=detail
        ):
            return

        try:
            with SessionLocal() as db:
                q = self._query_builder(db, strict, oids)
                for p in q.all():
                    p.precio = self._compute_new_price(float(p.precio or 0))
                db.commit()
        except Exception as e:
            QMessageBox.critical(self, "Ajustar precios", str(e))
            return

        self._on_done()
        QMessageBox.information(
            self,
            "Ajustar precios",
            f"Se actualizaron {n} precio(s).",
        )
        self.accept()


class _InvFilterComboBox(QComboBox):
    """Evita que la rueda cambie el filtro al hacer scroll sobre la tabla."""

    def wheelEvent(self, event) -> None:
        if self.hasFocus():
            super().wheelEvent(event)
        else:
            event.ignore()


def _inventory_filter_lineedit_qss() -> str:
    """QLineEdit con colores explícitos (Fusion + QSS parcial suele dejar texto/fondo raro)."""
    return f"""
        QLineEdit {{
            background-color: #FFFFFF;
            color: {Z.NAV_TEXT};
            border: 2px solid rgba(58, 53, 48, 0.14);
            border-radius: 6px;
            padding: 5px 10px;
            font-family: {Z.FONT_UI};
            font-size: 11px;
            selection-background-color: {Z.PRIMARY_LIGHT};
            selection-color: {Z.NAV_TEXT};
        }}
        QLineEdit:hover {{
            border-color: rgba(58, 53, 48, 0.22);
        }}
        QLineEdit:focus {{
            border: 2px solid {Z.PRIMARY};
        }}
        QLineEdit:disabled {{
            background-color: rgba(245, 243, 240, 0.95);
            color: {Z.NAV_TEXT_MUTED};
        }}
        QLineEdit QToolButton {{
            background: transparent;
            border: none;
            border-radius: 3px;
            width: 18px;
            height: 18px;
        }}
        QLineEdit QToolButton:hover {{
            background: rgba(58, 53, 48, 0.08);
        }}
    """


def _inventory_filter_combobox_qss() -> str:
    """QComboBox completo: flecha, desplegable y lista (QAbstractItemView)."""
    return f"""
        QComboBox {{
            background-color: #FFFFFF;
            color: {Z.NAV_TEXT};
            border: 2px solid rgba(58, 53, 48, 0.14);
            border-radius: 6px;
            padding: 5px 34px 5px 10px;
            min-height: 20px;
            font-family: {Z.FONT_UI};
            font-size: 11px;
        }}
        QComboBox:hover {{
            border-color: rgba(58, 53, 48, 0.22);
        }}
        QComboBox:focus {{
            border: 2px solid {Z.PRIMARY};
        }}
        QComboBox:disabled {{
            background-color: rgba(245, 243, 240, 0.95);
            color: {Z.NAV_TEXT_MUTED};
        }}
        QComboBox::drop-down {{
            subcontrol-origin: padding;
            subcontrol-position: center right;
            width: 28px;
            border: none;
            border-left: 1px solid rgba(58, 53, 48, 0.1);
            border-top-right-radius: 5px;
            border-bottom-right-radius: 5px;
            background-color: rgba(245, 243, 240, 0.9);
        }}
        QComboBox::down-arrow {{
            image: none;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 5px solid rgba(58, 53, 48, 0.55);
            width: 0;
            height: 0;
            margin-right: 2px;
        }}
        QComboBox QAbstractItemView {{
            background-color: #FFFFFF;
            color: {Z.NAV_TEXT};
            selection-background-color: {Z.PRIMARY_PALE};
            selection-color: {Z.PRIMARY};
            border: 1px solid rgba(58, 53, 48, 0.14);
            outline: none;
            padding: 2px;
        }}
    """


def _ajustar_precios_dialog_qss() -> str:
    """Estilos explícitos: en Windows/Fusion a veces el diálogo hereda fondo oscuro y el texto queda ilegible."""
    t = Z.NAV_TEXT
    m = Z.NAV_TEXT_MUTED
    return f"""
        QDialog#AjustarPreciosDialog {{
            background-color: #FDF9F7;
            color: {t};
        }}
        QDialog#AjustarPreciosDialog QLabel {{
            color: {t};
            background: transparent;
        }}
        QDialog#AjustarPreciosDialog QGroupBox {{
            color: {t};
            background-color: transparent;
            border: none;
            margin-top: 12px;
            padding-top: 8px;
            font-family: {Z.FONT_UI};
            font-size: 11px;
            font-weight: 600;
        }}
        QDialog#AjustarPreciosDialog QGroupBox::title {{
            subcontrol-origin: margin;
            left: 8px;
            padding: 0 4px;
            color: {t};
        }}
        QDialog#AjustarPreciosDialog QDoubleSpinBox {{
            background-color: #FFFFFF;
            color: {t};
            border: 2px solid rgba(58, 53, 48, 0.14);
            border-radius: 6px;
            padding: 5px 10px;
            min-height: 22px;
            font-family: {Z.FONT_UI};
            font-size: 11px;
        }}
        QDialog#AjustarPreciosDialog QDoubleSpinBox:disabled {{
            background-color: rgba(245, 243, 240, 0.95);
            color: {m};
        }}
        QDialog#AjustarPreciosDialog QComboBox {{
            background-color: #FFFFFF;
            color: {t};
            border: 2px solid rgba(58, 53, 48, 0.14);
            border-radius: 6px;
            padding: 5px 34px 5px 10px;
            min-height: 22px;
            font-family: {Z.FONT_UI};
            font-size: 11px;
        }}
        QDialog#AjustarPreciosDialog QComboBox QAbstractItemView {{
            background-color: #FFFFFF;
            color: {t};
            selection-background-color: {Z.PRIMARY_PALE};
            selection-color: {Z.PRIMARY};
        }}
        QDialog#AjustarPreciosDialog QPushButton {{
            background-color: rgba(255, 255, 255, 0.95);
            color: {t};
            border: 2px solid rgba(58, 53, 48, 0.14);
            border-radius: 8px;
            padding: 6px 14px;
            font-family: {Z.FONT_UI};
            font-size: 11px;
        }}
        QDialog#AjustarPreciosDialog QPushButton:hover {{
            border-color: {Z.PRIMARY};
            color: {Z.PRIMARY};
        }}
        QDialog#AjustarPreciosDialog QDialogButtonBox QPushButton {{
            min-width: 88px;
        }}
        QDialog#AjustarPreciosDialog QPushButton#AjusteTagsBtn {{
            background-color: {Z.PRIMARY_PALE};
            color: {Z.PRIMARY};
            border: 2px solid {Z.PRIMARY};
            font-weight: 600;
        }}
        QDialog#AjustarPreciosDialog QPushButton#AjusteTagsBtn:hover {{
            background-color: {Z.PRIMARY_LIGHT};
            color: {Z.PRIMARY_HOVER};
        }}
    """


def _muted_label(text: str) -> QLabel:
    lb = QLabel(text)
    lb.setWordWrap(True)
    lb.setStyleSheet(
        f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; font-size: 10px; "
        "background: transparent;"
    )
    return lb


def _section_title(text: str) -> QLabel:
    lb = QLabel(text)
    lb.setStyleSheet(
        f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI}; font-size: 12px; "
        f"font-weight: 700; background: transparent; "
        f"border-bottom: 1px solid rgba(58, 53, 48, 0.12); padding-bottom: 4px;"
    )
    return lb


def _card_form_panel() -> QFrame:
    """Panel izquierdo: tono cálido / rosa suave (contraste vs inventario)."""
    f = QFrame()
    f.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
    f.setObjectName("ProductoFormPanel")
    f.setStyleSheet(
        f"""
        QFrame#ProductoFormPanel {{
            background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                stop:0 rgba(255, 252, 250, 0.98),
                stop:1 rgba(253, 244, 248, 0.88));
            border: 1px solid rgba(196, 96, 126, 0.14);
            border-radius: 11px;
        }}
        """
    )
    return f


def _card_inventory_panel() -> QFrame:
    """Panel derecho: más frío y papel blanco (tabla legible)."""
    f = QFrame()
    f.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
    f.setObjectName("ProductoInvPanel")
    f.setStyleSheet(
        f"""
        QFrame#ProductoInvPanel {{
            background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                stop:0 rgba(255, 255, 255, 0.97),
                stop:1 rgba(248, 246, 243, 0.94));
            border: 1px solid rgba(58, 53, 48, 0.1);
            border-radius: 11px;
        }}
        """
    )
    return f


def _action_caption(text: str) -> QLabel:
    lb = QLabel(text)
    lb.setAlignment(Qt.AlignmentFlag.AlignHCenter)
    lb.setStyleSheet(
        f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI}; font-size: 8.7px; "
        f"font-weight: 700; letter-spacing: 0.06em; background: transparent;"
    )
    return lb


def _icon_action_button(
    icon_name: str,
    tooltip: str,
    *,
    primary: bool = False,
    danger: bool = False,
) -> QPushButton:
    """Botón cuadrado solo icono; borde claro para que se lea como botón (estilo escritorio)."""
    b = QPushButton()
    b.setFixedSize(36, 36)
    b.setToolTip(tooltip)
    b.setCursor(Qt.CursorShape.PointingHandCursor)
    b.setFocusPolicy(Qt.FocusPolicy.NoFocus)

    try:
        if primary:
            ico = qta.icon(icon_name, color="#FFFFFF")
        elif danger:
            ico = qta.icon(icon_name, color="#B85C4A")
        else:
            ico = qta.icon(icon_name, color=Z.NAV_TEXT)
        b.setIcon(ico)
        b.setIconSize(QSize(18, 18))
    except Exception:
        b.setText("·")
        b.setStyleSheet(f"color: {Z.NAV_TEXT_MUTED}; font-size: 16px;")

    if primary:
        bg = Z.PRIMARY
        bg_h = Z.PRIMARY_HOVER
        border = Z.PRIMARY
        b.setStyleSheet(
            f"""
            QPushButton {{
                background: {bg};
                border: 2px solid {border};
                border-radius: 7px;
            }}
            QPushButton:hover {{ background: {bg_h}; border-color: {bg_h}; }}
            QPushButton:pressed {{ background: {bg_h}; padding-top: 1px; }}
            """
        )
    elif danger:
        b.setStyleSheet(
            f"""
            QPushButton {{
                background: rgba(255, 250, 248, 0.95);
                border: 2px solid rgba(184, 92, 74, 0.45);
                border-radius: 7px;
            }}
            QPushButton:hover {{
                background: rgba(184, 92, 74, 0.12);
                border-color: #B85C4A;
            }}
            """
        )
    else:
        b.setStyleSheet(
            f"""
            QPushButton {{
                background: rgba(255, 255, 255, 0.95);
                border: 2px solid rgba(58, 53, 48, 0.16);
                border-radius: 7px;
            }}
            QPushButton:hover {{
                background: rgba(253, 240, 244, 0.65);
                border-color: {Z.PRIMARY};
            }}
            """
        )
    return b


def _apply_tab_widget_no_base_line(tw: QTabWidget) -> None:
    """Quita la línea horizontal que Fusion dibuja bajo la fila de pestañas."""
    tw.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
    bar = tw.tabBar()
    bar.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
    if hasattr(bar, "setDrawBase"):
        bar.setDrawBase(False)


def _form_tab_stylesheet() -> str:
    """Pestañas del formulario: compactas; sin línea negra (tab-bar + drawBase off)."""
    return f"""
        QTabWidget#ProductoFormTabs {{
            border: none;
            outline: none;
        }}
        QTabWidget#ProductoFormTabs::pane {{
            border: none;
            border-radius: 0 6px 6px 6px;
            background: rgba(255, 255, 255, 0.72);
            top: 0px;
        }}
        QTabWidget#ProductoFormTabs::tab-bar {{
            border: none;
            background: transparent;
            left: 2px;
        }}
        QTabWidget#ProductoFormTabs QTabBar {{
            border: none;
            background: transparent;
        }}
        QTabWidget#ProductoFormTabs QTabBar::tab {{
            font-family: {Z.FONT_UI};
            font-size: 9px;
            font-weight: 600;
            color: {Z.NAV_TEXT_MUTED};
            background: rgba(220, 216, 210, 0.75);
            border: 1px solid rgba(58, 53, 48, 0.08);
            border-bottom: none;
            border-top-left-radius: 5px;
            border-top-right-radius: 5px;
            min-height: 10px;
            padding: 2px 7px;
            margin-top: 4px;
            margin-right: 0px;
        }}
        QTabWidget#ProductoFormTabs QTabBar::tab:selected {{
            color: {Z.PRIMARY};
            font-weight: 700;
            background: rgba(255, 255, 255, 0.98);
            border-color: rgba(196, 96, 126, 0.32);
            border-bottom: 2px solid {Z.PRIMARY};
            margin-top: 0px;
            padding-top: 3px;
            padding-bottom: 3px;
        }}
        QTabWidget#ProductoFormTabs QTabBar::tab:!selected:hover {{
            background: rgba(255, 252, 250, 0.92);
            color: {Z.NAV_TEXT};
            border-color: rgba(196, 96, 126, 0.18);
        }}
    """


def _inventory_tab_stylesheet() -> str:
    """Lista / +6 meses: más chicas; misma limpieza de línea que el formulario."""
    return f"""
        QTabWidget#ProductoInvTabs {{
            border: none;
            outline: none;
        }}
        QTabWidget#ProductoInvTabs::pane {{
            border: none;
            border-radius: 0 6px 6px 6px;
            background: rgba(255, 255, 255, 0.55);
            top: 0px;
        }}
        QTabWidget#ProductoInvTabs::tab-bar {{
            border: none;
            background: transparent;
            left: 2px;
        }}
        QTabWidget#ProductoInvTabs QTabBar {{
            border: none;
            background: transparent;
        }}
        QTabWidget#ProductoInvTabs QTabBar::tab {{
            font-family: {Z.FONT_UI};
            font-size: 9px;
            font-weight: 600;
            color: {Z.NAV_TEXT_MUTED};
            background: rgba(240, 237, 232, 0.95);
            border: 1px solid rgba(58, 53, 48, 0.1);
            border-bottom: none;
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            min-height: 9px;
            padding: 2px 8px;
            margin-top: 3px;
            margin-right: 0px;
        }}
        QTabWidget#ProductoInvTabs QTabBar::tab:selected {{
            color: {Z.NAV_TEXT};
            font-weight: 700;
            background: rgba(255, 255, 255, 0.98);
            border-color: rgba(58, 53, 48, 0.18);
            border-bottom: 2px solid rgba(58, 53, 48, 0.22);
            margin-top: 0px;
            padding-top: 3px;
            padding-bottom: 3px;
        }}
        QTabWidget#ProductoInvTabs QTabBar::tab:!selected:hover {{
            background: rgba(255, 255, 255, 0.88);
            color: {Z.NAV_TEXT};
            border-color: rgba(58, 53, 48, 0.14);
        }}
    """


def _placeholder_tab(title: str, body: str) -> QWidget:
    w = QWidget()
    w.setStyleSheet("background: transparent;")
    v = QVBoxLayout(w)
    v.setContentsMargins(10, 10, 10, 10)
    v.setSpacing(8)
    v.addWidget(_section_title(title))
    v.addWidget(_muted_label(body))
    v.addStretch(1)
    return w


def _small_field_label(text: str) -> QLabel:
    lb = QLabel(text)
    lb.setStyleSheet(
        f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; font-size: 9px; "
        f"font-weight: 600; letter-spacing: 0.04em; background: transparent;"
    )
    return lb


def _form_lineedit_qss() -> str:
    return (
        f"QLineEdit {{ background: #FFF; color: {Z.NAV_TEXT}; "
        f"border: 2px solid rgba(58,53,48,0.14); border-radius: 6px; "
        f"padding: 4px 8px; font-family: {Z.FONT_UI}; font-size: 11px; }}"
    )


_LBL_MONO = (
    '"Segoe UI", "Segoe UI Variable Text", Arial, "Helvetica Neue", sans-serif'
)
def _precio_str_para_etiqueta(valor: float) -> str:
    """Mismo criterio visual que la vista previa de etiqueta."""
    if valor == int(valor):
        return f"${int(valor)}"
    return f"${valor:.2f}"


class ProductoEtiquetaPreviewWidget(QWidget):
    """
    Maqueta tipo etiqueta térmica: empresa, nombre, PRECIO, Code128 (PNG nítido)
    y debajo el mismo código en texto espaciado (legible).
    """

    def __init__(self) -> None:
        super().__init__()
        self.setStyleSheet("background: transparent;")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(4)

        self._card = QFrame()
        self._card.setFixedSize(318, 178)
        self._card.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self._card.setStyleSheet(
            """
            QFrame {
                background: #FFFFFF;
                border: 1px solid rgba(0,0,0,0.08);
                border-radius: 6px;
            }
            """
        )
        cv = QVBoxLayout(self._card)
        cv.setContentsMargins(8, 6, 8, 6)
        cv.setSpacing(2)

        self._lbl_empresa = QLabel("Saldos Monserrat")
        self._lbl_empresa.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._lbl_empresa.setStyleSheet(
            f"color: #000000; font-family: {_LBL_MONO}; font-size: 11px; "
            "font-weight: 700; background: transparent; padding: 0 0 1px 0;"
        )
        cv.addWidget(self._lbl_empresa)

        self._lbl_nombre = QLabel("—")
        self._lbl_nombre.setWordWrap(False)
        self._lbl_nombre.setAlignment(
            Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter
        )
        self._lbl_nombre.setStyleSheet(
            f"color: #000000; font-family: {_LBL_MONO}; font-size: 10px; "
            "font-weight: 600; background: transparent; padding: 2px 0 0 0;"
        )
        cv.addWidget(self._lbl_nombre)

        row_precio = QHBoxLayout()
        row_precio.setContentsMargins(0, 0, 0, 2)
        row_precio.setSpacing(6)
        self._lbl_precio_tag = QLabel("PRECIO:")
        self._lbl_precio_tag.setStyleSheet(
            f"color: #000000; font-family: {_LBL_MONO}; font-size: 10px; "
            "font-weight: 700; background: transparent;"
        )
        row_precio.addWidget(self._lbl_precio_tag, 0, Qt.AlignmentFlag.AlignLeft)
        self._lbl_precio_val = QLabel("$0")
        self._lbl_precio_val.setAlignment(
            Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
        )
        self._lbl_precio_val.setStyleSheet(
            f"color: #000000; font-family: {_LBL_MONO}; font-size: 12px; "
            "font-weight: 800; background: transparent;"
        )
        row_precio.addWidget(self._lbl_precio_val, 1, Qt.AlignmentFlag.AlignRight)
        cv.addLayout(row_precio)

        cv.addSpacing(4)

        bar_block = QWidget()
        bar_block.setStyleSheet("background: transparent;")
        bl = QVBoxLayout(bar_block)
        bl.setContentsMargins(0, 0, 0, 0)
        bl.setSpacing(14)

        self._barcode = QLabel()
        self._barcode.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._barcode.setFixedHeight(70)
        self._barcode.setMinimumWidth(298)
        self._barcode.setScaledContents(False)
        self._barcode.setStyleSheet(
            "background: #FFFFFF; border: none; padding: 0; margin: 0;"
        )
        bl.addWidget(self._barcode, 0, Qt.AlignmentFlag.AlignHCenter)

        self._lbl_codigo_legible = QLabel("—")
        self._lbl_codigo_legible.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._lbl_codigo_legible.setWordWrap(True)
        self._lbl_codigo_legible.setStyleSheet(
            f"color: #000000; font-family: Consolas, 'Cascadia Mono', monospace; "
            f"font-size: 10px; font-weight: 600; background: transparent; "
            "padding: 8px 2px 0 2px; letter-spacing: 0.35px;"
        )
        bl.addWidget(self._lbl_codigo_legible)

        cv.addWidget(bar_block, 0, Qt.AlignmentFlag.AlignHCenter)

        outer.addWidget(self._card, 0, Qt.AlignmentFlag.AlignHCenter)
        outer.addStretch(1)

    def update_preview(
        self,
        *,
        linea_nombre: str,
        codigo: str,
        precio_text: str,
    ) -> None:
        line = linea_nombre.strip() if linea_nombre.strip() else "—"
        fm = QFontMetrics(self._lbl_nombre.font())
        avail = max(100, self._card.width() - 20)
        self._lbl_nombre.setText(
            fm.elidedText(line, Qt.TextElideMode.ElideRight, avail)
        )
        raw_code = (codigo or "").strip()
        payload = barcode_probe.normalize_code128_payload(raw_code)
        if not payload:
            self._barcode.clear()
            self._barcode.setPixmap(QPixmap())
            self._barcode.setText("—")
            self._lbl_codigo_legible.setText("—")
        else:
            pm, err = barcode_probe.code128_to_pixmap(payload, max_width=306)
            if err or pm is None or pm.isNull():
                self._barcode.clear()
                self._barcode.setPixmap(QPixmap())
                self._barcode.setText(err or "—")
                self._lbl_codigo_legible.setText(
                    barcode_probe.codigo_legible_espaciado(raw_code or payload)
                )
            else:
                self._barcode.setText("")
                h_cap = 66
                pm2 = pm
                if pm2.height() > h_cap or pm2.width() > 306:
                    pm2 = pm2.scaled(
                        306,
                        h_cap,
                        Qt.AspectRatioMode.KeepAspectRatio,
                        Qt.TransformationMode.FastTransformation,
                    )
                self._barcode.setPixmap(pm2)
                self._lbl_codigo_legible.setText(
                    barcode_probe.codigo_legible_espaciado(raw_code or payload)
                )

        p = (precio_text or "").strip()
        if not p:
            self._lbl_precio_val.setText("$0")
        elif p.startswith("$"):
            self._lbl_precio_val.setText(p)
        else:
            try:
                v = float(p.replace(",", "."))
                self._lbl_precio_val.setText(f"${v:.0f}" if v == int(v) else f"${v:.2f}")
            except ValueError:
                self._lbl_precio_val.setText(f"${p}")


class ProductoReferenciaPanel(QWidget):
    """Referencia de precio, modo (tuerca) y enlace a informe detallado."""

    mode_changed = Signal()

    def __init__(self) -> None:
        super().__init__()
        self.setStyleSheet("background: transparent;")
        self._last_payload: dict | None = None

        v = QVBoxLayout(self)
        v.setContentsMargins(10, 10, 10, 10)
        v.setSpacing(10)

        head = QHBoxLayout()
        head.setSpacing(8)
        ttl = _section_title("Referencia de precio")
        head.addWidget(ttl, 1)

        self._gear = QToolButton()
        self._gear.setIcon(qta.icon("fa5s.cog", color="#5c534c"))
        self._gear.setToolTip("Modo cuaderno / patrones y autocompletado")
        self._gear.setCursor(Qt.CursorShape.PointingHandCursor)
        self._gear.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        self._gear.setStyleSheet(
            "QToolButton { background: transparent; border: none; padding: 4px; }"
            "QToolButton:hover { background: rgba(196,96,126,0.12); border-radius: 6px; }"
        )
        self._menu = QMenu(self)
        self._gear.setMenu(self._menu)

        self._ag_mode = QActionGroup(self)
        self._act_cuaderno = QAction("Modo: Cuaderno de precios (reglas)", self)
        self._act_cuaderno.setCheckable(True)
        self._ag_mode.addAction(self._act_cuaderno)
        self._menu.addAction(self._act_cuaderno)

        self._act_patrones = QAction("Modo: Patrones del inventario", self)
        self._act_patrones.setCheckable(True)
        self._ag_mode.addAction(self._act_patrones)
        self._menu.addAction(self._act_patrones)

        self._ag_mode.triggered.connect(self._on_mode_action)
        self._menu.addSeparator()

        self._act_pf_c = QAction("Autocompletar precio (cuaderno)", self)
        self._act_pf_c.setCheckable(True)
        self._act_pf_c.toggled.connect(
            lambda on: prefs.set_autofill_precio_cuaderno(bool(on))
        )
        self._menu.addAction(self._act_pf_c)

        self._act_pf_p = QAction("Autocompletar precio (patrones)", self)
        self._act_pf_p.setCheckable(True)
        self._act_pf_p.toggled.connect(
            lambda on: prefs.set_autofill_precio_patrones(bool(on))
        )
        self._menu.addAction(self._act_pf_p)

        self._act_nom = QAction("Autocompletar nombre desde tags", self)
        self._act_nom.setCheckable(True)
        self._act_nom.toggled.connect(
            lambda on: prefs.set_autofill_nombre_desde_tags(bool(on))
        )
        self._menu.addAction(self._act_nom)

        for act in (self._act_pf_c, self._act_pf_p, self._act_nom):
            act.toggled.connect(self._on_autofill_toggled)

        self._menu.aboutToShow.connect(self._sync_menu_checks)
        head.addWidget(self._gear, 0, Qt.AlignmentFlag.AlignTop)
        v.addLayout(head)

        self._resultado = QLabel("")
        self._resultado.setWordWrap(True)
        self._resultado.setMinimumHeight(36)
        self._resultado.setStyleSheet(
            f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI}; font-size: 12px; "
            "font-weight: 600; background: transparent; padding: 2px 0;"
        )
        v.addWidget(self._resultado)

        self._btn_detalle = QPushButton("Ver detalles…")
        self._btn_detalle.setCursor(Qt.CursorShape.PointingHandCursor)
        self._btn_detalle.setStyleSheet(
            f"""
            QPushButton {{
                background: transparent;
                border: none;
                color: {Z.PRIMARY};
                font-family: {Z.FONT_UI};
                font-size: 11px;
                font-weight: 600;
                text-align: left;
                padding: 2px 0 6px 0;
            }}
            QPushButton:hover {{ text-decoration: underline; color: {Z.PRIMARY_HOVER}; }}
            """
        )
        self._btn_detalle.clicked.connect(self._on_ver_detalle)
        self._btn_detalle.hide()
        v.addWidget(self._btn_detalle)

        self._hint = QLabel()
        self._hint.setWordWrap(True)
        self._hint.setStyleSheet(
            f"color: {Z.NAV_TEXT_MUTED}; font-family: {Z.FONT_UI}; font-size: 10px; "
            "background: transparent;"
        )
        v.addWidget(self._hint)
        v.addStretch(1)

    def _sync_menu_checks(self) -> None:
        for x in (self._act_pf_c, self._act_pf_p, self._act_nom):
            x.blockSignals(True)
        try:
            mode = prefs.get_auto_fill_mode()
            self._act_cuaderno.setChecked(
                mode in (prefs.AUTO_FILL_CUADERNO, prefs.AUTO_FILL_OFF)
            )
            self._act_patrones.setChecked(mode == prefs.AUTO_FILL_PATRONES)
            self._act_pf_c.setChecked(prefs.autofill_precio_cuaderno())
            self._act_pf_p.setChecked(prefs.autofill_precio_patrones())
            self._act_nom.setChecked(prefs.autofill_nombre_desde_tags())
        finally:
            for x in (self._act_pf_c, self._act_pf_p, self._act_nom):
                x.blockSignals(False)

    def _on_autofill_toggled(self, _checked: bool) -> None:
        self.mode_changed.emit()

    def _on_mode_action(self, act: QAction) -> None:
        if act == self._act_patrones:
            prefs.set_auto_fill_mode(prefs.AUTO_FILL_PATRONES)
        else:
            prefs.set_auto_fill_mode(prefs.AUTO_FILL_CUADERNO)
        self.mode_changed.emit()

    def _on_ver_detalle(self) -> None:
        open_referencia_detalle(self.window(), self._last_payload)

    def refresh(self, tags_by_group: dict[int, int], exclude_codigo: str) -> None:
        option_ids = set(tags_by_group.values())
        ex = (exclude_codigo or "").strip() or None

        if not option_ids:
            self._last_payload = None
            self._resultado.setText("")
            self._btn_detalle.hide()
            self._hint.setText(
                "Elegí tags en Principal. Usá la tuerca para modo cuaderno o patrones "
                "y para activar o desactivar el autocompletado."
            )
            return

        try:
            from src.db.connection import SessionLocal

            with SessionLocal() as db:
                mode = prefs.get_auto_fill_mode()
                if mode == prefs.AUTO_FILL_PATRONES:
                    snap = alta.snapshot_referencia_patrones(
                        db,
                        option_ids,
                        ex,
                        tags_por_grupo=tags_by_group,
                    )
                else:
                    snap = alta.snapshot_referencia_cuaderno(
                        db,
                        option_ids,
                        tags_por_grupo=tags_by_group,
                    )
        except Exception as e:
            self._last_payload = None
            self._resultado.setText(f"No se pudo calcular la referencia: {e}")
            self._btn_detalle.hide()
            self._hint.clear()
            return

        self._last_payload = snap
        self._btn_detalle.show()

        if snap.get("modo") == "cuaderno":
            if snap.get("encontrado"):
                su = snap.get("sugerido")
                su_txt = f"${su:.2f}" if su is not None else "—"
                self._resultado.setText(
                    f"Cuaderno · «{snap.get('rule_name', '')}» → sugerido {su_txt} "
                    f"(rango ${snap.get('price_min', 0):.0f}–${snap.get('price_max', 0):.0f})"
                )
                self._hint.setText(
                    "Podés modificar nombre y precio antes de guardar; Monserrat decide qué dejar."
                )
            else:
                self._resultado.setText(
                    "No hay regla del cuaderno que coincida con estos tags."
                )
                self._hint.setText(snap.get("mensaje", "")[:280])
        else:
            st = snap.get("stats")
            if snap.get("encontrado") and st:
                med = float(st.get("median", st["avg"]))
                n_sel = int(st.get("tags_elegidos", 0))
                nex = int(st.get("n_conjunto_exacto", 0))
                ex = f" · {nex} con solo esos tags" if nex else ""
                self._resultado.setText(
                    f"Patrones · prendas con los {n_sel} tags elegidos{ex} · "
                    f"mediana ~${med:.0f} · {st['n']} artículo(s) · "
                    f"${st['min']:.0f}–${st['max']:.0f}"
                )
                self._hint.setText(
                    "Aproximación por productos con tags en común. Revisá detalles para la lista."
                )
            else:
                self._resultado.setText("No hay coincidencias en inventario para estos tags.")
                self._hint.setText(snap.get("mensaje", "")[:280])


def _etiqueta_tab_container(preview: ProductoEtiquetaPreviewWidget) -> QWidget:
    w = QWidget()
    w.setStyleSheet("background: transparent;")
    v = QVBoxLayout(w)
    v.setContentsMargins(10, 10, 10, 10)
    v.setSpacing(8)
    v.addWidget(_section_title("Configuración / vista previa de etiqueta"))
    v.addWidget(
        _muted_label(
            "Maqueta de impresión (sin foto). «Saldos Monserrat» es fijo. "
            "Nombre y precio según el formulario; si no hay nombre, se arma con los tags "
            "(ej. Blusa-Nike-Algodón). Code128 real y debajo el mismo código en texto espaciado."
        )
    )
    v.addWidget(preview, 1)
    return w


class ProductoPrincipalForm(QWidget):
    """Formulario: tags, código, nombre, precio, imagen."""

    def __init__(
        self,
        *,
        on_save: Callable[[], None],
        on_clear: Callable[[], None],
        on_refresh_table: Callable[[], None],
        on_cancel: Callable[[], None],
        on_form_changed: Callable[[], None],
        on_lookup_codigo: Callable[[str], None],
    ):
        super().__init__()
        self.setStyleSheet("background: transparent;")
        self._on_save = on_save
        self._on_clear = on_clear
        self._on_refresh_table = on_refresh_table
        self._on_cancel = on_cancel
        self._on_form_changed = on_form_changed
        self._on_lookup_codigo = on_lookup_codigo
        self.tags_by_group: dict[int, int] = {}
        self.pending_image_path: str | None = None
        self._editing_id: int | None = None
        self._editing_codigo_original: str = ""

        v = QVBoxLayout(self)
        v.setContentsMargins(10, 8, 10, 10)
        v.setSpacing(8)

        self._lbl_form_title = _section_title("Nuevo artículo")
        v.addWidget(self._lbl_form_title)
        self._lbl_form_hint = _muted_label(
            "Tags, nombre, precio e imagen. Código MSR automático. "
            "Doble clic en la tabla o escribí/escaneá un código y presioná Enter para editar."
        )
        self._lbl_form_hint.setWordWrap(True)
        v.addWidget(self._lbl_form_hint)

        self._tags_btn = QPushButton("Tags…")
        self._tags_btn.setMinimumHeight(32)
        self._tags_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._tags_btn.setStyleSheet(
            f"""
            QPushButton {{
                background: {Z.PRIMARY};
                color: #FFF;
                border: 2px solid {Z.PRIMARY};
                border-radius: 8px;
                font-family: {Z.FONT_UI};
                font-size: 11px;
                font-weight: 600;
            }}
            QPushButton:hover {{ background: {Z.PRIMARY_HOVER}; border-color: {Z.PRIMARY_HOVER}; }}
            """
        )
        self._tags_btn.clicked.connect(self._open_tags)
        v.addWidget(self._tags_btn)

        self._tags_frame = QFrame()
        self._tags_frame.setObjectName("ProductoTagSummary")
        self._tags_frame.setMinimumHeight(44)
        self._tags_frame.setStyleSheet(
            f"""
            QFrame#ProductoTagSummary {{
                background: rgba(255, 252, 250, 0.95);
                border: 1px dashed rgba(196, 96, 126, 0.35);
                border-radius: 8px;
            }}
            QFrame#ProductoTagSummary QLabel {{
                color: #3A3530;
                font-family: {Z.FONT_UI};
                font-size: 11px;
                background: transparent;
            }}
            """
        )
        fl = QVBoxLayout(self._tags_frame)
        fl.setContentsMargins(8, 6, 8, 6)
        self._tags_lbl = QLabel("Sin tags.")
        self._tags_lbl.setObjectName("ProductoTagSummaryText")
        self._tags_lbl.setWordWrap(True)
        fl.addWidget(self._tags_lbl)
        v.addWidget(self._tags_frame)

        v.addWidget(_small_field_label("Código"))
        self.le_codigo = QLineEdit()
        self.le_codigo.setPlaceholderText("MSR-… (Enter o lector para cargar)")
        self.le_codigo.setMinimumHeight(30)
        self.le_codigo.setStyleSheet(_form_lineedit_qss())
        self.le_codigo.textChanged.connect(lambda _t: self._emit_changed())
        self.le_codigo.returnPressed.connect(self._on_codigo_return)
        v.addWidget(self.le_codigo)

        v.addWidget(_small_field_label("Nombre"))
        self.le_nombre = QLineEdit()
        self.le_nombre.setPlaceholderText("Nombre del artículo")
        self.le_nombre.setMinimumHeight(30)
        self.le_nombre.setStyleSheet(_form_lineedit_qss())
        self.le_nombre.textChanged.connect(lambda _t: self._emit_changed())
        v.addWidget(self.le_nombre)

        v.addWidget(_small_field_label("Precio"))
        self.le_precio = QLineEdit()
        self.le_precio.setPlaceholderText("0")
        self.le_precio.setMinimumHeight(30)
        self.le_precio.setStyleSheet(_form_lineedit_qss())
        self.le_precio.textChanged.connect(lambda _t: self._emit_changed())
        v.addWidget(self.le_precio)

        v.addWidget(_small_field_label("Imagen"))
        row_img = QHBoxLayout()
        row_img.setSpacing(6)
        self._btn_img = QPushButton("Elegir…")
        self._btn_img.setMinimumHeight(30)
        self._btn_img.setCursor(Qt.CursorShape.PointingHandCursor)
        self._btn_img.setStyleSheet(
            f"""
            QPushButton {{
                background: rgba(255,255,255,0.95);
                color: {Z.NAV_TEXT};
                border: 2px solid rgba(58,53,48,0.14);
                border-radius: 6px;
                font-family: {Z.FONT_UI};
                font-size: 11px;
                padding: 4px 12px;
            }}
            QPushButton:hover {{ border-color: {Z.PRIMARY}; color: {Z.PRIMARY}; }}
            """
        )
        self._btn_img.clicked.connect(self._pick_image)
        row_img.addWidget(self._btn_img, 0)
        self._lbl_thumb = QLabel()
        self._lbl_thumb.setFixedSize(72, 72)
        self._lbl_thumb.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._lbl_thumb.setStyleSheet(
            "background: rgba(245,243,240,0.9); border-radius: 8px; "
            "border: 1px solid rgba(58,53,48,0.1); color: #8a8580; font-size: 9px;"
        )
        self._lbl_thumb.setText("—")
        self._lbl_thumb.setScaledContents(True)
        row_img.addWidget(self._lbl_thumb, 0)
        row_img.addStretch(1)
        v.addLayout(row_img)

        bot = QHBoxLayout()
        bot.setSpacing(8)
        btn_save = _icon_action_button("fa5s.save", "Guardar producto", primary=True)
        btn_save.clicked.connect(self._on_save)
        bot.addWidget(btn_save)
        btn_broom = _icon_action_button("fa5s.broom", "Limpiar formulario")
        btn_broom.clicked.connect(self._on_clear)
        bot.addWidget(btn_broom)
        btn_upd = _icon_action_button("fa5s.sync-alt", "Actualizar lista")
        btn_upd.clicked.connect(self._on_refresh_table)
        bot.addWidget(btn_upd)
        bot.addStretch(1)
        btn_x = _icon_action_button("fa5s.times-circle", "Limpiar y empezar de nuevo", danger=True)
        btn_x.clicked.connect(self._on_cancel)
        bot.addWidget(btn_x)
        v.addLayout(bot)

        v.addStretch(1)

    def _emit_changed(self) -> None:
        self._on_form_changed()

    def editing_producto_id(self) -> int | None:
        return self._editing_id

    def codigo_para_persistencia(self) -> str:
        """En edición el código de BD no cambia (aunque el campo se haya tocado)."""
        if self._editing_id is not None and self._editing_codigo_original.strip():
            return self._editing_codigo_original.strip()
        return self.le_codigo.text().strip()

    def _on_codigo_return(self) -> None:
        raw = self.le_codigo.text().strip()
        if not raw:
            return
        self._on_lookup_codigo(raw)

    def _set_thumb_from_saved_path(self, path: str) -> None:
        p = (path or "").strip()
        fp = Path(p) if p else None
        if fp and fp.is_file():
            pm = QPixmap(str(fp))
            if not pm.isNull():
                self._lbl_thumb.setPixmap(
                    pm.scaled(
                        self._lbl_thumb.size(),
                        Qt.AspectRatioMode.KeepAspectRatio,
                        Qt.TransformationMode.SmoothTransformation,
                    )
                )
                self._lbl_thumb.setText("")
                return
        self._lbl_thumb.clear()
        self._lbl_thumb.setPixmap(QPixmap())
        self._lbl_thumb.setText("—")

    def apply_loaded_product(
        self,
        *,
        product_id: int,
        codigo: str,
        descripcion: str,
        precio: float,
        tags_by_group: dict[int, int],
        imagen_path: str,
    ) -> None:
        """Carga un artículo existente para editar (sin copiar session fuera del caller)."""
        self._editing_id = product_id
        self._editing_codigo_original = (codigo or "").strip()
        self.tags_by_group = dict(tags_by_group)
        self.le_codigo.setText(self._editing_codigo_original)
        self.le_nombre.setText((descripcion or "").strip())
        self.le_precio.setText(f"{float(precio):.2f}")
        self.pending_image_path = None
        self._set_thumb_from_saved_path(imagen_path)
        self._refresh_tags_label()
        self._lbl_form_title.setText(f"Editar · {self._editing_codigo_original}")
        self._lbl_form_hint.setText(
            "Modificá datos y guardá. El código no se cambia desde aquí. "
            "Para otro artículo: limpiá o escribí otro código y Enter / lector."
        )
        self._emit_changed()

    def _pick_image(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            "Imagen del producto",
            "",
            "Imágenes (*.png *.jpg *.jpeg *.webp *.bmp);;Todos (*.*)",
        )
        if not path:
            return
        self.pending_image_path = path
        pm = QPixmap(path)
        if not pm.isNull():
            self._lbl_thumb.setPixmap(
                pm.scaled(
                    self._lbl_thumb.size(),
                    Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation,
                )
            )
            self._lbl_thumb.setText("")
        self._emit_changed()

    def _open_tags(self) -> None:
        sel = open_producto_tags_dialog(self, initial=self.tags_by_group)
        if sel is None:
            return
        self.tags_by_group = sel
        self._refresh_tags_label()
        self._maybe_autofill_nombre_tags()
        self._maybe_autofill_precio()
        self._emit_changed()

    def _refresh_tags_label(self) -> None:
        if not self.tags_by_group:
            self._tags_lbl.setText("Sin tags.")
            return
        try:
            from src.db.connection import SessionLocal

            with SessionLocal() as db:
                lines = alta.tag_labels_for_selection(db, self.tags_by_group)
            self._tags_lbl.setText(" · ".join(lines) if lines else "Sin tags.")
        except Exception:
            self._tags_lbl.setText(f"{len(self.tags_by_group)} tag(s)")

    def _maybe_autofill_nombre_tags(self) -> None:
        if not prefs.autofill_nombre_desde_tags():
            return
        if self.le_nombre.text().strip():
            return
        if not self.tags_by_group:
            return
        try:
            from src.db.connection import SessionLocal

            with SessionLocal() as db:
                ex = self.le_codigo.text().strip() or None
                nombre = alta.sugerir_nombre_desde_patrones_inventario(
                    db, self.tags_by_group, exclude_codigo=ex
                ) or ""
                if not nombre:
                    nombre = alta.nombre_etiqueta_desde_tags(db, self.tags_by_group)
            if nombre:
                self.le_nombre.setText(nombre)
        except Exception:
            pass

    def _maybe_autofill_precio(self) -> None:
        if self.le_precio.text().strip():
            return
        mode = prefs.get_auto_fill_mode()
        if mode == prefs.AUTO_FILL_OFF:
            return
        oids = set(self.tags_by_group.values())
        if not oids:
            return
        if mode == prefs.AUTO_FILL_CUADERNO and not prefs.autofill_precio_cuaderno():
            return
        if mode == prefs.AUTO_FILL_PATRONES and not prefs.autofill_precio_patrones():
            return
        try:
            from src.db.connection import SessionLocal

            with SessionLocal() as db:
                mid: float | None = None
                if mode == prefs.AUTO_FILL_CUADERNO:
                    rule = alta.best_matching_price_rule(db, oids)
                    mid = alta.suggested_price_from_rule(rule)
                elif mode == prefs.AUTO_FILL_PATRONES:
                    ex = self.le_codigo.text().strip() or None
                    st = alta.inventario_precio_stats_por_tags(
                        db, oids, exclude_codigo=ex
                    )
                    if st:
                        mid = float(st.get("median", st["avg"]))
            if mid is not None:
                self.le_precio.setText(f"{mid:.2f}")
        except Exception:
            pass

    def prepare_new_codigo(self) -> None:
        try:
            from src.db.connection import SessionLocal

            with SessionLocal() as db:
                self.le_codigo.setText(alta.next_codigo_msr(db))
        except Exception:
            self.le_codigo.clear()
        self._emit_changed()

    def clear_for_new(self) -> None:
        self._editing_id = None
        self._editing_codigo_original = ""
        self.tags_by_group.clear()
        self._tags_lbl.setText("Sin tags.")
        self.le_nombre.clear()
        self.le_precio.clear()
        self.pending_image_path = None
        self._lbl_thumb.clear()
        self._lbl_thumb.setPixmap(QPixmap())
        self._lbl_thumb.setText("—")
        self._lbl_form_title.setText("Nuevo artículo")
        self._lbl_form_hint.setText(
            "Tags, nombre, precio e imagen. Código MSR automático. "
            "Doble clic en la tabla o escribí/escaneá un código y presioná Enter para editar."
        )
        self.prepare_new_codigo()


def _inventory_table_skeleton() -> QTableWidget:
    t = QTableWidget(0, 6)
    t.setHorizontalHeaderLabels(
        ["Código", "Nombre", "Precio", "Estado", "Ingreso", "Tags"]
    )
    t.setAlternatingRowColors(True)
    t.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
    t.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
    t.setStyleSheet(
        f"""
        QTableWidget {{
            background-color: #FFFFFF;
            color: {Z.NAV_TEXT};
            /* Sin esto, Fusion/Windows a veces pinta filas alternas casi negras (palette AlternateBase). */
            alternate-background-color: #FAF5F7;
            border: 1px solid rgba(58, 53, 48, 0.12);
            border-radius: 6px;
            font-family: {Z.FONT_UI};
            font-size: 11px;
            gridline-color: rgba(58, 53, 48, 0.07);
            selection-background-color: {Z.PRIMARY_PALE};
            selection-color: {Z.NAV_TEXT};
        }}
        QTableWidget::item {{
            background-color: #FFFFFF;
            color: {Z.NAV_TEXT};
            padding: 4px 6px;
        }}
        QTableWidget::item:alternate {{
            background-color: #FAF5F7;
            color: {Z.NAV_TEXT};
        }}
        QTableWidget::item:selected {{
            background-color: {Z.PRIMARY_PALE};
            color: {Z.NAV_TEXT};
        }}
        QTableWidget::item:selected:!active {{
            background-color: {Z.PRIMARY_PALE};
            color: {Z.NAV_TEXT};
        }}
        QTableWidget QTableCornerButton::section {{
            background: rgba(245, 243, 240, 0.98);
            border: none;
            border-right: 1px solid rgba(58, 53, 48, 0.08);
            border-bottom: 1px solid rgba(58, 53, 48, 0.12);
        }}
        QHeaderView::section {{
            background: rgba(245, 243, 240, 0.98);
            color: {Z.NAV_TEXT};
            padding: 7px 6px;
            border: none;
            border-right: 1px solid rgba(58, 53, 48, 0.08);
            border-bottom: 1px solid rgba(58, 53, 48, 0.12);
            font-weight: 600;
            font-size: 10px;
        }}
        QTableWidget QHeaderView::section:vertical {{
            background: rgba(245, 243, 240, 0.98);
            color: {Z.NAV_TEXT};
            padding: 4px;
            border: none;
            border-right: 1px solid rgba(58, 53, 48, 0.08);
            border-bottom: 1px solid rgba(58, 53, 48, 0.08);
            font-weight: 600;
            font-size: 10px;
        }}
        """
    )
    # Sin columna de índices: evita esquina negra (bug Qt/Windows con QTableCornerButton).
    t.verticalHeader().setVisible(False)
    t.horizontalHeader().setStretchLastSection(True)
    return t


class ProductoPage(QWidget):
    """
    Alta de producto (SQLite), listado y filtros.
    La señal `navigate` se mantiene para compatibilidad con ZenShellWindow.
    """

    navigate = Signal(str)

    def __init__(self) -> None:
        super().__init__()
        self.setStyleSheet("background: transparent;")
        self._splitter: QSplitter | None = None
        self._deco_timer = QTimer(self)
        self._deco_timer.setSingleShot(True)
        self._deco_timer.setInterval(48)
        self._deco_timer.timeout.connect(self._repaint_inventario_chrome)

        self._etiqueta_preview = ProductoEtiquetaPreviewWidget()
        self._referencia_panel = ProductoReferenciaPanel()
        self._referencia_panel.mode_changed.connect(self._on_referencia_mode_changed)
        self._principal = ProductoPrincipalForm(
            on_save=self._on_guardar_producto,
            on_clear=self._limpiar_formulario,
            on_refresh_table=self._refresh_tables,
            on_cancel=self._limpiar_formulario,
            on_form_changed=self._sync_etiqueta_preview,
            on_lookup_codigo=self._cargar_producto_por_codigo_texto,
        )

        root = QVBoxLayout(self)
        root.setContentsMargins(10, 10, 10, 10)
        root.setSpacing(12)

        head = QLabel("Productos e inventario")
        head.setStyleSheet(
            f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI}; "
            f"font-size: {Z.FONT_SIZE_CARD_TITLE}px; font-weight: 600; "
            "background: transparent;"
        )
        root.addWidget(head)

        splitter = QSplitter(Qt.Orientation.Horizontal)
        self._splitter = splitter
        splitter.setChildrenCollapsible(False)
        splitter.setOpaqueResize(True)
        splitter.setHandleWidth(4)
        # Sin franja oscura entre columnas (suele leerse como “línea negra”)
        splitter.setStyleSheet(
            """
            QSplitter::handle {
                background: rgba(255, 255, 255, 0.15);
                border: none;
                margin: 0 2px;
            }
            QSplitter::handle:hover {
                background: rgba(196, 96, 126, 0.18);
            }
            """
        )
        splitter.splitterMoved.connect(self._schedule_inventario_deco)

        # ── Izquierda: toolbar iconos + pestañas (formulario angosto) ───────
        left_wrap = _card_form_panel()
        left_wrap.setMinimumWidth(_FORM_COL_MIN)
        ll = QVBoxLayout(left_wrap)
        # Mismos márgenes que la tarjeta derecha para alinear cabeceras
        ll.setContentsMargins(10, 10, 10, 10)
        ll.setSpacing(0)

        # Zona superior = misma altura aprox. que «Inventario» + filtros en la derecha,
        # barra de iconos pegada abajo de esa zona → filas de pestañas alineadas.
        top_zone = QWidget()
        top_zone.setFixedHeight(_RIGHT_TOP_BLOCK_H)
        top_zone.setStyleSheet("background: transparent;")
        tz_lay = QVBoxLayout(top_zone)
        # Aire inferior para que la sombra de la franja de acciones no roce el borde
        tz_lay.setContentsMargins(0, 0, 0, 3)
        tz_lay.setSpacing(0)
        tz_lay.addStretch(1)
        tz_lay.addWidget(self._create_action_toolbar())
        ll.addWidget(top_zone)

        # Aire entre iconos y pestañas (suma con zona ≈ bloque derecho antes de tabs)
        ll.addSpacing(10)

        self._center_tabs = QTabWidget()
        self._center_tabs.setObjectName("ProductoFormTabs")
        self._center_tabs.setDocumentMode(True)
        _apply_tab_widget_no_base_line(self._center_tabs)
        self._center_tabs.setStyleSheet(_form_tab_stylesheet())
        self._center_tabs.addTab(self._principal, "Principal")
        self._center_tabs.addTab(
            _etiqueta_tab_container(self._etiqueta_preview),
            "Etiqueta",
        )
        self._center_tabs.addTab(self._referencia_panel, "Referencia")
        self._center_tabs.currentChanged.connect(lambda _i: self._sync_etiqueta_preview())
        ll.addWidget(self._center_tabs, 1)

        splitter.addWidget(left_wrap)

        # ── Derecha: filtros + tabla (máximo espacio) ──────────────────────
        right_wrap = _card_inventory_panel()
        rr = QVBoxLayout(right_wrap)
        rr.setContentsMargins(10, 10, 10, 10)
        rr.setSpacing(8)

        rr.addWidget(_section_title("Inventario"))
        filt = QHBoxLayout()
        filt.setSpacing(6)
        self._search = QLineEdit()
        self._search.setPlaceholderText("Buscar…")
        self._search.setMinimumHeight(32)
        self._search.setClearButtonEnabled(True)
        self._search.setStyleSheet(_inventory_filter_lineedit_qss())
        self._search.textChanged.connect(lambda _t: self._refresh_tables())
        filt.addWidget(self._search, 3)

        self._cb_estado = _InvFilterComboBox()
        self._cb_estado.addItems(["Estado: todos", "Disponible", "En banqueta", "Vendido"])
        self._cb_estado.setMinimumHeight(32)
        self._cb_estado.setStyleSheet(_inventory_filter_combobox_qss())
        self._cb_estado.currentIndexChanged.connect(lambda _i: self._refresh_tables())
        filt.addWidget(self._cb_estado, 1)

        self._cb_vista = _InvFilterComboBox()
        self._cb_vista.addItems(["Vista: general", "Solo banqueta"])
        self._cb_vista.setMinimumHeight(32)
        self._cb_vista.setStyleSheet(_inventory_filter_combobox_qss())
        self._cb_vista.currentIndexChanged.connect(lambda _i: self._refresh_tables())
        filt.addWidget(self._cb_vista, 1)

        rr.addLayout(filt)

        pre_tabs = QWidget()
        pre_tabs.setFixedHeight(_RIGHT_PRE_TABS_GAP_H)
        pre_tabs.setStyleSheet("background: transparent;")
        rr.addWidget(pre_tabs)

        self._right_tabs = QTabWidget()
        self._right_tabs.setObjectName("ProductoInvTabs")
        self._right_tabs.setDocumentMode(True)
        _apply_tab_widget_no_base_line(self._right_tabs)
        self._right_tabs.setStyleSheet(_inventory_tab_stylesheet())

        tab_lista = QWidget()
        tl = QVBoxLayout(tab_lista)
        tl.setContentsMargins(0, 4, 0, 0)
        tl.setSpacing(4)
        self._table_main = _inventory_table_skeleton()
        self._table_main.itemDoubleClicked.connect(self._on_inventory_row_double_clicked)
        tl.addWidget(self._table_main, 1)

        tab_antiguos = QWidget()
        ta = QVBoxLayout(tab_antiguos)
        ta.setContentsMargins(0, 4, 0, 0)
        ta.addWidget(
            _muted_label(
                "Artículos disponibles con fecha de ingreso anterior a 6 meses "
                "(revisión de stock)."
            )
        )
        self._table_stale = _inventory_table_skeleton()
        self._table_stale.itemDoubleClicked.connect(self._on_inventory_row_double_clicked)
        ta.addWidget(self._table_stale, 1)

        self._right_tabs.addTab(tab_lista, "Lista")
        self._right_tabs.addTab(tab_antiguos, "+6 meses")
        rr.addWidget(self._right_tabs, 1)

        splitter.addWidget(right_wrap)

        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)
        # Formulario angosto por defecto; el resto para la tabla
        splitter.setSizes([_FORM_COL_DEFAULT, 2000])

        root.addWidget(splitter, 1)

        self._principal.prepare_new_codigo()
        self._sync_etiqueta_preview()
        self._refresh_tables()

    def _on_referencia_mode_changed(self) -> None:
        f = self._principal
        self._referencia_panel.refresh(f.tags_by_group, f.le_codigo.text())
        f._maybe_autofill_precio()
        f._maybe_autofill_nombre_tags()

    def _sync_etiqueta_preview(self) -> None:
        f = self._principal
        linea = f.le_nombre.text().strip()
        oids = set(f.tags_by_group.values())
        if not linea and oids:
            try:
                from src.db.connection import SessionLocal

                with SessionLocal() as db:
                    ex = f.le_codigo.text().strip() or None
                    linea = (
                        alta.sugerir_nombre_desde_patrones_inventario(
                            db, f.tags_by_group, exclude_codigo=ex
                        )
                        or ""
                    )
                    if not linea:
                        linea = alta.nombre_etiqueta_desde_tags(db, f.tags_by_group)
            except Exception:
                linea = ""
        if not linea:
            linea = "—"
        self._etiqueta_preview.update_preview(
            linea_nombre=linea,
            codigo=f.le_codigo.text().strip(),
            precio_text=f.le_precio.text().strip(),
        )
        self._referencia_panel.refresh(f.tags_by_group, f.le_codigo.text())

    def _create_action_toolbar(self) -> QFrame:
        """Texto arriba de cada icono + tarjeta con sombra; acciones conectadas."""
        shell = QFrame()
        shell.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        shell.setObjectName("ProductoActionStrip")
        shell.setStyleSheet(
            f"""
            QFrame#ProductoActionStrip {{
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(255, 255, 255, 0.92),
                    stop:1 rgba(253, 240, 244, 0.72));
                border: 1px solid rgba(58, 53, 48, 0.08);
                border-radius: 9px;
            }}
            """
        )
        sh = QGraphicsDropShadowEffect(shell)
        sh.setBlurRadius(14)
        sh.setOffset(0, 1)
        sh.setColor(QColor(58, 53, 48, 26))
        shell.setGraphicsEffect(sh)
        outer = QVBoxLayout(shell)
        outer.setContentsMargins(8, 7, 8, 8)
        outer.setSpacing(0)

        row = QHBoxLayout()
        row.setSpacing(4)
        row.setContentsMargins(0, 0, 0, 0)

        def col(label: str, btn: QPushButton) -> None:
            c = QVBoxLayout()
            c.setSpacing(5)
            c.setContentsMargins(0, 0, 0, 0)
            c.addWidget(_action_caption(label), 0, Qt.AlignmentFlag.AlignHCenter)
            c.addWidget(btn, 0, Qt.AlignmentFlag.AlignHCenter)
            row.addLayout(c)

        btn_add = _icon_action_button("fa5s.plus", "Guardar producto nuevo", primary=True)
        btn_add.clicked.connect(self._on_guardar_producto)
        col("AGREGAR", btn_add)
        btn_ed = _icon_action_button(
            "fa5s.edit",
            "Ir al código: escribilo o escaneá la etiqueta y presioná Enter",
        )
        btn_ed.clicked.connect(self._focus_editar_por_codigo)
        col("EDITAR", btn_ed)
        btn_del = _icon_action_button(
            "fa5s.trash-alt",
            "Quitar de la base (pedirá confirmación). Si no hay artículo cargado, pedirá el código.",
            danger=True,
        )
        btn_del.clicked.connect(self._on_eliminar_producto)
        col("ELIMINAR", btn_del)
        btn_adj = _icon_action_button("fa5s.percent", "Ajustar precios…")
        btn_adj.clicked.connect(self._open_ajuste_precios_dialog)
        col("AJUSTAR", btn_adj)
        row.addStretch(1)
        outer.addLayout(row)
        return shell

    def _focus_editar_por_codigo(self) -> None:
        self._center_tabs.setCurrentIndex(0)
        self._principal.le_codigo.setFocus(Qt.FocusReason.OtherFocusReason)
        self._principal.le_codigo.selectAll()

    def _on_inventory_row_double_clicked(self, item: QTableWidgetItem) -> None:
        if item is None:
            return
        row = item.row()
        table = item.tableWidget()
        if table is None:
            return
        it0 = table.item(row, 0)
        if it0 is None:
            return
        pid = it0.data(Qt.ItemDataRole.UserRole)
        if pid is None:
            return
        self._cargar_producto_por_id(int(pid))

    def _cargar_producto_por_codigo_texto(self, raw: str) -> None:
        c = _normalize_codigo_lookup(raw)
        if not c:
            return
        try:
            from sqlalchemy import func

            from src.db.connection import SessionLocal
            from src.db.models import Producto

            with SessionLocal() as db:
                p = (
                    db.query(Producto)
                    .filter(func.lower(Producto.codigo) == c.lower())
                    .one_or_none()
                )
                if p is None:
                    QMessageBox.warning(
                        self,
                        "Editar",
                        f"No hay ningún artículo con código «{c}».",
                    )
                    return
                pid = int(p.id)
        except Exception as e:
            QMessageBox.critical(self, "Editar", str(e))
            return
        self._cargar_producto_por_id(pid)

    def _cargar_producto_por_id(self, pid: int) -> None:
        try:
            from src.db.connection import SessionLocal
            from src.db.models import Producto

            with SessionLocal() as db:
                p = db.query(Producto).filter(Producto.id == pid).one_or_none()
                if p is None:
                    QMessageBox.warning(self, "Editar", "No se encontró el artículo.")
                    return
                tags_bg = {t.group_id: t.id for t in (p.tags or [])}
                cod = (p.codigo or "").strip()
                desc = (p.descripcion or "").strip()
                pr = float(p.precio or 0)
                img = (p.imagen_path or "").strip()
        except Exception as e:
            QMessageBox.critical(self, "Editar", str(e))
            return
        self._center_tabs.setCurrentIndex(0)
        self._principal.apply_loaded_product(
            product_id=pid,
            codigo=cod,
            descripcion=desc,
            precio=pr,
            tags_by_group=tags_bg,
            imagen_path=img,
        )
        self._sync_etiqueta_preview()

    def _on_eliminar_producto(self) -> None:
        """
        Elimina un artículo de la BD (y su celda en banqueta si existía).
        - Si el formulario está en modo **editar**, usa ese producto.
        - Si no, pide el código (manual o lector + Enter en el diálogo).
        """
        f = self._principal
        eid: int | None = f.editing_producto_id()
        codigo_muestra = ""
        nombre_muestra = ""

        if eid is not None:
            codigo_muestra = f.codigo_para_persistencia()
            nombre_muestra = f.le_nombre.text().strip()
        else:
            texto, ok = QInputDialog.getText(
                self,
                "Eliminar producto",
                "Código del artículo a eliminar (podés escribirlo o escanearlo y Enter):",
            )
            if not ok:
                return
            c = _normalize_codigo_lookup(texto)
            if not c:
                return
            try:
                from sqlalchemy import func

                from src.db.connection import SessionLocal
                from src.db.models import Producto

                with SessionLocal() as db:
                    p = (
                        db.query(Producto)
                        .filter(func.lower(Producto.codigo) == c.lower())
                        .one_or_none()
                    )
                    if p is None:
                        QMessageBox.warning(
                            self,
                            "Eliminar",
                            f"No existe ningún artículo con código «{c}».",
                        )
                        return
                    eid = int(p.id)
                    codigo_muestra = (p.codigo or "").strip()
                    nombre_muestra = (p.descripcion or "").strip()
            except Exception as ex:
                QMessageBox.critical(self, "Eliminar", str(ex))
                return

        assert eid is not None
        nm = nombre_muestra[:72] + ("…" if len(nombre_muestra) > 72 else "")
        confirm = QMessageBox.question(
            self,
            "Confirmar eliminación",
            f"¿Eliminar permanentemente del inventario?\n\n"
            f"{codigo_muestra}\n{nm}\n\n"
            f"Esta acción no se puede deshacer.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if confirm != QMessageBox.StandardButton.Yes:
            return

        try:
            from src.db.connection import SessionLocal
            from src.db.models import PlanoItem, Producto

            with SessionLocal() as db:
                p = db.query(Producto).filter(Producto.id == eid).one_or_none()
                if p is None:
                    QMessageBox.warning(
                        self,
                        "Eliminar",
                        "Ese artículo ya no está en la base.",
                    )
                    return
                img = (p.imagen_path or "").strip()
                db.query(PlanoItem).filter(PlanoItem.producto_id == eid).delete(
                    synchronize_session=False
                )
                p.tags.clear()
                db.delete(p)
                db.commit()
            _safe_unlink_product_image(img)
        except Exception as ex:
            QMessageBox.critical(
                self,
                "Eliminar",
                f"No se pudo eliminar:\n{ex}",
            )
            return

        f.clear_for_new()
        self._refresh_tables()
        QMessageBox.information(
            self,
            "Eliminar",
            f"Se eliminó «{codigo_muestra}» del inventario.",
        )

    def _limpiar_formulario(self) -> None:
        self._principal.clear_for_new()

    def _on_guardar_producto(self) -> None:
        f = self._principal
        codigo = f.codigo_para_persistencia()
        if not codigo:
            QMessageBox.warning(self, "Producto", "El código es obligatorio.")
            return
        nombre = f.le_nombre.text().strip()
        if not nombre:
            QMessageBox.warning(self, "Producto", "El nombre es obligatorio.")
            return
        precio = alta.parse_precio(f.le_precio.text())
        if precio is None:
            QMessageBox.warning(
                self,
                "Producto",
                "Indica un precio válido (número ≥ 0).",
            )
            return
        oids = set(f.tags_by_group.values())
        imagen_path = ""
        if f.pending_image_path:
            src = Path(f.pending_image_path)
            if not src.is_file():
                QMessageBox.warning(self, "Imagen", "No se encontró el archivo de imagen.")
                return
            ensure_data_dirs()
            ext = src.suffix.lower() if src.suffix else ".jpg"
            safe_codigo = codigo.replace("/", "_").replace("\\", "_")[:40]
            dest = PRODUCT_IMAGES_DIR / f"{safe_codigo}_{uuid.uuid4().hex[:10]}{ext}"
            try:
                shutil.copy2(src, dest)
                imagen_path = str(dest.resolve())
            except OSError as e:
                QMessageBox.warning(self, "Imagen", f"No se pudo guardar la imagen:\n{e}")
                return
        try:
            from src.db.connection import SessionLocal
            from src.db.models import Producto, TagOption

            with SessionLocal() as db:
                miss = alta.missing_required_groups(db, oids)
                if miss:
                    QMessageBox.warning(
                        self,
                        "Tags obligatorios",
                        "Debes elegir al menos una opción en:\n• "
                        + "\n• ".join(miss),
                    )
                    return
                tags = (
                    db.query(TagOption).filter(TagOption.id.in_(oids)).all()
                    if oids
                    else []
                )
                talla = alta.option_name_for_group(db, "Talla", oids)
                eid = f.editing_producto_id()
                if eid is not None:
                    p_db = db.query(Producto).filter(Producto.id == eid).one_or_none()
                    if p_db is None:
                        QMessageBox.warning(
                            self,
                            "Producto",
                            "El artículo ya no existe en la base. Volvé a cargarlo.",
                        )
                        return
                    p_db.descripcion = nombre
                    p_db.precio = float(precio)
                    p_db.talla = talla
                    p_db.tags = tags
                    if imagen_path:
                        p_db.imagen_path = imagen_path
                    db.commit()
                    cod_out = (p_db.codigo or "").strip()
                    QMessageBox.information(
                        self,
                        "Producto",
                        f"Se actualizó «{cod_out}».",
                    )
                else:
                    p = Producto(
                        codigo=codigo,
                        descripcion=nombre,
                        precio=float(precio),
                        color="",
                        talla=talla,
                        imagen_path=imagen_path,
                        estado="disponible",
                        fecha_ingreso=datetime.now(),
                    )
                    p.tags = tags
                    db.add(p)
                    try:
                        db.commit()
                    except IntegrityError:
                        db.rollback()
                        QMessageBox.warning(
                            self,
                            "Producto",
                            "Ya existe un artículo con ese código. Cambia el código o revisa el inventario.",
                        )
                        return
                    precio_etiq = _precio_str_para_etiqueta(float(precio))
                    ok_lbl, msg_lbl = hw_services.print_product_label(
                        zsettings.device_printer_labels_name(),
                        empresa="Saldos Monserrat",
                        linea_nombre=nombre,
                        precio_display=precio_etiq,
                        codigo_display=codigo,
                        job_title=f"Etiqueta {codigo}",
                    )
                    if ok_lbl:
                        QMessageBox.information(
                            self,
                            "Producto",
                            f"Se guardó «{codigo}».\n\n{msg_lbl}",
                        )
                    else:
                        QMessageBox.warning(
                            self,
                            "Producto",
                            f"Se guardó «{codigo}».\n\n{msg_lbl}",
                        )
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            return

        f.clear_for_new()
        self._refresh_tables()

    def _apply_list_filters(self, q):
        """Aplica búsqueda y filtros de estado/vista a una query de Producto."""
        from src.db.models import Producto

        text = self._search.text().strip()
        if text:
            pat = f"%{text}%"
            q = q.filter(
                or_(
                    Producto.codigo.ilike(pat),
                    Producto.descripcion.ilike(pat),
                )
            )
        solo_banqueta = self._cb_vista.currentIndex() == 1
        if solo_banqueta:
            q = q.filter(Producto.estado == "en_banqueta")
        else:
            est_map = {1: "disponible", 2: "en_banqueta", 3: "vendido"}
            ei = self._cb_estado.currentIndex()
            if ei in est_map:
                q = q.filter(Producto.estado == est_map[ei])
        return q

    def _build_query_ajuste_por_tags(
        self, session, strict_exact: bool, tag_option_ids: set[int]
    ):
        """
        Productos que cumplen el conjunto de tags indicado.
        strict_exact: True = exactamente ese conjunto; False = al menos esos (puede haber más).
        """
        from src.db.models import Producto, TagOption, _producto_tags

        oids = set(tag_option_ids)
        q = session.query(Producto)
        if not oids:
            return q.filter(Producto.id == -1)
        for oid in oids:
            q = q.filter(Producto.tags.any(TagOption.id == oid))
        if strict_exact:
            tag_n = (
                select(func.count())
                .select_from(_producto_tags)
                .where(_producto_tags.c.producto_id == Producto.id)
                .correlate_except(_producto_tags)
                .scalar_subquery()
            )
            q = q.filter(tag_n == len(oids))
        return q

    def _open_ajuste_precios_dialog(self) -> None:
        dlg = AjustarPreciosDialog(
            self,
            initial_tags=dict(self._principal.tags_by_group),
            query_builder=self._build_query_ajuste_por_tags,
            on_done=self._refresh_tables,
        )
        dlg.exec()

    @staticmethod
    def _fill_table(table: QTableWidget, rows) -> None:
        table.setRowCount(0)
        for p in rows:
            r = table.rowCount()
            table.insertRow(r)
            tag_names = sorted(o.name for o in (getattr(p, "tags", None) or []))
            tags_txt = ", ".join(tag_names)
            if len(tags_txt) > 100:
                tags_txt = tags_txt[:97] + "…"
            ing = (
                p.fecha_ingreso.strftime("%Y-%m-%d")
                if getattr(p, "fecha_ingreso", None)
                else "—"
            )
            vals = [
                p.codigo,
                (p.descripcion or "")[:80],
                f"{float(p.precio):.2f}",
                _ESTADO_LABEL.get(p.estado, p.estado or "—"),
                ing,
                tags_txt or "—",
            ]
            for c, val in enumerate(vals):
                it = QTableWidgetItem(str(val))
                it.setFlags(it.flags() & ~Qt.ItemFlag.ItemIsEditable)
                if c == 0:
                    it.setData(Qt.ItemDataRole.UserRole, int(p.id))
                table.setItem(r, c, it)

    def _refresh_tables(self) -> None:
        try:
            from src.db.connection import SessionLocal
            from src.db.models import Producto

            with SessionLocal() as db:
                q = db.query(Producto).order_by(Producto.id.desc())
                q = self._apply_list_filters(q)
                main_rows = q.all()

                cutoff = datetime.now() - timedelta(days=183)
                qs = db.query(Producto).filter(
                    Producto.estado == "disponible",
                    Producto.fecha_ingreso <= cutoff,
                ).order_by(Producto.fecha_ingreso.asc())
                qs = self._apply_list_filters(qs)
                stale_rows = qs.all()

            self._fill_table(self._table_main, main_rows)
            self._fill_table(self._table_stale, stale_rows)
        except Exception:
            self._table_main.setRowCount(0)
            self._table_stale.setRowCount(0)

    def _schedule_inventario_deco(self) -> None:
        """Tras mover el splitter o cambiar márgenes, unifica repintado (evita artefactos)."""
        self._deco_timer.stop()
        self._deco_timer.start()

    def _repaint_inventario_chrome(self) -> None:
        sp = self._splitter
        if sp is None:
            return
        sp.update()
        for i in range(sp.count()):
            w = sp.widget(i)
            if w is not None:
                w.update()
        self._center_tabs.update()
        self._right_tabs.update()
        self._table_main.viewport().update()
        self._table_stale.viewport().update()

    def showEvent(self, event: QShowEvent) -> None:
        super().showEvent(event)
        self._schedule_inventario_deco()

    def resizeEvent(self, event: QResizeEvent) -> None:
        super().resizeEvent(event)
        self._schedule_inventario_deco()
