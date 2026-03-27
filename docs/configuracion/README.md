# Configuración persistente

Las claves que guarda la app en **QSettings** (`SaldosMonserrat` / `BazarMonserrat`):

| Clave | Módulo | Descripción |
|-------|--------|-------------|
| `window/chrome_always_visible` | `src/core/configuracion/ventana.py` | Barra superior fija vs. modo franja Zen |
| `alta_producto/*` | `src/core/producto_prefs.py` | Paneles de inventario, autocompletar precio |

La organización y nombre de la app para QSettings están centralizados en `src/core/qsettings_paths.py`.
