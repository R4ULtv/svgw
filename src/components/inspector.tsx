import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  ArrowLeftRightIcon,
  ChevronDownIcon,
  Grid2x2Icon,
  Link2Icon,
  Link2OffIcon,
  MoonIcon,
  MousePointerClickIcon,
  ScanIcon,
  SunIcon,
} from 'lucide-react'
import { PaintField } from '@/components/color-picker'
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

export type Backdrop = 'checker' | 'light' | 'dark'

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
}

const backdrops: { value: Backdrop; label: string; icon: typeof SunIcon }[] = [
  { value: 'checker', label: 'Transparent', icon: Grid2x2Icon },
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
                  <Icon />
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
  const [draft, setDraft] = useState({ w: String(size.w), h: String(size.h) })
  const [linked, setLinked] = useState(false)
  useEffect(() => setDraft({ w: String(size.w), h: String(size.h) }), [size.w, size.h])

  function commit(changed: 'w' | 'h') {
    const value = Math.round(Number(draft[changed]))
    if (!Number.isFinite(value) || value < 1 || value > MAX_SIZE) {
      setDraft({ w: String(size.w), h: String(size.h) })
      return
    }
    let width = changed === 'w' ? value : size.w
    let height = changed === 'h' ? value : size.h
    if (linked) {
      if (changed === 'w') height = Math.max(1, Math.round((value * size.h) / size.w))
      else width = Math.max(1, Math.round((value * size.w) / size.h))
    }
    if (width !== size.w || height !== size.h) onResize(width, height)
    else setDraft({ w: String(size.w), h: String(size.h) })
  }

  const dimension = (axis: 'w' | 'h') => (
    <div className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[10px] text-muted-foreground uppercase">
        {axis}
      </span>
      <Input
        aria-label={axis === 'w' ? 'Canvas width' : 'Canvas height'}
        inputMode="numeric"
        value={draft[axis]}
        onChange={(event) =>
          setDraft({ ...draft, [axis]: event.target.value.replace(/[^\d.]/g, '') })
        }
        onBlur={() => commit(axis)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(axis)
          if (event.key === 'Escape') {
            setDraft({ w: String(size.w), h: String(size.h) })
            event.currentTarget.blur()
          }
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            const step = event.shiftKey ? 10 : 1
            const next = Math.min(
              MAX_SIZE,
              Math.max(1, Number(draft[axis]) + (event.key === 'ArrowUp' ? step : -step)),
            )
            setDraft({ ...draft, [axis]: String(next) })
          }
        }}
        className="pr-7 pl-6 tabular-nums"
      />
      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">
        px
      </span>
    </div>
  )

  return (
    <>
      <div className="flex items-center gap-1.5" role="group" aria-label="Canvas size">
        {dimension('w')}
        {dimension('h')}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Keep proportions"
                aria-pressed={linked}
                onClick={() => setLinked(!linked)}
                className={cn(linked && 'bg-muted text-foreground')}
              />
            }
          >
            {linked ? <Link2Icon /> : <Link2OffIcon />}
          </TooltipTrigger>
          <TooltipContent>{linked ? 'Proportions locked' : 'Keep proportions'}</TooltipContent>
        </Tooltip>
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
