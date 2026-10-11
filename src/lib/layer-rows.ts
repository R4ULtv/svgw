import type { LayerNode } from './layers'

export const LAYER_ROW_HEIGHT = 32
export interface LayerRow {
  node: LayerNode
  depth: number
  hiddenAbove: boolean
  lockedAbove: boolean
  position: number
  siblings: number
}

/** Flatten only expanded branches, retaining the hierarchy for indentation and ARIA. */
export function layerRows(tree: LayerNode[], toggled: Set<string>) {
  const rows: LayerRow[] = []
  function visit(nodes: LayerNode[], depth: number, hiddenAbove: boolean, lockedAbove: boolean) {
    nodes.forEach((node, index) => {
      rows.push({
        node,
        depth,
        hiddenAbove,
        lockedAbove,
        position: index + 1,
        siblings: nodes.length,
      })
      if ((node.kind === 'layer') !== toggled.has(node.key))
        visit(node.children, depth + 1, hiddenAbove || node.hidden, lockedAbove || node.locked)
    })
  }
  visit(tree, 0, false, false)
  return rows
}

/** A bounded number of mounted rows, regardless of document size. */
export function layerRowWindow(count: number, scrollTop: number, height: number) {
  if (count <= 80) return { start: 0, end: count }
  const overscan = 8
  const visible = Math.ceil(Math.max(1, height) / LAYER_ROW_HEIGHT)
  const first = Math.min(
    Math.max(0, count - visible),
    Math.floor(Math.max(0, scrollTop) / LAYER_ROW_HEIGHT),
  )
  return { start: Math.max(0, first - overscan), end: Math.min(count, first + visible + overscan) }
}
