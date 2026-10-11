export interface ProjectDocument {
  name: string
  svg: string
  formatVersion: 1
  guides?: { x: number[]; y: number[] }
}

export type Visibility = 'public' | 'private'

export interface VersionInfo {
  id: string
  createdAt: number
  name: string
  pinned: boolean
}

export interface RemoteProject {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  visibility: Visibility
  latestVersionId: string
  publishedVersionId: string | null
  publishedAt: number | null
}

export interface RemoteDocument {
  project: RemoteProject
  document: ProjectDocument
  versionId: string
  revision: string | null
}

export interface RemoteMutation {
  project: RemoteProject
  revision: string
}

/** Local-only synchronization state. Never included in a remote snapshot. */
export interface CloudLink {
  id: string
  mode: 'admin' | 'public'
  revision: string | null
  versionId: string
  savedDocument: string
  visibility: Visibility
  publishedVersionId: string | null
  /** Reused after a failed upload, so retrying cannot create duplicate versions. */
  pendingVersion?: { id: string; document: string }
}

export function projectDocument(project: ProjectDocument): ProjectDocument {
  return {
    name: project.name,
    svg: project.svg,
    formatVersion: 1,
    ...(project.guides ? { guides: { x: project.guides.x, y: project.guides.y } } : {}),
  }
}

export function documentKey(project: ProjectDocument) {
  return JSON.stringify(projectDocument(project))
}

export const REMOTE_SAVE_INTERVAL = 30_000
export const RECENT_VERSION_LIMIT = 100
