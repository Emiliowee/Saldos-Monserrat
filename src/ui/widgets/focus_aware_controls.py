"""
Controles que no reaccionan a la rueda del ratón hasta tener foco de teclado.

Evita el bug clásico al hacer scroll en un QScrollArea: pasar por encima de un
QComboBox o QDateEdit cambia valor sin querer.
"""
from __future__ import annotations

from PySide6.QtWidgets import QComboBox, QDateEdit
from PySide6.QtGui import QWheelEvent


class FocusAwareComboBox(QComboBox):
    def wheelEvent(self, event: QWheelEvent) -> None:
        if not self.hasFocus():
            event.ignore()
            return
        super().wheelEvent(event)


class FocusAwareDateEdit(QDateEdit):
    def wheelEvent(self, event: QWheelEvent) -> None:
        if not self.hasFocus():
            event.ignore()
            return
        super().wheelEvent(event)
