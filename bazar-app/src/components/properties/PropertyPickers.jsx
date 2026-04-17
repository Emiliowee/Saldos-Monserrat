import { useEffect, useState } from 'react'
import { ImagePlus, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { EmojiPicker } from 'frimousse'
import { NOTION_TAG_COLOR_CLASSIC, notionColorDotClass } from '@/lib/propertyTokens'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TAG_LUCIDE_ICON_KEYS, TagGlyph } from '@/components/TagGlyph'
import { localPathToFileUrl } from '@/lib/localFileUrl'
import { isTagIconImagePath } from '@/lib/tagIcon'

function isLucideIconKey(v) {
  return Boolean(v && TAG_LUCIDE_ICON_KEYS.includes(String(v)))
}

const COLOR_LABELS = {
  default: 'Predeterminado',
  gray: 'Gris',
  brown: 'Marrón',
  orange: 'Naranja',
  yellow: 'Amarillo',
  green: 'Verde',
  blue: 'Azul',
  purple: 'Morado',
  pink: 'Rosa',
  red: 'Rojo',
}

const QUICK_EMOJIS = ['👕', '👗', '👜', '👠', '⭐', '❤️', '✨', '🎀', '🏷️', '💎']

export function ColorSwatchGrid({ keys, value, onChange }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          title={COLOR_LABELS[k] || k}
          onClick={() => onChange?.(k)}
          className={cn(
            'flex h-8 w-full items-center justify-center rounded-md border transition-all',
            value === k ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-transparent hover:bg-muted/70',
          )}
        >
          <span className={cn('size-4 rounded-full', notionColorDotClass(k))} />
        </button>
      ))}
    </div>
  )
}

/** Paleta Notion (Select): solo colores clásicos. */
export function PropertyColorPickerButton({ value, onChange, size = 'sm', title = 'Color' }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title}
          className={cn(
            'inline-flex items-center justify-center rounded-md border border-border/70 bg-background shadow-sm transition-colors hover:bg-muted/60',
            size === 'sm' ? 'size-7' : 'size-8',
          )}
        >
          <span className={cn('size-4 rounded-full ring-2 ring-background', notionColorDotClass(value))} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[220] w-[min(100vw-1.5rem,260px)] p-3"
        align="start"
        sideOffset={6}
      >
        <p className="mb-2 text-[11px] font-medium text-foreground">Color de la opción</p>
        <ColorSwatchGrid keys={NOTION_TAG_COLOR_CLASSIC} value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}

/**
 * @param {'chip' | 'hero'} appearance — chip: botón compacto con borde; hero: solo emoji/icono grande (portada tipo Notion).
 */
export function PropertyIconPickerButton({
  value,
  onChange,
  title = 'Icono',
  triggerClassName,
  glyphClassName,
  appearance = 'chip',
}) {
  const [emojiDraft, setEmojiDraft] = useState('')
  const [emojiDialogOpen, setEmojiDialogOpen] = useState(false)

  useEffect(() => {
    if (!value) {
      setEmojiDraft('')
      return
    }
    if (isLucideIconKey(value) || isTagIconImagePath(value)) setEmojiDraft('')
    else setEmojiDraft(String(value))
  }, [value])

  const commitEmoji = () => {
    const t = emojiDraft.trim()
    if (t) onChange?.(t.slice(0, 8))
    else if (value && !isLucideIconKey(value) && !isTagIconImagePath(value)) onChange?.(null)
  }

  const pickTagImageFromDisk = async () => {
    const pick = window.bazar?.tagIconImage?.pick
    if (typeof pick !== 'function') {
      toast.error('Subir imagen solo está disponible en la aplicación de escritorio.')
      return
    }
    try {
      const res = await pick()
      if (!res || res.cancelled || !res.path) return
      onChange?.(String(res.path))
      toast.success('Imagen asignada a la etiqueta')
    } catch (e) {
      toast.error(String(e?.message || e))
    }
  }

  const chipTrigger =
    'inline-flex size-7 items-center justify-center rounded-md border border-border/70 bg-background shadow-sm transition-colors hover:bg-muted/60 hover:text-foreground'
  const heroTrigger =
    'inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-0 bg-transparent p-0 shadow-none ring-0 outline-none transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring/35'

  const defaultGlyph = appearance === 'hero' ? '!size-20 sm:!size-24' : 'size-5'

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={title}
            className={cn(appearance === 'hero' ? heroTrigger : chipTrigger, triggerClassName)}
          >
            {value ? (
              <TagGlyph icon={value} className={cn(defaultGlyph, glyphClassName)} />
            ) : (
              <Tag className={cn('opacity-35', appearance === 'hero' ? 'size-14 sm:size-16' : 'size-5', glyphClassName)} strokeWidth={2} aria-hidden />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[220] w-[min(100vw-1.5rem,320px)] p-0 shadow-lg"
          align="start"
          sideOffset={8}
        >
          <div className="border-b border-border/40 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Icono</p>
            <p className="text-[12px] text-muted-foreground/90">Icono vectorial, emoji o imagen desde tu equipo.</p>
          </div>

          <Tabs defaultValue="icons" className="w-full px-3 pb-3 pt-2">
            <TabsList variant="line" className="mb-3 h-8 w-full justify-start gap-1 bg-transparent p-0">
              <TabsTrigger
                value="icons"
                className="rounded-md px-2.5 py-1 text-[12px] data-[state=active]:bg-muted data-[state=active]:shadow-none"
              >
                Iconos
              </TabsTrigger>
              <TabsTrigger
                value="emoji"
                className="rounded-md px-2.5 py-1 text-[12px] data-[state=active]:bg-muted data-[state=active]:shadow-none"
              >
                Emoji
              </TabsTrigger>
            </TabsList>

            <TabsContent value="icons" className="mt-0 space-y-2">
              <div className="grid grid-cols-5 gap-1">
                <button
                  type="button"
                  title="Sin icono"
                  onClick={() => onChange?.(null)}
                  className={cn(
                    'flex h-8 items-center justify-center rounded-md text-[11px] text-muted-foreground transition-colors',
                    !value ? 'bg-muted font-medium text-foreground' : 'hover:bg-muted/80',
                  )}
                >
                  —
                </button>
                {TAG_LUCIDE_ICON_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    title={k}
                    onClick={() => onChange?.(k)}
                    className={cn(
                      'flex h-8 items-center justify-center rounded-md transition-colors',
                      isLucideIconKey(value) && value === k ? 'bg-muted' : 'hover:bg-muted/80',
                    )}
                  >
                    <TagGlyph icon={k} className="size-[18px]" />
                  </button>
                ))}
              </div>
              <div className="border-t border-border/35 pt-2.5">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Imagen</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex-1 min-w-[9rem] gap-1.5 text-[12px]"
                    onClick={() => void pickTagImageFromDisk()}
                  >
                    <ImagePlus className="size-3.5 shrink-0 opacity-90" strokeWidth={1.75} />
                    Subir desde archivo…
                  </Button>
                  {isTagIconImagePath(value) ? (
                    <Button type="button" variant="outline" size="sm" className="text-[12px]" onClick={() => onChange?.(null)}>
                      Quitar imagen
                    </Button>
                  ) : null}
                </div>
                {isTagIconImagePath(value) ? (
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-border/40 bg-muted/15 p-2">
                    <img
                      src={localPathToFileUrl(value)}
                      alt=""
                      className="size-10 shrink-0 object-contain"
                      draggable={false}
                      decoding="async"
                    />
                    <span className="min-w-0 truncate text-[11px] text-muted-foreground">Vista previa</span>
                  </div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="emoji" className="mt-0 space-y-3">
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sugeridos</p>
                <div className="flex flex-wrap gap-0.5">
                  {QUICK_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="flex size-9 items-center justify-center rounded-md text-[1.25rem] leading-none transition-transform hover:scale-110 active:scale-95"
                      onClick={() => onChange?.(e)}
                    >
                      <span className="select-none">{e}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full text-[12px]"
                onClick={() => setEmojiDialogOpen(true)}
              >
                Buscar en biblioteca…
              </Button>
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Pegar</p>
                <Input
                  className="h-8 text-[12px]"
                  placeholder="Un emoji…"
                  value={emojiDraft}
                  onChange={(e) => setEmojiDraft(e.target.value)}
                  onBlur={() => commitEmoji()}
                  onKeyDown={(e) => e.key === 'Enter' && commitEmoji()}
                />
              </div>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      <Dialog open={emojiDialogOpen} onOpenChange={setEmojiDialogOpen}>
        <DialogContent
          className="z-[230] max-w-[min(100vw-1.5rem,420px)] gap-0 overflow-hidden border border-border/40 bg-popover p-0 shadow-xl sm:max-w-[420px]"
          showCloseButton
        >
          <DialogHeader className="border-b border-border/35 px-4 pb-3 pt-4 text-left">
            <DialogTitle className="text-[15px] font-semibold">Emojis</DialogTitle>
            <DialogDescription className="text-[12px] leading-snug">
              Buscá por nombre o recorré las categorías abajo (estilo Notion).
            </DialogDescription>
          </DialogHeader>
          <div className="bg-background px-3 pb-3 pt-2">
            {emojiDialogOpen ? (
              <EmojiPicker.Root
                locale="es"
                columns={9}
                skinTone="none"
                className="flex flex-col gap-2 outline-none"
                onEmojiSelect={({ emoji }) => {
                  onChange?.(emoji)
                  setEmojiDialogOpen(false)
                }}
              >
                <div className="flex items-center gap-2">
                  <EmojiPicker.Search
                    className={cn(
                      'h-9 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-3 text-[13px] outline-none',
                      'placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30',
                    )}
                    placeholder="Buscar emoji…"
                    autoFocus
                  />
                  <EmojiPicker.SkinToneSelector
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-[1.15rem] leading-none transition-colors hover:bg-muted/60"
                    aria-label="Tono de piel"
                  />
                </div>
                <EmojiPicker.Viewport className="max-h-[min(52vh,380px)] rounded-md border border-border/40 bg-background p-0.5">
                  <EmojiPicker.Loading className="block px-3 py-10 text-center text-[12px] text-muted-foreground">
                    Cargando emojis…
                  </EmojiPicker.Loading>
                  <EmojiPicker.Empty className="block px-3 py-10 text-center text-[12px] text-muted-foreground">
                    Sin resultados.
                  </EmojiPicker.Empty>
                  <EmojiPicker.List
                    components={{
                      CategoryHeader: ({ category, className, ...props }) => (
                        <div
                          {...props}
                          className={cn(
                            className,
                            'border-b border-border/30 bg-muted/40 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm',
                          )}
                        >
                          {category.label}
                        </div>
                      ),
                      Row: ({ className, ...props }) => <div {...props} className={cn(className, 'flex gap-0.5')} />,
                      Emoji: ({ emoji, className, ...props }) => (
                        <button
                          type="button"
                          {...props}
                          className={cn(
                            className,
                            'flex size-9 shrink-0 items-center justify-center rounded-md text-[1.2rem] leading-none transition-colors',
                            'hover:bg-muted/70',
                            emoji.isActive && 'bg-muted',
                          )}
                        >
                          {emoji.emoji}
                        </button>
                      ),
                    }}
                  />
                </EmojiPicker.Viewport>
              </EmojiPicker.Root>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
