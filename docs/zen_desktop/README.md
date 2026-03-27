# Shell Zen (`python main.py`)

Interfaz **principal del escritorio**: **barra lateral a toda la altura** (búsqueda + menú) y a la derecha **barra de título + tarjeta de contenido** (estilo Zen: los controles de ventana no “pisan” el sidebar). **Sidebar y barra superior** comparten el **mismo color que el fondo**, **sin líneas**; la tarjeta central va **casi encajada** (márgenes chicos en `theme.py`: `SHELL_MARGIN_LEFT`, `SHELL_MARGIN`) y la separación la dan **radio + sombra suave** (tipo Zen).

- **Animaciones** = solo fundido al cambiar de sección en la tarjeta derecha (no es otra columna).

La carpeta **Zen Browser** del instalador del navegador no forma parte del proyecto; no debe incluirse en el repositorio (ver `.gitignore`).

## Cómo ejecutar

```bash
python main.py
```

El arranque oficial es **`main.py`** en la raíz del repo. El ERP clásico (selector + `src/ui/main_window.py`) queda en el código como **legacy** por si se reutilizan pantallas; no tiene otro entry point.

## Configuración (QSettings)

Organización: `SaldosMonserrat` · App: `BazarMonserratZenShell`

| Clave | Uso |
|-------|-----|
| `window/geometry` | Tamaño y posición |
| `ui/animations_enabled` | Fundidos al cambiar página |
| `ui/nav_width` | Ancho barra lateral (200–340; por defecto ~228, proporción tipo Zen) |
| `ui/nav_sidebar_collapsed` | Menú lateral en modo compacto (solo iconos, ~56 px); el panel derecho usa el espacio que libera el layout |
| `ui/nav_sidebar_fully_hidden` | Menú oculto al borde (solo franja de ~5 px hasta pasar el ratón); va junto al interruptor **«** activo |
| `ui/nav_banqueta_folder_expanded` | Carpeta Banqueta del sidebar abierta o cerrada (se guarda al animar) |
| `ui/nav_banqueta_sidebar_block_visible` | Bloque «Banqueta · resumen» (título + carpeta) visible en la barra; si es `false`, el layout se reacomoda; se puede volver a activar en **Ver → Mostrar resumen Banqueta en la barra** o con el menú **⋮** de la carpeta |
| `devices/printer_labels_name` | Nombre de impresora para etiquetas (vacío = predeterminada de Windows) |
| `devices/printer_tickets_name` | Nombre de impresora para tickets / recibos (vacío = predeterminada) |
| `devices/scanner_pnp_instance_id` | Reservado (futuro, p. ej. Raw Input); la UI no lo modifica |
| `ui/titlebar_always_visible` | Barra título fija; si es `false`, solo franja fina hasta pasar el ratón arriba |

**Menú lateral**: **chevron** plegar a iconos; **«** (`fa5s.angle-double-left`) es un **interruptor**: activado = menú al borde (el botón se ve resaltado); desactivado = menú fijo visible. Con el menú al borde, pasá el ratón por la **franja izquierda** para verlo; al sacar el ratón se vuelve a ocultar. **Otro clic** en **«** lo deja otra vez fijo y el botón al estado normal.

Debajo del separador hay una **carpeta Banqueta** (estilo Zen): al hacer clic se **despliega con animación** y muestra datos del SQLite compartido con el ERP (prendas `en_banqueta`, disponibles para plano, nombres de **planos de tienda** y prendas colocadas en cada uno). El enlace **Abrir sección Banqueta** cambia al ítem Banqueta del menú. Al pasar el ratón por la cabecera aparece **⋮** con opciones **Colapsar carpeta** y **Quitar de la barra lateral**.

Al pie del menú lateral: solo la **tuerca** (Configuración). En **Inicio**, el enlace **Configuración · impresoras y lector** va debajo de «Ir a»; **Salir** (enlace rojizo, sin icono) debajo de **Atajos de teclado**, alineado al texto de las tarjetas. Los botones **minimizar / maximizar / cerrar** de la ventana Zen usan hovers suaves (sin rojo plano al cerrar). El modal **Configuración** (título de ventana; barra lateral «hardware de caja») agrupa **Impresoras** y **Lector en caja**; diseño por tarjetas y tokens de espaciado; sin registro largo de eventos. La página **Configuración** del shell incluye además tarjetas «próximamente» (apariencia, teclado e idioma).

En modo compacto, **tooltips** en los iconos y **sin barra de scroll** visible (sigue la rueda); la carpeta se **oculta** hasta volver a expandir el menú.

**Layout (tipo Zen)**: el menú lateral va de **borde a borde en altura**; la barra de título (minimizar, maximizar, cerrar) solo cubre el **panel derecho**. La zona central **ajusta altura y margen superior** cuando la barra pasa a solo franja (sin reservar espacio “fantasma” ni dejar un banda vacía grande arriba de la tarjeta).

En la **barra de título**: menús **Archivo** (Salir), **Ver** (animaciones, barra fija, maximizar/restaurar) y **Ayuda** (acerca de, documentación Zen, atajos — placeholders donde falte lógica).

**Menú contextual** (clic derecho en la ventana): mismas opciones útiles y salir.

## Código

- `src/ui/zen_desktop/theme.py` — colores y medidas
- `src/ui/zen_desktop/widgets.py` — menú lateral, búsqueda, tarjeta, barra título
- `src/ui/zen_desktop/animations.py` — fundidos
- `src/ui/zen_desktop/main_window.py` — ensamblado
- `src/ui/zen_desktop/config_page.py` — pantalla Configuración (acceso a dispositivos)
- `src/ui/zen_desktop/devices_modal.py` — ventana impresoras / lector (sidebar + contenido)
- `src/ui/zen_desktop/hw_services.py` — listado y prueba de impresoras (Qt)
- `src/ui/zen_desktop/scrollbars_qss.py` — barras de scroll finas (thumb que funde con el fondo)

Tipografía: **Segoe UI Variable** / **Segoe UI** (alineada al resto de la app en Windows).

Las páginas son **placeholders**; podés enlazar después los mismos widgets que usa `main_window.py` (inventario, dashboard, etc.).

**Dispositivos sin hardware** (PDF virtual, lector simulado): [`DISPOSITIVOS_PRUEBA.md`](DISPOSITIVOS_PRUEBA.md).

**Lista amplia de ideas** (estilos, animaciones, accesibilidad): [`IDEAS_DISENO.md`](IDEAS_DISENO.md).
