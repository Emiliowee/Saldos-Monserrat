# Ideas de diseño y animación (todo lo “Zen” en el proyecto)

Hay **dos sitios** distintos con inspiración Zen:

| Ubicación | Qué es | Archivos clave |
|-----------|--------|----------------|
| **`main.py` → `zen_desktop/`** | App principal: menú + tarjeta | `theme.py`, `widgets.py`, `animations.py`, `main_window.py`, `pages.py` |
| **Legacy ERP** (sin arranque) | `src/ui/main_window.py` + `zen/chrome_host.py` | `tokens.py`, `style.py`, etc. |
| **Carpeta `Zen Browser/`** | Restos del instalador del navegador | **No** trae estilos ni assets de UI útiles |

---

## Ya tenés

- Fundido al cambiar de sección (`StackFadeController`).
- Colores logo (rosa, dorado, papel) en `zen_desktop/theme.py`.
- Barra de título clara, tarjeta con sombra cálida, menú con selección dorada + rosa.
- Menú contextual: animaciones on/off.

---

## Estilos que podés sumar (sin cambiar arquitectura)

1. **Modo compacto / cómodo** — guardar densidad de filas (`ROW_HEIGHT`, márgenes) en QSettings.
2. **Tema claro / más pastel** — duplicar `theme.py` como `theme_soft.py` o cargar paleta desde JSON.
3. **Logo en la barra de título** — mini `QLabel` con `logo.jpg` junto al texto “Saldos Monserrat”.
4. **Separador visual** bajo la búsqueda en el menú (línea 1px `GOLD` muy suave).
5. **Estado vacío** en la lista si el filtro no matchea (“Ninguna sección coincide”).
6. **Tooltips** en cada ítem del menú con una frase corta.
7. **QSS global solo para `zen_desktop`** — un `zen_desktop.qss` que se aplique con `setStyleSheet` en la ventana raíz (más fácil de editar que strings en Python).
8. **Iconos activos** — al seleccionar fila, cambiar color del icono a `PRIMARY` (hoy el estilo Qt de lista no siempre lo permite; a veces hace falta `delegate` o `setIcon` al cambiar selección).

---

## Animaciones que Qt permite bien

| Idea | Dificultad | Notas |
|------|------------|--------|
| Fundido más suave (easing, ms) | Baja | Editar `animations.py` |
| **Slide horizontal** al cambiar página (stack) | Media | Animar `pos()` o usar `QStackedWidget` + `QTransform` / animar `geometry` del hijo |
| **Escalado leve** al aparecer tarjeta (95% → 100%) | Media | `QPropertyAnimation` en `scale` vía `QGraphicsProxyWidget` o `QGraphicsDropShadowEffect` + `opacity` |
| Entrada **escalonada** (icono → título → texto) | Media | Opacidad por widget con `QTimer`; ojo si combinás con fundido del stack (se superponen) |
| **Scroll suave** si agregás `QScrollArea` en la tarjeta | Baja–media | Política de scroll nativa; animar valor de scroll con `QPropertyAnimation` en la barra |
| **Ripple / material** en botones | Alta | No viene en QSS; hace falta widget custom o librería |
| **Blur** del fondo detrás de la tarjeta | Alta en Qt Widgets | Más natural en Qt Quick / efectos DWM |

---

## Paridad con “Zen Browser” real

El navegador usa **motor propio + CSS/web**. En **Qt Widgets** no podés copiar 1:1 transiciones CSS; se aproxima con `QPropertyAnimation`, `QGraphicsOpacityEffect`, y eventualmente **Qt Quick** si algún día migrás una pantalla.

---

## Sonido / microinteracciones

- Clic suave al cambiar sección: opcional `QSoundEffect` (muchas tiendas lo omiten).
- Vibración: no aplica en escritorio típico.

---

## Accesibilidad

- Contraste texto/fondo en `NAV_ROW_SELECTED` (revisar con WCAG).
- **Tab order** explícito en menú + búsqueda.
- Atajos **Alt+letra** o **1–7** para cada sección del menú.

---

## Prioridad sugerida si querés “más lindo” rápido

1. Logo en barra de título + separador bajo búsqueda.  
2. Afinar fundido (easing + duración).  
3. Icono del ítem seleccionado en color marca.  
4. `zen_desktop.qss` para iterar estilos sin tocar tanto Python.

---

## Configuración vs hardware (marzo 2025)

- **Página Configuración** (shell, tuerca): centro de preferencias del programa; hoy incluye acceso al modal de **hardware de caja** y tarjetas *próximamente* (apariencia tipo Zen browser, teclas rápidas, idioma, tipografía).
- **Modal «Configuración»** (título de ventana): por ahora solo la sección **Impresoras** y **Lector en caja** (menú lateral). Más adelante se puede **unificar** en ese mismo modal entradas de tema/atajos/idioma, o dejar el modal solo para hardware y el resto en la página — según complejidad y si querés un solo lugar estilo Windows 11 *Settings*.
