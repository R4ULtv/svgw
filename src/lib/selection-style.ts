import { styleTargets, type StyleTarget, type SvgEditor } from './editor'
import { editElements, selectionRoots } from './layers'

/**
 * Sets presentation attributes on the selected objects a shape-specific field edits (see
 * `styleTargets`), as one undo step. A null value removes the attribute. An inline style
 * outranks the attribute, so a property set there changes there.
 */
export function setSelectionStyle(
  editor: SvgEditor,
  target: StyleTarget,
  values: Record<string, string | null>,
) {
  const roots = selectionRoots(editor)
  const elements = roots ? styleTargets(roots, target) : []
  if (!elements.length) return false
  return editElements(editor, 'Change Style', elements, (element) => {
    const style = (element as SVGElement).style
    for (const [name, value] of Object.entries(values)) {
      if (style?.getPropertyValue(name)) {
        if (value === null) style.removeProperty(name)
        else style.setProperty(name, value)
        if (!style.length) element.removeAttribute('style')
      } else if (value === null) element.removeAttribute(name)
      else element.setAttribute(name, value)
    }
  })
}
