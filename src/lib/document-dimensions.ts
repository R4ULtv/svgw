import type { SvgEditor } from './editor'

/** SVG-Edit's bundled undo restores the root attributes but can leave contentW/H at the newer size. */
export function syncDocumentSize(editor: SvgEditor, previousViewBox: string | null) {
  const viewBox = editor.getSvgContent().getAttribute('viewBox')
  if (!viewBox || viewBox === previousViewBox) return
  const values = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0)
    return
  editor.contentW = values[2]
  editor.contentH = values[3]
}
