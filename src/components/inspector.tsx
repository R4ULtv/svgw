import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignEndHorizontalIcon,
  AlignEndVerticalIcon,
  AlignHorizontalSpaceBetweenIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  AlignVerticalSpaceBetweenIcon,
  ArrowLeftRightIcon,
  ChevronDownIcon,
  Link2Icon,
  Link2OffIcon,
  MoonIcon,
  MousePointerClickIcon,
  RotateCwIcon,
  ScanIcon,
  SplinePointerIcon,
  SquareRoundCornerIcon,
  SunIcon,
  TargetIcon,
  TypeIcon,
} from 'lucide-react'
import { PaintField } from '@/components/color-picker'
import { DocumentColors } from '@/components/document-colors'
import { DocumentInfo } from '@/components/document-info'
import type { CommandId } from '@/lib/commands'
import type { ColorReplacement, DocumentColor } from '@/lib/document-colors'
import type { Selection, StyleTarget } from '@/lib/editor'
import type { ArtworkStats } from '@/lib/layers'
import type { Alignment, Bounds } from '@/lib/layers'
import type { SelectionStore } from '@/lib/selection-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CommandShortcut } from './commands'

export type Backdrop = 'checker' | 'checker-dark' | 'light' | 'dark'

interface InspectorProps {
  selectionStore: SelectionStore
  size: { w: number; h: number }
  backdrop: Backdrop
  onBackdropChange: (backdrop: Backdrop) => void
  /** Applies a live change; repeated previews of one attribute become a single undo step. */
  onPreview: (attr: string, value: string | number) => void
  onCommit: () => void
  /** Changes the canvas size as one undo step; the artwork keeps its position from the top-left corner. */
  onResize: (width: number, height: number) => void
  /** Crops the canvas to the visible artwork. */
  onFitToArtwork: () => void
  onCenterSelection: () => void
  /** Moves and scales the selection as a whole; returns false when nothing changed. */
  onBoundsChange: (next: Bounds) => boolean
  /** Rotates a single selected object; returns false when it could not. */
  onRotate: (angle: number) => boolean
  /** Aligns several objects with each other, or one with the artboard. */
  onAlign: (alignment: Alignment) => void
  /** Spaces three or more objects evenly. */
  onDistribute: (axis: 'horizontal' | 'vertical') => void
  /** Every color in the document, most used first. */
  colors: DocumentColor[]
  onReplaceColor: (from: string) => ColorReplacement | null
  /** Sets attributes on the selected rectangles, texts, or strokes; a null value removes one. */
  onStyleChange: (target: StyleTarget, values: Record<string, string | null>) => boolean
  /** Changes whenever the document does. */
  documentRevision: number
  /** The SVG as it would be exported, and what it contains; shown with nothing selected. */
  readDocument: () => { svg: string; stats: ArtworkStats } | null
  onOptimize: () => void
  /** Node editing is active; object properties return once it ends. */
  editingPath?: boolean
}

const backdrops: { value: Backdrop; label: string; icon?: typeof SunIcon }[] = [
  { value: 'checker', label: 'Light grid' },
  { value: 'checker-dark', label: 'Dark grid' },
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
]

export function Inspector({
  selectionStore,
  size,
  backdrop,
  onBackdropChange,
  onPreview,
  onCommit,
  onResize,
  onFitToArtwork,
  onCenterSelection,
  onBoundsChange,
  onRotate,
  onAlign,
  onDistribute,
  colors,
  onReplaceColor,
  onStyleChange,
  documentRevision,
  readDocument,
  onOptimize,
  editingPath = false,
}: InspectorProps) {
  const selection = useSyncExternalStore(
    selectionStore.subscribe,
    selectionStore.getSnapshot,
    selectionStore.getSnapshot,
  )
  const set = (attr: string, value: string | number) => {
    onPreview(attr, value)
    onCommit()
  }

  return (
    <div className="flex flex-col">
      {selection ? (
        <>
          <Section title={selection.label}>
            <SelectionTransform
              selection={selection}
              onBoundsChange={onBoundsChange}
              onRotate={onRotate}
              onStyleChange={onStyleChange}
            />
            <SelectionArrange
              count={selection.count}
              onAlign={onAlign}
              onDistribute={onDistribute}
              onCenterSelection={onCenterSelection}
            />
          </Section>

          {selection.fontFamily !== null && (
            <Section title="Typography">
              <TextFields selection={selection} onStyleChange={onStyleChange} />
            </Section>
          )}

          <Section title="Appearance">
            <PaintField
              attr="fill"
              label="Fill"
              value={selection.fill}
              onPreview={onPreview}
              onCommit={onCommit}
            />
            <Field label="Opacity">
              <div className="flex flex-1 items-center gap-3">
                <Slider
                  aria-label="Opacity"
                  value={[selection.opacity]}
                  min={0}
                  max={100}
                  onValueChange={(value) =>
                    onPreview('opacity', (Array.isArray(value) ? value[0] : value) / 100)
                  }
                  onValueCommitted={onCommit}
                />
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                  {selection.opacity}%
                </span>
              </div>
            </Field>
            {selection.opacity < 100 && (
              <Button
                variant="link"
                size="xs"
                className="-mt-1 self-start px-0 text-muted-foreground"
                onClick={() => set('opacity', 1)}
              >
                Reset opacity
              </Button>
            )}
          </Section>

          <Section title="Stroke">
            <PaintField
              attr="stroke"
              label="Stroke"
              fieldLabel="Color"
              value={selection.stroke}
              onPreview={onPreview}
              onCommit={onCommit}
            />
            {selection.stroke !== 'none' && (
              <StrokeFields
                selection={selection}
                onPreview={onPreview}
                onCommit={onCommit}
                onStyleChange={onStyleChange}
              />
            )}
          </Section>
        </>
      ) : (
        <Section title="Document">
          <DocumentInfo revision={documentRevision} read={readDocument} onOptimize={onOptimize} />
          <div className="flex items-start gap-2.5 text-[11px] leading-relaxed text-muted-foreground">
            {editingPath ? (
              <>
                <SplinePointerIcon className="mt-0.5 size-3.5 shrink-0" />
                <p>Editing path nodes. Choose Done to edit this path's colors and style.</p>
              </>
            ) : (
              <>
                <MousePointerClickIcon className="mt-0.5 size-3.5 shrink-0" />
                <p>Select an object to edit its position, colors, and style.</p>
              </>
            )}
          </div>
        </Section>
      )}

      <Section title="Colors">
        <DocumentColors
          colors={colors}
          selection={selection}
          onApply={set}
          onReplace={onReplaceColor}
        />
      </Section>

      <Section title="Canvas">
        <CanvasSize size={size} onResize={onResize} onFitToArtwork={onFitToArtwork} />
        <Field label="Preview on">
          <ToggleGroup
            value={[backdrop]}
            onValueChange={(value) => {
              if (value[0]) onBackdropChange(value[0] as Backdrop)
            }}
            variant="outline"
            spacing={0}
            size="sm"
          >
            {backdrops.map(({ value, label, icon: Icon }) => (
              <Tooltip key={value}>
                <TooltipTrigger
                  render={<ToggleGroupItem value={value} aria-label={`${label} background`} />}
                >
                  {Icon ? (
                    <Icon />
                  ) : (
                    <span
                      aria-hidden="true"
                      data-backdrop={value}
                      className="preview-grid size-4 border border-black/10"
                    />
                  )}
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
        </Field>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The preview background is not part of your SVG.
        </p>
      </Section>
    </div>
  )
}

const PRESETS = [
  { label: 'Icon', w: 24, h: 24 },
  { label: 'App icon', w: 512, h: 512 },
  { label: 'Social post', w: 1080, h: 1080 },
  { label: 'Story', w: 1080, h: 1920 },
  { label: 'HD screen', w: 1920, h: 1080 },
  { label: 'A4 (72 ppi)', w: 595, h: 842 },
  { label: 'US Letter (72 ppi)', w: 612, h: 792 },
]

const MAX_SIZE = 20000

function CanvasSize({
  size,
  onResize,
  onFitToArtwork,
}: Pick<InspectorProps, 'size' | 'onResize' | 'onFitToArtwork'>) {
  const [linked, setLinked] = useState(false)

  function commit(changed: 'w' | 'h', input: number) {
    const value = Math.round(input)
    if (value < 1 || value > MAX_SIZE) return false
    let width = changed === 'w' ? value : size.w
    let height = changed === 'h' ? value : size.h
    if (linked) {
      if (changed === 'w') height = Math.max(1, Math.round((value * size.h) / size.w))
      else width = Math.max(1, Math.round((value * size.w) / size.h))
    }
    if (width === size.w && height === size.h) return false
    onResize(width, height)
    return true
  }

  return (
    <>
      <div className="flex items-center gap-1.5" role="group" aria-label="Canvas size">
        <NumberField
          label="Canvas width"
          prefix="W"
          unit="px"
          value={size.w}
          min={1}
          max={MAX_SIZE}
          onCommit={(value) => commit('w', value)}
        />
        <NumberField
          label="Canvas height"
          prefix="H"
          unit="px"
          value={size.h}
          min={1}
          max={MAX_SIZE}
          onCommit={(value) => commit('h', value)}
        />
        <ProportionsToggle linked={linked} onLinkedChange={setLinked} />
      </div>
      <div className="flex gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="flex-1 justify-between font-normal" />
            }
          >
            Presets
            <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {PRESETS.map((preset) => (
              <DropdownMenuItem key={preset.label} onClick={() => onResize(preset.w, preset.h)}>
                {preset.label}
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {preset.w} × {preset.h}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Swap width and height"
                disabled={size.w === size.h}
                onClick={() => onResize(size.h, size.w)}
              />
            }
          >
            <ArrowLeftRightIcon />
          </TooltipTrigger>
          <TooltipContent>Swap width and height</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Fit canvas to artwork"
                onClick={onFitToArtwork}
              />
            }
          >
            <ScanIcon />
          </TooltipTrigger>
          <TooltipContent>Fit canvas to artwork</TooltipContent>
        </Tooltip>
      </div>
    </>
  )
}

/**
 * Position, size, and rotation of the selection. Values are the selection's bounds in document
 * px, without strokes, so they match the artboard size and the guides.
 */
function SelectionTransform({
  selection,
  onBoundsChange,
  onRotate,
  onStyleChange,
}: {
  selection: Selection
  onBoundsChange: InspectorProps['onBoundsChange']
  onRotate: InspectorProps['onRotate']
  onStyleChange: InspectorProps['onStyleChange']
}) {
  const [linked, setLinked] = useState(false)
  const { x, y, width, height, rotation } = selection
  if (x === null || y === null || width === null || height === null) return null
  const bounds = { x, y, width, height }

  function resize(axis: 'width' | 'height', value: number) {
    const next = { ...bounds, [axis]: value }
    if (linked && bounds.width > 0 && bounds.height > 0) {
      if (axis === 'width') next.height = (value * bounds.height) / bounds.width
      else next.width = (value * bounds.width) / bounds.height
    }
    return onBoundsChange(next)
  }

  return (
    <div
      className="grid grid-cols-[1fr_1fr_auto] items-center gap-1.5"
      role="group"
      aria-label="Transform"
    >
      <NumberField
        label="X position"
        prefix="X"
        value={x}
        onCommit={(value) => onBoundsChange({ ...bounds, x: value })}
      />
      <NumberField
        label="Y position"
        prefix="Y"
        value={y}
        onCommit={(value) => onBoundsChange({ ...bounds, y: value })}
      />
      <span aria-hidden="true" className="w-7" />
      <NumberField
        label="Width"
        prefix="W"
        value={width}
        min={0}
        disabled={width === 0}
        onCommit={(value) => value > 0 && resize('width', value)}
      />
      <NumberField
        label="Height"
        prefix="H"
        value={height}
        min={0}
        disabled={height === 0}
        onCommit={(value) => value > 0 && resize('height', value)}
      />
      <ProportionsToggle linked={linked} onLinkedChange={setLinked} />
      {rotation !== null && (
        <NumberField
          label="Rotation"
          prefix={<RotateCwIcon className="size-3" />}
          unit="°"
          value={rotation}
          // Wraps to the range SVG-Edit's rotation handle uses, -180° to 180°.
          onCommit={(value) => onRotate(((((value + 180) % 360) + 360) % 360) - 180)}
        />
      )}
      {selection.radius !== null && (
        <NumberField
          label="Corner radius"
          prefix={<SquareRoundCornerIcon className="size-3" />}
          value={selection.radius}
          min={0}
          onCommit={(value) =>
            onStyleChange(
              'rect',
              value > 0 ? { rx: String(value), ry: String(value) } : { rx: null, ry: null },
            )
          }
        />
      )}
    </div>
  )
}

const alignments: {
  value: Alignment
  label: string
  command: CommandId
  icon: typeof AlignStartVerticalIcon
}[] = [
  {
    value: 'left',
    label: 'Align left',
    command: 'selection.alignLeft',
    icon: AlignStartVerticalIcon,
  },
  {
    value: 'center',
    label: 'Align horizontal centers',
    command: 'selection.alignCenter',
    icon: AlignCenterVerticalIcon,
  },
  {
    value: 'right',
    label: 'Align right',
    command: 'selection.alignRight',
    icon: AlignEndVerticalIcon,
  },
  {
    value: 'top',
    label: 'Align top',
    command: 'selection.alignTop',
    icon: AlignStartHorizontalIcon,
  },
  {
    value: 'middle',
    label: 'Align vertical centers',
    command: 'selection.alignMiddle',
    icon: AlignCenterHorizontalIcon,
  },
  {
    value: 'bottom',
    label: 'Align bottom',
    command: 'selection.alignBottom',
    icon: AlignEndHorizontalIcon,
  },
]

/** Align, distribute, and center. A single object aligns with the artboard. */
function SelectionArrange({
  count,
  onAlign,
  onDistribute,
  onCenterSelection,
}: {
  count: number
  onAlign: InspectorProps['onAlign']
  onDistribute: InspectorProps['onDistribute']
  onCenterSelection: InspectorProps['onCenterSelection']
}) {
  const target = count === 1 ? ' to artboard' : ''
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label="Arrange">
      <div className="grid grid-cols-6">
        {alignments.map(({ value, label, command, icon: Icon }) => (
          <ArrangeButton
            key={value}
            label={label + target}
            command={command}
            onClick={() => onAlign(value)}
          >
            <Icon />
          </ArrangeButton>
        ))}
      </div>
      <div className="grid grid-cols-6">
        <ArrangeButton
          label="Distribute horizontal spacing"
          command="selection.distributeHorizontal"
          disabled={count < 3}
          onClick={() => onDistribute('horizontal')}
        >
          <AlignHorizontalSpaceBetweenIcon />
        </ArrangeButton>
        <ArrangeButton
          label="Distribute vertical spacing"
          command="selection.distributeVertical"
          disabled={count < 3}
          onClick={() => onDistribute('vertical')}
        >
          <AlignVerticalSpaceBetweenIcon />
        </ArrangeButton>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                className="col-span-4 ml-1.5 font-normal"
                onClick={onCenterSelection}
              />
            }
          >
            <TargetIcon />
            Center on artboard
          </TooltipTrigger>
          <TooltipContent>
            Center on artboard
            <CommandShortcut command="selection.center" />
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

/** One segment of a joined row of outline icon buttons, with its shortcut in the tooltip. */
function ArrangeButton({
  label,
  command,
  disabled,
  onClick,
  children,
}: {
  label: string
  command: CommandId
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      {/* Wrapper keeps the tooltip available while the button is disabled. */}
      <TooltipTrigger render={<span className="inline-flex [&:not(:first-child)]:-ml-px" />}>
        <Button
          variant="outline"
          size="icon"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className="w-full"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {disabled ? `${label} (select 3 or more objects)` : label}
        <CommandShortcut command={command} />
      </TooltipContent>
    </Tooltip>
  )
}

const caps = [
  { value: 'butt', label: 'Flat' },
  { value: 'round', label: 'Round' },
  { value: 'square', label: 'Square' },
]
const joins = [
  { value: 'miter', label: 'Miter' },
  { value: 'round', label: 'Round' },
  { value: 'bevel', label: 'Bevel' },
]

/** Line caps, joins, and dashes of the selection's strokes. */
function StrokeFields({
  selection,
  onPreview,
  onCommit,
  onStyleChange,
}: {
  selection: Selection
  onPreview: InspectorProps['onPreview']
  onCommit: InspectorProps['onCommit']
  onStyleChange: InspectorProps['onStyleChange']
}) {
  const id = useId()
  return (
    <>
      <Field label="Width" htmlFor={`${id}-width`}>
        <div className="relative min-w-0 flex-1">
          {/* Typing previews live; Enter or leaving the field records one undo step. */}
          <Input
            id={`${id}-width`}
            type="number"
            min={0}
            step={0.5}
            value={selection.strokeWidth}
            onChange={(event) => {
              if (event.target.value !== '' && Number(event.target.value) >= 0)
                onPreview('stroke-width', Number(event.target.value))
            }}
            onBlur={onCommit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onCommit()
            }}
            className="pr-7 tabular-nums"
          />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">
            px
          </span>
        </div>
      </Field>
      <Field label="Cap">
        <Choice
          label="Line cap"
          options={caps}
          value={selection.strokeLinecap}
          onChange={(value) =>
            // Flat is the default; leave it implicit.
            onStyleChange('stroke', { 'stroke-linecap': value === 'butt' ? null : value })
          }
        />
      </Field>
      <Field label="Join">
        <Choice
          label="Line join"
          options={joins}
          value={selection.strokeLinejoin}
          onChange={(value) =>
            onStyleChange('stroke', { 'stroke-linejoin': value === 'miter' ? null : value })
          }
        />
      </Field>
      <Field label="Dashes" htmlFor={id}>
        <TextField
          id={id}
          value={selection.strokeDasharray === 'none' ? '' : selection.strokeDasharray}
          placeholder="Solid, or e.g. 6 3"
          title="Dash and gap lengths in px, repeating. Leave empty for a solid line."
          parse={(text) => {
            if (!text.trim()) return ''
            const parts = text
              .trim()
              .split(/[\s,]+/)
              .map(Number)
            return parts.every((part) => Number.isFinite(part) && part >= 0) &&
              parts.some((part) => part > 0)
              ? parts.join(' ')
              : null
          }}
          onCommit={(value) => onStyleChange('stroke', { 'stroke-dasharray': value || null })}
        />
      </Field>
    </>
  )
}

const FONTS = [
  'sans-serif',
  'serif',
  'monospace',
  'system-ui',
  'Arial',
  'Helvetica',
  'Verdana',
  'Georgia',
  'Times New Roman',
  'Courier New',
]

/** Font family, size, and weight of the selected texts. */
function TextFields({
  selection,
  onStyleChange,
}: {
  selection: Selection
  onStyleChange: InspectorProps['onStyleChange']
}) {
  const id = useId()
  return (
    <>
      <Field label="Font" htmlFor={id}>
        <TextField
          id={id}
          value={selection.fontFamily ?? ''}
          placeholder="sans-serif"
          title="Viewers need this font installed; generic families such as sans-serif always work."
          list={`${id}-fonts`}
          parse={(text) => text.trim() || null}
          onCommit={(value) => onStyleChange('text', { 'font-family': value })}
        />
        <datalist id={`${id}-fonts`}>
          {FONTS.map((font) => (
            <option key={font} value={font} />
          ))}
        </datalist>
      </Field>
      <Field label="Size">
        <NumberField
          label="Font size"
          prefix={<TypeIcon className="size-3" />}
          unit="px"
          value={selection.fontSize ?? 16}
          min={0.5}
          onCommit={(value) => onStyleChange('text', { 'font-size': String(value) })}
        />
      </Field>
      <Field label="Weight">
        <Choice
          label="Font weight"
          options={[
            { value: '400', label: 'Regular' },
            { value: '700', label: 'Bold' },
          ]}
          value={String(selection.fontWeight)}
          onChange={(value) =>
            onStyleChange('text', { 'font-weight': value === '400' ? null : 'bold' })
          }
        />
      </Field>
    </>
  )
}

/** A joined row of text buttons choosing one value. */
function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(values) => {
        if (values[0] && values[0] !== value) onChange(values[0])
      }}
      variant="outline"
      spacing={0}
      className="w-full"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          // The muted background alone barely shows in dark mode; the text color marks the choice.
          className="min-w-0 flex-1 px-1 text-[11px] font-normal text-muted-foreground aria-pressed:font-medium aria-pressed:text-foreground"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/**
 * A text input that applies on Enter or blur and restores the current value on Escape. `parse`
 * returns the value to apply, or null when the text is invalid.
 */
function TextField({
  id,
  value,
  placeholder,
  title,
  list,
  parse,
  onCommit,
}: {
  id: string
  value: string
  placeholder?: string
  title?: string
  list?: string
  parse: (text: string) => string | null
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const cancelling = useRef(false)
  useEffect(() => setDraft(value), [value])
  const invalid = parse(draft) === null

  function apply() {
    const next = parse(draft)
    if (next === null || next === value) setDraft(value)
    else onCommit(next)
  }

  return (
    <Input
      id={id}
      value={draft}
      placeholder={placeholder}
      title={title}
      list={list}
      spellCheck={false}
      autoComplete="off"
      aria-invalid={(draft !== value && invalid) || undefined}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (cancelling.current) cancelling.current = false
        else if (draft !== value) apply()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') apply()
        if (event.key === 'Escape') {
          cancelling.current = true
          setDraft(value)
          event.currentTarget.blur()
        }
      }}
      className="min-w-0 flex-1 text-xs"
    />
  )
}

function ProportionsToggle({
  linked,
  onLinkedChange,
}: {
  linked: boolean
  onLinkedChange: (linked: boolean) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Keep proportions"
            aria-pressed={linked}
            onClick={() => onLinkedChange(!linked)}
            className={cn(linked && 'bg-muted text-foreground')}
          />
        }
      >
        {linked ? <Link2Icon /> : <Link2OffIcon />}
      </TooltipTrigger>
      <TooltipContent>{linked ? 'Proportions locked' : 'Keep proportions'}</TooltipContent>
    </Tooltip>
  )
}

/** Rounds for display: two decimals, and never "-0". */
const formatNumber = (value: number) => String(Math.round(value * 100) / 100 || 0)

/**
 * A compact number input that applies on Enter or blur. Arrow keys apply a step of 1, or 10 with
 * Shift; Escape restores the current value. `onCommit` returns false when nothing changed.
 */
function NumberField({
  label,
  prefix,
  unit,
  value,
  min = -Infinity,
  max = Infinity,
  disabled,
  onCommit,
}: {
  label: string
  prefix: ReactNode
  unit?: string
  value: number
  min?: number
  max?: number
  disabled?: boolean
  onCommit: (value: number) => boolean
}) {
  const shown = formatNumber(value)
  const [draft, setDraft] = useState(shown)
  // Escape blurs the input before the restored draft renders; the blur must not apply the old one.
  const cancelling = useRef(false)
  useEffect(() => setDraft(shown), [shown])

  function apply(next: number) {
    if (Number.isFinite(next) && next >= min && next <= max && onCommit(next))
      setDraft(formatNumber(next))
    else setDraft(shown)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute top-1/2 left-2 flex -translate-y-1/2 text-[10px] text-muted-foreground uppercase">
        {prefix}
      </span>
      <Input
        aria-label={label}
        title={label}
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d.-]/g, ''))}
        onBlur={() => {
          if (cancelling.current) cancelling.current = false
          else if (draft !== shown) apply(draft === '' ? NaN : Number(draft))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') apply(draft === '' ? NaN : Number(draft))
          if (event.key === 'Escape') {
            cancelling.current = true
            setDraft(shown)
            event.currentTarget.blur()
          }
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            const step = (event.shiftKey ? 10 : 1) * (event.key === 'ArrowUp' ? 1 : -1)
            apply(Math.min(max, Math.max(min, (Number(draft) || 0) + step)))
          }
        }}
        className={cn('pl-6 tabular-nums', unit ? 'pr-7' : 'pr-2')}
      />
      {unit && (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">
          {unit}
        </span>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b p-4">
      <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <Label htmlFor={htmlFor} className="w-16 shrink-0 text-muted-foreground">
        {label}
      </Label>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">{children}</div>
    </div>
  )
}
