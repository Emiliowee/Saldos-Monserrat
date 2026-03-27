"""
Code128: PNG (compat) y SVG (vectorial, nitidez en pantalla e impresión).
"""
from __future__ import annotations

import os
import re
import secrets
import tempfile
from io import BytesIO

from PySide6.QtCore import QByteArray, QRectF, QSize, Qt
from PySide6.QtGui import QPainter, QPixmap
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtWidgets import QSizePolicy, QWidget


def random_numeric_payload(length: int = 12) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def code128_svg_bytes(payload: str) -> tuple[bytes | None, str | None]:
    """
    Code128 como SVG (líneas vectoriales). Mejor que PNG escalado en QLabel.
    """
    data = normalize_code128_payload(payload)
    if not data:
        return None, "El código no puede estar vacío."
    try:
        from barcode import Code128  # type: ignore[import-untyped]
        from barcode.writer import SVGWriter  # type: ignore[import-untyped]
    except ImportError:
        return None, "Falta el paquete python-barcode (pip install python-barcode)."
    try:
        buf = BytesIO()
        opts = {
            "module_width": 0.24,
            "module_height": 12.5,
            "quiet_zone": 5.5,
            "write_text": False,
        }
        Code128(data, writer=SVGWriter()).write(buf, options=opts)
        out = buf.getvalue()
        if not out:
            return None, "SVG vacío."
        return out, None
    except Exception as e:
        return None, str(e)


class Code128SvgWidget(QWidget):
    """Muestra Code128 como SVG reescalado (barras nítidas, no bitmap estirado)."""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._renderer: QSvgRenderer | None = None
        self._hint: str = ""
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet("background: #FFFFFF; border: none;")
        self.setSizePolicy(
            QSizePolicy.Policy.Expanding,
            QSizePolicy.Policy.Fixed,
        )
        self.setMinimumHeight(36)
        self.setMaximumHeight(52)

    def set_payload(self, raw: str) -> None:
        """``raw`` se normaliza internamente (mismo criterio que el resto de la app)."""
        data = normalize_code128_payload((raw or "").strip())
        self._hint = ""
        self._renderer = None
        if not data:
            self._hint = "Sin código"
        else:
            svg_b, err = code128_svg_bytes(data)
            if err or not svg_b:
                self._hint = err or "No se pudo generar Code128."
            else:
                r = QSvgRenderer(QByteArray(svg_b))
                if r.isValid():
                    self._renderer = r
                else:
                    self._hint = "SVG inválido."
        self.updateGeometry()
        self.update()

    def sizeHint(self) -> QSize:
        if self._renderer and self._renderer.isValid():
            ds = self._renderer.defaultSize()
            if ds.width() > 0:
                w = 220
                h = max(34, min(50, int(w * ds.height() / ds.width())))
                return QSize(w, h)
        return super().sizeHint()

    def paintEvent(self, event: object) -> None:
        del event
        p = QPainter(self)
        p.fillRect(self.rect(), Qt.GlobalColor.white)
        if self._renderer and self._renderer.isValid():
            m = 1
            target = QRectF(
                float(m),
                float(m),
                float(self.width() - 2 * m),
                float(self.height() - 2 * m),
            )
            self._renderer.render(p, target)
            return
        p.setPen(Qt.GlobalColor.black)
        p.drawText(
            self.rect(),
            Qt.AlignmentFlag.AlignCenter,
            self._hint or "—",
        )


def codigo_legible_espaciado(texto: str) -> str:
    """
    Si el código es solo números, separa cada dígito con espacio (más fácil de leer en voz).
    Si mezcla letras y números (ej. Blusa-Nike), lo muestra tal cual.
    """
    s = (texto or "").strip()
    if not s:
        return ""
    compact = s.replace(" ", "")
    if compact.isdigit() and len(compact) <= 28:
        return " ".join(compact)
    return s


def normalize_code128_payload(raw: str) -> str:
    """Caracteres seguros para Code128 (alfanumérico y algunos símbolos)."""
    s = (raw or "").strip()
    if not s:
        return ""
    # Code128 admite ASCII amplio; evitamos control chars
    s = re.sub(r"[\x00-\x1f\x7f]", "", s)
    return s[:64]


def code128_to_pixmap(payload: str, *, max_width: int = 440) -> tuple[QPixmap | None, str | None]:
    """
    Devuelve (pixmap, error_msg). error_msg si falla import o datos inválidos.
    """
    data = normalize_code128_payload(payload)
    if not data:
        return None, "El código no puede estar vacío."
    try:
        from barcode import Code128  # type: ignore[import-untyped]
        from barcode.writer import ImageWriter  # type: ignore[import-untyped]
    except ImportError:
        return None, "Falta el paquete python-barcode (pip install python-barcode pillow)."
    path = ""
    try:
        fd, path = tempfile.mkstemp(suffix=".png")
        os.close(fd)
        with open(path, "wb") as f:
            Code128(data, writer=ImageWriter()).write(
                f,
                options={
                    "write_text": False,
                    "quiet_zone": 6.5,
                    "module_width": 0.25,
                    "module_height": 12.0,
                },
            )
        pm = QPixmap(path)
        if pm.isNull():
            return None, "No se pudo cargar la imagen del código de barras."
        if pm.width() > max_width:
            pm = pm.scaledToWidth(max_width, Qt.TransformationMode.FastTransformation)
        return pm, None
    except Exception as e:
        return None, str(e)
    finally:
        if path:
            try:
                os.unlink(path)
            except OSError:
                pass
