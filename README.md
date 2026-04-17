# Bazar Monserrat

Aplicación de escritorio (**Electron + React + Vite + SQLite**) para inventario, cuaderno de precios, banqueta, créditos e impresión de etiquetas.

## Requisitos (quien clone el repo)

| Herramienta | Notas |
|-------------|--------|
| **Node.js 20 LTS** (o 22) | [nodejs.org](https://nodejs.org/). El proyecto declara `engines` en `bazar-app/package.json`. |
| **npm** | Viene con Node. |
| **Windows** | Para compilar `better-sqlite3`, suele hacer falta **Visual Studio Build Tools** (carga “Desarrollo con C++”) o un Visual Studio con componente MSVC. Sin eso, `npm install` puede fallar en el paso nativo. Si ves **EPERM / unlink** en `better_sqlite3.node`, cerrá la app Electron y cualquier `npm run dev` que esté usando esa carpeta y volvé a ejecutar `npm install` en `bazar-app/`. |
| **macOS / Linux** | Xcode Command Line Tools / `build-essential` según corresponda. |

No hace falta instalar Python ni dependencias del monorepo antiguo: todo va por **npm** dentro de `bazar-app/`.

## Instalación en un solo paso

**Opción A — desde la raíz del repo** (recomendado al clonar):

```bash
npm install
```

El `package.json` de la raíz ejecuta **`postinstall`** → `npm install` dentro de `bazar-app/`, que a su vez corre **`electron-rebuild`** para **better-sqlite3**.

**Opción B — solo la app:**

```bash
cd bazar-app
npm install
```

En ambos casos quedan instaladas las dependencias de frontend y Electron.

Opcional: copiá variables de entorno para prototipos de IA:

```bash
copy .env.example .env
# macOS/Linux: cp .env.example .env
```

## Arranque en desarrollo

Desde la raíz:

```bash
npm run dev
```

O desde `bazar-app/`:

```bash
cd bazar-app
npm run dev
```

Se levanta **Vite** (puerto 5173) y la ventana **Electron** con la UI. La app espera APIs en `window.bazar` (solo en Electron).

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` / `npm start` | Desarrollo (Vite + Electron) |
| `npm run build:vite` | Solo build web → `dist/` |
| `npm run build` | `vite build` + **electron-builder** → `release/` (instalador; no suele subirse a Git) |
| `npm run lint` | ESLint |

Más detalle: [`bazar-app/README.md`](bazar-app/README.md).

## Estructura del repo

```
BazarMonserrrat/
├── README.md          ← este archivo
├── CONTRIBUTING.md
└── bazar-app/         ← aplicación (package.json, electron/, src/)
```

## Subir a GitHub

1. Creá el repositorio vacío en GitHub.
2. En la carpeta del proyecto:

```bash
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git add .
git status   # revisá que no aparezcan node_modules/, dist/, release/
git commit -m "feat: app Electron Bazar Monserrat"
git push -u origin main
```

**Importante:** no commitees `node_modules/`, `dist/`, `release/` ni `.env`; ya están en `.gitignore`. Sí commiteá **`package-lock.json`** para que otro desarrollador obtenga las mismas versiones con `npm ci` o `npm install`.
