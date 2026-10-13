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

/** Homepage navigation needs metadata, without cloning every SVG and saved snapshot. */
export type ProjectSummary = Omit<Project, 'svg' | 'guides' | 'cloud'> & {
  cloud?: Pick<CloudLink, 'id' | 'mode'>
}

function projectSummary(project: Project): ProjectSummary {
  const { id, name, createdAt, updatedAt, formatVersion, cloud } = project
  return {
    id,
    name,
    createdAt,
    updatedAt,
    formatVersion,
    ...(cloud ? { cloud: { id: cloud.id, mode: cloud.mode } } : {}),
  }
}

interface ProjectDatabase extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: { updatedAt: number }
  }
  summaries: {
    key: string
    value: ProjectSummary
    indexes: { updatedAt: number }
  }
}

// Open lazily: IndexedDB is a browser API and must not run during shell prerendering.
let connection: ReturnType<typeof openDB<ProjectDatabase>> | undefined
function database() {
  connection ??= openDB<ProjectDatabase>('svgw', 2, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        const projects = db.createObjectStore('projects', { keyPath: 'id' })
        projects.createIndex('updatedAt', 'updatedAt')
      }
      const summaries = db.createObjectStore('summaries', { keyPath: 'id' })
      summaries.createIndex('updatedAt', 'updatedAt')
      // The upgrade transaction keeps both stores consistent before reads can begin.
      void (async () => {
        let cursor = await transaction.objectStore('projects').openCursor()
        while (cursor) {
          await summaries.put(projectSummary(cursor.value))
          cursor = await cursor.continue()
        }
      })().catch(() => transaction.abort())
    },
    blocking() {
      void connection?.then((db) => db.close())
      connection = undefined
    },
    terminated() {
      connection = undefined
    },
  }).catch((cause: unknown) => {
    connection = undefined
    throw cause
  })
  return connection
}

export async function listProjects() {
  const db = await database()
  return (await db.getAllFromIndex('projects', 'updatedAt')).reverse()
}

export async function listProjectSummaries() {
  const db = await database()
  return (await db.getAllFromIndex('summaries', 'updatedAt')).reverse()
}

export async function saveProject(project: Project) {
  const db = await database()
  const transaction = db.transaction(['projects', 'summaries'], 'readwrite')
  await Promise.all([
    transaction.objectStore('projects').put(project),
    transaction.objectStore('summaries').put(projectSummary(project)),
    transaction.done,
  ])
}

export async function getProject(id: string) {
  const db = await database()
  return db.get('projects', id)
}

export async function deleteProject(id: string) {
  const db = await database()
  const transaction = db.transaction(['projects', 'summaries'], 'readwrite')
  await Promise.all([
    transaction.objectStore('projects').delete(id),
    transaction.objectStore('summaries').delete(id),
    transaction.done,
  ])
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
export function projectRouteId(project: Pick<ProjectSummary, 'id' | 'cloud'>) {
  return project.cloud?.id ?? project.id
}

// Keeps the list sorted newest first, matching listProjects.
export function upsertProject(projects: Project[], project: Project) {
  return [project, ...projects.filter((item) => item.id !== project.id)].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  )
}
