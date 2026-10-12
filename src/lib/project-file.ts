import type { Guides } from './guides.ts'

/** A portable editable document, deliberately independent of local IDs and cloud access. */
export interface PortableProject {
  name: string
  svg: string
  guides?: Guides
}

export interface ProjectFile {
  format: 'svgw-project'
  version: 1
  project: PortableProject
  notes?: string[]
}

export const MAX_PROJECT_FILE_BYTES = 32 * 1024 * 1024
export const MAX_SVG_BYTES = 8 * 1024 * 1024
export const PROJECT_ACCEPT = '.svg,.json,image/svg+xml,application/json'

export function isProjectFile(file: Pick<File, 'name' | 'type'>) {
  return (
    /\.(svg|json)$/i.test(file.name) || ['image/svg+xml', 'application/json'].includes(file.type)
  )
}

function validateProject(value: unknown): PortableProject {
  const project = value as PortableProject | null
  if (
    !project ||
    typeof project.name !== 'string' ||
    !project.name.trim() ||
    project.name.length > 200
  )
    throw new Error('The project needs a name of 1–200 characters.')
  if (typeof project.svg !== 'string' || !project.svg.trim())
    throw new Error('The project is missing its SVG artwork.')
  if (new TextEncoder().encode(project.svg).length > MAX_SVG_BYTES)
    throw new Error('Project artwork exceeds 8 MiB. Split it into smaller projects.')
  const guides = project.guides
  if (
    guides !== undefined &&
    (!guides ||
      !Array.isArray(guides.x) ||
      !Array.isArray(guides.y) ||
      guides.x.length > 10_000 ||
      guides.y.length > 10_000 ||
      ![...guides.x, ...guides.y].every(
        (value) => typeof value === 'number' && Number.isFinite(value),
      ))
  )
    throw new Error('The project has invalid ruler guides.')
  return {
    name: project.name,
    svg: project.svg,
    ...(guides ? { guides: { x: [...guides.x], y: [...guides.y] } } : {}),
  }
}

export function parseProjectFile(source: string): ProjectFile {
  if (new TextEncoder().encode(source).length > MAX_PROJECT_FILE_BYTES)
    throw new Error('Choose a project file smaller than 32 MiB.')
  let value: ProjectFile
  try {
    value = JSON.parse(source) as ProjectFile
  } catch {
    throw new Error('This is not a valid JSON project file.')
  }
  if (!value || value.format !== 'svgw-project')
    throw new Error('This JSON file does not contain a svgw project.')
  if (value.version !== 1) throw new Error('This project file version is not supported.')
  if (
    value.notes !== undefined &&
    (!Array.isArray(value.notes) ||
      value.notes.length > 1000 ||
      !value.notes.every((note) => typeof note === 'string' && note.length <= 2000))
  )
    throw new Error('The project has invalid conversion notes.')
  return {
    format: 'svgw-project',
    version: 1,
    project: validateProject(value.project),
    ...(value.notes?.length ? { notes: [...value.notes] } : {}),
  }
}

export function serializeProjectFile(project: PortableProject, notes: string[] = []) {
  const file: ProjectFile = {
    format: 'svgw-project',
    version: 1,
    project: validateProject(project),
    ...(notes.length ? { notes } : {}),
  }
  const source = JSON.stringify(file, null, 2) + '\n'
  // Apply the same checks to exports and imports, without serializing any extra object properties.
  parseProjectFile(source)
  return source
}
