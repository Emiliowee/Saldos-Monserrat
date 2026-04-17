# Bazar Monserrat — Electron + React + Vite + Tailwind v4 + SQLite

Nuevo cliente de escritorio en paralelo al shell **PySide6** de la raíz del monorepo. La app Python (`python main.py`) no se modifica.

## Requisitos

- **Node.js 20 LTS** (recomendado; ver `engines` en `package.json` y `.nvmrc` para `nvm use`).
- **Windows:** si `npm install` falla al compilar **better-sqlite3**, instalá [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con la carga de trabajo **“Desarrollo con C++”** y volvé a ejecutar `npm install`.

## Scripts

**App de escritorio = Electron.** Desde `bazar-app/`:

```bash
npm run dev
# o:
npm start
```

Vite queda en **127.0.0.1:5173** sin abrir el navegador; la UI la muestra **solo la ventana de Electron**.

| Comando | Descripción |
|--------|-------------|
| `npm install` | Dependencias + `postinstall` (`electron-rebuild` para `better-sqlite3`) |
| `npm run dev` / `npm start` | **Vite + Electron** (ventana de escritorio) |
| `npm run dev:vite` | Solo Vite (sin `window.bazar`; si abrís la URL en el browser, es solo para maquetar) |
| `npm run dev:electron` | Solo Electron (necesitás Vite ya en marcha) |
| `npm run build:vite` | Compila `dist/` |
| `npm run build` | `vite build` + `electron-builder` → `release/` |

**DevTools:** por defecto no se abren solos. PowerShell: `$env:ELECTRON_OPEN_DEVTOOLS='1'; npm run dev` o **Ctrl+Shift+I** en la ventana.

## Estructura

```
bazar-app/
├── electron/
│   ├── main.cjs       # proceso principal
│   ├── preload.cjs    # bridge seguro
│   └── database.cjs   # SQLite (better-sqlite3)
├── src/
│   ├── components/ui/   # shadcn: ver README ahí
│   ├── components/inventory/
│   ├── hooks/useBarcode.js
│   ├── lib/             # format, fuse, ai (prototipo)
│   ├── stores/
│   └── App.jsx
```

## API en el renderer

`preload.cjs` expone `window.bazar.db.*` (invoke IPC). Tipos auxiliares: `src/bazar.d.ts`.

## Base de datos

Por defecto el archivo se crea en el **userData** de Electron (no es aún `data/monserrat.db` del proyecto Python). Próximo paso: migrar esquema o abrir la misma ruta en modo lectura/escritura con cuidado por bloqueos entre procesos.

## Variables de entorno

Copiá `.env.example` → `.env`. `VITE_ANTHROPIC_KEY` solo para prototipos; en producción la clave debe vivir en el **main process** vía IPC.

## shadcn/ui

```bash
npx shadcn@latest init
npx shadcn@latest add table dialog drawer ...
```

Ver `src/components/ui/README.md`.

## Fuentes

Se enlazan **Geist** y **Geist Mono** desde Google Fonts en `index.html`. Si algún peso falla, sustituí por Inter.
