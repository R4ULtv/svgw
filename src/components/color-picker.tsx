import { useEffect, useId, useRef, useState } from 'react'
import { HexAlphaColorPicker } from 'react-colorful'
import { XIcon } from 'lucide-react'
import type { PaintAttribute } from '@/lib/editor'
import {
  COLOR_FORMATS,
  colorChannels,
  colorFromChannels,
  colorToHex,
  formatColor,
  isOutsideSrgb,
  normalizeColor,
  type ChannelFormat,
  type ColorFormat,
} from '@/lib/colors'
import { useCommandScope } from '@/components/commands'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface PaintFieldProps {
  attr: PaintAttribute
  label: string
  value: string
  onPreview: (attr: string, value: string | number) => void
  onCommit: () => void
}

export function PaintField({ attr, label, value, onPreview, onCommit }: PaintFieldProps) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<ColorFormat>('hex')
  const none = value === 'none'
  const mixed = value === 'mixed'
  const color = normalizeColor(value)
  const pickerColor = colorToHex(value) ?? (attr === 'fill' ? '#cccccc' : '#000000')
  // The desktop inspector and the compact Properties popover can both be mounted.
  const id = useId()
  useCommandScope('dialog', open)

  function apply(next: string) {
    if (next !== value) {
      onPreview(attr, next)
      onCommit()
    }
  }

  return (
    <div data-paint-field={attr} className="flex min-h-8 items-center justify-between gap-3">
      <Label htmlFor={id} className="w-16 shrink-0 text-muted-foreground">
        {label}
      </Label>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (!next) onCommit()
            setOpen(next)
          }}
        >
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`${label} color`}
                className="checker relative size-8 shrink-0 overflow-hidden p-0"
              />
            }
          >
            {!none && (
              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background: mixed
                    ? 'conic-gradient(#f87171, #facc15, #4ade80, #60a5fa, #c084fc, #f87171)'
                    : value,
                }}
              />
            )}
            {none && (
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-destructive"
              />
            )}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="color-picker w-72 max-w-[calc(100vw-1rem)] gap-3 p-3"
            onKeyDown={(event) => {
              if (event.key.startsWith('Arrow')) event.stopPropagation()
            }}
          >
            <div className="flex items-center justify-between">
              <PopoverTitle>{label} color</PopoverTitle>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Close ${label.toLowerCase()} color picker`}
                onClick={() => {
                  onCommit()
                  setOpen(false)
                }}
              >
                <XIcon />
              </Button>
            </div>
            <HexAlphaColorPicker
              color={pickerColor}
              onChange={(next) => onPreview(attr, next)}
              onChangeEnd={(next) => {
                onPreview(attr, next)
                onCommit()
              }}
              aria-label={`${label} color controls`}
            />
            <ToggleGroup
              aria-label={`${label} color format`}
              value={[format]}
              onValueChange={(values) => {
                if (values[0]) setFormat(values[0] as ColorFormat)
              }}
              variant="outline"
              size="sm"
              spacing={0}
              className="w-full"
            >
              {COLOR_FORMATS.map((mode) => (
                <ToggleGroupItem
                  key={mode}
                  value={mode}
                  className="min-w-0 flex-1 px-1 text-[11px]"
                  aria-label={`${label} ${mode.toUpperCase()} format`}
                >
                  {mode.toUpperCase()}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {format !== 'hex' && (
              <ChannelInputs
                key={format}
                label={label}
                color={color ?? pickerColor}
                format={format}
                onApply={apply}
              />
            )}
            <ColorValueInput
              id={`${id}-value`}
              label={`${label} ${format.toUpperCase()} value`}
              color={color ?? ''}
              format={format}
              placeholder={mixed ? 'Mixed' : 'None'}
              onApply={apply}
            />
            {isOutsideSrgb(value) && (
              <p className="text-[11px] text-muted-foreground">
                Wide-gamut color. The visual picker shows its sRGB preview.
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">Paste HEX, RGB, HSL, or OKLCH.</p>
          </PopoverContent>
        </Popover>
        <ColorValueInput
          id={id}
          label={`${label} color value`}
          color={color ?? ''}
          format={color?.startsWith('oklch(') ? 'oklch' : 'hex'}
          placeholder={mixed ? 'Mixed' : 'None'}
          onApply={apply}
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${label.toLowerCase()}`}
                disabled={none}
                onClick={() => apply('none')}
              />
            }
          >
            <XIcon />
          </TooltipTrigger>
          <TooltipContent>Remove {label.toLowerCase()}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function ColorValueInput({
  id,
  label,
  color,
  format,
  placeholder,
  onApply,
}: {
  id: string
  label: string
  color: string
  format: ColorFormat
  placeholder?: string
  onApply: (color: string) => void
}) {
  const shown = formatColor(color, format)
  const [draft, setDraft] = useState(shown)
  const skipBlur = useRef(false)
  useEffect(() => setDraft(shown), [shown])
  const invalid = draft !== '' && normalizeColor(draft) === null

  function apply() {
    if (skipBlur.current) {
      skipBlur.current = false
      return
    }
    // Changing the format or focusing an approximation must not change a wide-gamut color.
    if (draft === shown) return
    const next = normalizeColor(draft)
    if (next) {
      onApply(next)
      setDraft(formatColor(next, format))
    }
  }

  return (
    <Input
      id={id}
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={apply}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          apply()
        }
        if (event.key === 'Escape' && draft !== shown) {
          event.stopPropagation()
          skipBlur.current = true
          setDraft(shown)
          event.currentTarget.blur()
        }
      }}
      aria-invalid={invalid || undefined}
      title={invalid ? 'Enter a valid HEX, RGB, HSL, or OKLCH color.' : shown || undefined}
      className="min-h-8 min-w-0 flex-1 font-mono text-[11px] placeholder:font-sans"
    />
  )
}

const CHANNELS = {
  rgb: [
    { label: 'R', name: 'Red', max: 255, step: 1 },
    { label: 'G', name: 'Green', max: 255, step: 1 },
    { label: 'B', name: 'Blue', max: 255, step: 1 },
  ],
  hsl: [
    { label: 'H°', name: 'Hue', max: 360, step: 1 },
    { label: 'S%', name: 'Saturation', max: 100, step: 1 },
    { label: 'L%', name: 'Lightness', max: 100, step: 1 },
  ],
  oklch: [
    { label: 'L%', name: 'Lightness', max: 100, step: 1 },
    { label: 'C', name: 'Chroma', max: undefined, step: 0.001 },
    { label: 'H°', name: 'Hue', max: 360, step: 1 },
  ],
}

function ChannelInputs({
  label,
  color,
  format,
  onApply,
}: {
  label: string
  color: string
  format: ChannelFormat
  onApply: (color: string) => void
}) {
  const [draft, setDraft] = useState(() => colorChannels(color, format))
  const dirty = useRef(false)
  const skipBlur = useRef(false)
  useEffect(() => {
    setDraft(colorChannels(color, format))
    dirty.current = false
  }, [color, format])
  const next = colorFromChannels(format, draft)

  function apply() {
    if (skipBlur.current) {
      skipBlur.current = false
      return
    }
    if (!dirty.current || !next) return
    onApply(next)
    dirty.current = false
    setDraft(colorChannels(next, format))
  }

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {[...CHANNELS[format], { label: 'A%', name: 'Alpha', max: 100, step: 1 }].map(
        (channel, index) => (
          <label key={channel.name} className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">{channel.label}</span>
            <Input
              type="number"
              inputMode="decimal"
              aria-label={`${label} ${format.toUpperCase()} ${channel.name.toLowerCase()}`}
              value={draft[index]}
              min={0}
              max={channel.max}
              step={channel.step}
              onChange={(event) => {
                dirty.current = true
                setDraft((values) =>
                  values.map((part, i) => (i === index ? event.target.value : part)),
                )
              }}
              onBlur={apply}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.stopPropagation()
                  apply()
                }
                if (event.key === 'Escape' && dirty.current) {
                  event.stopPropagation()
                  skipBlur.current = true
                  dirty.current = false
                  setDraft(colorChannels(color, format))
                  event.currentTarget.blur()
                }
              }}
              aria-invalid={(dirty.current && !next) || undefined}
              className="px-1 font-mono text-[11px] tabular-nums"
            />
          </label>
        ),
      )}
    </div>
  )
}
