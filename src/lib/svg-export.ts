export type ExportScope = 'all' | 'visible'

const RESOURCES = new Set([
  'defs',
  'linearGradient',
  'radialGradient',
  'pattern',
  'mask',
  'clipPath',
  'filter',
  'marker',
  'symbol',
])
const CONTAINERS = new Set(['svg', 'g', 'a', 'switch'])
const TEXT = new Set(['text', 'tspan', 'textPath'])
const DRAWABLE = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'image',
  'use',
  'foreignObject',
])

function presentation(element: Element, property: string) {
  return (
    (element as SVGElement).style?.getPropertyValue(property).trim() ||
    element.getAttribute(property)?.trim() ||
    ''
  )
}

/** Filters artwork, leaving resource contents alone: a mask's shapes are not document artwork. */
function pruneArtwork(element: Element, inheritedVisibility = 'visible', inText = false): boolean {
  if (RESOURCES.has(element.localName)) return false
  const display = presentation(element, 'display')
  const opacity = presentation(element, 'opacity')
  const ownVisibility = presentation(element, 'visibility')
  const visibility =
    !ownVisibility || ownVisibility === 'inherit' || ownVisibility === 'unset'
      ? inheritedVisibility
      : ownVisibility
  if (display === 'none') {
    element.remove()
    return false
  }
  if (opacity && parseFloat(opacity) === 0) {
    if (!inText) element.remove()
    return false
  }
  if (CONTAINERS.has(element.localName) || TEXT.has(element.localName)) {
    let hasArtwork =
      TEXT.has(element.localName) &&
      visibility !== 'hidden' &&
      visibility !== 'collapse' &&
      [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      )
    const children = [...element.children]
    for (const child of children)
      if (pruneArtwork(child, visibility, inText || TEXT.has(element.localName))) hasArtwork = true
    // A child may override visibility="hidden", so only discard a container after visiting it.
    // Invisible spans still advance the cursor in a text object that has visible content.
    if (!hasArtwork && !inText && element.localName !== 'svg') element.remove()
    return hasArtwork
  }
  if (!DRAWABLE.has(element.localName)) return false
  if (visibility === 'hidden' || visibility === 'collapse') {
    element.remove()
    return false
  }
  return true
}

function references(element: Element): string[] {
  const ids: string[] = []
  for (const attribute of element.attributes) {
    if (attribute.localName === 'href' && attribute.value.trim().startsWith('#'))
      ids.push(attribute.value.trim().slice(1))
    for (const match of attribute.value.matchAll(/url\(\s*(['"]?)#([^\s)'";]+)\1\s*\)/gi))
      ids.push(match[2])
  }
  if (element.localName === 'style')
    for (const match of (element.textContent ?? '').matchAll(
      /url\(\s*(['"]?)#([^\s)'";]+)\1\s*\)/gi,
    ))
      ids.push(match[2])
  return ids
}

/** Retains only resources reachable from the artwork, including chained and cyclic references. */
function retainResources(root: Element, original: Element) {
  const sources = new Map(
    [...original.querySelectorAll('[id]')].map((element) => [element.id, element]),
  )
  // Definitions can be nested inside an otherwise hidden layer. Resolve them from the original.
  for (const element of root.querySelectorAll('*'))
    if (RESOURCES.has(element.localName)) element.remove()
  const artwork = [root, ...root.querySelectorAll('*')]
  const liveIds = new Set(artwork.map((element) => element.id).filter(Boolean))
  const pending = artwork.flatMap(references)
  const resources = new Set<Element>()
  // Styles without IDs can still provide fonts or reference paint resources.
  for (const style of original.querySelectorAll('defs style')) {
    resources.add(style)
    pending.push(...references(style))
  }
  const visited = new Set<string>()
  for (let index = 0; index < pending.length; index++) {
    const id = pending[index]
    if (visited.has(id) || liveIds.has(id)) continue
    visited.add(id)
    let source = sources.get(id)
    if (!source) continue
    // Keep wrappers inside defs: their inherited color/style can affect a gradient or mask.
    const originalDefs = source.closest<Element>('defs')
    if (originalDefs && originalDefs !== source) {
      while (source.parentElement && source.parentElement !== originalDefs)
        source = source.parentElement
    } else {
      for (let parent = source.parentElement; parent; parent = parent.parentElement)
        if (RESOURCES.has(parent.localName)) source = parent
    }
    if (resources.has(source)) continue
    resources.add(source)
    for (const element of [source, ...source.querySelectorAll('*')])
      pending.push(...references(element))
  }
  if (!resources.size) return
  const defs = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'defs')
  const contexts = new Map<Element, Element>()
  const outputs: Element[] = []
  for (const resource of resources) {
    if ([...resources].some((other) => other !== resource && other.contains(resource))) continue
    const parent = resource.parentElement
    if (parent?.localName === 'defs') {
      let context = contexts.get(parent)
      if (!context) {
        context = parent.cloneNode(false) as Element
        contexts.set(parent, context)
        outputs.push(context)
      }
      context.append(resource.cloneNode(true))
    } else {
      if (!defs.childElementCount) outputs.push(defs)
      defs.append(resource.cloneNode(true))
    }
  }
  root.prepend(...outputs)
}

/** Removes export-only labels and groups that do not affect rendering or references. */
function cleanExport(root: Element) {
  const elements = [root, ...root.querySelectorAll('*')]
  const styles = [...root.querySelectorAll('style')]
  const namesUsedByCss = styles.some((style) => /\[\s*data-name\b/.test(style.textContent ?? ''))
  if (!namesUsedByCss) for (const element of elements) element.removeAttribute('data-name')
  // Remaining styles can depend on IDs, tag names, or hierarchy. Imported paint rules are
  // already inlined by the editor, so this conservative guard rarely prevents cleanup.
  if (styles.some((style) => style.textContent?.trim())) return
  const referenced = new Set(elements.flatMap(references))
  const groups = [...root.querySelectorAll('g')].reverse()
  for (const group of groups) {
    if (group.id && referenced.has(group.id)) continue
    if (group.parentElement?.localName === 'switch' || group.closest('defs')) continue
    if (
      [...group.attributes].some(
        (attribute) =>
          attribute.name !== 'id' &&
          attribute.namespaceURI !== 'http://www.w3.org/2000/xmlns/' &&
          !(['style', 'class'].includes(attribute.name) && !attribute.value.trim()),
      )
    )
      continue
    if (
      [...group.children].some((child) =>
        [
          'title',
          'desc',
          'metadata',
          'animate',
          'animateTransform',
          'animateMotion',
          'set',
        ].includes(child.localName),
      )
    )
      continue
    group.replaceWith(...group.childNodes)
  }
}

/** Exports a clean copy; visible artwork is the default. The live document stays intact. */
export function svgForExport(svg: string, scope: ExportScope = 'visible') {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg')
    throw new Error('Could not read the SVG for export.')
  const original = document.documentElement
  const root = original.cloneNode(true) as Element
  if (scope === 'visible') {
    if (!pruneArtwork(root))
      throw new Error('No visible artwork. Show a layer or object to export it.')
    retainResources(root, original)
  }
  cleanExport(root)
  return new XMLSerializer().serializeToString(root)
}
