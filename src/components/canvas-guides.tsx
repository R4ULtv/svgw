import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react'
import { LockIcon, LockOpenIcon, Trash2Icon, XIcon } from 'lucide-react'
import type { SvgEditor } from '@/lib/editor'
import { createFrameTask } from '@/lib/frame-task'
import {
  guideHitAreas,
  pointOnArtboard,
  rulerSteps,
  type Axis,
  type Guides,
  type GuideView as View,
} from '@/lib/guides'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useTheme } from './theme'

/** Ruler thickness in CSS pixels. */
export const RULER = 20

interface Drag {
  axis: Axis
  /** Index of the guide being moved, or null while creating one from a ruler. */
  index: number | null
  value: number
  /** Pointer position in overlay coordinates, for the value label. */
  px: number
  py: number
  /** Released here, the guide is deleted (or not created). */
  removing: boolean
  /** Guide placement is allowed only on the pasteboard outside the artboard. */
  onArtboard: boolean
}

interface DragHandlers {
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onPointerCancel: () => void
  onLostPointerCapture: () => void
}

interface CanvasGuidesProps {
  editor: SvgEditor | null
  /** The scrolling element that contains the artboard. */
  viewport: RefObject<HTMLDivElement | null>
  revision: number
  size: { w: number; h: number }
  guides: Guides
  onGuidesChange: (guides: Guides) => void
  showRulers: boolean
  showGuides: boolean
  locked: boolean
  onLockedChange: (locked: boolean) => void
  /** Lines currently snapped to while dragging on the canvas. */
  snapped: { x: number | null; y: number | null }
}

/**
 * Rulers along the top and left of the canvas area and guides across it, as in Illustrator:
 * add and move guides on the pasteboard outside the artboard; drop on a ruler to delete.
 * Guide lines across the artboard stay visible without intercepting artwork interactions.
 */
export function CanvasGuides({
  editor,
  viewport,
  revision,
  size,
  guides,
  onGuidesChange,
  showRulers,
  showGuides,
  locked,
  onLockedChange,
  snapped,
}: CanvasGuidesProps) {
  const overlay = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)

  const measure = useCallback(() => {
    const content = editor?.getSvgContent()
    const ctm = content?.getScreenCTM()
    const rect = overlay.current?.getBoundingClientRect()
    if (!ctm || !rect) return
    const next = {
      ox: ctm.e - rect.left,
      oy: ctm.f - rect.top,
      scale: ctm.a || 1,
      width: rect.width,
      height: rect.height,
    }
    setView((current) =>
      current &&
      (Object.keys(next) as (keyof View)[]).every(
        (key) => Math.abs(current[key] - next[key]) < 0.01,
      )
        ? current
        : next,
    )
  }, [editor])

  useLayoutEffect(measure, [measure, revision, size.w, size.h, showRulers])
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const task = createFrameTask(measure)
    element.addEventListener('scroll', task.schedule, { passive: true })
    const observer = new ResizeObserver(task.schedule)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', task.schedule)
      observer.disconnect()
      task.cancel()
    }
  }, [measure, viewport])

  function pointerState(
    axis: Axis,
    event: PointerEvent,
  ): Pick<Drag, 'value' | 'px' | 'py' | 'removing' | 'onArtboard'> {
    const rect = overlay.current!.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    const value = view ? (axis === 'x' ? px - view.ox : py - view.oy) / view.scale : 0
    // Vertical guides go back to the left ruler, horizontal ones to the top ruler, or anywhere off the canvas area.
    const offCanvas = px < 0 || py < 0 || px > rect.width || py > rect.height
    const onRuler = showRulers && (axis === 'x' ? px < RULER : py < RULER)
    return {
      value: Math.round(value),
      px,
      py,
      removing: offCanvas || onRuler,
      onArtboard: !!view && pointOnArtboard(view, size, px, py),
    }
  }

  function dragHandlers(axis: Axis, index: number | null): DragHandlers {
    return {
      onPointerDown: (event: PointerEvent) => {
        if (event.button !== 0 || (index !== null && locked)) return
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        setDrag({ axis, index, ...pointerState(axis, event) })
      },
      onPointerMove: (event: PointerEvent) => {
        if (!drag || drag.axis !== axis || drag.index !== index) return
        setDrag({ ...drag, ...pointerState(axis, event) })
      },
      onPointerUp: (event: PointerEvent) => {
        if (!drag || drag.axis !== axis || drag.index !== index) return
        const { value, removing, onArtboard } = pointerState(axis, event)
        if (onArtboard && !removing) {
          setDrag(null)
          return
        }
        const next: Guides = { x: [...guides.x], y: [...guides.y] }
        if (index !== null) next[axis].splice(index, 1)
        if (!removing) next[axis].push(value)
        if (index !== null || !removing) onGuidesChange(next)
        setDrag(null)
      },
      onPointerCancel: () => setDrag(null),
      // Capture can end without a pointerup (window blur, element removed); never leave a drag hanging.
      onLostPointerCapture: () => setDrag(null),
    }
  }

  // Whole pixels keep 1px guide lines crisp at any zoom instead of blurring across two pixels.
  const position = (axis: Axis, value: number) =>
    view ? Math.round((axis === 'x' ? view.ox : view.oy) + value * view.scale) : -100
  const hiddenWhileDragging = (axis: Axis, index: number) =>
    drag?.axis === axis && drag.index === index

  return (
    <div
      ref={overlay}
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
      data-guides-overlay
    >
      {showGuides &&
        (['x', 'y'] as const).flatMap((axis) =>
          guides[axis].map((value, index) => (
            <ContextMenu key={`${axis}-${index}`}>
              <ContextMenuTrigger
                render={
                  <div
                    role="separator"
                    aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
                    aria-label={`${axis === 'x' ? 'Vertical' : 'Horizontal'} guide at ${value}`}
                    {...dragHandlers(axis, index)}
                    className={cn(
                      'group/guide pointer-events-none absolute flex touch-none select-none justify-center',
                      axis === 'x' ? 'inset-y-0 w-[7px] flex-row' : 'inset-x-0 h-[7px] flex-col',
                    )}
                    // The 7px hit area is offset by 3px so its center pixel is the guide's pixel.
                    style={
                      axis === 'x'
                        ? { left: position('x', value) - 3 }
                        : { top: position('y', value) - 3 }
                    }
                  />
                }
              >
                {!locked &&
                  view &&
                  guideHitAreas(axis, position(axis, value), view, size).map((area, hit) => (
                    <span
                      key={hit}
                      data-guide-hit-area
                      className={cn(
                        'pointer-events-auto absolute',
                        axis === 'x' ? 'cursor-col-resize' : 'cursor-row-resize',
                      )}
                      style={{
                        left: area.left - (axis === 'x' ? position(axis, value) - 3 : 0),
                        top: area.top - (axis === 'y' ? position(axis, value) - 3 : 0),
                        width: area.width,
                        height: area.height,
                      }}
                    />
                  ))}
                {/* Keep the capture target mounted until release; only hide its original line. */}
                <span
                  className={cn(
                    'bg-cyan-500 dark:bg-cyan-400',
                    axis === 'x' ? 'w-px' : 'h-px',
                    !locked && 'group-hover/guide:bg-cyan-600 dark:group-hover/guide:bg-cyan-300',
                    snapped[axis] === value && 'bg-fuchsia-500 dark:bg-fuchsia-400',
                    hiddenWhileDragging(axis, index) && 'opacity-0',
                  )}
                />
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                <ContextMenuItem
                  onClick={() =>
                    onGuidesChange({
                      ...guides,
                      [axis]: guides[axis].filter((_, item) => item !== index),
                    })
                  }
                >
                  <XIcon />
                  Delete guide
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onLockedChange(!locked)}>
                  {locked ? <LockOpenIcon /> : <LockIcon />}
                  {locked ? 'Unlock guides' : 'Lock guides'}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => onGuidesChange({ x: [], y: [] })}
                >
                  <Trash2Icon />
                  Clear all guides
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )),
        )}

      {/* Snapping to the artboard's edges and center, which are not user guides. */}
      {(['x', 'y'] as const).map((axis) => {
        const value = snapped[axis]
        if (value === null || (showGuides && guides[axis].includes(value))) return null
        return (
          <span
            key={axis}
            className={cn(
              'absolute bg-fuchsia-500 dark:bg-fuchsia-400',
              axis === 'x' ? 'inset-y-0 w-px' : 'inset-x-0 h-px',
            )}
            style={axis === 'x' ? { left: position('x', value) } : { top: position('y', value) }}
          />
        )
      })}

      {drag && (
        <>
          <span
            className={cn(
              'absolute',
              (drag.removing || drag.onArtboard) && 'opacity-40',
              drag.axis === 'x' ? 'inset-y-0 w-px' : 'inset-x-0 h-px',
              'bg-cyan-500 dark:bg-cyan-400',
            )}
            style={
              drag.axis === 'x'
                ? { left: position('x', drag.value) }
                : { top: position('y', drag.value) }
            }
          />
          <span
            className="absolute z-10 bg-foreground px-1.5 py-0.5 text-[10px] text-background tabular-nums"
            style={{ left: drag.px + 12, top: drag.py + 12 }}
          >
            {drag.removing
              ? drag.index === null
                ? 'Release to cancel'
                : 'Release to delete'
              : drag.onArtboard
                ? 'Release outside the artboard'
                : `${drag.axis === 'x' ? 'X' : 'Y'} ${drag.value}`}
          </span>
        </>
      )}

      {showRulers && view && (
        <>
          <Ruler axis="x" view={view} length={size.w} handlers={dragHandlers('y', null)} />
          <Ruler axis="y" view={view} length={size.h} handlers={dragHandlers('x', null)} />
          <span className="pointer-events-auto absolute top-0 left-0 grid size-5 place-items-center border-r border-b bg-muted text-[8px] text-muted-foreground">
            px
          </span>
        </>
      )}
    </div>
  )
}

/**
 * One ruler: the top ruler measures x and creates horizontal guides; the left ruler measures y
 * and creates vertical guides, as in Illustrator.
 */
function Ruler({
  axis,
  view,
  length,
  handlers,
}: {
  axis: 'x' | 'y'
  view: View
  length: number
  handlers: DragHandlers
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const { resolved } = useTheme()
  const [bounds, setBounds] = useState({ width: 0, height: 0 })

  // Redraw when the ruler itself resizes, not only when the view moves.
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const ratio = window.devicePixelRatio || 1
    const { width, height } = element.getBoundingClientRect()
    element.width = Math.round(width * ratio)
    element.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)

    const style = getComputedStyle(element)
    const root = getComputedStyle(document.documentElement)
    const horizontal = axis === 'x'
    const span = horizontal ? width : height
    const thickness = horizontal ? height : width
    // The canvas starts after the corner square, so shift the artboard origin into its coordinates.
    const origin = (horizontal ? view.ox : view.oy) - RULER

    // The artboard's extent reads lighter, like Illustrator's ruler.
    context.fillStyle = root.getPropertyValue('--background')
    if (horizontal) context.fillRect(origin, 0, length * view.scale, thickness)
    else context.fillRect(0, origin, thickness, length * view.scale)

    const { major, minor } = rulerSteps(view.scale)
    context.strokeStyle = style.color
    context.fillStyle = style.color
    context.lineWidth = 1
    context.font = '9px ui-sans-serif, system-ui, sans-serif'
    context.textBaseline = 'top'
    const first = Math.floor(-origin / view.scale / minor) * minor
    context.beginPath()
    for (let value = first; origin + value * view.scale <= span; value += minor) {
      const at = Math.round(origin + value * view.scale) + 0.5
      const isMajor = Math.abs(value / major - Math.round(value / major)) < 1e-6
      const tick = isMajor
        ? thickness
        : Math.abs(value / (major / 2) - Math.round(value / (major / 2))) < 1e-6
          ? thickness * 0.45
          : thickness * 0.25
      if (horizontal) {
        context.moveTo(at, thickness)
        context.lineTo(at, thickness - tick)
      } else {
        context.moveTo(thickness, at)
        context.lineTo(thickness - tick, at)
      }
      if (isMajor) {
        const label = String(Math.round(value))
        if (horizontal) context.fillText(label, at + 3, 2)
        else {
          context.save()
          context.translate(2, at - 3)
          context.rotate(-Math.PI / 2)
          context.fillText(label, 0, 0)
          context.restore()
        }
      }
    }
    context.stroke()
  }, [axis, view, length, resolved, bounds])

  return (
    <canvas
      ref={canvas}
      aria-label={
        axis === 'x'
          ? 'Horizontal ruler. Drag onto the pasteboard outside the artboard to add a horizontal guide.'
          : 'Vertical ruler. Drag onto the pasteboard outside the artboard to add a vertical guide.'
      }
      {...handlers}
      className={cn(
        'pointer-events-auto absolute touch-none select-none bg-muted text-muted-foreground',
        // Canvases keep their intrinsic size unless width and height are set explicitly.
        axis === 'x'
          ? 'top-0 left-5 h-5 w-[calc(100%-1.25rem)] cursor-s-resize border-b'
          : 'top-5 left-0 h-[calc(100%-1.25rem)] w-5 cursor-e-resize border-r',
      )}
    />
  )
}
