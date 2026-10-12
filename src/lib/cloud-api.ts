import type {
  ProjectDocument,
  RemoteDocument,
  RemoteMutation,
  RemoteProject,
  VersionInfo,
  Visibility,
} from './cloud-types'
import type { SavedAdminSession } from './saved-admin-session'

export class CloudError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function cloudRequest<T>(
  path: string,
  key: string,
  options: { method?: string; data?: unknown; revision?: string | null } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
      headers: {
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(options.data !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.revision ? { 'If-Match': options.revision } : {}),
      },
      ...(options.data !== undefined ? { body: JSON.stringify(options.data) } : {}),
    })
  } catch {
    throw new CloudError(
      0,
      'You are offline. Your draft is saved on this device; online saving will retry.',
    )
  }
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new CloudError(503, 'The project API is unavailable. Your local draft is safe.')
  }
  if (!response.ok) {
    const error =
      data && typeof data === 'object' && 'error' in data
        ? String(data.error)
        : 'Could not complete the request.'
    throw new CloudError(
      response.status,
      response.status === 401 ? 'Remote access requires a valid key. Log in again.' : error,
    )
  }
  return data as T
}

export const cloudApi = {
  admin: (key: string) => cloudRequest<{ admin: boolean; configured: boolean }>('/admin', key),
  login: (key: string) =>
    cloudRequest<{ admin: boolean; configured: boolean; session: SavedAdminSession }>(
      '/admin',
      key,
      {
        method: 'POST',
      },
    ),
  async list(key: string) {
    const projects: RemoteProject[] = []
    let cursor: string | null = null
    do {
      const page: { projects: RemoteProject[]; cursor: string | null } = await cloudRequest(
        `/projects${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
        key,
      )
      projects.push(...page.projects)
      cursor = page.cursor
    } while (cursor)
    return projects.sort((a, b) => b.updatedAt - a.updatedAt)
  },
  get: (id: string, key: string) => cloudRequest<RemoteDocument>(`/projects/${id}`, key),
  save: (
    id: string,
    key: string,
    document: ProjectDocument,
    versionId: string,
    revision: string | null,
  ) =>
    cloudRequest<RemoteMutation>(revision ? `/projects/${id}` : '/projects', key, {
      method: revision ? 'PUT' : 'POST',
      data: { id, versionId, document },
      revision,
    }),
  publish: (id: string, key: string, versionId: string, revision: string) =>
    cloudRequest<RemoteMutation>(`/projects/${id}/publish`, key, {
      method: 'POST',
      data: { versionId },
      revision,
    }),
  visibility: (id: string, key: string, visibility: Visibility, revision: string) =>
    cloudRequest<RemoteMutation>(`/projects/${id}/visibility`, key, {
      method: 'PATCH',
      data: { visibility },
      revision,
    }),
  versions: (id: string, key: string) =>
    cloudRequest<{ versions: VersionInfo[]; revision: string }>(`/projects/${id}/versions`, key),
  pin: (id: string, key: string, versionId: string, pinned: boolean, revision: string) =>
    cloudRequest<RemoteMutation>(`/projects/${id}/versions/${versionId}`, key, {
      method: 'PATCH',
      data: { pinned },
      revision,
    }),
  restore: (id: string, key: string, versionId: string, revision: string) =>
    cloudRequest<RemoteMutation>(`/projects/${id}/restore`, key, {
      method: 'POST',
      data: { versionId },
      revision,
    }),
  delete: (id: string, key: string, revision: string) =>
    cloudRequest<{ deleted: boolean }>(`/projects/${id}`, key, { method: 'DELETE', revision }),
}
