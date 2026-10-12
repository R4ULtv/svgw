import { useId, useRef, useState } from 'react'
import { HexAlphaColorPicker } from 'react-colorful'
import { XIcon } from 'lucide-react'
import { colorToHex, normalizeColor } from '@/lib/colors'
import type { ColorReplacement, DocumentColor } from '@/lib/document-colors'
import type { PaintAttribute } from '@/lib/editor'
import { cn } from '@/lib/utils'
import { ColorValueInput } from '@/components/color-picker'
import { useCommandScope } from '@/components/commands'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTitle } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Four rows of swatches before "Show all". */
const LIMIT = 36

interface DocumentColorsProps {
  colors: DocumentColor[]
  /** The selection's fill and stroke, or null with nothing selected to apply a color to. */
  selection: { fill: string; stroke: string } | null
  onApply: (attr: PaintAttribute, color: string) => void
  /** Starts replacing a color everywhere; null when nothing uses it anymore. */
  onReplace: (from: string) => ColorReplacement | null
}

/**
 * Swatches of every color in the document. With a selection, a click applies the color as its
 * fill and Shift-click as its stroke. Otherwise, or on right-click, a picker replaces the color
 * everywhere.
 */
export function DocumentColors({ colors, selection, onApply, onReplace }: DocumentColorsProps) {
  const [expanded, setExpanded] = useState(false)
  // `from` is the color being replaced; `value` what the picker shows while dragging.
  const [editing, setEditing] = useState<{ from: string; value: string } | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  const replacement = useRef<ColorReplacement | null>(null)
  const id = useId()
  useCommandScope('dialog', editing !== null)

  if (!colors.length)
    return <p className="text-[11px] text-muted-foreground">Colors you use appear here.</p>

  function preview(to: string) {
    if (!editing) return
    replacement.current ??= onReplace(editing.from)
    replacement.current?.preview(to)
    setEditing({ ...editing, value: to })
  }

  function commit(to: string) {
    if (!editing) return
    preview(to)
    replacement.current?.commit()
    replacement.current = null
    // Further changes replace the new color, which now covers everything the old one did.
    const next = normalizeColor(to) ?? editing.from
    setEditing({ from: next, value: next })
  }

  function close() {
    replacement.current?.commit()
    replacement.current = null
    setEditing(null)
  }

  const shown = expanded ? colors : colors.slice(0, LIMIT)
  return (
    <>
      <div ref={grid} className="flex flex-wrap gap-1" aria-label="Document colors" role="group">
        {shown.map(({ color, uses }) => {
          const current = selection && (selection.fill === color || selection.stroke === color)
          return (
            <Tooltip key={color}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={`${color}, ${uses === 1 ? '1 use' : `${uses} uses`}`}
                    aria-pressed={editing?.from === color || undefined}
                    className={cn(
                      'checker relative size-5 shrink-0 overflow-hidden ring-1 ring-foreground/15 outline-none hover:ring-foreground/40 focus-visible:ring-2 focus-visible:ring-ring',
                      (current || editing?.from === color) &&
                        'ring-2 ring-foreground ring-offset-1 ring-offset-background',
                    )}
                    onClick={(event) => {
                      if (selection) onApply(event.shiftKey ? 'stroke' : 'fill', color)
                      else setEditing({ from: color, value: color })
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      setEditing({ from: color, value: color })
                    }}
                  />
                }
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{ background: color }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <span className="font-mono">{color}</span>
                <span className="text-background/60">{uses === 1 ? '1 use' : `${uses} uses`}</span>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      {colors.length > LIMIT && (
        <Button
          variant="link"
          size="xs"
          className="-mt-1 self-start px-0 text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show fewer' : `Show all ${colors.length}`}
        </Button>
      )}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {selection
          ? 'Click to fill · Shift-click to stroke · Right-click to replace'
          : 'Click a color to replace it everywhere.'}
      </p>
      <Popover
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        {editing && (
          <PopoverContent
            anchor={grid}
            side="left"
            align="start"
            sideOffset={20}
            className="color-picker w-64 max-w-[calc(100vw-1rem)] gap-3 p-3"
            onKeyDown={(event) => {
              if (event.key.startsWith('Arrow')) event.stopPropagation()
            }}
          >
            <div className="flex items-center justify-between">
              <PopoverTitle>Replace color</PopoverTitle>
              <Button variant="ghost" size="icon-xs" aria-label="Close" onClick={close}>
                <XIcon />
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Changes every fill, stroke, and gradient stop using{' '}
              <span className="font-mono text-foreground">{editing.from}</span>.
            </p>
            <HexAlphaColorPicker
              color={colorToHex(editing.value) ?? '#000000'}
              onChange={preview}
              onChangeEnd={commit}
              aria-label="Replacement color controls"
            />
            <ColorValueInput
              id={id}
              label="Replacement color value"
              color={editing.value}
              format={editing.value.startsWith('oklch(') ? 'oklch' : 'hex'}
              onApply={commit}
            />
          </PopoverContent>
        )}
      </Popover>
    </>
  )
}
