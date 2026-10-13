import { promoteLayers } from './layers'
import { sanitizeSvg } from './sanitize-svg'
import { inlineStyles } from './svg-import'
import {
  isProjectFile,
  parseProjectFile,
  MAX_PROJECT_FILE_BYTES,
  MAX_SVG_BYTES,
  type PortableProject,
} from './project-file'

export { PROJECT_ACCEPT } from './project-file'

export interface ImportedDocument extends PortableProject {
  width: number
  height: number
  layers: number
  objects: number
  warnings: string[]
}
export interface ProjectImport {
  source: 'SVG' | 'JSON project'
  fileName: string
  documents: ImportedDocument[]
}

export function prepareImportedSvg(markup: string) {
  // Recover source-app layer labels before DOMPurify removes namespaced editor metadata.
  const clean = sanitizeSvg(promoteLayers(inlineStyles(markup)))
  if (new Blob([clean]).size > MAX_SVG_BYTES)
    throw new Error('The SVG exceeds 8 MiB. Split the artwork into smaller projects.')
  return clean
}

/** The website opens portable projects and SVG; native conversion stays in the local script. */
export async function importProjectFile(file: File, signal: AbortSignal): Promise<ProjectImport> {
  signal.throwIfAborted()
  if (!isProjectFile(file))
    throw new Error(
      'Choose SVG or .json artwork. Convert Affinity files with the local converter, or export SVG from the source app.',
    )
  if (!file.size) throw new Error('This file is empty.')
  const projectFile = /\.json$/i.test(file.name) || file.type === 'application/json'
  if (file.size > (projectFile ? MAX_PROJECT_FILE_BYTES : MAX_SVG_BYTES))
    throw new Error(
      projectFile
        ? 'Choose a project file smaller than 32 MiB.'
        : 'Choose an SVG smaller than 8 MiB.',
    )
  const source = await file.text()
  signal.throwIfAborted()
  const portable = projectFile ? parseProjectFile(source) : null
  const project: PortableProject = portable?.project ?? {
    name: file.name.replace(/\.svg$/i, '').slice(0, 200) || 'Imported artwork',
    svg: source,
  }
  const svg = prepareImportedSvg(project.svg)
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
  const viewBox = parsed
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  const width = viewBox?.[2] ?? parseFloat(parsed.getAttribute('width') ?? '100')
  const height = viewBox?.[3] ?? parseFloat(parsed.getAttribute('height') ?? '100')
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height)))
    throw new Error('The artwork has invalid canvas dimensions.')
  const layers = [...parsed.children].filter(
    (element) => element.localName === 'g' && element.classList.contains('layer'),
  ).length
  const objects = parsed.querySelectorAll(
    'path,rect,circle,ellipse,line,polyline,polygon,text,image,use',
  ).length
  const warnings = [...(portable?.notes ?? [])]
  if (
    [...parsed.querySelectorAll('image')].some((image) => {
      const href = image.getAttribute('href') ?? image.getAttribute('xlink:href') ?? ''
      return href && !href.startsWith('data:') && !href.startsWith('#')
    })
  )
    warnings.push(
      'This SVG references external images. Embed them in the source app to keep a portable project.',
    )
  return {
    source: projectFile ? 'JSON project' : 'SVG',
    fileName: file.name,
    documents: [{ ...project, svg, width, height, layers: layers || 1, objects, warnings }],
  }
}
