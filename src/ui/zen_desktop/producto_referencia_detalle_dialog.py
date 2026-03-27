"""
Modal «informe» de cómo se calculó la referencia de precio (cuaderno o patrones).
Lista de patrones: filas tipo tarjeta (scroll) para que texto e imágenes se vean bien.
"""
from __future__ import annotations

import html
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QScrollArea,
    QTextBrowser,
    QVBoxLayout,
    QWidget,
)

from src.ui.zen_desktop import theme as Z

_THUMB = 76


def _thumb_from_path(path_str: str, max_side: int = _THUMB) -> QPixmap:
    p = (path_str or "").strip()
    if not p:
        return QPixmap()
    fp = Path(p)
    if not fp.is_file():
        return QPixmap()
    pm = QPixmap(str(fp))
    if pm.isNull():
        return QPixmap()
    return pm.scaled(
        max_side,
        max_side,
        Qt.AspectRatioMode.KeepAspectRatio,
        Qt.TransformationMode.SmoothTransformation,
    )


class ReferenciaDetalleDialog(QDialog):
    def __init__(self, parent: QWidget | None, payload: dict) -> None:
        super().__init__(parent)
        self.setWindowTitle("Detalle de referencia de precio")
        self.setMinimumSize(760, 520)
        self.resize(860, 580)
        self.setStyleSheet(
            f"QDialog {{ background: #FDF9F7; color: {Z.NAV_TEXT}; }}"
        )

        root = QVBoxLayout(self)
        root.setContentsMargins(14, 14, 14, 12)
        root.setSpacing(10)

        intro = QTextBrowser()
        intro.setReadOnly(True)
        intro.setOpenExternalLinks(False)
        intro.setMaximumHeight(140)
        intro.setStyleSheet(
            f"""
            QTextBrowser {{
                background: #FFFFFF;
                border: 1px solid rgba(58,53,48,0.12);
                border-radius: 8px;
                padding: 8px;
                font-family: {Z.FONT_UI};
                font-size: 11px;
                color: {Z.NAV_TEXT};
            }}
            """
        )
        tags = payload.get("tags_elegidos") or []
        tags_html = (
            "<br/>".join(f"• {t}" for t in tags)
            if tags
            else "<i>Sin tags en el resumen.</i>"
        )
        intro.setHtml(
            f"<p style='margin:0 0 6px 0;'><b>Tags elegidos</b></p>{tags_html}"
        )
        root.addWidget(intro)

        modo = payload.get("modo", "")
        if modo == "cuaderno":
            self._build_cuaderno(root, payload)
        else:
            self._build_patrones(root, payload)

        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Close)
        bb.rejected.connect(self.reject)
        bb.accepted.connect(self.accept)
        root.addWidget(bb)

    def _build_cuaderno(self, root: QVBoxLayout, payload: dict) -> None:
        body = QTextBrowser()
        body.setReadOnly(True)
        body.setStyleSheet(
            f"""
            QTextBrowser {{
                background: #FFFFFF;
                border: 1px solid rgba(58,53,48,0.12);
                border-radius: 8px;
                padding: 10px;
                font-family: {Z.FONT_UI};
                font-size: 11px;
                color: {Z.NAV_TEXT};
            }}
            """
        )
        if not payload.get("encontrado"):
            body.setHtml(
                f"<p>{payload.get('mensaje', 'Sin datos.')}</p>"
                "<p>Podés revisar las reglas en <b>Cuaderno de precios</b> y ajustar tags o condiciones.</p>"
            )
            root.addWidget(body, 1)
            return

        su = payload.get("sugerido")
        su_txt = f"${su:.2f}" if su is not None else "—"
        conds: list[tuple[str, str]] = payload.get("condiciones") or []
        rows_html = "".join(
            f"<tr><td style='padding:4px 8px;border-bottom:1px solid #eee;'>{g}</td>"
            f"<td style='padding:4px 8px;border-bottom:1px solid #eee;'>{o}</td></tr>"
            for g, o in conds
        )
        notes = payload.get("rule_notes") or ""
        notes_block = (
            f"<p style='margin-top:10px;'><b>Notas de la regla:</b> {notes}</p>"
            if notes
            else ""
        )
        body.setHtml(
            f"""
            <h3 style="margin-top:0;">Regla del cuaderno</h3>
            <p><b>«{payload.get('rule_name', '')}»</b> · prioridad {payload.get('prioridad', 0)}</p>
            <p>Rango: <b>${payload.get('price_min', 0):.0f}</b> – <b>${payload.get('price_max', 0):.0f}</b>
            · Punto medio sugerido: <b>{su_txt}</b></p>
            <p>La regla aplica porque todas sus condiciones están entre los tags que elegiste:</p>
            <table style="border-collapse:collapse;width:100%;">{rows_html}</table>
            {notes_block}
            """
        )
        root.addWidget(body, 1)

    def _build_patrones(self, root: QVBoxLayout, payload: dict) -> None:
        if not payload.get("encontrado"):
            lbl = QLabel(payload.get("mensaje", "Sin coincidencias."))
            lbl.setWordWrap(True)
            lbl.setStyleSheet(
                f"font-family: {Z.FONT_UI}; font-size: 11px; color: {Z.NAV_TEXT}; "
                "padding: 8px; background: #FFF; border-radius: 8px;"
            )
            root.addWidget(lbl, 1)
            return

        st = payload.get("stats") or {}
        med = float(st.get("median", st.get("avg", 0)))
        n_sel = int(st.get("tags_elegidos", 0))
        nex = int(st.get("n_conjunto_exacto", 0))
        ex = (
            f" <b>{nex}</b> artículo(s) tienen exactamente esos {n_sel} tags (sin extras). "
            if nex
            else ""
        )
        head = QLabel(
            f"Solo se usan prendas que incluyen <b>los {n_sel} tags que elegiste</b> "
            f"(pueden tener talla, material, etc. además).{ex}"
            f"Mediana <b>~${med:.0f}</b> sobre <b>{st.get('n', 0)}</b> artículo(s), "
            f"rango <b>${st.get('min', 0):.0f}</b> – <b>${st.get('max', 0):.0f}</b>."
        )
        head.setWordWrap(True)
        head.setStyleSheet(
            f"font-family: {Z.FONT_UI}; font-size: 11px; color: {Z.NAV_TEXT}; "
            "padding: 6px 0;"
        )
        root.addWidget(head)

        prods: list[dict] = payload.get("productos") or []

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setStyleSheet(
            "QScrollArea { border: none; background: transparent; }"
            "QScrollArea > QWidget > QWidget { background: transparent; }"
        )

        list_host = QWidget()
        vlay = QVBoxLayout(list_host)
        vlay.setSpacing(10)
        vlay.setContentsMargins(0, 4, 6, 8)

        for i, row in enumerate(prods):
            card = self._patron_row_card(i, row)
            vlay.addWidget(card)

        vlay.addStretch(1)
        scroll.setWidget(list_host)
        root.addWidget(scroll, 1)

    def _patron_row_card(self, index: int, row: dict) -> QFrame:
        even = index % 2 == 0
        bg = "#FFFFFF" if even else "#FAF5F7"
        card = QFrame()
        card.setStyleSheet(
            f"QFrame#refCard {{ background: {bg}; border: 1px solid rgba(58,53,48,0.11); "
            f"border-radius: 12px; }}"
        )
        card.setObjectName("refCard")

        h = QHBoxLayout(card)
        h.setSpacing(16)
        h.setContentsMargins(14, 12, 14, 12)

        pm = _thumb_from_path(row.get("imagen_path", ""))
        pic = QLabel()
        pic.setAlignment(Qt.AlignmentFlag.AlignCenter)
        pic.setFixedSize(_THUMB + 4, _THUMB + 4)
        pic.setStyleSheet(
            "QLabel { background: #F3F1EE; border: 1px solid rgba(0,0,0,0.07); "
            "border-radius: 8px; }"
        )
        if pm.isNull():
            pic.setText("Sin foto")
            pic.setStyleSheet(
                pic.styleSheet()
                + f" color: #9a9590; font-size: 9px; font-family: {Z.FONT_UI};"
            )
        else:
            pic.setPixmap(pm)
        h.addWidget(pic, 0, Qt.AlignmentFlag.AlignTop)

        mid = QWidget()
        mid.setStyleSheet("background: transparent;")
        ml = QVBoxLayout(mid)
        ml.setContentsMargins(0, 0, 0, 0)
        ml.setSpacing(6)

        codigo = str(row.get("codigo", "") or "")
        nombre = str(row.get("nombre", "") or "")
        tags_txt = str(row.get("tags_coincidentes", "") or "")
        try:
            n_coinc = int(row.get("n_coincidencias", 0))
        except (TypeError, ValueError):
            n_coinc = 0
        try:
            precio_f = float(row.get("precio", 0) or 0)
        except (TypeError, ValueError):
            precio_f = 0.0

        lc = QLabel(f"<b style='font-size:12px;'>{html.escape(codigo)}</b>")
        lc.setTextFormat(Qt.TextFormat.RichText)
        lc.setStyleSheet(f"color: {Z.NAV_TEXT}; font-family: {Z.FONT_UI};")
        lc.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)

        ln = QLabel(nombre)
        ln.setWordWrap(True)
        ln.setMinimumWidth(220)
        ln.setStyleSheet(
            f"font-family: {Z.FONT_UI}; font-size: 11px; font-weight: 600; color: {Z.NAV_TEXT};"
        )
        ln.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)

        lt = QLabel(
            f"<span style='color:#6e6860;font-size:10px;'>Coinciden:</span> "
            f"<span style='font-size:10px;'>{html.escape(tags_txt)}</span>"
        )
        lt.setWordWrap(True)
        lt.setTextFormat(Qt.TextFormat.RichText)
        lt.setStyleSheet(f"font-family: {Z.FONT_UI}; color: {Z.NAV_TEXT};")
        lt.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)

        ml.addWidget(lc)
        ml.addWidget(ln)
        ml.addWidget(lt)
        h.addWidget(mid, 1)

        right = QWidget()
        right.setFixedWidth(120)
        right.setStyleSheet("background: transparent;")
        rl = QVBoxLayout(right)
        rl.setContentsMargins(0, 4, 0, 0)
        rl.setSpacing(6)
        rl.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignHCenter)

        pr = QLabel(f"${precio_f:.2f}")
        pr.setAlignment(Qt.AlignmentFlag.AlignRight)
        pr.setStyleSheet(
            "font-size: 17px; font-weight: 700; color: #2e2a26; letter-spacing: -0.5px;"
        )

        nt = QLabel(f"{n_coinc} tag{'s' if n_coinc != 1 else ''}")
        nt.setAlignment(Qt.AlignmentFlag.AlignRight)
        nt.setStyleSheet(
            f"font-size: 10px; color: #6e6860; font-family: {Z.FONT_UI};"
        )

        rl.addWidget(pr)
        rl.addWidget(nt)
        h.addWidget(right, 0, Qt.AlignmentFlag.AlignTop)

        tip = "\n".join(x for x in (codigo, nombre, tags_txt) if x)
        if tip:
            card.setToolTip(tip[:2000])

        return card


def open_referencia_detalle(parent: QWidget | None, payload: dict | None) -> None:
    if not payload:
        return
    dlg = ReferenciaDetalleDialog(parent, payload)
    dlg.exec()
