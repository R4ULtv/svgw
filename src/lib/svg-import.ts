import type { SvgEditor } from './editor'
import { artworkBounds, isLayer, layerName } from './layers'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Finds SVG markup in clipboard text, such as "Copy as SVG" from Figma or code copied from an editor. */
export function extractSvg(text: string) {
  return text.match(/<svg[\s>][\s\S]*<\/svg>/i)?.[0] ?? null
}

// CSS properties that are also SVG presentation attributes. Written as attributes they stay
// editable: the inspector sets attributes, which lose to class rules and inline styles.
const PRESENTATION = new Set([
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'clip-path',
  'clip-rule',
  'mask',
  'filter',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'display',
  'visibility',
  'stop-color',
  'stop-opacity',
  'mix-blend-mode',
  'isolation',
  'transform-origin',
])

/**
 * Turns CSS styling into presentation attributes, which stay editable and survive SVG-Edit
 * (it deletes an element's `style` attribute when the element is clicked):
 * - `<style>` rules (Illustrator's `.cls-1 { fill: … }`) are applied to the elements they match
 *   and dropped, so class names from different imports can't override each other. Unsupported
 *   rules such as @font-face are kept.
 * - Paint and text properties in `style` attributes (Illustrator's "Inline Style" export) move
 *   to attributes.
 */
export function inlineStyles(svg: string) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (document.querySelector('parsererror')) return svg
  const styles = [...document.querySelectorAll('style')]
  for (const style of styles) {
    const sheet = new CSSStyleSheet()
    try {
      sheet.replaceSync(style.textContent ?? '')
    } catch {
      continue
    }
    const kept: string[] = []
    for (const rule of sheet.cssRules) {
      if (!(rule instanceof CSSStyleRule)) {
        kept.push(rule.cssText)
        continue
      }
      let targets: Element[]
      try {
        targets = [...document.documentElement.querySelectorAll(rule.selectorText)]
      } catch {
        kept.push(rule.cssText)
        continue
      }
      for (const element of targets) {
        for (const property of rule.style) {
          const value = rule.style.getPropertyValue(property)
          // Later rules win, as they would in the cascade for these flat class selectors.
          if (PRESENTATION.has(property)) element.setAttribute(property, value)
          else (element as SVGElement).style?.setProperty(property, value)
        }
      }
    }
    if (kept.length) style.textContent = kept.join('\n')
    else style.remove()
  }
  for (const element of document.querySelectorAll('[style]')) {
    const style = (element as SVGElement).style
    if (!style) continue
    // CSS declarations are live; snapshot them before removing presentation properties.
    const properties = [...style]
    for (const property of properties) {
      if (!PRESENTATION.has(property)) continue
      element.setAttribute(property, style.getPropertyValue(property))
      style.removeProperty(property)
    }
    if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
  }
  return new XMLSerializer().serializeToString(document.documentElement)
}

// Root attributes that describe the document rather than the artwork.
const DOCUMENT_ATTRIBUTES = new Set([
  'width',
  'height',
  'viewBox',
  'x',
  'y',
  'version',
  'preserveAspectRatio',
  'id',
  'class',
  'baseProfile',
  'data-name',
  'enable-background',
  'xml:space',
])

const number = (value: string | null) => {
  const parsed = value ? parseFloat(value) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Places sanitized SVG markup in a new layer on top, as one selected group and one undo step.
 * The artwork is centered on the artboard by its actual bounds (not its viewBox, which may have
 * empty space around it) and keeps its size unless it is larger than the artboard, in which case
 * it is scaled down to fit.
 */
export function insertSvg(editor: SvgEditor, markup: string, preferredName: string) {
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml')
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg')
    throw new Error('This is not valid SVG.')
  const source = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement
  editor.uniquifyElems(source)

  const viewBox = source
    .getAttribute('viewBox')
    ?.split(/[\s,]+/)
    .map(Number)
  const width = number(source.getAttribute('width')) ?? viewBox?.[2] ?? 100
  const height = number(source.getAttribute('height')) ?? viewBox?.[3] ?? 100
  const [vx, vy, vw, vh] =
    viewBox?.length === 4 && viewBox.every(Number.isFinite) ? viewBox : [0, 0, width, height]
  const round = (value: number) => Math.round(value * 1000) / 1000
  // Maps the source's viewBox to its width × height at the document origin.
  const base = `scale(${round(width / vw)} ${round(height / vh)}) translate(${round(-vx)} ${round(-vy)})`

  const group = document.createElementNS(SVG_NS, 'g')
  group.id = editor.getNextId()
  // Inherited paint on the root, like Figma's `fill="none"`, must stay in effect.
  for (const attribute of source.attributes) {
    if (!DOCUMENT_ATTRIBUTES.has(attribute.name) && !attribute.name.startsWith('xmlns'))
      group.setAttribute(attribute.name, attribute.value)
  }
  group.setAttribute('transform', base)
  group.append(...source.childNodes)
  // SVG-Edit tracks drawable elements by id.
  for (const element of group.querySelectorAll('*')) {
    if (
      !element.id &&
      element.namespaceURI === SVG_NS &&
      !['defs', 'style', 'title', 'desc', 'stop', 'tspan'].includes(element.localName)
    )
      element.id = editor.getNextId()
  }

  // A new layer on top of the others, named after the source, as SVG-Edit's layer markup.
  const content = editor.getSvgContent()
  const names = new Set([...content.children].filter(isLayer).map(layerName))
  let name = preferredName.trim() || 'Imported SVG'
  for (let index = 2, first = name; names.has(name); index++) name = `${first} ${index}`
  const layer = document.createElementNS(SVG_NS, 'g')
  layer.setAttribute('class', 'layer')
  const title = document.createElementNS(SVG_NS, 'title')
  title.textContent = name
  layer.append(title, group)
  if (editor.getCurrentGroup()) editor.leaveContext()
  content.append(layer)

  // Measure the artwork as placed, then scale it down if needed and center it on the artboard.
  const canvas = editor.getResolution()
  const bounds = artworkBounds(content, [group]) ?? { x: 0, y: 0, width, height }
  const fit = Math.min(
    1,
    (canvas.w * 0.9) / (bounds.width || 1),
    (canvas.h * 0.9) / (bounds.height || 1),
  )
  const dx = canvas.w / 2 - fit * (bounds.x + bounds.width / 2)
  const dy = canvas.h / 2 - fit * (bounds.y + bounds.height / 2)
  group.setAttribute(
    'transform',
    `translate(${round(dx)} ${round(dy)})${fit < 1 ? ` scale(${round(fit)})` : ''} ${base}`,
  )

  editor.undoMgr.addCommandToHistory(new editor.history.InsertElementCommand(layer, PLACE_LABEL))
  editor.identifyLayers()
  editor.setCurrentLayer(name)
  editor.selectOnly([group], true)
  editor.call('changed', [group])
  return { element: group, layer: name, scaled: fit < 1 }
}

/** History label for placed SVGs, used to offer "Open as new project" right after placing. */
export const PLACE_LABEL = 'Place SVG'
