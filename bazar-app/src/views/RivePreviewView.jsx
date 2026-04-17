import { useState } from 'react'
import { RiveBazarCanvas, RIVE_BAZAR_SRC } from '@/components/rive/RiveBazarCanvas.jsx'

function resolvedRiveUrl() {
  try {
    return new URL(RIVE_BAZAR_SRC, window.location.origin).href
  } catch {
    return RIVE_BAZAR_SRC
  }
}

export function RivePreviewView() {
  const [loadError, setLoadError] = useState(null)
  const [readyHint, setReadyHint] = useState('Inicializando…')

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 bg-muted/30">
        <RiveBazarCanvas
          layoutVariant="preview"
          stageClassName="w-full h-full"
          rootClassName="w-full h-full"
          onReadyMeta={({ artboard, playingIds }) => {
            setReadyHint(
              `Listo. Artboard: ${artboard}. En reproducción (${playingIds.length}): ${playingIds.length ? playingIds.join(', ') : 'predeterminado del runtime'}.`,
            )
          }}
          onLoadError={(msg) => {
            setLoadError(msg)
            setReadyHint('Error al cargar')
          }}
        />
      </div>
      <footer className="shrink-0 border-t px-4 py-2 space-y-0.5">
        {loadError && (
          <p className="text-xs text-destructive" role="alert">{loadError}</p>
        )}
        <p className="text-xs text-muted-foreground">{readyHint}</p>
        <p className="text-[10px] text-muted-foreground/60 font-mono truncate" title="URL resuelta del .riv">
          {resolvedRiveUrl()}
        </p>
      </footer>
    </div>
  )
}
