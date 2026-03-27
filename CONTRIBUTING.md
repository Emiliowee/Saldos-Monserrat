# Contribuir al proyecto

## Requisitos

- Python 3.10+ recomendado (el equipo usa la versión indicada en clase).
- Entorno virtual opcional pero recomendable (`python -m venv .venv`).

## Configuración local

```bash
git clone https://github.com/Emiliowee/Saldos-Monserrat.git
cd Saldos-Monserrat
pip install -r requirements.txt
python main.py
```

La base SQLite se crea en `data/` al primer arranque. No subas `data/*.db` al repositorio (está en `.gitignore`).

## Ramas

- `main`: código integrado y estable para el equipo.
- Trabajo en ramas por tarea, por ejemplo: `feature/descripcion-corta`, `fix/descripcion`.

## Pull requests

1. Abrí un PR desde tu rama hacia `main`.
2. Describí qué cambia y cómo probarlo (ej.: pantalla Inventario, diálogo X).
3. Pedí revisión a al menos un compañero antes de fusionar.

## Issues

Usá Issues para tareas y bugs (título claro, pasos si es error).

## Estilo de código

- Respetá el estilo existente en el archivo que toques.
- No commitees `__pycache__`, `.env` ni bases locales.
