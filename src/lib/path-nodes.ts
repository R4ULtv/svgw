type Point = { x: number; y: number }
type Linear = { a: number; b: number; c: number; d: number }
/** The control point a following S or T reflects. */
type Smooth = { kind: 'C' | 'Q'; control: Point } | null

/** A node-model segment: SVG-Edit's absolute pathSegList item and its numeric type. */
export interface SegmentData {
  type: number
  item: { readonly [key: string]: unknown }
}

interface Drawn {
  command: 'L' | 'C' | 'Q' | 'A'
  values: number[]
  end: Point
  /** Index of the engine segment this came from; -1 for a segment added here. */
  index: number
}

interface Subpath {
  start: Point
  startIndex: number
  segments: Drawn[]
  closed: boolean
}

/**
 * SVG-Edit draws a selected arc's outline by transforming its radii, rotation and flags as if
 * they were points. A linear map keeps an elliptical arc elliptical: its semi-axes are the
 * singular values of M·R(angle)·diag(r1, r2), and a reflection reverses the sweep.
 */
export function transformArc(
  arc: { r1: number; r2: number; angle: number; sweep: boolean },
  m: Linear,
) {
  const theta = (arc.angle * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const ea = (m.a * cos + m.c * sin) * arc.r1
  const eb = (m.b * cos + m.d * sin) * arc.r1
  const ec = (m.c * cos - m.a * sin) * arc.r2
  const ed = (m.d * cos - m.b * sin) * arc.r2
  // The major axis is the dominant eigenvector of E·Eᵀ.
  const p = ea * ea + ec * ec
  const q = ea * eb + ec * ed
  const s = eb * eb + ed * ed
  const mean = (p + s) / 2
  const spread = Math.hypot((p - s) / 2, q)
  return {
    r1: Math.sqrt(mean + spread),
    r2: Math.sqrt(Math.max(0, mean - spread)),
    angle: (Math.atan2(2 * q, p - s) * 90) / Math.PI,
    sweep: m.a * m.d - m.b * m.c < 0 ? !arc.sweep : arc.sweep,
  }
}

/** Splits absolute path data into subpaths of L/C/Q/A segments; null for data it cannot model. */
function subpaths(segments: readonly SegmentData[]): Subpath[] | null {
  const result: Subpath[] = []
  let current: Subpath | null = null
  let point: Point = { x: 0, y: 0 }
  let smooth: Smooth = null
  for (const [index, { type, item }] of segments.entries()) {
    const value = (key: string) => Number(item[key])
    const reflect = (kind: 'C' | 'Q') =>
      smooth?.kind === kind
        ? { x: 2 * point.x - smooth.control.x, y: 2 * point.y - smooth.control.y }
        : point
    if (type === 1) {
      if (current) {
        current.closed = true
        point = current.start
      }
      current = null
      smooth = null
      continue
    }
    if (type === 2) {
      point = { x: value('x'), y: value('y') }
      current = { start: point, startIndex: index, segments: [], closed: false }
      result.push(current)
      smooth = null
      continue
    }
    if (!current) {
      // Drawing after Z continues from the closed subpath's start.
      current = { start: point, startIndex: -1, segments: [], closed: false }
      result.push(current)
    }
    let segment: Drawn
    const end = { x: value('x'), y: value('y') }
    const next = (command: Drawn['command'], values: number[], to = end) =>
      ({ command, values: [...values, to.x, to.y], end: to, index }) satisfies Drawn
    let control: Smooth = null
    switch (type) {
      case 4:
        segment = next('L', [])
        break
      case 12:
        segment = next('L', [], { x: value('x'), y: point.y })
        break
      case 14:
        segment = next('L', [], { x: point.x, y: value('y') })
        break
      case 6:
        segment = next('C', [value('x1'), value('y1'), value('x2'), value('y2')])
        control = { kind: 'C', control: { x: value('x2'), y: value('y2') } }
        break
      case 16: {
        // S and T depend on the previous segment, which a deletion can change.
        const first = reflect('C')
        segment = next('C', [first.x, first.y, value('x2'), value('y2')])
        control = { kind: 'C', control: { x: value('x2'), y: value('y2') } }
        break
      }
      case 8:
        segment = next('Q', [value('x1'), value('y1')])
        control = { kind: 'Q', control: { x: value('x1'), y: value('y1') } }
        break
      case 18: {
        const first = reflect('Q')
        segment = next('Q', [first.x, first.y])
        control = { kind: 'Q', control: first }
        break
      }
      case 10:
        segment = next('A', [
          value('r1'),
          value('r2'),
          value('angle'),
          item.largeArcFlag ? 1 : 0,
          item.sweepFlag ? 1 : 0,
        ])
        break
      default:
        return null
    }
    if (segment.values.some((number) => !Number.isFinite(number))) return null
    current.segments.push(segment)
    point = segment.end
    smooth = control
  }
  for (const subpath of result) {
    const last = subpath.segments.at(-1)
    // The engine's closed-subpath node model needs the last node on the start point.
    if (
      subpath.closed &&
      last &&
      (last.end.x !== subpath.start.x || last.end.y !== subpath.start.y)
    )
      subpath.segments.push({
        command: 'L',
        values: [subpath.start.x, subpath.start.y],
        end: subpath.start,
        index: -1,
      })
  }
  return result
}

const draw = (segment: Drawn) => `${segment.command}${segment.values.join(' ')}`

/**
 * Path data without the given nodes, rebuilt subpath by subpath. The segment into each remaining
 * node keeps its shape and starts from the previous remaining node. A closed subpath restarts
 * at its last remaining node; a subpath left with fewer than two nodes is dropped. Returns ''
 * when nothing remains, or null when the data holds segments this cannot model.
 */
export function deleteNodes(segments: readonly SegmentData[], indices: readonly number[]) {
  const parsed = subpaths(segments)
  if (!parsed) return null
  const deleted = new Set(indices)
  const data: string[] = []
  for (const subpath of parsed) {
    const kept = subpath.segments.filter((segment) => !deleted.has(segment.index))
    if (subpath.closed) {
      // The start point is the last segment's node, so its incoming segment is the first one.
      if (kept.length < 2) continue
      const start = kept.at(-1)!.end
      data.push(`M${start.x} ${start.y}`, ...kept.map(draw), 'Z')
    } else {
      // An open subpath's start is a node of its own; without it, the next node starts it.
      const start = deleted.has(subpath.startIndex) ? kept.shift()?.end : subpath.start
      if (!start || !kept.length) continue
      data.push(`M${start.x} ${start.y}`, ...kept.map(draw))
    }
  }
  return data.join(' ')
}
