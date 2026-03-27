"""
Detección y prueba de impresoras (Qt).

Los lectores de códigos USB tipo «teclado» (HID) no suelen exponer una API en Windows:
la app solo puede ofrecer un campo de prueba y explicar el modo de uso.
"""
from __future__ import annotations

import os
import tempfile
from datetime import datetime

from PySide6.QtCore import QMarginsF, QRect, Qt, QUrl, QSizeF
from PySide6.QtGui import (
    QColor,
    QDesktopServices,
    QFont,
    QPageLayout,
    QPageSize,
    QPainter,
    QTextDocument,
)
from PySide6.QtPrintSupport import QPrinter, QPrinterInfo

from src.ui.zen_desktop.barcode_probe import (
    code128_to_pixmap,
    codigo_legible_espaciado,
    normalize_code128_payload,
)

# Etiqueta horizontal tipo 58×30 mm (más ancha que alta; barras grandes abajo).
_LABEL_W_MM = 58.0
_LABEL_H_MM = 40.0
# Fracción vertical del área útil para el Code128 (más grande).
_LABEL_BARCODE_FRAC = 0.60
# Separación entre la franja del código de barras y el texto legible debajo.
_LABEL_GAP_BAR_TO_TEXT_PX = 12


def list_printer_names() -> list[str]:
    """Nombres tal como los ve Windows / el spooler (orden no garantizado)."""
    names = QPrinterInfo.availablePrinterNames()
    return [str(n) for n in names]


def default_printer_name() -> str:
    """Impresora predeterminada del sistema (puede estar vacía en casos raros)."""
    info = QPrinterInfo.defaultPrinter()
    return info.printerName() if info else ""


def printer_exists(name: str) -> bool:
    n = (name or "").strip()
    if not n:
        return True
    return n in list_printer_names()


def _effective_printer_name(requested: str | None) -> str:
    """Nombre que usará realmente el spooler (vacío = predeterminada de Windows)."""
    n = (requested or "").strip()
    if n:
        return n
    return default_printer_name()


def _is_virtual_pdf_printer(name: str) -> bool:
    """
    Impresora virtual que genera PDF (p. ej. «Microsoft Print to PDF»).
    Heurística: el nombre contiene «pdf» (cubre varios idiomas y fabricantes).
    """
    n = (name or "").lower()
    return bool(n) and "pdf" in n


def printer_info_lines() -> list[str]:
    """Líneas de diagnóstico legibles (para registro en UI)."""
    lines: list[str] = []
    default_n = default_printer_name()
    lines.append(f"Predeterminada del sistema: {default_n or '(no definida)'}")
    all_n = list_printer_names()
    if not all_n:
        lines.append("No se detectó ninguna impresora instalada.")
        return lines
    lines.append(f"Instaladas ({len(all_n)}):")
    for n in sorted(all_n, key=str.lower):
        mark = " ← predeterminada" if n == default_n else ""
        lines.append(f"  · {n}{mark}")
    return lines


def _test_print_html(*, resolved_label: str, when: str) -> str:
    return f"""
    <html><head><meta charset="utf-8"/></head>
    <body style="font-family: 'Segoe UI', sans-serif; font-size: 11pt; color: #3a3530;">
    <h2 style="color:#8E5F72; margin-bottom:8px;">Saldos Monserrat</h2>
    <p><b>Prueba de impresión</b></p>
    <p>Si ves este documento, el spooler y el driver respondieron.</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;"/>
    <p style="color:#6e6860;font-size:10pt;">
    Impresora: <b>{resolved_label}</b><br/>
    Enviado: {when}
    </p>
    </body></html>
    """


def send_test_print(
    printer_name: str | None,
    *,
    job_title: str = "Prueba de impresión",
    open_virtual_pdf: bool = True,
) -> tuple[bool, str]:
    """
    Envía una página de prueba a la cola de impresión.

    - ``printer_name`` vacío o None: usa la impresora predeterminada de Windows.
    - Si la impresora elegida es una **virtual PDF** y ``open_virtual_pdf`` es True,
      genera un PDF en %TEMP% y lo abre con la app predeterminada (podés guardarlo desde el visor).
    - Impresora física: envío clásico al spooler.
    """
    name = (printer_name or "").strip()
    if name and not printer_exists(name):
        return False, f"La impresora «{name}» no está en la lista actual del sistema."

    effective = _effective_printer_name(name)
    resolved = effective or default_printer_name() or "(predeterminada)"
    when = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    html = _test_print_html(resolved_label=resolved, when=when)
    doc = QTextDocument()
    doc.setHtml(html)

    if open_virtual_pdf and _is_virtual_pdf_printer(effective):
        safe_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(
            tempfile.gettempdir(),
            f"prueba_impresion_{safe_ts}.pdf",
        )
        printer_pdf = QPrinter(QPrinter.PrinterMode.HighResolution)
        printer_pdf.setOutputFormat(QPrinter.OutputFormat.PdfFormat)
        printer_pdf.setOutputFileName(path)
        printer_pdf.setDocName(job_title)
        try:
            doc.print_(printer_pdf)
        except Exception as e:
            return False, f"No se pudo generar el PDF de prueba: {e}"
        url = QUrl.fromLocalFile(path)
        if not QDesktopServices.openUrl(url):
            return True, (
                f"PDF de prueba guardado en: {path}\n"
                "No se pudo abrir el visor automáticamente; abrilo manualmente."
            )
        return True, (
            f"PDF de prueba generado y abierto. "
            f"Podés guardarlo o imprimirlo desde el visor (archivo: {path})."
        )

    printer = QPrinter(QPrinter.PrinterMode.HighResolution)
    if effective:
        printer.setPrinterName(effective)
    printer.setDocName(job_title)
    try:
        spool_name = printer.printerName() or resolved
        doc.print_(printer)
    except Exception as e:
        return False, f"No se pudo completar la impresión: {e}"
    return True, f"Trabajo enviado a «{spool_name}»."


def _configure_label_page(printer: QPrinter) -> None:
    """Página al tamaño de etiqueta física (ancho de rollo × poco alto)."""
    printer.setPageSize(
        QPageSize(
            QSizeF(_LABEL_W_MM, _LABEL_H_MM),
            QPageSize.Unit.Millimeter,
            "Etiqueta 58×40",
        )
    )
    try:
        printer.setPageMargins(
            QMarginsF(0.8, 0.8, 0.8, 0.8),
            QPageLayout.Unit.Millimeter,
        )
    except Exception:
        pass


def _draw_product_label_on_printer(
    printer: QPrinter,
    *,
    empresa: str,
    linea_nombre: str,
    precio_display: str,
    codigo_display: str,
) -> None:
    """
    Texto arriba, PRECIO, Code128 como imagen (evita bug de QtSvg = bloque negro)
    y debajo el mismo código en caracteres legibles.
    """
    painter = QPainter()
    if not painter.begin(printer):
        raise OSError("No se pudo iniciar la impresión (painter).")
    try:
        painter.setRenderHint(QPainter.RenderHint.TextAntialiasing, True)
        page = printer.pageRect(QPrinter.Unit.DevicePixel)
        painter.fillRect(page, QColor(255, 255, 255))
        x0 = int(page.x())
        y0 = int(page.y())
        pw = int(page.width())
        ph = int(page.height())
        margin = max(3, min(pw, ph) // 22)
        x = x0 + margin
        content_w = max(40, pw - 2 * margin)
        inner_h = ph - 2 * margin
        bottom_limit = y0 + ph - margin
        gap_bar = max(_LABEL_GAP_BAR_TO_TEXT_PX, 4)

        painter.setPen(QColor(0, 0, 0))
        y_cursor = float(y0 + margin)

        # ── Texto superior en orden fijo (evita solapar nombre / PRECIO por min(y, text_floor)). ──
        fe = QFont("Segoe UI", 9)
        fe.setBold(True)
        painter.setFont(fe)
        fm_emp = painter.fontMetrics()
        h_emp = fm_emp.height() + 2
        painter.drawText(
            QRect(x, int(y_cursor), content_w, h_emp),
            int(Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignTop),
            empresa,
        )
        y_cursor += h_emp + 4

        fn = QFont("Segoe UI", 8)
        fn.setWeight(QFont.Weight.DemiBold)
        painter.setFont(fn)
        fm_nom = painter.fontMetrics()
        nombre = (linea_nombre or "").strip() or "—"
        line = fm_nom.elidedText(nombre, Qt.TextElideMode.ElideRight, content_w)
        painter.drawText(x, int(y_cursor + fm_nom.ascent()), line)
        y_cursor += fm_nom.height() + 5

        fp = QFont("Segoe UI", 9)
        fp.setBold(True)
        painter.setFont(fp)
        fm_prec = painter.fontMetrics()
        pv = (precio_display or "").strip() or "$0"
        y_prec = int(y_cursor)
        painter.drawText(x, y_prec + fm_prec.ascent(), "PRECIO:")
        painter.drawText(
            x + content_w - fm_prec.horizontalAdvance(pv),
            y_prec + fm_prec.ascent(),
            pv,
        )
        y_cursor += fm_prec.height() + 6

        # ── Código de barras: el alto sale del espacio restante (nombre/precio ya reservados). ──
        fc = QFont("Segoe UI", 7)
        fc.setWeight(QFont.Weight.Medium)
        painter.setFont(fc)
        fm_human = painter.fontMetrics()
        human_h = fm_human.height() + 8

        y_bar_top = int(y_cursor)
        remaining = bottom_limit - y_bar_top
        desired_bar = max(26, int(inner_h * _LABEL_BARCODE_FRAC))
        min_bar = 18
        min_human = fm_human.height() + 4

        # bar_h + gap_bar + human_h <= remaining ; si falta sitio, achicamos leyenda antes que solapar texto.
        max_fit_bar = remaining - gap_bar - human_h
        if max_fit_bar < min_bar:
            human_h = max(min_human, remaining - gap_bar - min_bar)
            max_fit_bar = remaining - gap_bar - human_h

        bar_h = max(8, min(desired_bar, max_fit_bar))
        y_codigo_top = y_bar_top + bar_h + gap_bar
        overflow = (y_codigo_top + human_h) - bottom_limit
        if overflow > 0:
            human_h = max(min_human, human_h - overflow)
            y_codigo_top = min(y_codigo_top, bottom_limit - human_h)
            bar_h = max(8, y_codigo_top - y_bar_top - gap_bar)

        payload = normalize_code128_payload(codigo_display)
        if payload:
            bar_pm, _err = code128_to_pixmap(payload, max_width=int(content_w))
            if bar_pm is not None and not bar_pm.isNull():
                if bar_pm.height() > bar_h - 2:
                    bar_pm = bar_pm.scaledToHeight(
                        max(8, bar_h - 2),
                        Qt.TransformationMode.FastTransformation,
                    )
                x_bar = x + max(0, (content_w - bar_pm.width()) // 2)
                painter.drawPixmap(x_bar, y_bar_top, bar_pm)

            leyenda = codigo_legible_espaciado(
                (codigo_display or "").strip() or payload
            )
            painter.setFont(fc)
            painter.drawText(
                QRect(x, y_codigo_top, content_w, human_h),
                int(Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignTop),
                leyenda,
            )
    finally:
        painter.end()


def print_product_label(
    printer_name: str | None,
    *,
    empresa: str = "Saldos Monserrat",
    linea_nombre: str,
    precio_display: str,
    codigo_display: str,
    job_title: str = "Etiqueta producto",
    open_virtual_pdf: bool = True,
) -> tuple[bool, str]:
    """
    Imprime una etiqueta de producto (misma composición que la vista previa del alta).

    Usa el nombre de impresora indicado (p. ej. la «impresora de etiquetas» guardada
    en Dispositivos). Si esa impresora es virtual PDF, genera un PDF en %TEMP% y lo abre.
    """
    name = (printer_name or "").strip()
    if not name:
        return False, (
            "No hay impresora de etiquetas configurada. "
            "Elegila en Dispositivos → impresora de etiquetas."
        )

    if not printer_exists(name):
        return False, f"La impresora «{name}» no está en la lista del sistema."

    effective = name

    if open_virtual_pdf and _is_virtual_pdf_printer(effective):
        safe_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        cod = (codigo_display or "item").replace("/", "_")[:24]
        path = os.path.join(
            tempfile.gettempdir(),
            f"etiqueta_{cod}_{safe_ts}.pdf",
        )
        printer_pdf = QPrinter(QPrinter.PrinterMode.HighResolution)
        printer_pdf.setOutputFormat(QPrinter.OutputFormat.PdfFormat)
        printer_pdf.setOutputFileName(path)
        printer_pdf.setDocName(job_title)
        try:
            printer_pdf.setResolution(300)
        except Exception:
            pass
        _configure_label_page(printer_pdf)
        try:
            _draw_product_label_on_printer(
                printer_pdf,
                empresa=empresa,
                linea_nombre=linea_nombre,
                precio_display=precio_display,
                codigo_display=codigo_display,
            )
        except Exception as e:
            return False, f"No se pudo generar el PDF de la etiqueta: {e}"
        url = QUrl.fromLocalFile(path)
        if not QDesktopServices.openUrl(url):
            return True, (
                f"Etiqueta guardada como PDF:\n{path}\n"
                "No se pudo abrir el visor automáticamente."
            )
        return True, f"Etiqueta generada como PDF y abierta ({path})."

    printer = QPrinter(QPrinter.PrinterMode.HighResolution)
    printer.setPrinterName(effective)
    printer.setDocName(job_title)
    _configure_label_page(printer)
    try:
        _draw_product_label_on_printer(
            printer,
            empresa=empresa,
            linea_nombre=linea_nombre,
            precio_display=precio_display,
            codigo_display=codigo_display,
        )
    except Exception as e:
        return False, f"No se pudo imprimir la etiqueta: {e}"
    spool = printer.printerName() or effective
    return True, f"Etiqueta enviada a «{spool}»."
