import type { RemoteProject } from './cloud-types'
import { projectRouteId, type Project, type ProjectSummary } from './projects'

export interface ProjectEntry<Local extends ProjectSummary = Project> {
  /** The canonical project URL, shared by its saved version and browser copy. */
  id: string
  name: string
  updatedAt: number
  local?: Local
  remote?: RemoteProject
}

export function projectLibrary<Local extends ProjectSummary>(
  locals: Local[],
  remotes: RemoteProject[],
  loggedIn: boolean,
): ProjectEntry<Local>[] {
  const copies = new Map<string, Local>()
  const mode = loggedIn ? 'admin' : 'public'
  for (const project of locals) {
    const id = projectRouteId(project)
    const previous = copies.get(id)
    const preferred = project.cloud?.mode === mode
    const previousPreferred = previous?.cloud?.mode === mode
    if (
      !previous ||
      (preferred && !previousPreferred) ||
      (preferred === previousPreferred && project.updatedAt > previous.updatedAt)
    )
      copies.set(id, project)
  }

  const entries = new Map<string, ProjectEntry<Local>>()
  for (const local of copies.values())
    entries.set(projectRouteId(local), {
      id: projectRouteId(local),
      name: local.name,
      updatedAt: local.updatedAt,
      local,
    })
  for (const remote of remotes) {
    if (!loggedIn && remote.visibility !== 'public') continue
    // Use the copy this session would actually open. The other session's edits
    // must not replace the name or thumbnail of the saved project.
    const copy = copies.get(remote.id)
    const local = copy?.cloud?.mode === mode ? copy : undefined
    entries.set(remote.id, {
      id: remote.id,
      name: local?.name ?? remote.name,
      updatedAt: Math.max(local?.updatedAt ?? 0, remote.updatedAt),
      local,
      remote,
    })
  }
  return [...entries.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}
