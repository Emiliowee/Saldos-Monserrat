import { useEffect } from 'react'

/**
 * Expone la plataforma de Electron en `<html data-platform>` para CSS (p. ej. padding de traffic lights en macOS).
 */
export function usePlatform() {
  useEffect(() => {
    const p = typeof window !== 'undefined' ? window.bazar?.runtime?.platform ?? '' : ''
    document.documentElement.dataset.platform = p || 'web'
    return () => {
      delete document.documentElement.dataset.platform
    }
  }, [])
}
