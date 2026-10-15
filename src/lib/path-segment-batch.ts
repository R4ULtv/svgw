/** The pathSegList polyfills shipped with SVG-Edit serialize the path for every changed node. */
interface SegmentList {
  _writeListToPath?: () => void
  _checkPathSynchronizedToList?: () => void
  _getData?: () => unknown[]
  _setData?: (data: unknown[]) => void
}

/** Keep the engine's node/curve logic, but serialize a multi-node move only once. */
export function batchPathSegments<T>(element: SVGPathElement, edit: () => T): T {
  const list = (element as SVGPathElement & { pathSegList?: SegmentList }).pathSegList
  const write = list?._writeListToPath
  if (list && write) {
    list._checkPathSynchronizedToList?.()
    const descriptor = Object.getOwnPropertyDescriptor(list, '_writeListToPath')
    let changed = false
    list._writeListToPath = () => {
      changed = true
    }
    try {
      return edit()
    } finally {
      if (descriptor) Object.defineProperty(list, '_writeListToPath', descriptor)
      else delete list._writeListToPath
      if (changed) write.call(list)
    }
  }
  const get = list?._getData
  const set = list?._setData
  // Older browsers may use a different pathSegList implementation.
  if (!list || !get || !set) return edit()
  const getDescriptor = Object.getOwnPropertyDescriptor(list, '_getData')
  const setDescriptor = Object.getOwnPropertyDescriptor(list, '_setData')
  let data = get.call(list)
  let changed = false
  list._getData = () => data
  list._setData = (next) => {
    data = next
    changed = true
  }
  try {
    return edit()
  } finally {
    if (getDescriptor) Object.defineProperty(list, '_getData', getDescriptor)
    else delete list._getData
    if (setDescriptor) Object.defineProperty(list, '_setData', setDescriptor)
    else delete list._setData
    if (changed) set.call(list, data)
  }
}
