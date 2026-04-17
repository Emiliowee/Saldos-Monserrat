import { useMemo } from 'react'
import {
  useRive,
  Layout,
  Fit,
  Alignment,
  DrawOptimizationOptions,
} from '@rive-app/react-canvas'

const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`
export const RIVE_BAZAR_SRC = `${base}branding/rive-app.riv`

/**
 * Animación .riv compartida (misma lógica que el preview: reproduce todo el artboard).
 * @param {'welcome' | 'preview'} layoutVariant — welcome: Cover llena la ventana; preview: Cover + escala.
 */
export function RiveBazarCanvas({
  layoutVariant = 'preview',
  stageClassName = '',
  rootClassName = '',
  onReadyMeta,
  onLoadError,
}) {
  const layout = useMemo(() => {
    if (layoutVariant === 'welcome') {
      /* Center: encuadre estable (las cajitas visibles). BottomCenter dejaba zona vacía según proporción del artboard. */
      return new Layout({
        fit: Fit.Cover,
        alignment: Alignment.Center,
        layoutScaleFactor: 1.08,
      })
    }
    return new Layout({
      fit: Fit.Cover,
      alignment: Alignment.Center,
      layoutScaleFactor: 1.2,
    })
  }, [layoutVariant])

  const { RiveComponent } = useRive(
    {
      src: RIVE_BAZAR_SRC,
      autoplay: true,
      layout,
      shouldResizeCanvasToContainer: true,
      shouldDisableRiveListeners: false,
      drawingOptions: DrawOptimizationOptions.AlwaysDraw,
      onRiveReady: (rive) => {
        try {
          rive.resizeDrawingSurfaceToCanvas()
        } catch {
          /* noop */
        }
        const anims = rive.animationNames ?? []
        const sms = rive.stateMachineNames ?? []
        const allIds = [...new Set([...anims, ...sms])]
        if (allIds.length) {
          try {
            rive.play(allIds)
          } catch {
            /* noop */
          }
        }
        onReadyMeta?.({
          artboard: rive.activeArtboard ?? '—',
          playingIds: allIds,
        })
      },
      onLoadError: () => {
        onLoadError?.(
          'No se pudo cargar la animación. Verificá public/branding/rive-app.riv.',
        )
      },
    },
    {
      useOffscreenRenderer: false,
      shouldUseIntersectionObserver: false,
      fitCanvasToArtboardHeight: layoutVariant === 'preview',
    },
  )

  return (
    <div className={stageClassName}>
      <RiveComponent
        className={rootClassName}
        style={{ touchAction: 'none' }}
      />
    </div>
  )
}
