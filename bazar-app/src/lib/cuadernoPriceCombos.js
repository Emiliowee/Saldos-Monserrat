/** Firma estable para comparar filas de precio por combinación (sin depender del orden de filas en UI). */
export function normalizeComboSnapshot(rows) {
  if (!Array.isArray(rows)) return '[]'
  const norm = rows.map((r) => ({
    c: [...(r.companionIds || [])].sort((a, b) => a - b),
    p: String(r.price ?? '')
      .trim()
      .replace(',', '.'),
  }))
  norm.sort((a, b) => {
    const ka = `${a.c.join(',')}|${a.p}`
    const kb = `${b.c.join(',')}|${b.p}`
    return ka.localeCompare(kb, 'es')
  })
  return JSON.stringify(norm)
}

export function cloneComboRows(rows) {
  if (!Array.isArray(rows)) return [{ companionIds: [], price: '' }]
  return rows.map((r) => ({ companionIds: [...(r.companionIds || [])], price: String(r.price ?? '') }))
}
