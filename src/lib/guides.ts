/**
 * Illustrator-style ruler guides. Positions are in document units (the SVG's user space).
 * `x` holds vertical guides (an x position each), `y` horizontal ones. Guides belong to the
 * project, not the SVG, so exported files stay clean.
 */
export interface Guides {
  x: number[]
  y: number[]
}

export type Axis = keyof Guides

export interface GuideView {
  /** Artboard origin relative to the guide overlay, in CSS pixels. */
  ox: number
  oy: number
  /** CSS pixels per document unit. */
  scale: number
  width: number
  height: number
}

export function pointOnArtboard(
  view: GuideView,
  size: { w: number; h: number },
  x: number,
  y: number,
) {
  return (
    x >= view.ox &&
    x < view.ox + size.w * view.scale &&
    y >= view.oy &&
    y < view.oy + size.h * view.scale
  )
}

/** The guide's 7px hit strip, clipped to the visible pasteboard outside the artboard. */
export function guideHitAreas(
  axis: Axis,
  position: number,
  view: GuideView,
  size: { w: number; h: number },
) {
  const left = axis === 'x' ? Math.max(0, position - 3) : 0
  const right = axis === 'x' ? Math.min(view.width, position + 4) : view.width
  const top = axis === 'y' ? Math.max(0, position - 3) : 0
  const bottom = axis === 'y' ? Math.min(view.height, position + 4) : view.height
  const blockedLeft = Math.max(left, view.ox)
  const blockedRight = Math.min(right, view.ox + size.w * view.scale)
  const blockedTop = Math.max(top, view.oy)
  const blockedBottom = Math.min(bottom, view.oy + size.h * view.scale)
  const rectangles =
    blockedLeft >= blockedRight || blockedTop >= blockedBottom
      ? [[left, top, right, bottom]]
      : [
          [left, top, blockedLeft, bottom],
          [blockedRight, top, right, bottom],
          [blockedLeft, top, blockedRight, blockedTop],
          [blockedLeft, blockedBottom, blockedRight, bottom],
        ]
  return rectangles
    .filter(([x1, y1, x2, y2]) => x2 > x1 && y2 > y1)
    .map(([x1, y1, x2, y2]) => ({ left: x1, top: y1, width: x2 - x1, height: y2 - y1 }))
}

export const noGuides: Guides = { x: [], y: [] }

/** Snap distance in screen pixels, converted to document units by the caller's scale. */
export const SNAP_DISTANCE = 6

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]

/** Ruler tick spacing in document units: labeled ticks at least ~56px apart on screen. */
export function rulerSteps(scale: number) {
  const major = STEPS.find((step) => step * scale >= 56) ?? STEPS[STEPS.length - 1]
  const divisions = String(major).startsWith('25')
    ? 5
    : String(major).startsWith('2')
      ? 4
      : major * scale >= 100
        ? 10
        : 5
  return { major, minor: major / divisions }
}

/** Snap targets per axis: user guides plus the artboard's edges and center. */
export function snapLines(guides: Guides, size: { w: number; h: number }): Guides {
  return {
    x: [...guides.x, 0, size.w / 2, size.w],
    y: [...guides.y, 0, size.h / 2, size.h],
  }
}

/** Closest line to any of `values`, as the offset to apply, or null if none is within `threshold`. */
function closest(lines: number[], values: number[], threshold: number) {
  let best: { offset: number; line: number } | null = null
  for (const value of values) {
    for (const line of lines) {
      const offset = line - value
      if (Math.abs(offset) <= threshold && (!best || Math.abs(offset) < Math.abs(best.offset)))
        best = { offset, line }
    }
  }
  return best
}

export interface SnapResult {
  x: number
  y: number
  /** Lines that were snapped to, for highlighting. */
  lines: { x: number | null; y: number | null }
}

/** Snaps a point, for drawing shapes and dragging resize handles. */
export function snapPoint(
  point: { x: number; y: number },
  lines: Guides,
  threshold: number,
): SnapResult {
  const x = closest(lines.x, [point.x], threshold)
  const y = closest(lines.y, [point.y], threshold)
  return {
    x: point.x + (x?.offset ?? 0),
    y: point.y + (y?.offset ?? 0),
    lines: { x: x?.line ?? null, y: y?.line ?? null },
  }
}

/** Snaps a moving box by its edges and center. Returns the adjusted pointer position. */
export function snapBox(
  pointer: { x: number; y: number },
  start: { x: number; y: number },
  box: { x: number; y: number; width: number; height: number },
  lines: Guides,
  threshold: number,
): SnapResult {
  const dx = pointer.x - start.x
  const dy = pointer.y - start.y
  const left = box.x + dx
  const top = box.y + dy
  const x = closest(lines.x, [left, left + box.width / 2, left + box.width], threshold)
  const y = closest(lines.y, [top, top + box.height / 2, top + box.height], threshold)
  return {
    x: pointer.x + (x?.offset ?? 0),
    y: pointer.y + (y?.offset ?? 0),
    lines: { x: x?.line ?? null, y: y?.line ?? null },
  }
}

export function isGuides(value: unknown): value is Guides {
  const guides = value as Guides
  return (
    !!guides &&
    Array.isArray(guides.x) &&
    Array.isArray(guides.y) &&
    [...guides.x, ...guides.y].every(Number.isFinite)
  )
}

/** Editor-wide view settings (not per project), remembered in this browser. */
export interface ViewPrefs {
  rulers: boolean
  guides: boolean
  snap: boolean
  lockGuides: boolean
}

const VIEW_KEY = 'svgw:view:v1'
const defaultView: ViewPrefs = { rulers: true, guides: true, snap: true, lockGuides: false }

export function loadViewPrefs(): ViewPrefs {
  try {
    const stored = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as Partial<ViewPrefs>
    return Object.fromEntries(
      Object.entries(defaultView).map(([key, value]) => [
        key,
        typeof stored[key as keyof ViewPrefs] === 'boolean'
          ? stored[key as keyof ViewPrefs]
          : value,
      ]),
    ) as unknown as ViewPrefs
  } catch {
    return defaultView
  }
}

export function saveViewPrefs(prefs: ViewPrefs) {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(prefs))
  } catch {
    /* Session-only when storage is unavailable. */
  }
}
