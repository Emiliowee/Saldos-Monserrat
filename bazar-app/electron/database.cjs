/**
 * SQLite: mismo archivo y esquema que Python (`data/monserrat.db`).
 * Tablas extra solo para funciones Electron (clientes / app_meta) — CREATE IF NOT EXISTS.
 */
const fs = require('fs')
const Database = require('better-sqlite3')
const { resolveMonserratDbPath, ensureDirForFile } = require('./monserrat-path.cjs')
const { ensureMonserratSchema } = require('./monserrat-schema.cjs')
const { runFactorySeed } = require('./monserrat-seed.cjs')
const alta = require('./producto-alta.cjs')

let _db = null

function getDb() {
  if (_db) return _db
  const dbPath = resolveMonserratDbPath()
  ensureDirForFile(dbPath)
  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  ensureMonserratSchema(_db)
  ensureTagPriceRuleMigration(_db)
  ensureInvPricingRulesSchema(_db)
  ensureTagNotionStyleMigration(_db)
  ensureProductosColumns(_db)
  ensureElectronExtras(_db)
  ensureBanquetaSalidasSchema(_db)
  return _db
}

/** Columna is_price_rule + tablas de combinaciones por tag ancla (reglas de precio). */
function ensureTagPriceRuleMigration(database) {
  try {
    const cols = database.prepare('PRAGMA table_info(tag_options)').all()
    const names = new Set(cols.map((c) => c.name))
    if (!names.has('is_price_rule')) {
      database.exec('ALTER TABLE tag_options ADD COLUMN is_price_rule INTEGER NOT NULL DEFAULT 0')
    }
    if (!names.has('rule_priority')) {
      database.exec('ALTER TABLE tag_options ADD COLUMN rule_priority INTEGER NOT NULL DEFAULT 0')
    }
  } catch {
    /* tag_options puede no existir aún */
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS tag_price_combo (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      anchor_option_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      price REAL,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (anchor_option_id) REFERENCES tag_options (id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS tag_price_combo_part (
      combo_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      PRIMARY KEY (combo_id, option_id),
      FOREIGN KEY (combo_id) REFERENCES tag_price_combo (id) ON DELETE CASCADE,
      FOREIGN KEY (option_id) REFERENCES tag_options (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tag_price_combo_anchor ON tag_price_combo (anchor_option_id);
  `)
}

/**
 * Reglas de inventario nombradas: ancla (tag), alcance por categorías, filas precio fijo por combinación de tags.
 * (La aplicación en el formulario de producto —elegir regla y filtrar categorías— es fase posterior.)
 */
function ensureInvPricingRulesSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS inv_pricing_rule (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(200) NOT NULL,
      anchor_option_id INTEGER NOT NULL,
      scope_all INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (anchor_option_id) REFERENCES tag_options (id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS inv_pricing_rule_scope_group (
      rule_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      PRIMARY KEY (rule_id, group_id),
      FOREIGN KEY (rule_id) REFERENCES inv_pricing_rule (id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES tag_groups (id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS inv_pricing_rule_row (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      price REAL,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (rule_id) REFERENCES inv_pricing_rule (id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS inv_pricing_rule_row_part (
      row_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      PRIMARY KEY (row_id, option_id),
      FOREIGN KEY (row_id) REFERENCES inv_pricing_rule_row (id) ON DELETE CASCADE,
      FOREIGN KEY (option_id) REFERENCES tag_options (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_inv_pricing_rule_anchor ON inv_pricing_rule (anchor_option_id);
    CREATE INDEX IF NOT EXISTS idx_inv_pricing_rule_row_rule ON inv_pricing_rule_row (rule_id);
  `)
}

/** Colores estilo Notion + icono opcional por sub-etiqueta (`tag_options.tag_icon`). */
function ensureTagNotionStyleMigration(database) {
  try {
    const tgCols = database.prepare('PRAGMA table_info(tag_groups)').all()
    const tgNames = new Set(tgCols.map((c) => c.name))
    if (!tgNames.has('notion_color')) {
      database.exec(`ALTER TABLE tag_groups ADD COLUMN notion_color TEXT NOT NULL DEFAULT 'gray'`)
    }
    const toCols = database.prepare('PRAGMA table_info(tag_options)').all()
    const toNames = new Set(toCols.map((c) => c.name))
    if (!toNames.has('notion_color')) {
      database.exec(`ALTER TABLE tag_options ADD COLUMN notion_color TEXT NOT NULL DEFAULT 'default'`)
    }
    if (!toNames.has('tag_icon')) {
      database.exec(`ALTER TABLE tag_options ADD COLUMN tag_icon TEXT`)
    }
  } catch {
    /* tablas tag_* pueden no existir aún */
  }
}

const NOTION_COLOR_KEYS = new Set([
  'default',
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
  /* variantes con relieve / brillo / cristal (UI) */
  'neo',
  'glow',
  'mesh',
  'prism',
  'aurora',
  'glass',
])

function normalizeNotionColorKey(raw, fallback = 'default') {
  const v = String(raw ?? fallback)
    .toLowerCase()
    .trim()
  return NOTION_COLOR_KEYS.has(v) ? v : fallback
}

function normalizeTagIcon(raw) {
  if (raw == null) return null
  const t = String(raw).trim()
  if (!t) return null
  const norm = t.replace(/\\/g, '/').toLowerCase()
  if (norm.includes('/tag_icons/')) {
    if (t.length > 2048) return null
    return t
  }
  if (t.length > 32) return null
  return t
}

/** Bases antiguas o creadas fuera de SQLAlchemy pueden no tener todas las columnas de `models.Producto`. */
function ensureProductosColumns(database) {
  let cols
  try {
    cols = database.prepare('PRAGMA table_info(productos)').all()
  } catch {
    return
  }
  const names = new Set(cols.map((c) => c.name))
  const add = (col, ddl) => {
    if (!names.has(col)) {
      database.exec(`ALTER TABLE productos ADD COLUMN ${ddl}`)
      names.add(col)
    }
  }
  add('pieza_unica', 'pieza_unica INTEGER')
  add('color', 'color TEXT')
  add('talla', 'talla TEXT')
  add('imagen_path', 'imagen_path TEXT')
  add('estado', "estado TEXT DEFAULT 'disponible'")
  add('fecha_ingreso', 'fecha_ingreso DATETIME')
  add('created_at', 'created_at DATETIME')
  add('updated_at', 'updated_at DATETIME')
  add('stock', 'stock INTEGER NOT NULL DEFAULT 1')
}

function friendlySqliteError(err) {
  const msg = String(err?.message || err || '')
  const code = err?.code || ''
  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed/i.test(msg)) {
    return new Error(
      'Ya existe un artículo con ese código. Cambiá el código o revisá el inventario.',
    )
  }
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || /FOREIGN KEY constraint failed/i.test(msg)) {
    return new Error(
      'Algún tag elegido no es válido en la base (¿se borró la opción?). Reabrí «Tags…» y volvé a elegir.',
    )
  }
  return err instanceof Error ? err : new Error(msg || 'Error al guardar en la base')
}

function initDatabase() {
  getDb()
}

function closeDb() {
  if (_db) {
    try {
      _db.close()
    } catch (e) {
      console.error('[db] closeDb:', e)
    }
    _db = null
  }
}

/**
 * Borra el archivo SQLite (y WAL/SHM), recrea esquema y carga tags + regla ejemplo + artículos demo.
 * @returns {{ ok: true, path: string, productCount: number }}
 */
function resetMonserratDatabaseToSeed() {
  const dbPath = resolveMonserratDbPath()
  closeDb()
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    } catch (e) {
      console.error('[db] reset unlink', p, e)
    }
  }
  ensureDirForFile(dbPath)
  const db = getDb()
  runFactorySeed(db)
  const n = db.prepare('SELECT COUNT(*) AS c FROM productos').get()
  return { ok: true, path: dbPath, productCount: Number(n?.c) || 0 }
}

function ensureElectronExtras(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT DEFAULT '',
      notas TEXT DEFAULT '',
      saldo_pendiente REAL NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  seedClientesDemoIfEmpty(database)
}

/** Salidas de venta en banqueta (borrador → activa → cerrada), con ítems y snapshot de precio. */
function ensureBanquetaSalidasSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS banqueta_salidas (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'borrador',
      notas TEXT DEFAULT '',
      lugar TEXT DEFAULT '',
      fecha_planeada TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      activated_at TEXT,
      closed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_banqueta_salidas_estado ON banqueta_salidas(estado);
    CREATE TABLE IF NOT EXISTS banqueta_salida_items (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      salida_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      precio_snapshot REAL,
      codigo_snapshot TEXT,
      nombre_snapshot TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      vendido INTEGER NOT NULL DEFAULT 0,
      precio_vendido REAL,
      vendido_at TEXT,
      added_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (salida_id) REFERENCES banqueta_salidas(id) ON DELETE CASCADE,
      FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
      UNIQUE(salida_id, producto_id)
    );
    CREATE INDEX IF NOT EXISTS idx_banqueta_items_salida ON banqueta_salida_items(salida_id);
  `)
  ensureBanquetaSalidaSchemaMigrations(database)
}

function ensureBanquetaSalidaSchemaMigrations(database) {
  try {
    const salidaCols = database.prepare('PRAGMA table_info(banqueta_salidas)').all()
    if (salidaCols.length) {
      const names = new Set(salidaCols.map((c) => c.name))
      if (!names.has('lugar')) database.exec("ALTER TABLE banqueta_salidas ADD COLUMN lugar TEXT DEFAULT ''")
      if (!names.has('fecha_planeada')) database.exec('ALTER TABLE banqueta_salidas ADD COLUMN fecha_planeada TEXT')
    }
  } catch {
    /* noop */
  }
  try {
    const cols = database.prepare('PRAGMA table_info(banqueta_salida_items)').all()
    if (!cols.length) return
    const names = new Set(cols.map((c) => c.name))
    if (!names.has('sort_order')) database.exec('ALTER TABLE banqueta_salida_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0')
    if (!names.has('vendido')) database.exec('ALTER TABLE banqueta_salida_items ADD COLUMN vendido INTEGER NOT NULL DEFAULT 0')
    if (!names.has('precio_vendido')) database.exec('ALTER TABLE banqueta_salida_items ADD COLUMN precio_vendido REAL')
    if (!names.has('vendido_at')) database.exec('ALTER TABLE banqueta_salida_items ADD COLUMN vendido_at TEXT')
  } catch {
    /* noop */
  }
}

function seedClientesDemoIfEmpty(database) {
  const ran = database.prepare("SELECT 1 FROM app_meta WHERE key = 'welcome_demo_clientes_v1' LIMIT 1").get()
  if (ran) return
  const { c } = database.prepare('SELECT COUNT(*) AS c FROM clientes').get()
  if (c > 0) {
    database
      .prepare("INSERT INTO app_meta (key, value) VALUES ('welcome_demo_clientes_v1', 'skipped_existing')")
      .run()
    return
  }
  const stmt = database.prepare(
    `INSERT INTO clientes (nombre, telefono, notas, saldo_pendiente, activo)
     VALUES (@nombre, @telefono, @notas, @saldo_pendiente, 1)`,
  )
  const rows = [
    { nombre: 'María López', telefono: '', notas: 'Cuota semanal', saldo_pendiente: 480.5 },
    { nombre: 'Roberto Vega', telefono: '', notas: '', saldo_pendiente: 0 },
    { nombre: 'Ana Gutiérrez', telefono: '', notas: 'Varios artículos', saldo_pendiente: 1250 },
    { nombre: 'Cliente mostrador', telefono: '', notas: '', saldo_pendiente: 0 },
    { nombre: 'Lucía Hernández', telefono: '', notas: '', saldo_pendiente: 89.99 },
    { nombre: 'Pedro Ramírez', telefono: '', notas: '', saldo_pendiente: 0 },
    { nombre: 'Comunidad La Merced', telefono: '', notas: 'Pedido grupal', saldo_pendiente: 3420.75 },
  ]
  const run = database.transaction((list) => {
    for (const r of list) stmt.run(r)
  })
  run(rows)
  database.prepare("INSERT INTO app_meta (key, value) VALUES ('welcome_demo_clientes_v1', '1')").run()
}

function parseTagsByGroup(raw) {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return parseTagsByGroup(p)
    } catch {
      return {}
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out = {}
    for (const [k, v] of Object.entries(raw)) {
      const gid = Number(k)
      const oid = Number(v)
      if (Number.isFinite(gid) && Number.isFinite(oid) && oid > 0) out[gid] = oid
    }
    return out
  }
  return {}
}

function tagNamesForProduct(database, productoId) {
  const row = database
    .prepare(
      `SELECT group_concat(o.name, ', ') AS names
       FROM producto_tags pt
       JOIN tag_options o ON o.id = pt.tag_option_id
       WHERE pt.producto_id = ?
       GROUP BY pt.producto_id`,
    )
    .get(productoId)
  return row?.names ? String(row.names) : ''
}

function hydrateProductRow(database, p) {
  if (!p) return p
  return {
    ...p,
    tags: tagNamesForProduct(database, p.id),
  }
}

function getProducts(filters = {}) {
  const database = getDb()
  let sql = 'SELECT * FROM productos WHERE 1=1'
  const params = []
  if (filters.estado) {
    sql += ' AND estado = ?'
    params.push(filters.estado)
  }
  sql += ' ORDER BY id DESC LIMIT 500'
  return database.prepare(sql).all(...params).map((p) => hydrateProductRow(database, p))
}

function searchProducts(query) {
  const database = getDb()
  const t = String(query || '').trim()
  if (!t) return getProducts({})
  const esc = (s) =>
    String(s)
      .trim()
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
  const like = `%${esc(t).toLowerCase()}%`
  const rows = database
    .prepare(
      `SELECT DISTINCT p.*
       FROM productos p
       LEFT JOIN producto_tags pt ON pt.producto_id = p.id
       LEFT JOIN tag_options o ON o.id = pt.tag_option_id
       WHERE lower(p.codigo) LIKE ? ESCAPE '\\' OR lower(COALESCE(p.descripcion,'')) LIKE ? ESCAPE '\\' OR lower(COALESCE(o.name,'')) LIKE ? ESCAPE '\\'
       ORDER BY p.id DESC
       LIMIT 200`,
    )
    .all(like, like, like)
  return rows.map((p) => hydrateProductRow(database, p))
}

function getProductById(id) {
  const database = getDb()
  const p = database.prepare('SELECT * FROM productos WHERE id = ?').get(id)
  if (!p) return null
  const tagsByGroup = {}
  const links = database
    .prepare(
      `SELECT o.group_id, o.id AS option_id
       FROM producto_tags pt
       JOIN tag_options o ON o.id = pt.tag_option_id
       WHERE pt.producto_id = ?`,
    )
    .all(id)
  for (const r of links) {
    tagsByGroup[r.group_id] = r.option_id
  }
  return { ...p, tagsByGroup }
}

function getProductByCodigo(codigo) {
  const database = getDb()
  const c = String(codigo || '').trim()
  if (!c) return null
  const row = database.prepare('SELECT id FROM productos WHERE TRIM(codigo) = ? COLLATE NOCASE').get(c)
  if (!row) return null
  return getProductById(row.id)
}

/**
 * Lista inventario como Zen: búsqueda, filtro estado, vista banqueta, pestaña +6 meses.
 */
function getInventoryList(filters = {}) {
  const database = getDb()
  const search = String(filters.search || '').trim()
  const estadoIndex = Number(filters.estadoIndex) || 0
  const vistaIndex = Number(filters.vistaIndex) || 0
  const listTab = filters.listTab === 'stale' ? 'stale' : 'main'

  const params = []
  let fromBody = 'productos p'
  const where = []

  if (search) {
    fromBody =
      'productos p LEFT JOIN producto_tags pt ON pt.producto_id = p.id LEFT JOIN tag_options o ON o.id = pt.tag_option_id'
    const esc = (s) =>
      String(s)
        .trim()
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
    const like = `%${esc(search).toLowerCase()}%`
    where.push(
      `(lower(p.codigo) LIKE ? ESCAPE '\\' OR lower(COALESCE(p.descripcion,'')) LIKE ? ESCAPE '\\' OR lower(COALESCE(o.name,'')) LIKE ? ESCAPE '\\')`,
    )
    params.push(like, like, like)
  }

  if (listTab === 'stale') {
    where.push("LOWER(TRIM(COALESCE(p.estado,''))) = 'disponible'")
    where.push("date(COALESCE(p.fecha_ingreso, p.created_at)) <= date('now', '-183 days')")
  }

  if (vistaIndex === 1) {
    where.push("LOWER(TRIM(COALESCE(p.estado,''))) = 'en_banqueta'")
  } else {
    const em = { 1: 'disponible', 2: 'en_banqueta', 3: 'vendido', 4: 'reservado' }
    if (estadoIndex >= 1 && estadoIndex <= 4) {
      where.push('LOWER(TRIM(COALESCE(p.estado,\'\'))) = ?')
      params.push(em[estadoIndex])
    }
  }

  const distinct = search ? 'DISTINCT ' : ''
  let sql = `SELECT ${distinct}p.* FROM ${fromBody}`
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`
  sql +=
    listTab === 'stale'
      ? " ORDER BY date(COALESCE(p.fecha_ingreso, p.created_at)) ASC LIMIT 500"
      : ' ORDER BY p.id DESC LIMIT 500'

  const rows = database.prepare(sql).all(...params)
  return rows.map((p) => hydrateProductRow(database, p))
}

/** Antes de guardar: grupos con `required=1` que aún no tienen opción elegida. */
function checkRequiredTagsForProduct(tagsByGroup) {
  const database = getDb()
  const map = parseTagsByGroup(tagsByGroup)
  const oids = alta.toOptionIdSet(Object.values(map))
  const miss = alta.missingRequiredGroups(database, oids)
  return { ok: miss.length === 0, missing: miss }
}

function setProductTags(database, productoId, tagsByGroup) {
  database.prepare('DELETE FROM producto_tags WHERE producto_id = ?').run(productoId)
  const oids = [...new Set(Object.values(tagsByGroup).map(Number).filter((n) => Number.isFinite(n) && n > 0))]
  const ins = database.prepare('INSERT INTO producto_tags (producto_id, tag_option_id) VALUES (?, ?)')
  for (const oid of oids) {
    ins.run(productoId, oid)
  }
}

function addProduct(product) {
  const database = getDb()
  const tagsByGroup = parseTagsByGroup(product?.tagsByGroup ?? product?.tags_by_group)
  const oids = alta.toOptionIdSet(Object.values(tagsByGroup))
  const miss = alta.missingRequiredGroups(database, oids)
  if (miss.length) {
    const err = new Error(`Faltan grupos obligatorios: ${miss.join(', ')}`)
    err.code = 'TAGS_REQUIRED'
    err.missing = miss
    throw err
  }
  const talla = alta.optionNameForGroup(database, 'Talla', oids)
  const codigo = String(product.codigo || '').trim()
  const descripcion = String(product.descripcion ?? '').trim()
  const precio = Number(product.precio) || 0
  const estado = String(product.estado || 'disponible')
  const imagen_path = String(product.imagen_path ?? '').trim()
  const color = String(product.color ?? '').trim()
  const pieza_unica = product.pieza_unica ? 1 : 0
  let stock = Math.max(1, Math.floor(Number(product.stock) || 1))
  if (pieza_unica) stock = 1

  const insertProd = database.prepare(
    `INSERT INTO productos (
      codigo, descripcion, precio, pieza_unica, stock, color, talla, imagen_path, estado,
      fecha_ingreso, created_at, updated_at
    ) VALUES (
      @codigo, @descripcion, @precio, @pieza_unica, @stock, @color, @talla, @imagen_path, @estado,
      datetime('now'), datetime('now'), datetime('now')
    )`,
  )
  const delTags = database.prepare('DELETE FROM producto_tags WHERE producto_id = ?')
  const insTag = database.prepare('INSERT INTO producto_tags (producto_id, tag_option_id) VALUES (?, ?)')
  const tagIds = [...new Set(Object.values(tagsByGroup).map(Number).filter((n) => Number.isFinite(n) && n > 0))]

  try {
    const id = database.transaction(() => {
      const info = insertProd.run({
        codigo,
        descripcion,
        precio,
        pieza_unica,
        stock,
        color,
        talla,
        imagen_path,
        estado,
      })
      const newId = Number(info.lastInsertRowid)
      delTags.run(newId)
      for (const oid of tagIds) {
        insTag.run(newId, oid)
      }
      return newId
    })()
    return { id }
  } catch (e) {
    throw friendlySqliteError(e)
  }
}

function updateProduct(product) {
  const database = getDb()
  const id = Number(product.id)
  if (!Number.isFinite(id)) throw new Error('id inválido')
  const tagsByGroup = parseTagsByGroup(product?.tagsByGroup ?? product?.tags_by_group)
  const oids = alta.toOptionIdSet(Object.values(tagsByGroup))
  const miss = alta.missingRequiredGroups(database, oids)
  if (miss.length) {
    const err = new Error(`Faltan grupos obligatorios: ${miss.join(', ')}`)
    err.code = 'TAGS_REQUIRED'
    err.missing = miss
    throw err
  }
  const talla = alta.optionNameForGroup(database, 'Talla', oids)
  const pieza_unica = product.pieza_unica ? 1 : 0
  let stock = Math.max(1, Math.floor(Number(product.stock) || 1))
  if (pieza_unica) stock = 1
  const upd = database.prepare(
    `UPDATE productos SET
      descripcion = @descripcion,
      precio = @precio,
      pieza_unica = @pieza_unica,
      stock = @stock,
      color = @color,
      talla = @talla,
      imagen_path = @imagen_path,
      estado = @estado,
      updated_at = datetime('now')
     WHERE id = @id`,
  )
  const delTags = database.prepare('DELETE FROM producto_tags WHERE producto_id = ?')
  const insTag = database.prepare('INSERT INTO producto_tags (producto_id, tag_option_id) VALUES (?, ?)')
  const tagIds = [...new Set(Object.values(tagsByGroup).map(Number).filter((n) => Number.isFinite(n) && n > 0))]

  try {
    database.transaction(() => {
      upd.run({
        id,
        descripcion: String(product.descripcion ?? '').trim(),
        precio: Number(product.precio) || 0,
        pieza_unica,
        stock,
        color: String(product.color ?? '').trim(),
        talla,
        imagen_path: String(product.imagen_path ?? '').trim(),
        estado: String(product.estado || 'disponible'),
      })
      delTags.run(id)
      for (const oid of tagIds) {
        insTag.run(id, oid)
      }
    })()
    return { ok: true }
  } catch (e) {
    throw friendlySqliteError(e)
  }
}

function deleteProduct(id) {
  const database = getDb()
  database.prepare('DELETE FROM plano_items WHERE producto_id = ?').run(id)
  database.prepare('DELETE FROM producto_tags WHERE producto_id = ?').run(id)
  database.prepare('DELETE FROM productos WHERE id = ?').run(id)
  return { ok: true }
}

function nextCodigoMsr() {
  return alta.nextCodigoMsr(getDb())
}

function getTagGroupsForProduct() {
  const database = getDb()
  const groups = database
    .prepare(
      `SELECT id, name, required, display_order, COALESCE(notion_color, 'gray') AS notion_color
       FROM tag_groups WHERE active = 1 ORDER BY display_order, name`,
    )
    .all()
  const optStmt = database.prepare(
    `SELECT id, name, COALESCE(is_price_rule, 0) AS is_price_rule,
        COALESCE(notion_color, 'default') AS notion_color, tag_icon
     FROM tag_options WHERE group_id = ? AND active = 1 ORDER BY name`,
  )
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    required: Boolean(g.required),
    display_order: g.display_order,
    notion_color: String(g.notion_color || 'gray'),
    options: optStmt.all(g.id).map((o) => ({
      id: o.id,
      name: o.name,
      is_price_rule: Number(o.is_price_rule) === 1,
      notion_color: String(o.notion_color || 'default'),
      tag_icon: o.tag_icon != null ? String(o.tag_icon) : null,
    })),
  }))
}

/** Cuaderno / admin: grupos con conteo de sub-opciones activas y listado completo para editar. */
function getCuadernoTagGroups() {
  const database = getDb()
  const groups = database
    .prepare(
      `SELECT g.id, g.name, g.required, g.display_order, g.use_in_price,
        COALESCE(g.notion_color, 'gray') AS notion_color,
        (SELECT COUNT(*) FROM tag_options o WHERE o.group_id = g.id AND COALESCE(o.active, 1) = 1) AS option_count
       FROM tag_groups g
       WHERE COALESCE(g.active, 1) = 1
       ORDER BY g.display_order, g.name`,
    )
    .all()
  const optStmt = database.prepare(
    `SELECT id, name, COALESCE(active, 1) AS active, COALESCE(is_price_rule, 0) AS is_price_rule,
        COALESCE(rule_priority, 0) AS rule_priority,
        COALESCE(notion_color, 'default') AS notion_color, tag_icon
     FROM tag_options WHERE group_id = ? ORDER BY name COLLATE NOCASE`,
  )
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    required: Boolean(g.required),
    display_order: g.display_order,
    use_in_price: g.use_in_price,
    notion_color: String(g.notion_color || 'gray'),
    option_count: Number(g.option_count) || 0,
    options: optStmt.all(g.id).map((o) => ({
      id: o.id,
      name: o.name,
      active: Number(o.active) === 1,
      is_price_rule: Number(o.is_price_rule) === 1,
      rule_priority: Number(o.rule_priority) || 0,
      notion_color: String(o.notion_color || 'default'),
      tag_icon: o.tag_icon != null ? String(o.tag_icon) : null,
    })),
  }))
}

function listPriceRulesAdmin() {
  const database = getDb()
  const rules = database
    .prepare(`SELECT * FROM price_rules ORDER BY priority DESC, id DESC`)
    .all()
  const condStmt = database.prepare(
    `SELECT c.group_id, c.option_id, g.name AS group_name, o.name AS option_name
     FROM price_rule_conditions c
     JOIN tag_groups g ON g.id = c.group_id
     JOIN tag_options o ON o.id = c.option_id
     WHERE c.rule_id = ?
     ORDER BY g.display_order, g.name COLLATE NOCASE, o.name COLLATE NOCASE`,
  )
  return rules.map((r) => ({
    id: r.id,
    name: r.name,
    price_min: Number(r.price_min),
    price_max: Number(r.price_max),
    priority: Number(r.priority) || 0,
    active: Number(r.active) === 1,
    notes: r.notes != null ? String(r.notes) : '',
    conditions: condStmt.all(r.id),
  }))
}

function cuadernoAddTagGroup(payload) {
  const database = getDb()
  const name = String(payload?.name || '').trim()
  if (!name) throw new Error('El nombre del grupo no puede estar vacío.')
  const notion_color = normalizeNotionColorKey(payload?.notionColor, 'gray')
  const row = database.prepare('SELECT COALESCE(MAX(display_order), 0) AS m FROM tag_groups').get()
  const nextOrd = (Number(row?.m) || 0) + 1
  try {
    const ins = database.prepare(
      `INSERT INTO tag_groups (name, use_in_price, required, active, display_order, created_at, notion_color)
       VALUES (?, 1, 0, 1, ?, datetime('now'), ?)`,
    )
    const info = ins.run(name, nextOrd, notion_color)
    return { ok: true, id: Number(info.lastInsertRowid) }
  } catch (err) {
    throw friendlySqliteError(err)
  }
}

function cuadernoAddTagOption(payload) {
  const database = getDb()
  const groupId = Number(payload?.groupId)
  const name = String(payload?.name || '').trim()
  if (!groupId || !name) throw new Error('Indicá grupo y nombre de la sub-etiqueta.')
  const g = database.prepare('SELECT id FROM tag_groups WHERE id = ?').get(groupId)
  if (!g) throw new Error('El grupo no existe.')
  const countRow = database.prepare('SELECT COUNT(*) AS c FROM tag_options WHERE group_id = ?').get(groupId)
  const cycle = [
    'default',
    'gray',
    'brown',
    'orange',
    'yellow',
    'green',
    'blue',
    'purple',
    'pink',
    'red',
    'neo',
    'glow',
    'mesh',
    'prism',
    'aurora',
    'glass',
  ]
  const notion_color =
    payload?.notionColor != null && String(payload.notionColor).trim() !== ''
      ? normalizeNotionColorKey(payload.notionColor, 'default')
      : cycle[Number(countRow?.c || 0) % cycle.length]
  const tag_icon = normalizeTagIcon(payload?.tagIcon)
  try {
    const ins = database.prepare(
      `INSERT INTO tag_options (group_id, name, active, created_at, notion_color, tag_icon) VALUES (?, ?, 1, datetime('now'), ?, ?)`,
    )
    const info = ins.run(groupId, name, notion_color, tag_icon)
    return { ok: true, id: Number(info.lastInsertRowid) }
  } catch (err) {
    const msg = String(err?.message || err)
    if (/UNIQUE constraint failed/i.test(msg)) {
      throw new Error('Ya existe una opción con ese nombre en este grupo.')
    }
    throw friendlySqliteError(err)
  }
}

function cuadernoRenameTagOption(payload) {
  const database = getDb()
  const id = Number(payload?.id)
  const name = String(payload?.name || '').trim()
  if (!id || !name) throw new Error('Nombre inválido.')
  const row = database.prepare('SELECT group_id FROM tag_options WHERE id = ?').get(id)
  if (!row) throw new Error('La opción no existe.')
  try {
    database.prepare('UPDATE tag_options SET name = ? WHERE id = ?').run(name, id)
    return { ok: true }
  } catch (err) {
    const msg = String(err?.message || err)
    if (/UNIQUE constraint failed/i.test(msg)) {
      throw new Error('Ya existe otra opción con ese nombre en este grupo.')
    }
    throw friendlySqliteError(err)
  }
}

function cuadernoSetTagOptionActive(payload) {
  const database = getDb()
  const id = Number(payload?.id)
  const active = payload?.active !== false
  if (!id) throw new Error('Opción inválida.')
  const row = database.prepare('SELECT id FROM tag_options WHERE id = ?').get(id)
  if (!row) throw new Error('La opción no existe.')
  database.prepare('UPDATE tag_options SET active = ? WHERE id = ?').run(active ? 1 : 0, id)
  return { ok: true }
}

function cuadernoSetTagGroupStyle(payload) {
  const database = getDb()
  const id = Number(payload?.id)
  if (!id) throw new Error('Grupo inválido.')
  const notion_color = normalizeNotionColorKey(payload?.notionColor, 'gray')
  const ex = database.prepare('SELECT id FROM tag_groups WHERE id = ?').get(id)
  if (!ex) throw new Error('El grupo no existe.')
  database.prepare('UPDATE tag_groups SET notion_color = ? WHERE id = ?').run(notion_color, id)
  return { ok: true }
}

function cuadernoSetTagOptionStyle(payload) {
  const database = getDb()
  const id = Number(payload?.id)
  if (!id) throw new Error('Opción inválida.')
  const notion_color = normalizeNotionColorKey(payload?.notionColor, 'default')
  const tag_icon = normalizeTagIcon(payload?.tagIcon)
  const row = database.prepare('SELECT id FROM tag_options WHERE id = ?').get(id)
  if (!row) throw new Error('La opción no existe.')
  database.prepare('UPDATE tag_options SET notion_color = ?, tag_icon = ? WHERE id = ?').run(notion_color, tag_icon, id)
  return { ok: true }
}

/** Orden de grupos en UI (display_order) — como reordenar propiedades en Notion. */
function cuadernoReorderTagGroups(payload) {
  const database = getDb()
  const orderedIds = Array.isArray(payload?.orderedIds)
    ? payload.orderedIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : []
  if (orderedIds.length === 0) throw new Error('Sin orden para aplicar.')
  const allRows = database.prepare('SELECT id FROM tag_groups').all()
  const valid = new Set(allRows.map((r) => r.id))
  const seen = new Set()
  for (const id of orderedIds) {
    if (!valid.has(id)) throw new Error('ID de grupo inválido en el orden.')
    if (seen.has(id)) throw new Error('Grupos duplicados en el orden.')
    seen.add(id)
  }
  if (orderedIds.length !== valid.size) throw new Error('El orden debe incluir cada grupo una sola vez.')
  const run = database.transaction(() => {
    orderedIds.forEach((id, i) => {
      database.prepare('UPDATE tag_groups SET display_order = ? WHERE id = ?').run(i + 1, id)
    })
  })
  run()
  return { ok: true }
}

/** Grupos y opciones (activas o no) para el gestor de catálogo en UI. */
function getTagCatalogForManager() {
  const database = getDb()
  const groups = database
    .prepare(
      `SELECT g.id, g.name, g.required, g.display_order, g.use_in_price, COALESCE(g.active, 1) AS active,
        COALESCE(g.notion_color, 'gray') AS notion_color,
        (SELECT COUNT(*) FROM tag_options o WHERE o.group_id = g.id AND COALESCE(o.active, 1) = 1) AS option_count
       FROM tag_groups g
       ORDER BY g.display_order, g.name COLLATE NOCASE`,
    )
    .all()
  const optStmt = database.prepare(
    `SELECT id, name, COALESCE(active, 1) AS active, COALESCE(is_price_rule, 0) AS is_price_rule,
        COALESCE(rule_priority, 0) AS rule_priority,
        COALESCE(notion_color, 'default') AS notion_color, tag_icon
     FROM tag_options WHERE group_id = ? ORDER BY name COLLATE NOCASE`,
  )
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    required: Boolean(g.required),
    display_order: g.display_order,
    use_in_price: g.use_in_price,
    group_active: Number(g.active) === 1,
    notion_color: String(g.notion_color || 'gray'),
    option_count: Number(g.option_count) || 0,
    options: optStmt.all(g.id).map((o) => ({
      id: o.id,
      name: o.name,
      active: Number(o.active) === 1,
      is_price_rule: Number(o.is_price_rule) === 1,
      rule_priority: Number(o.rule_priority) || 0,
      notion_color: String(o.notion_color || 'default'),
      tag_icon: o.tag_icon != null ? String(o.tag_icon) : null,
    })),
  }))
}

function _deleteTagOptionDeep(database, optionId) {
  const oid = Number(optionId)
  database.prepare('DELETE FROM tag_price_combo WHERE anchor_option_id = ?').run(oid)
  database.prepare('DELETE FROM tag_price_combo_part WHERE option_id = ?').run(oid)
  database.prepare('DELETE FROM price_rule_conditions WHERE option_id = ?').run(oid)
  database.prepare('DELETE FROM producto_tags WHERE tag_option_id = ?').run(oid)
  database.prepare('DELETE FROM tag_options WHERE id = ?').run(oid)
}

function cuadernoRenameTagGroup(payload) {
  const database = getDb()
  const id = Number(payload?.id)
  const name = String(payload?.name || '').trim()
  if (!id || !name) throw new Error('Nombre de grupo inválido.')
  const ex = database.prepare('SELECT id FROM tag_groups WHERE id = ?').get(id)
  if (!ex) throw new Error('El grupo no existe.')
  try {
    database.prepare('UPDATE tag_groups SET name = ? WHERE id = ?').run(name, id)
    return { ok: true }
  } catch (err) {
    const msg = String(err?.message || err)
    if (/UNIQUE constraint failed/i.test(msg)) {
      throw new Error('Ya existe otro grupo con ese nombre.')
    }
    throw friendlySqliteError(err)
  }
}

/** Mueve una etiqueta a otra carpeta. Quita condiciones de reglas que referían esa opción (hay que rearmar reglas si aplica). */
function cuadernoMoveTagOption(payload) {
  const database = getDb()
  const optionId = Number(payload?.optionId ?? payload?.id)
  const newGroupId = Number(payload?.groupId ?? payload?.targetGroupId)
  if (!optionId || !newGroupId) throw new Error('Indicá etiqueta y carpeta destino.')
  const opt = database.prepare('SELECT id, name, group_id FROM tag_options WHERE id = ?').get(optionId)
  if (!opt) throw new Error('La etiqueta no existe.')
  if (Number(opt.group_id) === newGroupId) return { ok: true }
  const g = database.prepare('SELECT id FROM tag_groups WHERE id = ?').get(newGroupId)
  if (!g) throw new Error('La carpeta destino no existe.')
  const clash = database
    .prepare('SELECT id FROM tag_options WHERE group_id = ? AND name = ? AND id != ?')
    .get(newGroupId, opt.name, optionId)
  if (clash) throw new Error('Ya existe una etiqueta con ese nombre en la carpeta destino.')
  const run = database.transaction(() => {
    database.prepare('DELETE FROM price_rule_conditions WHERE option_id = ?').run(optionId)
    database.prepare('UPDATE tag_options SET group_id = ? WHERE id = ?').run(newGroupId, optionId)
  })
  try {
    run()
    return { ok: true }
  } catch (err) {
    throw friendlySqliteError(err)
  }
}

function cuadernoDeleteTagOption(payload) {
  const database = getDb()
  const id = Number(payload?.id)
  if (!id) throw new Error('Opción inválida.')
  const row = database.prepare('SELECT id FROM tag_options WHERE id = ?').get(id)
  if (!row) throw new Error('La opción no existe.')
  const run = database.transaction(() => {
    _deleteTagOptionDeep(database, id)
  })
  run()
  return { ok: true }
}

function cuadernoDeleteTagGroup(payload) {
  const database = getDb()
  const gid = Number(payload?.id)
  if (!gid) throw new Error('Grupo inválido.')
  const g = database.prepare('SELECT id FROM tag_groups WHERE id = ?').get(gid)
  if (!g) throw new Error('El grupo no existe.')
  const opts = database.prepare('SELECT id FROM tag_options WHERE group_id = ?').all(gid)
  const run = database.transaction(() => {
    for (const { id } of opts) {
      _deleteTagOptionDeep(database, id)
    }
    database.prepare('DELETE FROM price_rule_conditions WHERE group_id = ?').run(gid)
    database.prepare('DELETE FROM tag_groups WHERE id = ?').run(gid)
  })
  run()
  return { ok: true }
}

function cuadernoUpsertPriceRule(payload) {
  const database = getDb()
  const name = String(payload?.name || '').trim()
  const price_min = Number(payload?.price_min)
  const price_max = Number(payload?.price_max)
  if (!name) throw new Error('La regla necesita un nombre.')
  if (!Number.isFinite(price_min) || !Number.isFinite(price_max) || price_min < 0 || price_max < 0) {
    throw new Error('Indicá precio mínimo y máximo válidos (≥ 0).')
  }
  if (price_min > price_max) throw new Error('El mínimo no puede ser mayor que el máximo.')
  const priority = Number(payload?.priority)
  const pr = Number.isFinite(priority) ? priority : 0
  const active = payload?.active !== false ? 1 : 0
  const notes = String(payload?.notes ?? '').trim()
  const rawConds = Array.isArray(payload?.conditions) ? payload.conditions : []
  const seenGroups = new Set()
  const validConds = []
  for (const c of rawConds) {
    const gid = Number(c?.group_id ?? c?.groupId)
    const oid = Number(c?.option_id ?? c?.optionId)
    if (!gid || !oid) continue
    if (seenGroups.has(gid)) throw new Error('Cada regla solo puede incluir una opción por grupo de tags.')
    seenGroups.add(gid)
    validConds.push({ group_id: gid, option_id: oid })
  }

  const existingId =
    payload?.id != null && payload.id !== '' ? Number(payload.id) : null
  if (existingId != null && !Number.isFinite(existingId)) throw new Error('ID de regla inválido.')

  let outId = null
  const run = database.transaction(() => {
    if (existingId) {
      const ex = database.prepare('SELECT id FROM price_rules WHERE id = ?').get(existingId)
      if (!ex) throw new Error('La regla a editar no existe.')
      database
        .prepare(
          `UPDATE price_rules SET name = ?, price_min = ?, price_max = ?, priority = ?, active = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .run(name, price_min, price_max, pr, active, notes, existingId)
      database.prepare('DELETE FROM price_rule_conditions WHERE rule_id = ?').run(existingId)
      outId = existingId
    } else {
      const ins = database.prepare(
        `INSERT INTO price_rules (name, price_min, price_max, priority, active, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      const info = ins.run(name, price_min, price_max, pr, active, notes)
      outId = Number(info.lastInsertRowid)
    }
    const insC = database.prepare(
      `INSERT INTO price_rule_conditions (rule_id, group_id, option_id) VALUES (?, ?, ?)`,
    )
    const verify = database.prepare(
      `SELECT 1 FROM tag_options WHERE id = ? AND group_id = ? AND COALESCE(active,1) = 1`,
    )
    for (const c of validConds) {
      if (!verify.get(c.option_id, c.group_id)) {
        throw new Error('Alguna condición usa una opción inexistente, inactiva o de otro grupo.')
      }
      insC.run(outId, c.group_id, c.option_id)
    }
  })

  try {
    run()
    return { ok: true, id: outId }
  } catch (err) {
    throw err instanceof Error && err.message.startsWith('Alguna') ? err : friendlySqliteError(err)
  }
}

function cuadernoDeletePriceRule(payload) {
  const database = getDb()
  const id = Number(payload?.id)
  if (!id) throw new Error('Regla inválida.')
  const ex = database.prepare('SELECT id FROM price_rules WHERE id = ?').get(id)
  if (!ex) throw new Error('La regla no existe.')
  const run = database.transaction(() => {
    database.prepare('DELETE FROM price_rule_conditions WHERE rule_id = ?').run(id)
    database.prepare('DELETE FROM price_rules WHERE id = ?').run(id)
  })
  run()
  return { ok: true }
}

function listTagPriceRulesSummary() {
  const database = getDb()
  return database
    .prepare(
      `SELECT o.id, o.name AS option_name, g.name AS group_name,
        (SELECT COUNT(*) FROM tag_price_combo c WHERE c.anchor_option_id = o.id) AS combo_count
       FROM tag_options o
       JOIN tag_groups g ON g.id = o.group_id
       WHERE COALESCE(o.is_price_rule, 0) = 1 AND COALESCE(o.active, 1) = 1
       ORDER BY g.display_order, g.name COLLATE NOCASE, o.name COLLATE NOCASE`,
    )
    .all()
    .map((r) => ({
      id: r.id,
      option_name: String(r.option_name || ''),
      group_name: String(r.group_name || ''),
      combo_count: Number(r.combo_count) || 0,
    }))
}

/** Cuaderno UI: reglas con líneas legibles (ej. Calzón → algodón $30, licra $40). */
function listTagPriceRulesForCuaderno() {
  const database = getDb()
  const anchors = database
    .prepare(
      `SELECT o.id AS anchor_option_id, o.name AS option_name, g.name AS group_name,
        COALESCE(o.notion_color, 'default') AS notion_color, o.tag_icon AS tag_icon
       FROM tag_options o
       JOIN tag_groups g ON g.id = o.group_id
       WHERE COALESCE(o.is_price_rule, 0) = 1 AND COALESCE(o.active, 1) = 1
       ORDER BY g.display_order, g.name COLLATE NOCASE, o.name COLLATE NOCASE`,
    )
    .all()
  const comboStmt = database.prepare(
    `SELECT id, price FROM tag_price_combo WHERE anchor_option_id = ? ORDER BY sort_order ASC, id ASC`,
  )
  const partStmt = database.prepare(
    `SELECT o.name AS oname
     FROM tag_price_combo_part p
     JOIN tag_options o ON o.id = p.option_id
     WHERE p.combo_id = ?
     ORDER BY o.name COLLATE NOCASE`,
  )
  return anchors.map((a) => {
    const combos = comboStmt.all(a.anchor_option_id)
    const lines = combos.map((c) => {
      const names = partStmt.all(c.id).map((p) => String(p.oname || '').trim()).filter(Boolean)
      const summaryLabel = names.length === 0 ? 'Solo (precio base)' : names.join(', ')
      return {
        summaryLabel,
        price: c.price == null ? null : Number(c.price),
      }
    })
    return {
      anchor_option_id: Number(a.anchor_option_id),
      option_name: String(a.option_name || ''),
      group_name: String(a.group_name || ''),
      notion_color: String(a.notion_color || 'default'),
      tag_icon: a.tag_icon != null ? String(a.tag_icon) : null,
      lines,
    }
  })
}

function setTagOptionPriceRule(payload) {
  const database = getDb()
  const optionId = Number(payload?.optionId)
  const isRule = Boolean(payload?.isRule)
  const rpRaw = payload?.rulePriority
  const rulePriority =
    rpRaw != null && String(rpRaw).trim() !== '' && Number.isFinite(Number(rpRaw))
      ? Math.max(0, Math.floor(Number(rpRaw)))
      : 0
  if (!optionId) throw new Error('Opción de tag inválida.')
  const row = database.prepare('SELECT id FROM tag_options WHERE id = ?').get(optionId)
  if (!row) throw new Error('La opción no existe.')
  const run = database.transaction(() => {
    database
      .prepare('UPDATE tag_options SET is_price_rule = ?, rule_priority = ? WHERE id = ?')
      .run(isRule ? 1 : 0, isRule ? rulePriority : 0, optionId)
    if (!isRule) {
      database.prepare('DELETE FROM tag_price_combo WHERE anchor_option_id = ?').run(optionId)
    }
  })
  run()
  return { ok: true }
}

function getPriceCombosForAnchor(payload) {
  const database = getDb()
  const anchorOptionId = Number(payload?.anchorOptionId)
  if (!anchorOptionId) throw new Error('Ancla inválida.')
  const combos = database
    .prepare(
      `SELECT id, price, sort_order FROM tag_price_combo WHERE anchor_option_id = ? ORDER BY sort_order ASC, id ASC`,
    )
    .all(anchorOptionId)
  const partStmt = database.prepare('SELECT option_id FROM tag_price_combo_part WHERE combo_id = ?')
  const labelStmt = database.prepare(
    `SELECT o.name AS oname, g.name AS gname FROM tag_options o JOIN tag_groups g ON g.id = o.group_id WHERE o.id = ?`,
  )
  return combos.map((c) => {
    const companionIds = partStmt.all(c.id).map((p) => p.option_id)
    const companionLabels = companionIds.map((oid) => {
      const lb = labelStmt.get(oid)
      return lb ? `${lb.gname}: ${lb.oname}` : String(oid)
    })
    return {
      id: c.id,
      price: c.price == null ? null : Number(c.price),
      companionIds,
      companionLabels,
    }
  })
}

function replacePriceCombosForAnchor(payload) {
  const database = getDb()
  const anchorOptionId = Number(payload?.anchorOptionId)
  if (!anchorOptionId) throw new Error('Ancla inválida.')
  const anchor = database.prepare('SELECT id, COALESCE(is_price_rule,0) AS ir FROM tag_options WHERE id = ?').get(anchorOptionId)
  if (!anchor) throw new Error('La opción no existe.')
  if (Number(anchor.ir) !== 1) throw new Error('Activá primero «Este tag es una regla de precio» para esta opción.')
  const rawRows = Array.isArray(payload?.combos) ? payload.combos : []
  const verifyOpt = database.prepare('SELECT id FROM tag_options WHERE id = ? AND COALESCE(active,1)=1')
  const rows = []
  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i]
    const companionIds = Array.isArray(r?.companionIds)
      ? [...new Set(r.companionIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
      : []
    if (companionIds.includes(anchorOptionId)) {
      throw new Error('La combinación no puede incluir el mismo tag que actúa como regla.')
    }
    for (const cid of companionIds) {
      if (!verifyOpt.get(cid)) throw new Error('Algún tag compañero no existe o está inactivo.')
    }
    let price = null
    if (r?.price != null && String(r.price).trim() !== '') {
      const p = Number(String(r.price).replace(',', '.'))
      if (!Number.isFinite(p) || p < 0) throw new Error('Cada precio debe ser un número ≥ 0 o vacío (sin precio).')
      price = p
    }
    rows.push({ companionIds, price, sort_order: i })
  }
  const delC = database.prepare('DELETE FROM tag_price_combo WHERE anchor_option_id = ?')
  const insC = database.prepare(
    `INSERT INTO tag_price_combo (anchor_option_id, sort_order, price, created_at) VALUES (?, ?, ?, datetime('now'))`,
  )
  const insP = database.prepare('INSERT INTO tag_price_combo_part (combo_id, option_id) VALUES (?, ?)')
  const run = database.transaction(() => {
    delC.run(anchorOptionId)
    for (const row of rows) {
      const info = insC.run(anchorOptionId, row.sort_order, row.price)
      const comboId = Number(info.lastInsertRowid)
      for (const oid of row.companionIds) {
        insP.run(comboId, oid)
      }
    }
  })
  run()
  return { ok: true }
}

function listInvPricingRules() {
  const database = getDb()
  return database
    .prepare(
      `SELECT r.id, r.name, r.anchor_option_id, r.scope_all, r.active,
        (SELECT g.name || ': ' || o.name FROM tag_options o JOIN tag_groups g ON g.id = o.group_id WHERE o.id = r.anchor_option_id) AS anchor_label,
        (SELECT COUNT(*) FROM inv_pricing_rule_row x WHERE x.rule_id = r.id) AS row_count
       FROM inv_pricing_rule r
       ORDER BY r.updated_at DESC, r.id DESC`,
    )
    .all()
    .map((row) => ({
      id: Number(row.id),
      name: String(row.name || ''),
      anchor_option_id: Number(row.anchor_option_id),
      anchor_label: String(row.anchor_label || ''),
      scope_all: Number(row.scope_all) === 1,
      active: Number(row.active) === 1,
      row_count: Number(row.row_count) || 0,
    }))
}

function getInvPricingRule(payload) {
  const database = getDb()
  const id = Number(payload?.id)
  if (!id) throw new Error('Regla inválida.')
  const r = database.prepare('SELECT * FROM inv_pricing_rule WHERE id = ?').get(id)
  if (!r) throw new Error('La regla no existe.')
  const scopeRows = database.prepare('SELECT group_id FROM inv_pricing_rule_scope_group WHERE rule_id = ?').all(id)
  const scopeGroupIds = scopeRows.map((x) => Number(x.group_id))
  const rows = database
    .prepare(`SELECT id, price, sort_order FROM inv_pricing_rule_row WHERE rule_id = ? ORDER BY sort_order ASC, id ASC`)
    .all(id)
  const partStmt = database.prepare('SELECT option_id FROM inv_pricing_rule_row_part WHERE row_id = ?')
  const comboRows = rows.map((row) => ({
    id: Number(row.id),
    price: row.price == null ? null : Number(row.price),
    companionIds: partStmt.all(row.id).map((p) => Number(p.option_id)),
  }))
  const anchor = database
    .prepare(
      `SELECT o.id, o.name, o.group_id, o.tag_icon,
              COALESCE(o.notion_color, 'default') AS notion_color,
              g.name AS group_name,
              COALESCE(g.notion_color, 'gray') AS group_color
       FROM tag_options o JOIN tag_groups g ON g.id = o.group_id
       WHERE o.id = ?`,
    )
    .get(Number(r.anchor_option_id))
  return {
    id: Number(r.id),
    name: String(r.name || ''),
    anchor_option_id: Number(r.anchor_option_id),
    anchor_group_id: anchor ? Number(anchor.group_id) : null,
    anchor_name: anchor ? String(anchor.name || '') : '',
    anchor_notion_color: anchor ? String(anchor.notion_color || 'default') : 'default',
    anchor_tag_icon: anchor?.tag_icon != null ? String(anchor.tag_icon) : null,
    anchor_group_name: anchor ? String(anchor.group_name || '') : '',
    anchor_group_color: anchor ? String(anchor.group_color || 'gray') : 'gray',
    scope_all: Number(r.scope_all) === 1,
    active: Number(r.active) === 1,
    notes: r.notes != null ? String(r.notes) : '',
    scopeGroupIds,
    rows: comboRows.map((c) => ({
      companionIds: c.companionIds,
      price: c.price == null ? '' : String(c.price),
    })),
  }
}

function upsertInvPricingRule(payload) {
  const database = getDb()
  const name = String(payload?.name || '').trim()
  if (!name) throw new Error('El nombre de la regla es obligatorio.')
  const anchorOptionId = Number(payload?.anchorOptionId)
  if (!anchorOptionId) throw new Error('Elegí el tag ancla.')
  const anchorOk = database.prepare('SELECT id FROM tag_options WHERE id = ? AND COALESCE(active,1)=1').get(anchorOptionId)
  if (!anchorOk) throw new Error('El tag ancla no existe o está inactivo.')
  const scopeAll = Boolean(payload?.scopeAll)
  const rawGids = Array.isArray(payload?.scopeGroupIds) ? payload.scopeGroupIds : []
  const scopeGroupIds = [...new Set(rawGids.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
  if (!scopeAll) {
    if (scopeGroupIds.length === 0) throw new Error('Si no aplica a todas las categorías, elegí al menos una categoría.')
    const chk = database.prepare('SELECT id FROM tag_groups WHERE id = ? AND COALESCE(active,1)=1')
    for (const gid of scopeGroupIds) {
      if (!chk.get(gid)) throw new Error('Alguna categoría del alcance no existe o está inactiva.')
    }
  }
  const rawRows = Array.isArray(payload?.rows) ? payload.rows : []
  const verifyOpt = database.prepare('SELECT id FROM tag_options WHERE id = ? AND COALESCE(active,1)=1')
  const normalizedRows = []
  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i]
    const companionIds = Array.isArray(r?.companionIds)
      ? [...new Set(r.companionIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
      : []
    if (companionIds.includes(anchorOptionId)) {
      throw new Error('Las filas no pueden incluir el mismo tag que el ancla.')
    }
    for (const cid of companionIds) {
      if (!verifyOpt.get(cid)) throw new Error('Algún tag en una fila no existe o está inactivo.')
    }
    let price = null
    if (r?.price != null && String(r.price).trim() !== '') {
      const p = Number(String(r.price).replace(',', '.'))
      if (!Number.isFinite(p) || p < 0) throw new Error('Cada precio debe ser un número ≥ 0 o vacío.')
      price = p
    }
    normalizedRows.push({ companionIds, price, sort_order: i })
  }
  const existingIdRaw = payload?.id
  const existingId =
    existingIdRaw != null && String(existingIdRaw).trim() !== '' && Number.isFinite(Number(existingIdRaw))
      ? Math.floor(Number(existingIdRaw))
      : 0
  const delScopes = database.prepare('DELETE FROM inv_pricing_rule_scope_group WHERE rule_id = ?')
  const delRows = database.prepare('DELETE FROM inv_pricing_rule_row WHERE rule_id = ?')
  const insRule = database.prepare(
    `INSERT INTO inv_pricing_rule (name, anchor_option_id, scope_all, active, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  )
  const updRule = database.prepare(
    `UPDATE inv_pricing_rule SET name = ?, anchor_option_id = ?, scope_all = ?, active = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
  )
  const insScope = database.prepare('INSERT INTO inv_pricing_rule_scope_group (rule_id, group_id) VALUES (?, ?)')
  const insRow = database.prepare(
    `INSERT INTO inv_pricing_rule_row (rule_id, sort_order, price, created_at) VALUES (?, ?, ?, datetime('now'))`,
  )
  const insPart = database.prepare('INSERT INTO inv_pricing_rule_row_part (row_id, option_id) VALUES (?, ?)')
  let outRuleId = 0
  const run = database.transaction(() => {
    let ruleId = existingId
    const active = payload?.active === false ? 0 : 1
    const notes = payload?.notes != null ? String(payload.notes) : ''
    if (existingId > 0) {
      const ex = database.prepare('SELECT id FROM inv_pricing_rule WHERE id = ?').get(existingId)
      if (!ex) throw new Error('La regla no existe.')
      updRule.run(name, anchorOptionId, scopeAll ? 1 : 0, active, notes, existingId)
      delScopes.run(existingId)
      delRows.run(existingId)
      ruleId = existingId
    } else {
      const info = insRule.run(name, anchorOptionId, scopeAll ? 1 : 0, active, notes)
      ruleId = Number(info.lastInsertRowid)
    }
    outRuleId = ruleId
    if (!scopeAll) {
      for (const gid of scopeGroupIds) {
        insScope.run(ruleId, gid)
      }
    }
    for (const row of normalizedRows) {
      const info = insRow.run(ruleId, row.sort_order, row.price)
      const rowId = Number(info.lastInsertRowid)
      for (const oid of row.companionIds) {
        insPart.run(rowId, oid)
      }
    }
  })
  run()
  return { ok: true, id: outRuleId }
}

function deleteInvPricingRule(payload) {
  const database = getDb()
  const id = Number(payload?.id)
  if (!id) throw new Error('Regla inválida.')
  database.prepare('DELETE FROM inv_pricing_rule WHERE id = ?').run(id)
  return { ok: true }
}

function getTagLabelsForMap(tagsByGroup) {
  const database = getDb()
  const map = parseTagsByGroup(tagsByGroup)
  return alta.tagLabelsForSelection(database, map)
}

function suggestNombreFromTags(payload) {
  const database = getDb()
  const tagsByGroup = parseTagsByGroup(payload?.tagsByGroup)
  const ex = String(payload?.excludeCodigo || '').trim() || null
  return alta.sugerirNombreDesdePatronesInventario(database, tagsByGroup, ex)
}

function nombreEtiquetaDesdeTagsPayload(payload) {
  const database = getDb()
  const tagsByGroup = parseTagsByGroup(payload?.tagsByGroup)
  return alta.nombreEtiquetaDesdeTags(database, tagsByGroup) || ''
}

/**
 * Precio sugerido según la selección de tags.
 *
 * - Si viene `ruleId` → modo regla exacto sobre `inv_pricing_rule`:
 *   busca la fila cuyo conjunto de companion ids está TODO incluido en la
 *   selección (sin contar el ancla). Gana la fila con más partes (más específica).
 *   Devuelve `null` si ninguna coincide (no hay fallback a patrones).
 * - `mode === 'cuaderno'` → legacy anchor/combo (tag_options.is_price_rule).
 * - `mode === 'patrones'` → mediana del inventario con los mismos tags.
 */
function suggestPrecioFromTags(payload) {
  const database = getDb()
  const tagsByGroup = parseTagsByGroup(payload?.tagsByGroup)
  const oids = alta.toOptionIdSet(Object.values(tagsByGroup))
  const excludeCodigo = String(payload?.excludeCodigo || '').trim() || null
  const ruleIdRaw = payload?.ruleId
  const ruleId =
    ruleIdRaw != null && String(ruleIdRaw).trim() !== '' && Number.isFinite(Number(ruleIdRaw))
      ? Math.floor(Number(ruleIdRaw))
      : 0
  if (ruleId > 0) {
    return resolveInvPricingRulePrice(database, ruleId, oids)
  }
  if (oids.size === 0) return null
  const mode = String(payload?.mode || alta.AUTO_FILL_CUADERNO)
  if (mode === alta.AUTO_FILL_CUADERNO) {
    const tagP = alta.bestTagAnchorPrice(database, oids)
    if (tagP != null && Number.isFinite(Number(tagP))) return Number(tagP)
    return null
  }
  if (mode === alta.AUTO_FILL_PATRONES) {
    const st = alta.inventarioPrecioStatsPorTags(database, oids, excludeCodigo)
    if (!st) return null
    return Number(st.median != null ? st.median : st.avg)
  }
  return null
}

/**
 * Resuelve el precio exacto de una regla de inventario dada una selección de
 * option ids. Requiere que el ancla esté seleccionada. Elige la fila con más
 * partes coincidentes (todas las partes deben estar incluidas en la selección).
 */
function resolveInvPricingRulePrice(database, ruleId, oids) {
  const rule = database
    .prepare(`SELECT id, anchor_option_id, active FROM inv_pricing_rule WHERE id = ?`)
    .get(ruleId)
  if (!rule || !Number(rule.active)) return null
  const anchorId = Number(rule.anchor_option_id)
  if (!oids.has(anchorId)) return null
  const rows = database
    .prepare(
      `SELECT id, price FROM inv_pricing_rule_row
       WHERE rule_id = ? ORDER BY sort_order ASC, id ASC`,
    )
    .all(ruleId)
  const partStmt = database.prepare('SELECT option_id FROM inv_pricing_rule_row_part WHERE row_id = ?')
  let best = null
  for (const row of rows) {
    const parts = partStmt.all(row.id).map((p) => Number(p.option_id))
    if (parts.length === 0) continue
    const allInSel = parts.every((oid) => oids.has(oid))
    if (!allInSel) continue
    if (!best || parts.length > best.count) {
      const p = row.price == null ? null : Number(row.price)
      if (p != null && Number.isFinite(p)) best = { count: parts.length, price: p }
    }
  }
  return best ? best.price : null
}

function getReferenceRows(payload) {
  const database = getDb()
  const tagsByGroup = parseTagsByGroup(payload?.tagsByGroup)
  const oids = alta.toOptionIdSet(Object.values(tagsByGroup))
  const codigo = String(payload?.codigo || '').trim() || null
  const mode = String(payload?.mode || alta.AUTO_FILL_CUADERNO)
  return alta.filasReferenciaPrecio(database, oids, codigo, mode)
}

function getReferenceSnapshot(payload) {
  const database = getDb()
  const tagsByGroup = parseTagsByGroup(payload?.tagsByGroup)
  const oids = alta.toOptionIdSet(Object.values(tagsByGroup))
  const codigo = String(payload?.codigo || '').trim() || null
  const cuaderno = alta.snapshotReferenciaCuaderno(database, oids, tagsByGroup)
  const patrones = alta.snapshotReferenciaPatrones(database, oids, codigo, tagsByGroup)
  return { cuaderno, patrones, tagLabels: alta.tagLabelsForSelection(database, tagsByGroup) }
}

/** @deprecated usar getReferenceSnapshot */
function getReferencePatternStats(payload) {
  const database = getDb()
  const tagsByGroup = parseTagsByGroup(payload?.tagsByGroup ?? payload?.tags)
  const oids = alta.toOptionIdSet(Object.values(tagsByGroup))
  const excludeCodigo = String(payload?.excludeCodigo || '').trim() || null
  const snap = alta.snapshotReferenciaPatrones(database, oids, excludeCodigo, tagsByGroup)
  if (!snap.encontrado) {
    return {
      encontrado: false,
      mensaje: snap.mensaje,
      stats: null,
      productos: [],
    }
  }
  return {
    encontrado: true,
    mensaje: '',
    stats: snap.stats,
    productos: snap.productos.map((p) => ({
      codigo: p.codigo,
      descripcion: p.nombre,
      precio: p.precio,
      estado: p.estado,
    })),
  }
}

function roundPrice(p, mode) {
  let x = Math.max(0, Number(p) || 0)
  const m = mode || 'centavos'
  if (m === 'centavos') return Math.round(x * 100) / 100
  if (m === 'entero') return Math.round(x)
  if (m === 'medio') return Math.round(x * 2) / 2
  if (m === 'punto90') {
    if (x < 5) return Math.round(x * 100) / 100
    return Math.round((Math.floor(x) + 0.9) * 100) / 100
  }
  return Math.round(x * 100) / 100
}

function computeNewPrice(old, opts) {
  const { adjustMode, adjustValue, sumSign, roundMode } = opts
  if (adjustMode === 'fixed') {
    return roundPrice(Number(adjustValue) || 0, 'centavos')
  }
  let o = Number(old) || 0
  let newP
  if (adjustMode === 'pct') {
    newP = o * (1 + Number(adjustValue) / 100)
  } else {
    newP = o + Number(adjustValue || 0) * (sumSign === -1 ? -1 : 1)
  }
  return roundPrice(newP, roundMode)
}

const PREVIEW_CAP = 500

function previewPriceAdjust(payload) {
  const database = getDb()
  const rawIds = payload?.tagOptionIds ?? payload?.filterTags ?? []
  const tagOptionIds = Array.isArray(rawIds)
    ? rawIds.map(Number).filter((n) => Number.isFinite(n))
    : []
  const matchExact = Boolean(payload?.matchExact)
  const strict = matchExact
  const adjustMode = payload?.adjustMode || 'pct'
  const adjustValue = Number(payload?.adjustValue)
  const sumSign = payload?.sumSign === -1 ? -1 : 1
  const roundMode = payload?.roundMode || 'centavos'

  const matched = alta.queryProductosAjustePorTags(database, strict, tagOptionIds)
  const rows = matched.map((p) => {
    const oldP = Number(p.precio) || 0
    const newP = computeNewPrice(oldP, { adjustMode, adjustValue, sumSign, roundMode })
    return {
      id: p.id,
      codigo: p.codigo,
      descripcion: (p.descripcion || '').slice(0, 80),
      precioActual: oldP,
      precioNuevo: newP,
    }
  })
  const previewRows = rows.slice(0, PREVIEW_CAP)
  return {
    total: rows.length,
    truncated: rows.length > PREVIEW_CAP,
    rows: previewRows,
  }
}

function applyPriceAdjust(payload) {
  const database = getDb()
  const rawIds = payload?.tagOptionIds ?? payload?.filterTags ?? []
  const tagOptionIds = Array.isArray(rawIds)
    ? rawIds.map(Number).filter((n) => Number.isFinite(n))
    : []
  const matchExact = Boolean(payload?.matchExact)
  const adjustMode = payload?.adjustMode || 'pct'
  const adjustValue = Number(payload?.adjustValue)
  const sumSign = payload?.sumSign === -1 ? -1 : 1
  const roundMode = payload?.roundMode || 'centavos'

  const matched = alta.queryProductosAjustePorTags(database, matchExact, tagOptionIds)
  if (matched.length === 0) return { ok: true, updated: 0 }

  const upd = database.prepare(
    `UPDATE productos SET precio = @precio, updated_at = datetime('now') WHERE id = @id`,
  )
  const run = database.transaction(() => {
    for (const p of matched) {
      const newP = computeNewPrice(Number(p.precio) || 0, {
        adjustMode,
        adjustValue,
        sumSign,
        roundMode,
      })
      upd.run({ id: p.id, precio: newP })
    }
  })
  run()
  return { ok: true, updated: matched.length }
}

function ensureVentasSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total REAL NOT NULL DEFAULT 0,
      pago_con REAL,
      cambio REAL,
      metodo TEXT NOT NULL DEFAULT 'efectivo',
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS venta_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      codigo_snapshot TEXT,
      nombre_snapshot TEXT,
      precio_snapshot REAL NOT NULL,
      cantidad INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
      FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON venta_items(venta_id);
  `)
}

function getSales(filters = {}) {
  const database = getDb()
  ensureVentasSchema(database)
  const limit = Number(filters?.limit) || 50
  const rows = database.prepare(
    `SELECT v.*, (SELECT COUNT(*) FROM venta_items vi WHERE vi.venta_id = v.id) AS item_count
     FROM ventas v ORDER BY v.id DESC LIMIT ?`
  ).all(limit)
  return rows.map(r => ({ ...r, item_count: Number(r.item_count) || 0 }))
}

function addSale(payload) {
  const database = getDb()
  ensureVentasSchema(database)
  const items = Array.isArray(payload?.items) ? payload.items : []
  if (items.length === 0) throw new Error('El carrito está vacío.')
  const total = Number(payload?.total) || items.reduce((s, it) => s + (Number(it.precio) || 0) * (Number(it.cantidad) || 1), 0)
  const pagoCon = payload?.pagoCon != null ? Number(payload.pagoCon) : null
  const cambio = pagoCon != null ? Math.max(0, pagoCon - total) : null
  const metodo = String(payload?.metodo || 'efectivo')
  const notas = String(payload?.notas || '').trim()

  const insVenta = database.prepare(
    `INSERT INTO ventas (total, pago_con, cambio, metodo, notas) VALUES (?, ?, ?, ?, ?)`
  )
  const insItem = database.prepare(
    `INSERT INTO venta_items (venta_id, producto_id, codigo_snapshot, nombre_snapshot, precio_snapshot, cantidad) VALUES (?, ?, ?, ?, ?, ?)`
  )
  const updEstado = database.prepare(
    `UPDATE productos SET estado = 'vendido', updated_at = datetime('now') WHERE id = ? AND pieza_unica = 1`
  )

  let ventaId
  const run = database.transaction(() => {
    const info = insVenta.run(total, pagoCon, cambio, metodo, notas)
    ventaId = Number(info.lastInsertRowid)
    for (const it of items) {
      const pid = Number(it.productoId || it.producto_id)
      const codigo = String(it.codigo || '').trim()
      const nombre = String(it.nombre || it.descripcion || '').trim()
      const precio = Number(it.precio) || 0
      const cantidad = Math.max(1, Number(it.cantidad) || 1)
      insItem.run(ventaId, pid, codigo, nombre, precio, cantidad)
      updEstado.run(pid)
    }
  })
  run()
  return { ok: true, ventaId, total, cambio }
}

function ensureCreditoSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS credito_movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('compra', 'pago')),
      monto REAL NOT NULL,
      descripcion TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_credito_mov_cliente ON credito_movimientos(cliente_id);
  `)
}

function listClientes() {
  const database = getDb()
  return database.prepare(
    `SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre COLLATE NOCASE`
  ).all()
}

function addCliente(payload) {
  const database = getDb()
  const nombre = String(payload?.nombre || '').trim()
  if (!nombre) throw new Error('El nombre es obligatorio.')
  const telefono = String(payload?.telefono || '').trim()
  const notas = String(payload?.notas || '').trim()
  const info = database.prepare(
    `INSERT INTO clientes (nombre, telefono, notas, saldo_pendiente, activo) VALUES (?, ?, ?, 0, 1)`
  ).run(nombre, telefono, notas)
  return { ok: true, id: Number(info.lastInsertRowid) }
}

function updateCliente(payload) {
  const database = getDb()
  const id = Number(payload?.id)
  if (!id) throw new Error('Cliente inválido.')
  const sets = []
  const params = []
  if (payload?.nombre != null) { sets.push('nombre = ?'); params.push(String(payload.nombre).trim()) }
  if (payload?.telefono != null) { sets.push('telefono = ?'); params.push(String(payload.telefono).trim()) }
  if (payload?.notas != null) { sets.push('notas = ?'); params.push(String(payload.notas).trim()) }
  if (sets.length === 0) return { ok: true }
  sets.push("updated_at = datetime('now')")
  params.push(id)
  database.prepare(`UPDATE clientes SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  return { ok: true }
}

function addCreditoMovimiento(payload) {
  const database = getDb()
  ensureCreditoSchema(database)
  const clienteId = Number(payload?.clienteId || payload?.cliente_id)
  const tipo = String(payload?.tipo || '').toLowerCase()
  if (!clienteId) throw new Error('Cliente inválido.')
  if (tipo !== 'compra' && tipo !== 'pago') throw new Error('Tipo debe ser "compra" o "pago".')
  const monto = Number(payload?.monto)
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('Monto debe ser mayor a 0.')
  const descripcion = String(payload?.descripcion || '').trim()

  const run = database.transaction(() => {
    database.prepare(
      `INSERT INTO credito_movimientos (cliente_id, tipo, monto, descripcion) VALUES (?, ?, ?, ?)`
    ).run(clienteId, tipo, monto, descripcion)
    const delta = tipo === 'compra' ? monto : -monto
    database.prepare(
      `UPDATE clientes SET saldo_pendiente = MAX(0, saldo_pendiente + ?), updated_at = datetime('now') WHERE id = ?`
    ).run(delta, clienteId)
  })
  run()
  return { ok: true }
}

function getCreditoMovimientos(payload) {
  const database = getDb()
  ensureCreditoSchema(database)
  const clienteId = Number(payload?.clienteId || payload?.cliente_id)
  if (!clienteId) return []
  return database.prepare(
    `SELECT * FROM credito_movimientos WHERE cliente_id = ? ORDER BY id DESC LIMIT 200`
  ).all(clienteId)
}

function getCredits() {
  return listClientes()
}

function suggestByTags() {
  return null
}

function getWelcomeSnapshot() {
  const database = getDb()
  const p = database
    .prepare(
      `SELECT
        COUNT(*) AS productosTotal,
        COALESCE(SUM(CASE WHEN LOWER(TRIM(estado)) = 'disponible' THEN 1 ELSE 0 END), 0) AS productosDisponibles
       FROM productos`,
    )
    .get()
  const c = database
    .prepare(
      `SELECT
        COUNT(*) AS clientesTotal,
        COALESCE(SUM(CASE WHEN saldo_pendiente > 0.005 THEN 1 ELSE 0 END), 0) AS clientesConSaldo,
        COALESCE(SUM(CASE WHEN saldo_pendiente > 0 THEN saldo_pendiente ELSE 0 END), 0) AS saldoTotalPendiente
       FROM clientes
       WHERE activo = 1`,
    )
    .get()
  return {
    productosTotal: Number(p.productosTotal) || 0,
    productosDisponibles: Number(p.productosDisponibles) || 0,
    clientesTotal: Number(c.clientesTotal) || 0,
    clientesConSaldo: Number(c.clientesConSaldo) || 0,
    saldoTotalPendiente: Number(c.saldoTotalPendiente) || 0,
  }
}

function getMonserratDbPath() {
  return resolveMonserratDbPath()
}

function listBanquetaSalidas() {
  const database = getDb()
  const rows = database
    .prepare(
      `SELECT s.id, s.nombre, s.estado, s.notas, s.lugar, s.fecha_planeada,
              s.created_at, s.activated_at, s.closed_at,
              (SELECT COUNT(*) FROM banqueta_salida_items i WHERE i.salida_id = s.id) AS item_count,
              (SELECT COUNT(*) FROM banqueta_salida_items i WHERE i.salida_id = s.id AND i.vendido = 1) AS sold_count,
              (SELECT COALESCE(SUM(i.precio_vendido), 0) FROM banqueta_salida_items i WHERE i.salida_id = s.id AND i.vendido = 1) AS sold_total
       FROM banqueta_salidas s
       ORDER BY
         CASE s.estado WHEN 'activa' THEN 0 WHEN 'borrador' THEN 1 ELSE 2 END,
         s.id DESC`,
    )
    .all()
  return (rows || []).map((r) => ({
    ...r,
    item_count: Number(r.item_count) || 0,
    sold_count: Number(r.sold_count) || 0,
    sold_total: Number(r.sold_total) || 0,
  }))
}

function getActiveBanquetaSalida() {
  const database = getDb()
  const row = database
    .prepare(
      `SELECT s.id, s.nombre, s.estado, s.lugar, s.fecha_planeada, s.created_at, s.activated_at,
              (SELECT COUNT(*) FROM banqueta_salida_items i WHERE i.salida_id = s.id) AS item_count,
              (SELECT COUNT(*) FROM banqueta_salida_items i WHERE i.salida_id = s.id AND i.vendido = 1) AS sold_count
       FROM banqueta_salidas s
       WHERE s.estado = 'activa'
       LIMIT 1`,
    )
    .get()
  if (!row) return null
  return {
    ...row,
    item_count: Number(row.item_count) || 0,
    sold_count: Number(row.sold_count) || 0,
  }
}

function sanitizeFechaPlaneada(value) {
  if (value == null) return null
  const s = String(value).trim()
  if (!s) return null
  // Acepta YYYY-MM-DD o cualquier string parseable; guardamos en ISO
  const d = new Date(s)
  if (Number.isFinite(d.getTime())) {
    // Si el input es YYYY-MM-DD, conservar esa forma (sin corrimiento de zona horaria)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    return d.toISOString()
  }
  return null
}

function createBanquetaSalida(payload = {}) {
  const database = getDb()
  const nombre =
    String(payload.nombre || '').trim() ||
    `Salida ${new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}`
  const lugar = String(payload.lugar || '').trim()
  const fechaPlaneada = sanitizeFechaPlaneada(payload.fechaPlaneada ?? payload.fecha_planeada)
  const r = database
    .prepare(
      `INSERT INTO banqueta_salidas (nombre, estado, lugar, fecha_planeada)
       VALUES (?, 'borrador', ?, ?)`,
    )
    .run(nombre, lugar, fechaPlaneada)
  return { id: Number(r.lastInsertRowid) }
}

function updateBanquetaSalida(payload = {}) {
  const id = Number(payload.id)
  if (!id) throw new Error('Salida inválida')
  const database = getDb()
  const row = database.prepare('SELECT estado FROM banqueta_salidas WHERE id = ?').get(id)
  if (!row) throw new Error('No existe la salida')
  if (row.estado === 'cerrada') throw new Error('No se puede editar una salida cerrada')
  if (payload.nombre != null) {
    database.prepare('UPDATE banqueta_salidas SET nombre = ? WHERE id = ?').run(String(payload.nombre).trim(), id)
  }
  if (payload.notas != null) {
    database.prepare('UPDATE banqueta_salidas SET notas = ? WHERE id = ?').run(String(payload.notas), id)
  }
  if (payload.lugar != null) {
    database.prepare('UPDATE banqueta_salidas SET lugar = ? WHERE id = ?').run(String(payload.lugar).trim(), id)
  }
  if (payload.fechaPlaneada !== undefined || payload.fecha_planeada !== undefined) {
    const fp = sanitizeFechaPlaneada(payload.fechaPlaneada ?? payload.fecha_planeada)
    database.prepare('UPDATE banqueta_salidas SET fecha_planeada = ? WHERE id = ?').run(fp, id)
  }
  return { ok: true }
}

function getBanquetaSalidaDetail(id) {
  const database = getDb()
  const sid = Number(id)
  if (!sid) return null
  const s = database.prepare('SELECT * FROM banqueta_salidas WHERE id = ?').get(sid)
  if (!s) return null
  const items = database
    .prepare(
      `SELECT i.id, i.producto_id, i.precio_snapshot, i.codigo_snapshot, i.nombre_snapshot,
              i.added_at, i.vendido, i.precio_vendido, i.vendido_at, COALESCE(i.sort_order, 0) AS sort_order,
              p.codigo AS codigo_actual, p.descripcion AS descripcion_actual, p.precio AS precio_actual,
              p.estado AS estado_producto
       FROM banqueta_salida_items i
       JOIN productos p ON p.id = i.producto_id
       WHERE i.salida_id = ?
       ORDER BY COALESCE(i.sort_order, 0) ASC, i.id ASC`,
    )
    .all(sid)
  return { salida: s, items: items || [] }
}

function addProductToBanquetaSalida(salidaId, codigo) {
  const database = getDb()
  const sid = Number(salidaId)
  const s = database.prepare('SELECT id, estado FROM banqueta_salidas WHERE id = ?').get(sid)
  if (!s) throw new Error('Salida no encontrada')
  if (s.estado === 'cerrada') throw new Error('La salida está cerrada')
  const p = getProductByCodigo(codigo)
  if (!p) throw new Error('No hay artículo con ese código')
  const estActual = String(p.estado || '').trim().toLowerCase()
  if (estActual === 'vendido') {
    throw new Error('Esta prenda figura como vendida. No se puede agregar a banqueta.')
  }
  const precio = Number(p.precio) || 0
  const codigoStr = String(p.codigo || '').trim()
  const nombre = String(p.descripcion || codigoStr).slice(0, 500)
  const mx = database
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM banqueta_salida_items WHERE salida_id = ?')
    .get(sid)
  const nextOrder = Number(mx?.m ?? -1) + 1
  const run = database.transaction(() => {
    try {
      database
        .prepare(
          `INSERT INTO banqueta_salida_items (salida_id, producto_id, precio_snapshot, codigo_snapshot, nombre_snapshot, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(sid, p.id, precio, codigoStr, nombre, nextOrder)
    } catch (e) {
      const msg = String(e?.message || e || '')
      if (/UNIQUE constraint failed/i.test(msg)) {
        throw new Error('Esa prenda ya está en esta salida.')
      }
      throw friendlySqliteError(e)
    }
    // Auto-mover a «en_banqueta» para que desaparezca del inventario disponible.
    if (estActual !== 'en_banqueta') {
      database.prepare("UPDATE productos SET estado = 'en_banqueta' WHERE id = ?").run(p.id)
    }
  })
  run()
  return getBanquetaSalidaDetail(sid)
}

function removeBanquetaSalidaItem(itemId) {
  const database = getDb()
  const iid = Number(itemId)
  const row = database
    .prepare(
      `SELECT i.id, i.producto_id, s.estado FROM banqueta_salida_items i
       JOIN banqueta_salidas s ON s.id = i.salida_id
       WHERE i.id = ?`,
    )
    .get(iid)
  if (!row) throw new Error('Ítem no encontrado')
  if (row.estado === 'cerrada') throw new Error('No se puede modificar una salida cerrada')
  const run = database.transaction(() => {
    database.prepare('DELETE FROM banqueta_salida_items WHERE id = ?').run(iid)
    // Si el producto no figura en ninguna otra salida viva, lo devolvemos al inventario.
    const other = database
      .prepare(
        `SELECT 1 FROM banqueta_salida_items i
         JOIN banqueta_salidas s ON s.id = i.salida_id
         WHERE i.producto_id = ? AND s.estado != 'cerrada' LIMIT 1`,
      )
      .get(row.producto_id)
    if (!other) {
      database
        .prepare(
          "UPDATE productos SET estado = 'disponible' WHERE id = ? AND LOWER(COALESCE(estado,'')) = 'en_banqueta'",
        )
        .run(row.producto_id)
    }
  })
  run()
  return { ok: true }
}

function setBanquetaSalidaItemResult(payload = {}) {
  const database = getDb()
  const iid = Number(payload.itemId)
  if (!iid) throw new Error('Ítem inválido')
  const vendido = payload.vendido ? 1 : 0
  const precioRaw = payload.precioVendido ?? payload.precio_vendido
  const precioVendido =
    vendido === 1 && precioRaw != null && String(precioRaw).trim() !== '' && Number.isFinite(Number(precioRaw))
      ? Number(precioRaw)
      : null
  const row = database
    .prepare(
      `SELECT i.id, s.estado, s.id AS salida_id FROM banqueta_salida_items i
       JOIN banqueta_salidas s ON s.id = i.salida_id WHERE i.id = ?`,
    )
    .get(iid)
  if (!row) throw new Error('Ítem no encontrado')
  if (row.estado === 'cerrada') throw new Error('La salida ya está cerrada')
  if (vendido === 1) {
    database
      .prepare(
        `UPDATE banqueta_salida_items
         SET vendido = 1, precio_vendido = ?, vendido_at = COALESCE(vendido_at, datetime('now'))
         WHERE id = ?`,
      )
      .run(precioVendido, iid)
  } else {
    database
      .prepare(
        `UPDATE banqueta_salida_items SET vendido = 0, precio_vendido = NULL, vendido_at = NULL WHERE id = ?`,
      )
      .run(iid)
  }
  return getBanquetaSalidaDetail(row.salida_id)
}

function reorderBanquetaSalidaItems(salidaId, orderedItemIds) {
  const database = getDb()
  const sid = Number(salidaId)
  const ids = Array.isArray(orderedItemIds) ? orderedItemIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0) : []
  if (!sid || !ids.length) return getBanquetaSalidaDetail(sid)
  const s = database.prepare('SELECT estado FROM banqueta_salidas WHERE id = ?').get(sid)
  if (!s) throw new Error('Salida no encontrada')
  if (s.estado === 'cerrada') throw new Error('No se puede reordenar una salida cerrada')
  const run = database.transaction(() => {
    ids.forEach((itemId, idx) => {
      database
        .prepare('UPDATE banqueta_salida_items SET sort_order = ? WHERE id = ? AND salida_id = ?')
        .run(idx, itemId, sid)
    })
  })
  run()
  return getBanquetaSalidaDetail(sid)
}

function removeBanquetaSalidaItemsBulk(itemIds) {
  const database = getDb()
  const ids = Array.isArray(itemIds) ? itemIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0) : []
  if (!ids.length) return { ok: true, detail: null }
  const row = database
    .prepare(
      `SELECT i.salida_id AS sid, s.estado FROM banqueta_salida_items i
       JOIN banqueta_salidas s ON s.id = i.salida_id
       WHERE i.id = ?`,
    )
    .get(ids[0])
  if (!row) throw new Error('Ítem no encontrado')
  if (row.estado === 'cerrada') throw new Error('No se puede modificar una salida cerrada')
  const sid = Number(row.sid)
  const ph = ids.map(() => '?').join(',')
  const okCnt = database
    .prepare(`SELECT COUNT(*) AS c FROM banqueta_salida_items WHERE salida_id = ? AND id IN (${ph})`)
    .get(sid, ...ids)
  if (!okCnt || Number(okCnt.c) !== ids.length) {
    throw new Error('Los ítems deben pertenecer a la misma salida.')
  }
  const del = database.prepare('DELETE FROM banqueta_salida_items WHERE id = ? AND salida_id = ?')
  const run = database.transaction(() => {
    for (const iid of ids) del.run(iid, sid)
  })
  run()
  return { ok: true, detail: getBanquetaSalidaDetail(sid) }
}

function activateBanquetaSalida(salidaId) {
  const database = getDb()
  const sid = Number(salidaId)
  const s = database.prepare('SELECT id, estado FROM banqueta_salidas WHERE id = ?').get(sid)
  if (!s) throw new Error('Salida no encontrada')
  if (s.estado === 'cerrada') throw new Error('La salida ya está cerrada')
  const n = database.prepare('SELECT COUNT(*) AS c FROM banqueta_salida_items WHERE salida_id = ?').get(sid)
  if (!n || Number(n.c) < 1) throw new Error('Agregá al menos una prenda antes de activar.')
  const run = database.transaction(() => {
    database.prepare(`UPDATE banqueta_salidas SET estado = 'borrador' WHERE estado = 'activa'`).run()
    database
      .prepare(`UPDATE banqueta_salidas SET estado = 'activa', activated_at = datetime('now') WHERE id = ?`)
      .run(sid)
  })
  run()
  return getBanquetaSalidaDetail(sid)
}

function closeBanquetaSalida(salidaId) {
  const database = getDb()
  const sid = Number(salidaId)
  const s = database.prepare('SELECT estado FROM banqueta_salidas WHERE id = ?').get(sid)
  if (!s) throw new Error('Salida no encontrada')
  if (s.estado !== 'activa') throw new Error('Solo se puede cerrar una salida activa.')
  const items = database
    .prepare(
      `SELECT id, producto_id, vendido FROM banqueta_salida_items WHERE salida_id = ?`,
    )
    .all(sid)
  let sold = 0
  let returned = 0
  const run = database.transaction(() => {
    database
      .prepare(`UPDATE banqueta_salidas SET estado = 'cerrada', closed_at = datetime('now') WHERE id = ?`)
      .run(sid)
    const setVendido = database.prepare("UPDATE productos SET estado = 'vendido' WHERE id = ?")
    const setDisponible = database.prepare(
      "UPDATE productos SET estado = 'disponible' WHERE id = ? AND LOWER(COALESCE(estado,'')) = 'en_banqueta'",
    )
    for (const it of items) {
      if (Number(it.vendido) === 1) {
        setVendido.run(it.producto_id)
        sold += 1
      } else {
        setDisponible.run(it.producto_id)
        returned += 1
      }
    }
  })
  run()
  return { ok: true, sold, returned }
}

function deleteBanquetaSalida(salidaId) {
  const database = getDb()
  const sid = Number(salidaId)
  const s = database.prepare('SELECT estado FROM banqueta_salidas WHERE id = ?').get(sid)
  if (!s) throw new Error('Salida no encontrada')
  if (s.estado === 'activa') {
    throw new Error('No se puede eliminar una salida activa. Cerrala primero o eliminá el borrador antes de activar.')
  }
  /* Historial: ya se aplicó cierre al inventario; solo quitamos el registro y los ítems (CASCADE). */
  if (s.estado === 'cerrada') {
    database.prepare('DELETE FROM banqueta_salidas WHERE id = ?').run(sid)
    return { ok: true }
  }
  if (s.estado !== 'borrador') throw new Error('Solo se pueden borrar borradores o salidas cerradas del historial.')
  const productIds = database
    .prepare('SELECT producto_id FROM banqueta_salida_items WHERE salida_id = ?')
    .all(sid)
    .map((r) => Number(r.producto_id))
  const run = database.transaction(() => {
    database.prepare('DELETE FROM banqueta_salidas WHERE id = ?').run(sid)
    // Devolver al inventario productos que quedaron sin ninguna otra salida viva.
    for (const pid of productIds) {
      const other = database
        .prepare(
          `SELECT 1 FROM banqueta_salida_items i
           JOIN banqueta_salidas s ON s.id = i.salida_id
           WHERE i.producto_id = ? AND s.estado != 'cerrada' LIMIT 1`,
        )
        .get(pid)
      if (!other) {
        database
          .prepare(
            "UPDATE productos SET estado = 'disponible' WHERE id = ? AND LOWER(COALESCE(estado,'')) = 'en_banqueta'",
          )
          .run(pid)
      }
    }
  })
  run()
  return { ok: true }
}

/** Paridad con `zen_banqueta_snapshot` en Python: en banqueta, disponibles, planos de tienda. */
function getBanquetaSidebarSnapshot() {
  try {
    const database = getDb()
    const r1 = database
      .prepare(
        `SELECT COUNT(*) AS n FROM productos WHERE LOWER(TRIM(COALESCE(estado,''))) = 'en_banqueta'`,
      )
      .get()
    const r2 = database
      .prepare(
        `SELECT COUNT(*) AS n FROM productos WHERE LOWER(TRIM(COALESCE(estado,''))) = 'disponible'`,
      )
      .get()
    const planos = database
      .prepare(
        `SELECT tp.nombre AS nombre, COUNT(pi.id) AS cnt
         FROM tienda_planos tp
         LEFT JOIN plano_items pi ON pi.plano_id = tp.id
         GROUP BY tp.id
         ORDER BY tp.nombre COLLATE NOCASE`,
      )
      .all()
    return {
      enBanqueta: Number(r1?.n) || 0,
      disponibles: Number(r2?.n) || 0,
      planos: (planos || []).map((row) => ({
        nombre: String(row.nombre || ''),
        cnt: Number(row.cnt) || 0,
      })),
    }
  } catch {
    return { enBanqueta: 0, disponibles: 0, planos: [] }
  }
}

module.exports = {
  initDatabase,
  getDb,
  closeDb,
  resetMonserratDatabaseToSeed,
  getProducts,
  checkRequiredTagsForProduct,
  addProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  nextCodigoMsr,
  getProductById,
  getProductByCodigo,
  getInventoryList,
  getTagGroupsForProduct,
  getTagLabelsForMap,
  suggestNombreFromTags,
  suggestPrecioFromTags,
  getReferenceRows,
  getReferenceSnapshot,
  previewPriceAdjust,
  applyPriceAdjust,
  getReferencePatternStats,
  getSales,
  addSale,
  getCredits,
  suggestByTags,
  getWelcomeSnapshot,
  getBanquetaSidebarSnapshot,
  listBanquetaSalidas,
  getActiveBanquetaSalida,
  createBanquetaSalida,
  updateBanquetaSalida,
  getBanquetaSalidaDetail,
  addProductToBanquetaSalida,
  removeBanquetaSalidaItem,
  setBanquetaSalidaItemResult,
  activateBanquetaSalida,
  closeBanquetaSalida,
  deleteBanquetaSalida,
  reorderBanquetaSalidaItems,
  removeBanquetaSalidaItemsBulk,
  getMonserratDbPath,
  nombreEtiquetaDesdeTagsPayload,
  getCuadernoTagGroups,
  getTagCatalogForManager,
  listPriceRulesAdmin,
  cuadernoAddTagGroup,
  cuadernoAddTagOption,
  cuadernoMoveTagOption,
  cuadernoRenameTagOption,
  cuadernoRenameTagGroup,
  cuadernoDeleteTagOption,
  cuadernoDeleteTagGroup,
  cuadernoSetTagOptionActive,
  cuadernoSetTagGroupStyle,
  cuadernoSetTagOptionStyle,
  cuadernoReorderTagGroups,
  cuadernoUpsertPriceRule,
  cuadernoDeletePriceRule,
  listTagPriceRulesSummary,
  listTagPriceRulesForCuaderno,
  setTagOptionPriceRule,
  getPriceCombosForAnchor,
  replacePriceCombosForAnchor,
  listInvPricingRules,
  getInvPricingRule,
  upsertInvPricingRule,
  deleteInvPricingRule,
  listClientes,
  addCliente,
  updateCliente,
  addCreditoMovimiento,
  getCreditoMovimientos,
}
