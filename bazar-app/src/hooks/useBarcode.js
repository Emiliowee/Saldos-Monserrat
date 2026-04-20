import { useEffect, useRef } from 'react'

/**
 * Lector HID: acumula teclas y dispara al Enter.
 * @param {(code: string) => void} onScan
 * @param {{ minLength?: number, timeout?: number }} [options]
 */
export function useBarcode(onScan, options = {}) {
  const { minLength = 3, timeout = 100 } = options
  const buffer = useRef('')
  const timer = useRef(null)

  useEffect(() => {
    const handleKeydown = (e) => {
      const active = document.activeElement
      if (active instanceof HTMLElement && active.closest('[data-no-barcode="true"]')) {
        return
      }
      const t = e.target
      if (t instanceof HTMLElement && t.closest('[data-no-barcode="true"]')) {
        return
      }
      if (
        t &&
        (t instanceof HTMLInputElement ||
          t instanceof HTMLTextAreaElement ||
          t instanceof HTMLSelectElement ||
          (t instanceof HTMLElement && t.isContentEditable))
      ) {
        return
      }

      if (e.key === 'Enter') {
        if (typeof document !== 'undefined' && document.querySelector('[data-no-barcode="true"]')) {
          buffer.current = ''
          return
        }
        if (buffer.current.length >= minLength) {
          onScan(buffer.current)
        }
        buffer.current = ''
        return
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer.current += e.key
      }

      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        buffer.current = ''
      }, timeout)
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      clearTimeout(timer.current)
    }
  }, [onScan, minLength, timeout])
}
