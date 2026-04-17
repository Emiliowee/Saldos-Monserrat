/**
 * Tags en SQLite: lista separada por comas, normalizada a minúsculas (paridad práctica con filtro Qt).
 */
export function parseTagsList(raw) {
  return String(raw || '')
    .split(/[,;\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

/** Normaliza texto libre (coma / punto y coma) a string de almacenamiento. */
export function normalizeTagsInput(raw) {
  return [...new Set(parseTagsList(raw))].join(',')
}

export function parseTagsSet(raw) {
  return new Set(parseTagsList(raw))
}

/** Coincidencia amplia: el producto incluye todos los tags del filtro (puede tener más). */
export function matchesTagFilterWide(productTagsStr, filterTags) {
  const p = parseTagsSet(productTagsStr)
  const f = filterTags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
  if (f.length === 0) return false
  return f.every((t) => p.has(t))
}

/** Conjunto exacto: mismos tags que el filtro (sin contar orden). */
export function matchesTagFilterExact(productTagsStr, filterTags) {
  const p = parseTagsSet(productTagsStr)
  const f = new Set(filterTags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))
  if (f.size === 0) return false
  if (p.size !== f.size) return false
  for (const t of f) {
    if (!p.has(t)) return false
  }
  return true
}
