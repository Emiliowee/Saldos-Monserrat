const { app, BrowserWindow, ipcMain, screen, shell, dialog, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')
const { pathToFileURL, fileURLToPath } = require('node:url')
const { execFile } = require('child_process')
const os = require('os')
const db = require('./database.cjs')
const { pickProductImage } = require('./product-image.cjs')
const { pickTagIconImage } = require('./tag-icon-image.cjs')
const { resolveDataRootDir } = require('./monserrat-path.cjs')
const printers = require('./printers.cjs')
const printTest = require('./print-test.cjs')
const printPdf = require('./print-pdf.cjs')
const { createSettingsStore } = require('./settings-store.cjs')
const { createLabelTemplatesStore } = require('./label-templates-store.cjs')
const labelPdfRender = require('./label-pdf-render.cjs')
const banquetaSheetPdf = require('./banqueta-sheet-pdf.cjs')
const { applyLabelLogoStyle } = require('./label-logo-raster.cjs')

const isDev = !app.isPackaged

/** Ruta de disco: acepta `file://` (p. ej. settings antiguos) o ruta absoluta normal. */
function workspacePathToFs(p) {
  const s = String(p ?? '').trim()
  if (!s) return ''
  if (s.startsWith('file:')) {
    try {
      return fileURLToPath(s)
    } catch {
      return s
    }
  }
  return s
}

/** Logo por defecto de la app (mismo que el sidebar sin avatar). */
function resolveBrandingLogoFsPath() {
  const candidates = [
    path.join(__dirname, '..', 'public', 'branding', 'logo.jpg'),
    path.join(__dirname, '..', 'dist', 'branding', 'logo.jpg'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
    } catch {
      /* noop */
    }
  }
  return ''
}

/** Ruta de archivo a usar en etiquetas: avatar del espacio o logo por defecto. */
function effectiveWorkspaceLogoFsPath(settings) {
  const user = workspacePathToFs(String(settings?.workspaceLogoPath ?? '').trim())
  if (user) {
    try {
      if (fs.existsSync(user) && fs.statSync(user).isFile()) return user
    } catch {
      /* noop */
    }
  }
  return resolveBrandingLogoFsPath()
}

/** Nombre de archivo PDF de etiqueta (sin extensión), seguro para el sistema de archivos. */
function safeEtiquetaFileStem(codigo, nombreEtiqueta) {
  const bad = /[<>:"/\\|?*\x00-\x1f]/g
  const c = String(codigo || '')
    .trim()
    .replace(bad, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 56)
  const rawN = String(nombreEtiqueta || '')
    .trim()
    .replace(bad, '_')
    .replace(/\s+/g, '_')
    .slice(0, 48)
  const n = rawN === '—' ? '' : rawN
  let stem
  if (c && n) stem = `Etiqueta_${c}_${n}`
  else if (c) stem = `Etiqueta_${c}`
  else if (n) stem = `Etiqueta_${n}`
  else stem = `Etiqueta_${Date.now()}`
  if (stem.length > 140) stem = stem.slice(0, 140)
  return stem
}

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null
/** @type {import('electron').BrowserWindow | null} */
let devicesWindow = null
/** @type {import('electron').BrowserWindow | null} */
let riveWindow = null
/** @type {import('electron').BrowserWindow | null} */
let pdvWindow = null
/** @type {import('electron').Rectangle | null} */
let preWelcomeBounds = null
/** @type {[number, number] | null} */
let preWelcomeMinSize = null
/** Ventana principal en modo splash: no permitir maximizar. */
let welcomeModeActive = false
/** @type {ReturnType<typeof createSettingsStore> | null} */
let settingsStore = null
/** @type {ReturnType<typeof createLabelTemplatesStore> | null} */
let labelTemplatesStore = null

/** Carpeta efectiva para guardar PDFs de etiqueta (config o Descargas). */
function resolveLabelPdfDirectory() {
  const downloads = app.getPath('downloads')
  try {
    const st = settingsStore?.getAll?.() ?? {}
    const custom = String(st.labelPdfSavePath || '').trim()
    if (!custom) return downloads
    const norm = path.resolve(custom)
    try {
      const stat = fs.statSync(norm)
      if (stat.isDirectory()) return norm
    } catch {
      /* ruta inexistente o sin acceso */
    }
    return downloads
  } catch {
    return downloads
  }
}

function resolveAppIconPath() {
  const candidates = [
    path.join(__dirname, '../public/branding/rose_icon.png'),
    path.join(__dirname, '../dist/branding/rose_icon.png'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return undefined
}

function wireWindowState(win) {
  const send = () => {
    win.webContents.send('window:state', { maximized: win.isMaximized() })
  }
  win.on('maximize', send)
  win.on('unmaximize', send)
  win.on('enter-full-screen', send)
  win.on('leave-full-screen', send)
}

function createWindow() {
  const icon = resolveAppIconPath()

  /** @type {import('electron').BrowserWindowConstructorOptions} */
  const opts = {
    title: 'Bazar Monserrat',
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#f3f0f4',
    autoHideMenuBar: true,
    /* macOS: marco nativo + hiddenInset para luces de tráfico en (14,14); Win/Linux: sin marco */
    frame: process.platform === 'darwin',
    icon: icon || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isDev,
      /* file:// en <img> desde la app (rutas locales tras elegir foto) */
      webSecurity: false,
    },
  }

  if (process.platform === 'win32') {
    try {
      opts.backgroundMaterial = 'mica'
    } catch {
      /* Electron antiguo */
    }
  }

  if (process.platform === 'darwin') {
    opts.titleBarStyle = 'hiddenInset'
    opts.trafficLightPosition = { x: 14, y: 14 }
  }

  const win = new BrowserWindow(opts)
  mainWindow = win
  wireWindowState(win)

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173')
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('closed', () => {
    mainWindow = null
  })
}

function createDevicesWindow() {
  if (devicesWindow && !devicesWindow.isDestroyed()) {
    devicesWindow.focus()
    return
  }

  const icon = resolveAppIconPath()
  devicesWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: Boolean(mainWindow),
    title: 'Dispositivos de caja',
    width: 720,
    height: 580,
    minWidth: 520,
    minHeight: 420,
    backgroundColor: '#f3f0f4',
    frame: false,
    icon: icon || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isDev,
    },
  })
  wireWindowState(devicesWindow)

  if (isDev) {
    devicesWindow.loadURL('http://127.0.0.1:5173/#devices')
  } else {
    try {
      devicesWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'devices' })
    } catch {
      const u = pathToFileURL(path.join(__dirname, '../dist/index.html')).href + '#devices'
      devicesWindow.loadURL(u)
    }
  }

  devicesWindow.on('closed', () => {
    devicesWindow = null
  })
}

function createRiveWindow() {
  if (riveWindow && !riveWindow.isDestroyed()) {
    riveWindow.focus()
    return
  }

  const icon = resolveAppIconPath()
  riveWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: false,
    title: 'Vista previa Rive',
    width: 980,
    height: 820,
    minWidth: 640,
    minHeight: 520,
    backgroundColor: '#f3f0f4',
    frame: false,
    icon: icon || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isDev,
    },
  })
  wireWindowState(riveWindow)

  if (isDev) {
    riveWindow.loadURL('http://127.0.0.1:5173/#rive')
  } else {
    try {
      riveWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'rive' })
    } catch {
      const u = pathToFileURL(path.join(__dirname, '../dist/index.html')).href + '#rive'
      riveWindow.loadURL(u)
    }
  }

  riveWindow.on('closed', () => {
    riveWindow = null
  })
}

function createPdvWindow() {
  if (pdvWindow && !pdvWindow.isDestroyed()) {
    pdvWindow.focus()
    return
  }

  const icon = resolveAppIconPath()
  pdvWindow = new BrowserWindow({
    modal: false,
    title: 'Caja — Bazar Monserrat',
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 560,
    /* Antes del paint de React: tono papel del tema claro (index.css --background aprox.) */
    backgroundColor: '#f6f2f8',
    frame: false,
    icon: icon || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isDev,
    },
  })
  wireWindowState(pdvWindow)

  if (isDev) {
    pdvWindow.loadURL('http://127.0.0.1:5173/#pdv-terminal')
  } else {
    try {
      pdvWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'pdv-terminal' })
    } catch {
      const u = pathToFileURL(path.join(__dirname, '../dist/index.html')).href + '#pdv-terminal'
      pdvWindow.loadURL(u)
    }
  }

  pdvWindow.on('closed', () => {
    pdvWindow = null
  })
}

function registerIpc() {
  ipcMain.handle('db:getProducts', (_, filters) => db.getProducts(filters))
  ipcMain.handle('db:checkRequiredTagsForProduct', (_, map) => db.checkRequiredTagsForProduct(map))
  ipcMain.handle('db:addProduct', (_, product) => db.addProduct(product))
  ipcMain.handle('db:updateProduct', (_, product) => db.updateProduct(product))
  ipcMain.handle('db:deleteProduct', (_, id) => db.deleteProduct(id))
  ipcMain.handle('db:searchProducts', (_, query) => db.searchProducts(query))
  ipcMain.handle('db:nextCodigoMsr', () => db.nextCodigoMsr())
  ipcMain.handle('db:getMonserratDbPath', () => db.getMonserratDbPath())
  ipcMain.handle('db:resetToFactorySeed', () => {
    try {
      return db.resetMonserratDatabaseToSeed()
    } catch (e) {
      return { ok: false, message: String(e?.message || e) }
    }
  })
  ipcMain.handle('db:getTagGroupsForProduct', () => db.getTagGroupsForProduct())
  ipcMain.handle('db:getProductById', (_, id) => db.getProductById(id))
  ipcMain.handle('db:getProductByCodigo', (_, codigo) => db.getProductByCodigo(codigo))
  ipcMain.handle('db:getInventoryList', (_, filters) => db.getInventoryList(filters ?? {}))
  ipcMain.handle('productImage:pick', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return pickProductImage(win, resolveDataRootDir())
  })
  ipcMain.handle('tagIconImage:pick', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return pickTagIconImage(win, resolveDataRootDir())
  })
  ipcMain.handle('db:getTagLabelsForMap', (_, map) => db.getTagLabelsForMap(map))
  ipcMain.handle('db:suggestNombreFromTags', (_, payload) => db.suggestNombreFromTags(payload))
  ipcMain.handle('db:getNombreEtiquetaDesdeTags', (_, payload) => db.nombreEtiquetaDesdeTagsPayload(payload))
  ipcMain.handle('db:suggestPrecioFromTags', (_, payload) => db.suggestPrecioFromTags(payload))
  ipcMain.handle('db:getReferenceRows', (_, payload) => db.getReferenceRows(payload))
  ipcMain.handle('db:getReferenceSnapshot', (_, payload) => db.getReferenceSnapshot(payload))
  ipcMain.handle('db:getSales', (_, filters) => db.getSales(filters))
  ipcMain.handle('db:addSale', (_, sale) => db.addSale(sale))
  ipcMain.handle('db:getCredits', (_, filters) => db.getCredits(filters))
  ipcMain.handle('db:listClientes', () => db.listClientes())
  ipcMain.handle('db:addCliente', (_, p) => db.addCliente(p))
  ipcMain.handle('db:updateCliente', (_, p) => db.updateCliente(p))
  ipcMain.handle('db:addCreditoMovimiento', (_, p) => db.addCreditoMovimiento(p))
  ipcMain.handle('db:getCreditoMovimientos', (_, p) => db.getCreditoMovimientos(p))
  ipcMain.handle('db:suggestByTags', (_, tags) => db.suggestByTags(tags))
  ipcMain.handle('db:getWelcomeSnapshot', () => db.getWelcomeSnapshot())
  ipcMain.handle('db:getBanquetaSidebarSnapshot', () => db.getBanquetaSidebarSnapshot())
  ipcMain.handle('db:listBanquetaSalidas', () => db.listBanquetaSalidas())
  ipcMain.handle('db:getActiveBanquetaSalida', () => db.getActiveBanquetaSalida())
  ipcMain.handle('db:createBanquetaSalida', (_, p) => db.createBanquetaSalida(p ?? {}))
  ipcMain.handle('db:updateBanquetaSalida', (_, p) => db.updateBanquetaSalida(p ?? {}))
  ipcMain.handle('db:getBanquetaSalidaDetail', (_, id) => db.getBanquetaSalidaDetail(id))
  ipcMain.handle('db:addProductToBanquetaSalida', (_, payload) =>
    db.addProductToBanquetaSalida(payload?.salidaId, payload?.codigo),
  )
  ipcMain.handle('db:removeBanquetaSalidaItem', (_, itemId) => db.removeBanquetaSalidaItem(itemId))
  ipcMain.handle('db:setBanquetaSalidaItemResult', (_, payload) => db.setBanquetaSalidaItemResult(payload ?? {}))
  ipcMain.handle('db:activateBanquetaSalida', (_, id) => db.activateBanquetaSalida(id))
  ipcMain.handle('db:closeBanquetaSalida', (_, id) => db.closeBanquetaSalida(id))
  ipcMain.handle('db:deleteBanquetaSalida', (_, id) => db.deleteBanquetaSalida(id))
  ipcMain.handle('db:reorderBanquetaSalidaItems', (_, payload) =>
    db.reorderBanquetaSalidaItems(payload?.salidaId, payload?.orderedItemIds),
  )
  ipcMain.handle('db:removeBanquetaSalidaItemsBulk', (_, itemIds) => db.removeBanquetaSalidaItemsBulk(itemIds))
  ipcMain.handle('db:previewPriceAdjust', (_, payload) => db.previewPriceAdjust(payload))
  ipcMain.handle('db:applyPriceAdjust', (_, payload) => db.applyPriceAdjust(payload))
  ipcMain.handle('db:getReferencePatternStats', (_, payload) => db.getReferencePatternStats(payload))
  ipcMain.handle('db:getCuadernoTagGroups', () => db.getCuadernoTagGroups())
  ipcMain.handle('db:getTagCatalogForManager', () => db.getTagCatalogForManager())
  ipcMain.handle('db:cuadernoRenameTagGroup', (_, p) => db.cuadernoRenameTagGroup(p))
  ipcMain.handle('db:cuadernoDeleteTagOption', (_, p) => db.cuadernoDeleteTagOption(p))
  ipcMain.handle('db:cuadernoDeleteTagGroup', (_, p) => db.cuadernoDeleteTagGroup(p))
  ipcMain.handle('db:listPriceRulesAdmin', () => db.listPriceRulesAdmin())
  ipcMain.handle('db:cuadernoAddTagGroup', (_, p) => db.cuadernoAddTagGroup(p))
  ipcMain.handle('db:cuadernoAddTagOption', (_, p) => db.cuadernoAddTagOption(p))
  ipcMain.handle('db:cuadernoMoveTagOption', (_, p) => db.cuadernoMoveTagOption(p))
  ipcMain.handle('db:cuadernoRenameTagOption', (_, p) => db.cuadernoRenameTagOption(p))
  ipcMain.handle('db:cuadernoSetTagOptionActive', (_, p) => db.cuadernoSetTagOptionActive(p))
  ipcMain.handle('db:cuadernoSetTagGroupStyle', (_, p) => db.cuadernoSetTagGroupStyle(p))
  ipcMain.handle('db:cuadernoSetTagOptionStyle', (_, p) => db.cuadernoSetTagOptionStyle(p))
  ipcMain.handle('db:cuadernoReorderTagGroups', (_, p) => db.cuadernoReorderTagGroups(p))
  ipcMain.handle('db:cuadernoUpsertPriceRule', (_, p) => db.cuadernoUpsertPriceRule(p))
  ipcMain.handle('db:cuadernoDeletePriceRule', (_, p) => db.cuadernoDeletePriceRule(p))
  ipcMain.handle('db:listTagPriceRulesSummary', () => db.listTagPriceRulesSummary())
  ipcMain.handle('db:listTagPriceRulesForCuaderno', () => db.listTagPriceRulesForCuaderno())
  ipcMain.handle('db:setTagOptionPriceRule', (_, p) => db.setTagOptionPriceRule(p))
  ipcMain.handle('db:getPriceCombosForAnchor', (_, p) => db.getPriceCombosForAnchor(p))
    ipcMain.handle('db:replacePriceCombosForAnchor', (_, p) => db.replacePriceCombosForAnchor(p))
    ipcMain.handle('db:listInvPricingRules', () => db.listInvPricingRules())
    ipcMain.handle('db:getInvPricingRule', (_, p) => db.getInvPricingRule(p))
    ipcMain.handle('db:upsertInvPricingRule', (_, p) => db.upsertInvPricingRule(p))
    ipcMain.handle('db:deleteInvPricingRule', (_, p) => db.deleteInvPricingRule(p))

  ipcMain.handle('settings:get', () => settingsStore?.getAll() ?? {})
  ipcMain.handle('settings:set', (_, patch) => settingsStore?.merge(patch ?? {}) ?? {})
  /**
   * Vista previa del logo en el renderer (data URL). Si `rawPath` está vacío o el archivo
   * no existe, se usa `public/branding/logo.jpg` (mismo recurso que el avatar por defecto).
   */
  ipcMain.handle('assets:logoDataUrl', async (_, rawPath) => {
    const user = workspacePathToFs(String(rawPath ?? '').trim())
    let p = ''
    if (user) {
      try {
        if (fs.existsSync(user) && fs.statSync(user).isFile()) p = user
      } catch {
        /* noop */
      }
    }
    if (!p) p = resolveBrandingLogoFsPath()
    if (!p) return { ok: false, message: 'Sin imagen de logo (ni avatar ni logo por defecto)' }
    try {
      if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return { ok: false, message: 'Archivo no encontrado' }
      const ext = path.extname(p).toLowerCase()
      if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext)) {
        return { ok: false, message: 'Formato no soportado para el logo' }
      }
      const img = nativeImage.createFromPath(p)
      if (img.isEmpty()) return { ok: false, message: 'No se pudo leer la imagen' }
      const st = settingsStore?.getAll?.() ?? {}
      const styled = applyLabelLogoStyle(img, {
        style: st.labelLogoStyle,
        warmth: st.labelLogoWarmth,
        contrast: st.labelLogoContrast,
        saturation: st.labelLogoSaturation,
      })
      const png = styled.toPNG()
      const buf = Buffer.isBuffer(png) ? png : Buffer.from(png)
      return { ok: true, dataUrl: `data:image/png;base64,${buf.toString('base64')}` }
    } catch (e) {
      return { ok: false, message: String(e?.message || e) }
    }
  })

  /** Imagen arbitraria (PNG/JPEG/WebP…) a data URL, sin estilo de logo térmico. Vacío → error (sin fallback). */
  ipcMain.handle('assets:imageFileDataUrl', async (_, rawPath) => {
    const user = workspacePathToFs(String(rawPath ?? '').trim())
    if (!user) return { ok: false, message: 'Sin ruta de imagen' }
    try {
      if (!fs.existsSync(user) || !fs.statSync(user).isFile()) return { ok: false, message: 'Archivo no encontrado' }
      const ext = path.extname(user).toLowerCase()
      if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext)) {
        return { ok: false, message: 'Formato no soportado' }
      }
      const img = nativeImage.createFromPath(user)
      if (img.isEmpty()) return { ok: false, message: 'No se pudo leer la imagen' }
      const png = img.toPNG()
      const buf = Buffer.isBuffer(png) ? png : Buffer.from(png)
      return { ok: true, dataUrl: `data:image/png;base64,${buf.toString('base64')}` }
    } catch (e) {
      return { ok: false, message: String(e?.message || e) }
    }
  })

  ipcMain.handle('settings:pickLabelPdfFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const r = await dialog.showOpenDialog(win ?? undefined, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Carpeta para guardar PDFs de etiqueta',
      buttonLabel: 'Usar esta carpeta',
    })
    if (r.canceled || !r.filePaths?.length) return { cancelled: true }
    return { cancelled: false, path: r.filePaths[0] }
  })

  /* Banqueta — hoja de trabajo PDF ------------------------------------- */
  ipcMain.handle('banqueta:printSheet', async (_, payload) => {
    const detail = payload?.detail
    if (!detail?.salida) return { ok: false, message: 'Sin datos de la salida.' }
    const outDir = resolveLabelPdfDirectory()
    try { fs.mkdirSync(outDir, { recursive: true }) } catch { /* ignore */ }
    const bad = /[<>:"/\\|?*\x00-\x1f]/g
    const nameStem = String(detail.salida.nombre || `salida_${detail.salida.id || Date.now()}`)
      .trim().replace(bad, '_').replace(/\s+/g, '_').slice(0, 80) || 'salida_banqueta'
    let outPath = path.join(outDir, `Hoja_${nameStem}.pdf`)
    let suffix = 0
    while (fs.existsSync(outPath) && suffix < 200) { suffix += 1; outPath = path.join(outDir, `Hoja_${nameStem}_${suffix}.pdf`) }
    try {
      await banquetaSheetPdf.writeBanquetaSheetPdf(outPath, detail)
    } catch (e) {
      return { ok: false, message: String(e?.message || e) }
    }
    setImmediate(() => {
      void (async () => {
        try {
          let err = await shell.openPath(outPath)
          if (err) {
            try { await shell.openExternal(pathToFileURL(outPath).href); err = '' } catch { /* noop */ }
          }
          if (err && process.platform === 'win32') {
            try {
              await new Promise((resolve, reject) => execFile('cmd.exe', ['/c', 'start', '""', outPath], { windowsHide: true }, (e2) => e2 ? reject(e2) : resolve()))
              err = ''
            } catch { /* noop */ }
          }
          if (err) { try { shell.showItemInFolder(outPath) } catch { /* noop */ } }
        } catch (e) {
          console.error('[banqueta:printSheet] abrir PDF:', e)
        }
      })()
    })
    return { ok: true, path: outPath, message: `Hoja PDF generada en «${outDir}».` }
  })

  /* Plantillas de etiqueta --------------------------------------------- */
  ipcMain.handle('labels:list', () => labelTemplatesStore?.list() ?? { activeId: null, templates: [] })
  ipcMain.handle('labels:getActive', () => labelTemplatesStore?.getActive() ?? null)
  ipcMain.handle('labels:upsert', (_, tpl) => labelTemplatesStore?.upsert(tpl))
  ipcMain.handle('labels:remove', (_, id) => labelTemplatesStore?.remove(String(id)))
  ipcMain.handle('labels:setActive', (_, id) => labelTemplatesStore?.setActive(String(id)))
  ipcMain.handle('labels:duplicate', (_, id) => labelTemplatesStore?.duplicate(String(id)))
  ipcMain.handle('labels:restoreDefault', () => labelTemplatesStore?.restoreDefault())

  ipcMain.handle('printers:list', () => printers.listPrinterNames())
  ipcMain.handle('printers:diagnostic', () => printers.diagnosticLines().join('\n'))

  ipcMain.handle('printers:testPrint', async (_, payload) => {
    const requested = String(payload?.printerName ?? '').trim()
    if (requested && !printers.printerExists(requested)) {
      return {
        ok: false,
        message: `La impresora «${requested}» no está en la lista actual del sistema.`,
      }
    }

    const defaultN = printers.getDefaultPrinterName()
    const effective = requested || defaultN
    const resolvedLabel = effective || defaultN || '(predeterminada)'
    const when = new Date().toLocaleString('es-MX', { hour12: false })

    if (printTest.isVirtualPdf(effective)) {
      const safeTs = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14)
      const outPath = path.join(os.tmpdir(), `prueba_impresion_${safeTs}.pdf`)
      const fs = require('fs')
      try {
        await printTest.writeTestPdf(outPath, resolvedLabel, when)
        await printPdf.printPdfToQueue(outPath, effective)
        return {
          ok: true,
          message: `Prueba enviada a la cola de «${resolvedLabel}» (PDF).`,
        }
      } catch (e) {
        return { ok: false, message: `No se pudo imprimir la prueba PDF: ${e.message || e}` }
      } finally {
        try {
          fs.unlinkSync(outPath)
        } catch {
          /* ignore */
        }
      }
    }

    return printTest.sendPhysicalTestPrint(requested || undefined)
  })

  ipcMain.handle('printers:printLabel', async (_, payload) => {
    const { codigo, nombre, precio } = payload || {}
    const codigoTrim = String(codigo || '').trim()
    if (!codigoTrim) return { ok: false, message: 'Falta el código del producto.' }

    const precioStr = Number.isFinite(Number(precio))
      ? Math.abs(Number(precio) - Math.round(Number(precio))) < 1e-9
        ? `$${Math.round(Number(precio))}`
        : `$${Number(precio).toFixed(2)}`
      : '$0'

    const outDir = resolveLabelPdfDirectory()
    try {
      fs.mkdirSync(outDir, { recursive: true })
    } catch {
      /* ignore */
    }

    const stem = safeEtiquetaFileStem(codigoTrim, nombre)
    let outPath = path.join(outDir, `${stem}.pdf`)
    let suffix = 0
    while (fs.existsSync(outPath) && suffix < 200) {
      suffix += 1
      outPath = path.join(outDir, `${stem}_${suffix}.pdf`)
    }

    const settings = settingsStore?.getAll?.() || {}
    const template = labelTemplatesStore?.getActive?.() || null
    const data = {
      empresa: String(settings.workspaceDisplayName || 'Saldos Monserrat'),
      codigo: codigoTrim,
      nombre: String(nombre || '').trim() || '—',
      precio: precioStr,
      logoPath: effectiveWorkspaceLogoFsPath(settings),
      labelLogoStyle: settings.labelLogoStyle || 'thermal',
      labelLogoWarmth: Number.isFinite(Number(settings.labelLogoWarmth)) ? Number(settings.labelLogoWarmth) : 0,
      labelLogoContrast: Number.isFinite(Number(settings.labelLogoContrast)) ? Number(settings.labelLogoContrast) : 100,
      labelLogoSaturation: Number.isFinite(Number(settings.labelLogoSaturation))
        ? Number(settings.labelLogoSaturation)
        : 100,
    }

    let labelMeta = { barcodeOk: false, barcodeNote: '' }
    try {
      if (template) {
        labelMeta = await labelPdfRender.renderLabelPdf(outPath, template, data)
      } else {
        labelMeta = await printTest.writeLabelPdf(outPath, {
          empresa: data.empresa, codigo: data.codigo, nombre: data.nombre, precio: data.precio,
        })
      }
    } catch (e) {
      return { ok: false, message: String(e?.message || e) }
    }

    let size = 0
    try {
      size = fs.statSync(outPath).size
    } catch {
      /* ignore */
    }
    if (size < 64) {
      return {
        ok: false,
        message: `El PDF no se pudo escribir en la carpeta configurada (archivo vacío o bloqueado): ${outDir}`,
      }
    }

    const base = path.basename(outPath)
    const bcNote = String(labelMeta?.barcodeNote || '').trim()
    const bcHint =
      labelMeta?.barcodeOk === false && bcNote ? ` · Código de barras: ${bcNote}` : ''

    /**
     * Abrir el PDF en segundo plano: si `openPath` o el visor cuelgan, no debe bloquear el IPC
     * (p. ej. al guardar producto con «etiqueta al crear»).
     */
    setImmediate(() => {
      void (async () => {
        try {
          let openErr = await shell.openPath(outPath)
          if (openErr && String(openErr).length > 0) {
            try {
              await shell.openExternal(pathToFileURL(outPath).href)
              openErr = ''
            } catch {
              /* ignore */
            }
          }
          if (openErr && String(openErr).length > 0 && process.platform === 'win32') {
            try {
              await new Promise((resolve, reject) => {
                execFile(
                  'cmd.exe',
                  ['/c', 'start', '""', outPath],
                  { windowsHide: true },
                  (err) => (err ? reject(err) : resolve()),
                )
              })
              openErr = ''
            } catch {
              /* ignore */
            }
          }
          if (openErr && String(openErr).length > 0) {
            try {
              shell.showItemInFolder(outPath)
            } catch {
              /* ignore */
            }
          }
        } catch (e) {
          console.error('[printLabel] abrir PDF en segundo plano:', e)
        }
      })()
    })

    return {
      ok: true,
      message: `PDF guardado (${base}) en «${outDir}». Se intenta abrir el visor en segundo plano.${bcHint}`,
      path: outPath,
      barcodeOk: labelMeta?.barcodeOk === true,
    }
  })

  ipcMain.handle('devices:open', () => {
    createDevicesWindow()
    return true
  })

  ipcMain.handle('rive:open', () => {
    createRiveWindow()
    return true
  })

  ipcMain.handle('pdv:open', () => {
    createPdvWindow()
    return true
  })

  /**
   * Ventana compacta tipo “modal” para la bienvenida (Rive + botón), centrada en el escritorio.
   * Al salir se restauran tamaño y límites previos.
   */
  ipcMain.handle('window:setWelcomeMode', (event, compact) => {
    const w = BrowserWindow.fromWebContents(event.sender)
    if (!w || w.isDestroyed()) return false
    try {
      if (compact) {
        welcomeModeActive = true
        if (preWelcomeBounds === null) {
          preWelcomeBounds = w.getBounds()
          preWelcomeMinSize = w.getMinimumSize()
        }
        if (w.isMaximized()) w.unmaximize()
        w.setMaximizable(false)
        w.setMinimumSize(500, 540)
        const wa = screen.getPrimaryDisplay().workArea
        /* Splash: ancho para el hero Rive; altura un poco mayor por card + animación */
        const ww = 592
        const wh = 664
        w.setBounds({
          x: wa.x + Math.floor((wa.width - ww) / 2),
          y: wa.y + Math.floor((wa.height - wh) / 2),
          width: ww,
          height: wh,
        })
      } else {
        welcomeModeActive = false
        w.setMaximizable(true)
        if (preWelcomeBounds) {
          const [mw, mh] = preWelcomeMinSize ?? [900, 600]
          w.setMinimumSize(mw, mh)
          w.setBounds(preWelcomeBounds)
          preWelcomeBounds = null
          preWelcomeMinSize = null
        }
      }
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('window:isMaximized', (event) => {
    const w = BrowserWindow.fromWebContents(event.sender)
    return w?.isMaximized() ?? false
  })
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle('window:maximizeToggle', (event) => {
    if (welcomeModeActive) return
    const w = BrowserWindow.fromWebContents(event.sender)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}

app.whenReady().then(() => {
  settingsStore = createSettingsStore(app.getPath('userData'))
  labelTemplatesStore = createLabelTemplatesStore(app.getPath('userData'))
  db.initDatabase()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
