import { normalizeColor } from './colors'
import type { SvgEditor } from './editor'

/** Paint properties and the elements they color. */
type Paint = 'fill' | 'stroke' | 'stop-color'

export interface DocumentColor {
  /** A normalized color, as `normalizeColor` returns it. */
  color: string
  /** How many fills, strokes, and gradient stops use it. */
  uses: number
}

// Contents of these are templates, not artwork; a clip path's default black fill is not a color in use.
const TEMPLATES = new Set(['defs', 'clipPath', 'mask', 'pattern', 'marker', 'symbol'])
const TEXT = new Set(['text', 'tspan', 'textPath'])

function declares(element: Element, paint: Paint) {
  return element.hasAttribute(paint) || !!(element as SVGElement).style?.getPropertyValue(paint)
}

/** Every painted fill, stroke, and gradient stop in the document, with its computed color. */
function paints(content: SVGSVGElement) {
  const found: { element: Element; paint: Paint; color: string }[] = []
  const colors = new Map<string, string | null>()
  const add = (element: Element, paint: Paint, value: string) => {
    if (!value || value === 'none') return
    if (!colors.has(value)) colors.set(value, normalizeColor(value))
    const color = colors.get(value)
    if (color) found.push({ element, paint, color })
  }
  const visit = (parent: Element, template: boolean) => {
    for (const element of parent.children) {
      const name = element.localName
      if (name === 'stop') add(element, 'stop-color', getComputedStyle(element).stopColor)
      const inside = template || TEMPLATES.has(name)
      // Text inherits its parent's paint; only count a tspan that sets its own.
      const painted =
        !inside &&
        (element instanceof SVGGeometryElement ||
          name === 'text' ||
          (TEXT.has(name) && (declares(element, 'fill') || declares(element, 'stroke'))))
      if (painted) {
        const style = getComputedStyle(element)
        if (name !== 'line') add(element, 'fill', style.fill)
        add(element, 'stroke', style.stroke)
      }
      visit(element, inside)
    }
  }
  visit(content, false)
  return found
}

/** The colors the document uses, most used first. Gradients count by their stops. */
export function readDocumentColors(content: SVGSVGElement): DocumentColor[] {
  const uses = new Map<string, number>()
  for (const { color } of paints(content)) uses.set(color, (uses.get(color) ?? 0) + 1)
  return [...uses].map(([color, uses]) => ({ color, uses })).sort((a, b) => b.uses - a.uses)
}

export interface ColorReplacement {
  /** Shows `to` in place of the color, without recording anything. */
  preview(to: string): void
  /** Records the change as one undo step; false when nothing changed. */
  commit(): boolean
}

/**
 * Starts replacing a color everywhere in the document. Each change goes where the color is
 * declared, so a group's fill changes once rather than on each of its children. Returns null when
 * nothing uses the color.
 */
export function startColorReplacement(editor: SvgEditor, from: string): ColorReplacement | null {
  const target = normalizeColor(from)
  if (!target) return null
  const content = editor.getSvgContent()
  // The element declaring each matching paint: the nearest one that sets it, or the painted
  // element itself when it only inherits the initial value (black fill).
  const declarations = new Map<Element, Set<Paint>>()
  for (const { element, paint, color } of paints(content)) {
    if (color !== target) continue
    let owner: Element = element
    for (
      let node: Element | null = element;
      node && node !== content && paint !== 'stop-color';
      node = node.parentElement
    )
      if (declares(node, paint)) {
        owner = node
        break
      }
    declarations.set(owner, (declarations.get(owner) ?? new Set()).add(paint))
  }
  if (!declarations.size) return null

  const originals = new Map(
    [...declarations].map(([element, set]) => [
      element,
      Object.fromEntries(
        ['style', ...set].map((name) => [name, element.getAttribute(name)]),
      ) as Record<string, string | null>,
    ]),
  )
  let changed = false
  return {
    preview(to) {
      const next = normalizeColor(to)
      if (!next) return
      changed = next !== target
      for (const [element, set] of declarations) {
        const style = (element as SVGElement).style
        for (const paint of set) {
          // An inline style outranks the attribute, so change whichever one is in effect.
          if (style?.getPropertyValue(paint)) style.setProperty(paint, next)
          else element.setAttribute(paint, next)
        }
      }
    },
    commit() {
      if (!changed) return false
      const { BatchCommand, ChangeElementCommand } = editor.history
      const batch = new BatchCommand('Replace Color')
      for (const [element, old] of originals)
        batch.addSubCommand(new ChangeElementCommand(element, old))
      editor.undoMgr.addCommandToHistory(batch)
      changed = false
      return true
    },
  }
}
