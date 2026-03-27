# Bazar Monserrat / Saldos Monserrat

Aplicación de escritorio (**PySide6** + SQLite).

## Clonar el repositorio

```bash
git clone https://github.com/Emiliowee/Saldos-Monserrat.git
cd Saldos-Monserrat
pip install -r requirements.txt
python main.py
```

Recursos gráficos (logo, iconos) están en `assets/`. La base de datos local `data/monserrat.db` **no** se versiona.

## Ejecutar (si ya clonaste e instalaste dependencias)

```bash
python main.py
```

La interfaz activa es el **shell Zen** (`src/ui/zen_desktop/`). El código del ERP clásico (ventana con selector de arranque, `src/ui/main_window.py`, etc.) **sigue en el repositorio** por si se reutilizan módulos, pero **ya no hay otro `main`**: el arranque oficial es `main.py` de la raíz.

En **Inventario** (F2): alta con tags, nombre, precio, imagen, código `MSR-…`; **etiqueta** con Code128 real; **referencia de precio** (tuerca: cuaderno vs patrones, autocompletado opcional, enlace a informe con tabla e imágenes).

- Si la base está **vacía** (primer arranque), se cargan ~168 artículos de demostración con **nombres legibles** y **precios por tipo × marca**.
- Para **eliminar toda la base** y regenerar desde cero: `python main.py --reset-db` (también borra planos de banqueta).

Si tras actualizar el código no ves cambios en pantalla, cerrá la app, borrá `src/**/__pycache__` (o la carpeta `__pycache__` del proyecto) y volvé a ejecutar `python main.py` desde la **raíz del proyecto**.

## Documentación

- Interfaz Zen: [`docs/zen_desktop/README.md`](docs/zen_desktop/README.md)
- Dispositivos / impresoras de prueba: [`docs/zen_desktop/DISPOSITIVOS_PRUEBA.md`](docs/zen_desktop/DISPOSITIVOS_PRUEBA.md)
- Cómo colaborar: [`CONTRIBUTING.md`](CONTRIBUTING.md)
