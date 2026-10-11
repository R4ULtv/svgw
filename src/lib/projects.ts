import { openDB, type DBSchema } from 'idb'
import type { Guides } from './guides'
import type { CloudLink } from './cloud-types'

export interface Project {
  id: string
  name: string
  svg: string
  createdAt: number
  updatedAt: number
  formatVersion: 1
  /** Ruler guides; kept with the project rather than in the SVG. */
  guides?: Guides
  cloud?: CloudLink
}

interface ProjectDatabase extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: { updatedAt: number }
  }
}

// Open lazily: IndexedDB is a browser API and must not run during shell prerendering.
function database() {
  return openDB<ProjectDatabase>('svgw', 1, {
    upgrade(db) {
      const projects = db.createObjectStore('projects', { keyPath: 'id' })
      projects.createIndex('updatedAt', 'updatedAt')
    },
  })
}

export async function listProjects() {
  const db = await database()
  try {
    return (await db.getAllFromIndex('projects', 'updatedAt')).reverse()
  } finally {
    db.close()
  }
}

export async function saveProject(project: Project) {
  const db = await database()
  try {
    await db.put('projects', project)
  } finally {
    db.close()
  }
}

export async function getProject(id: string) {
  const db = await database()
  try {
    return await db.get('projects', id)
  } finally {
    db.close()
  }
}

export async function deleteProject(id: string) {
  const db = await database()
  try {
    await db.delete('projects', id)
  } finally {
    db.close()
  }
}

// crypto.randomUUID only exists in secure contexts (HTTPS or localhost), so plain-HTTP LAN
// access falls back to a v4 UUID built from getRandomValues, which is available everywhere.
export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function createProject(name: string, svg: string): Project {
  const now = Date.now()
  return {
    id: newId(),
    name: name.slice(0, 200),
    svg,
    createdAt: now,
    updatedAt: now,
    formatVersion: 1,
  }
}

/** Remote drafts and visitor copies share a URL while retaining separate local records. */
export function projectRouteId(project: Project) {
  return project.cloud?.id ?? project.id
}

// Keeps the list sorted newest first, matching listProjects.
export function upsertProject(projects: Project[], project: Project) {
  return [project, ...projects.filter((item) => item.id !== project.id)].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  )
}
