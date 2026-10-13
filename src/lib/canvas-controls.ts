import type { SvgEditor } from './editor'
import { createFrameTask } from './frame-task'

const ns = 'http://www.w3.org/2000/svg'

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number>,
) {
  const element = document.createElementNS(ns, tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value))
  return element
}

/** Paint the handles inside the engine's existing hit targets, keeping its drag behavior intact. */
function addControlPatterns(root: SVGSVGElement) {
  const defs = svg('defs', {})
  const shadow = svg('filter', {
    id: 'svgw-control-shadow',
    x: '-50%',
    y: '-50%',
    width: '200%',
    height: '200%',
    'color-interpolation-filters': 'sRGB',
  })
  shadow.append(svg('feDropShadow', { dx: 0, dy: 1, stdDeviation: 1, 'flood-opacity': 0.18 }))
  defs.append(shadow)
  for (const active of [false, true]) {
    for (const kind of ['corner', 'edge-x', 'edge-y', 'rotate'] as const) {
      const size = kind === 'rotate' ? 28 : 24
      const center = size / 2
      const pattern = svg('pattern', {
        id: `svgw-control-${kind}${active ? '-active' : ''}`,
        width: 1,
        height: 1,
        patternUnits: 'objectBoundingBox',
        viewBox: `0 0 ${size} ${size}`,
      })
      if (kind === 'rotate') {
        pattern.append(
          svg('circle', {
            cx: center,
            cy: center,
            r: 9,
            fill: active ? 'var(--canvas-control-accent)' : 'var(--canvas-control-surface)',
            stroke: 'var(--canvas-control-accent)',
            'stroke-width': 1.25,
            filter: 'url(#svgw-control-shadow)',
          }),
          svg('path', {
            d: 'M23 15a6 6 0 1 0 .5 5 M23 11v4.5h-4.5',
            // Scale the 12px glyph down to fit the button; 2.2 units render as a 1.4px stroke.
            transform: `translate(${center} ${center}) scale(0.62) translate(-17.25 -17.5)`,
            fill: 'none',
            stroke: active ? 'var(--canvas-control-surface)' : 'var(--canvas-control-accent)',
            'stroke-width': 2.2,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          }),
        )
      } else {
        const width = kind === 'edge-x' ? 13 : kind === 'edge-y' ? 5 : 9
        const height = kind === 'edge-y' ? 13 : kind === 'edge-x' ? 5 : 9
        pattern.append(
          svg('rect', {
            x: center - width / 2,
            y: center - height / 2,
            width,
            height,
            rx: kind === 'corner' ? 2 : 2.5,
            fill: active ? 'var(--canvas-control-accent)' : 'var(--canvas-control-surface)',
            stroke: 'var(--canvas-control-accent)',
            'stroke-width': 1.25,
            filter: 'url(#svgw-control-shadow)',
          }),
        )
      }
      defs.append(pattern)
    }
  }
  root.prepend(defs)
}

/**
 * A small live readout beneath a single selection. Read the engine's handle coordinates instead
 * of walking the artwork or measuring layout on every pointer move. All helpers stay outside
 * #svgcontent, so they never enter a saved or exported SVG.
 */
export function installCanvasControls(editor: SvgEditor) {
  const root = editor.getSvgRoot()
  addControlPatterns(root)
  const info = svg('g', { id: 'svgw-selection-info', 'pointer-events': 'none', display: 'none' })
  const surface = svg('rect', { height: 22, rx: 5 })
  const text = svg('text', { x: 0, y: 11, 'text-anchor': 'middle', 'dominant-baseline': 'central' })
  info.append(surface, text)
  const number = (value: number) => String(Math.round(value * 10) / 10)
  let parent: Element | null = null

  const refresh = () => {
    const selected = editor.getSelectedElements().filter((element): element is Element => !!element)
    const mode = editor.getMode()
    if (selected.length !== 1 || !['select', 'resize', 'rotate'].includes(mode)) {
      info.setAttribute('display', 'none')
      return
    }
    const grips = ['nw', 'ne', 'se', 'sw'].map((dir) =>
      parent?.querySelector<SVGCircleElement>(`#selectorGrip_resize_${dir}`),
    )
    const group = grips[0]?.closest<SVGGElement>('[id^="selectorGroup"]')
    if (!group || group.getAttribute('display') === 'none' || grips.some((grip) => !grip)) {
      info.setAttribute('display', 'none')
      return
    }
    const corners = grips.map(
      (grip) => new DOMPoint(Number(grip!.getAttribute('cx')), Number(grip!.getAttribute('cy'))),
    )
    // Edge handles would crowd the corners on small objects at low zoom.
    parent!.setAttribute('data-compact-x', String(corners[1].x - corners[0].x < 48))
    parent!.setAttribute('data-compact-y', String(corners[3].y - corners[0].y < 48))
    const scale = editor.getZoom()
    const stroke =
      selected[0].getAttribute('stroke') === 'none'
        ? 0
        : Number(selected[0].getAttribute('stroke-width')) || 0
    const width = Math.max(0, (corners[1].x - corners[0].x - 2) / scale - stroke)
    const height = Math.max(0, (corners[3].y - corners[0].y - 2) / scale - stroke)
    const transform = group.transform.baseVal
    const rotated = transform.numberOfItems ? transform.getItem(0) : null
    const points = rotated ? corners.map((point) => point.matrixTransform(rotated.matrix)) : corners
    const left = Math.min(...points.map((point) => point.x))
    const right = Math.max(...points.map((point) => point.x))
    const bottom = Math.max(...points.map((point) => point.y))
    const label =
      mode === 'rotate' && rotated
        ? `${number(rotated.angle)}°`
        : `${number(width)} × ${number(height)}`
    const chipWidth = Math.max(56, label.length * 6 + 20)
    if (text.textContent !== label) text.textContent = label
    surface.setAttribute('x', String(-chipWidth / 2))
    surface.setAttribute('width', String(chipWidth))
    info.setAttribute('transform', `translate(${(left + right) / 2} ${bottom + 14})`)
    info.setAttribute('display', 'inline')
  }
  const update = createFrameTask(refresh)
  const selections = new MutationObserver((records) => {
    if (records.some((record) => !info.contains(record.target))) update.schedule()
  })
  const attach = () => {
    const next = root.querySelector('#selectorParentGroup')
    if (next === parent) return
    selections.disconnect()
    parent = next
    if (parent) {
      parent.append(info)
      selections.observe(parent, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['cx', 'cy', 'd', 'display', 'transform'],
      })
    }
    update.schedule()
  }
  // Opening another document can replace the engine's selector group.
  const roots = new MutationObserver(attach)
  roots.observe(root, { childList: true })
  // The engine returns to Select after its last DOM update; release also refreshes the readout.
  window.addEventListener('mouseup', update.schedule)
  attach()
  return () => {
    window.removeEventListener('mouseup', update.schedule)
    roots.disconnect()
    selections.disconnect()
    update.cancel()
    info.remove()
  }
}
