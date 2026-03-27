"""
Fundido al cambiar de página en el panel derecho (QStackedWidget).
No es una barra lateral: solo anima el contenido de la tarjeta.

Ajustes rápidos de “feel”:
- FADE_OUT_MS / FADE_IN_MS — duración (ms)
- EASING_OUT — curva al salir; EASING_IN — al entrar (más suave = OutQuint / OutCubic)
"""
from __future__ import annotations

from typing import Callable

from PySide6.QtCore import QEasingCurve, QPropertyAnimation, QObject
from PySide6.QtWidgets import QGraphicsOpacityEffect, QStackedWidget, QWidget

# ── Tunear sensación visual ───────────────────────────────────────────────────
FADE_OUT_MS = 120
FADE_IN_MS = 220
EASING_OUT = QEasingCurve.Type.OutQuad
EASING_IN = QEasingCurve.Type.OutQuint

# Inicio (índice 0) usa QScrollArea: QGraphicsOpacityEffect + scroll suele parpadear o “romper” el clic.
_SKIP_OPACITY_FADE_INDICES = frozenset({0})


class _AnimGuard(QObject):
    """Anima opacidad de un widget; guarda el effect y la animación."""

    def __init__(self, parent: QObject | None = None):
        super().__init__(parent)
        self._anim: QPropertyAnimation | None = None

    def stop(self) -> None:
        """Corta la animación sin disparar `finished` (limpieza la hace el controlador)."""
        if self._anim is not None:
            self._anim.stop()
            self._anim = None

    def run_fade(
        self,
        widget: QWidget,
        start: float,
        end: float,
        duration_ms: int,
        on_finished: Callable[[], None] | None = None,
        easing: QEasingCurve.Type = QEasingCurve.Type.OutCubic,
    ) -> None:
        if self._anim is not None:
            self._anim.stop()
        eff = widget.graphicsEffect()
        if not isinstance(eff, QGraphicsOpacityEffect):
            eff = QGraphicsOpacityEffect(widget)
            widget.setGraphicsEffect(eff)
        eff.setOpacity(start)
        anim = QPropertyAnimation(eff, b"opacity", self)
        anim.setDuration(duration_ms)
        anim.setStartValue(start)
        anim.setEndValue(end)
        anim.setEasingCurve(easing)
        self._anim = anim

        def _done():
            self._anim = None
            if on_finished:
                on_finished()
            # Opacidad plena: quitar el efecto. Si queda en el widget, en Windows suele
            # romper QComboBox/tablas/sombras al redimensionar o al volver del stack.
            if end >= 0.999:
                ge = widget.graphicsEffect()
                if isinstance(ge, QGraphicsOpacityEffect):
                    widget.setGraphicsEffect(None)

        anim.finished.connect(_done)
        anim.start()


class StackFadeController(QObject):
    """Cambia página del QStackedWidget con fundido in/out."""

    def __init__(self, stack: QStackedWidget, enabled: bool = True):
        super().__init__(stack)
        self._stack = stack
        self._enabled = enabled
        self._out = _AnimGuard(self)
        self._in = _AnimGuard(self)
        self._busy = False

    def set_animations_enabled(self, on: bool) -> None:
        self._enabled = on
        if not on:
            self._out.stop()
            self._in.stop()
            self._reset_stack_opacity_effects()
            self._busy = False

    def _reset_stack_opacity_effects(self) -> None:
        """Quita fundidos a medias (evita pantallas en blanco/negro o widgets “muertos”)."""
        for i in range(self._stack.count()):
            w = self._stack.widget(i)
            if w is None:
                continue
            ge = w.graphicsEffect()
            if isinstance(ge, QGraphicsOpacityEffect):
                w.setGraphicsEffect(None)

    def show_index(
        self,
        index: int,
        duration_out: int | None = None,
        duration_in: int | None = None,
    ) -> None:
        dout = FADE_OUT_MS if duration_out is None else duration_out
        din = FADE_IN_MS if duration_in is None else duration_in
        cur_i = self._stack.currentIndex()
        if not self._enabled or index == cur_i:
            self._stack.setCurrentIndex(index)
            self._busy = False
            return
        # Sin fundido al entrar/salir de Inicio: evita glitches con el área con scroll.
        if index in _SKIP_OPACITY_FADE_INDICES or cur_i in _SKIP_OPACITY_FADE_INDICES:
            self._stack.setCurrentIndex(index)
            self._busy = False
            return
        if self._busy:
            self._out.stop()
            self._in.stop()
            self._reset_stack_opacity_effects()
            self._stack.setCurrentIndex(index)
            self._busy = False
            return
        cur = self._stack.currentWidget()
        if cur is None:
            self._stack.setCurrentIndex(index)
            return
        self._busy = True

        def after_out():
            self._stack.setCurrentIndex(index)
            new_w = self._stack.currentWidget()
            if new_w is None:
                self._busy = False
                return

            def clear_busy():
                self._busy = False

            self._in.run_fade(new_w, 0.0, 1.0, din, clear_busy, EASING_IN)

        self._out.run_fade(cur, 1.0, 0.0, dout, after_out, EASING_OUT)
