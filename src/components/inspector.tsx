import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
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
  SunIcon,
  TargetIcon,
} from 'lucide-react'
import { PaintField } from '@/components/color-picker'
import type { CommandId } from '@/lib/commands'
import type { Selection } from '@/lib/editor'
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
      <Section title={selection ? selection.label : 'Selection'}>
        {selection ? (
          <>
            <SelectionTransform
              selection={selection}
              onBoundsChange={onBoundsChange}
              onRotate={onRotate}
            />
            <SelectionArrange
              count={selection.count}
              onAlign={onAlign}
              onDistribute={onDistribute}
              onCenterSelection={onCenterSelection}
            />
            <PaintField
              attr="fill"
              label="Fill"
              value={selection.fill}
              onPreview={onPreview}
              onCommit={onCommit}
            />
            <PaintField
              attr="stroke"
              label="Stroke"
              value={selection.stroke}
              onPreview={onPreview}
              onCommit={onCommit}
            />
            {selection.stroke !== 'none' && (
              <Field label="Stroke width" htmlFor="stroke-width">
                <Input
                  id="stroke-width"
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
                  className="w-20 tabular-nums"
                />
              </Field>
            )}
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
          </>
        ) : (
          <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
            <MousePointerClickIcon className="mt-0.5 size-4 shrink-0" />
            <p>Select an object on the canvas to change its fill, stroke, and opacity.</p>
          </div>
        )}
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
}: {
  selection: Selection
  onBoundsChange: InspectorProps['onBoundsChange']
  onRotate: InspectorProps['onRotate']
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
                size="sm"
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
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className="w-full"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <CommandShortcut command={command} />
      </TooltipContent>
    </Tooltip>
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
