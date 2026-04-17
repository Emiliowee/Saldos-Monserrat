import { cn } from '@/lib/utils'

/**
 * Capa solo visual: rellena huecos, da color muy suave y guía la mirada
 * hacia el centro (orbes + línea + rejilla). No recibe eventos.
 */
export function AmbientCalm({ variant = 'main', className }) {
  const embed = variant === 'embed'

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        embed && 'opacity-[0.92]',
        className,
      )}
      aria-hidden
    >
      {/* Orbes difusos — “peso” visual que calma el blanco */}
      <div
        className={cn(
          'absolute rounded-full blur-[100px] motion-reduce:blur-[80px]',
          embed
            ? '-right-[6%] top-[18%] h-[min(30vh,260px)] w-[min(40vw,300px)] bg-primary/[0.06] dark:bg-primary/[0.1]'
            : '-right-[10%] top-[0%] h-[min(46vh,440px)] w-[min(56vw,500px)] bg-primary/[0.085] dark:bg-primary/[0.11]',
        )}
      />
      <div
        className={cn(
          'absolute rounded-full blur-[110px]',
          embed
            ? '-left-[8%] bottom-[12%] h-[min(26vh,220px)] w-[min(36vw,280px)] bg-[oklch(0.78_0.09_300/0.1)] dark:bg-[oklch(0.42_0.08_300/0.18)]'
            : '-left-[12%] bottom-[0%] h-[min(42vh,400px)] w-[min(48vw,440px)] bg-[oklch(0.82_0.07_300/0.14)] dark:bg-[oklch(0.38_0.07_300/0.22)]',
        )}
      />
      <div
        className={cn(
          'absolute rounded-full blur-[70px]',
          embed
            ? 'left-[35%] top-[55%] h-[140px] w-[140px] bg-rose-300/10 dark:bg-rose-400/8'
            : 'left-[28%] top-[42%] h-[min(22vh,200px)] w-[min(22vh,200px)] bg-rose-300/[0.13] dark:bg-rose-400/[0.06]',
        )}
      />

      {/* Rejilla casi invisible — ritmo, como papel fino */}
      <div
        className={cn(
          'absolute inset-0 opacity-[0.5] dark:opacity-[0.35]',
          '[background-image:radial-gradient(oklch(0.5_0.05_18_/_0.055)_1px,transparent_1px)] [background-size:28px_28px]',
          'dark:[background-image:radial-gradient(oklch(0.75_0.04_18_/_0.07)_1px,transparent_1px)]',
        )}
      />

      {/* Línea de respiración junto al borde — ancla la lectura hacia adentro */}
      <div
        className={cn(
          'absolute top-[8%] bottom-[8%] left-0 w-px bg-gradient-to-b from-transparent via-primary/25 to-transparent opacity-70 dark:via-primary/35',
          embed ? 'opacity-50' : 'md:opacity-80',
        )}
      />
      <div
        className={cn(
          'absolute top-[12%] bottom-[12%] left-[3px] hidden w-px bg-gradient-to-b from-transparent via-primary/[0.08] to-transparent md:block',
        )}
      />

      {/* Arco inferior — cierra el espacio y evita que la vista “caiga” */}
      <svg
        className={cn(
          'absolute bottom-0 left-1/2 h-[min(100px,14vh)] w-[min(920px,96%)] -translate-x-1/2 text-primary/[0.09] dark:text-primary/[0.14]',
          embed && 'h-[min(72px,10vh)] opacity-80',
        )}
        viewBox="0 0 900 80"
        preserveAspectRatio="xMidYMax meet"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 80 C 200 20, 700 20, 900 80"
          stroke="currentColor"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M0 78 C 220 35, 680 35, 900 78"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Tres puntos de ancla suaves (orientación tipo “pasos” sin UI) */}
      <div className="absolute bottom-[min(72px,10vh)] left-[12%] size-1 rounded-full bg-primary/25 dark:bg-primary/35" />
      <div className="absolute bottom-[min(88px,12vh)] left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary/20 dark:bg-primary/30" />
      <div className="absolute bottom-[min(72px,10vh)] right-[12%] size-1 rounded-full bg-primary/25 dark:bg-primary/35" />
    </div>
  )
}
