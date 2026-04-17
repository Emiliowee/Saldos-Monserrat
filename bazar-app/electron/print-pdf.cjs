const fs = require('fs')
const { execFileSync } = require('child_process')

/**
 * Envía un PDF existente a la cola de impresión (sin abrir visor).
 * Windows: pdf-to-printer. macOS/Linux: lp.
 * @param {string} absPath
 * @param {string} [printerName]
 */
async function printPdfToQueue(absPath, printerName) {
  if (!absPath || !fs.existsSync(absPath)) {
    throw new Error('Archivo PDF no encontrado.')
  }
  const name = String(printerName || '').trim()

  if (process.platform === 'win32') {
    const { print } = require('pdf-to-printer')
    const opts = {}
    if (name) opts.printer = name
    await print(absPath, opts)
    return
  }

  try {
    if (name) {
      execFileSync('lp', ['-d', name, absPath], { timeout: 120000 })
    } else {
      execFileSync('lp', [absPath], { timeout: 120000 })
    }
  } catch (e) {
    throw new Error(String(e?.message || e))
  }
}

module.exports = { printPdfToQueue }
