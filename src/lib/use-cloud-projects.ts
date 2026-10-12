import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cloudApi, CloudError } from './cloud-api'
import {
  documentKey,
  projectDocument,
  REMOTE_SAVE_INTERVAL,
  type CloudLink,
  type RemoteDocument,
  type RemoteMutation,
  type RemoteProject,
  type VersionInfo,
  type Visibility,
} from './cloud-types'
import { linkAfter, uploadDraft } from './cloud-sync'
import { listProjects, type Project } from './projects'
import { useAdminSession } from './admin-session'

export type OnlineState =
  | 'local'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'conflict'
  | 'error'
  | 'locked'

interface Options {
  project: Project | null
  snapshot: () => Promise<Project | null>
  link: (localId: string, link: CloudLink | undefined) => Promise<void>
  open: (result: RemoteDocument, mode: CloudLink['mode'], reload?: boolean) => Promise<Project>
  removeRemote: (id: string) => Promise<void>
}

export function useCloudProjects(options: Options) {
  const latest = useRef(options)
  latest.current = options
  const { key, admin, authReady, unlock, lock } = useAdminSession()
  const [remoteProjects, setRemoteProjects] = useState<RemoteProject[]>([])
  const [loading, setLoading] = useState(false)
  const [remoteAvailable, setRemoteAvailable] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [onlineState, setOnlineState] = useState<OnlineState>('local')
  const [onlineError, setOnlineError] = useState<string | null>(null)
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const busy = useRef(false)
  const [working, setWorking] = useState(false)
  const conflict = useRef(new Set<string>())
  const mounted = useRef(true)
  const listGeneration = useRef(0)

  function fail(cause: unknown, localId?: string) {
    const error = cause instanceof Error ? cause.message : 'Could not save online.'
    if (localId && cause instanceof CloudError && cause.status === 409)
      conflict.current.add(localId)
    if (cause instanceof CloudError && cause.status === 401) lock()
    if (cause instanceof CloudError && (cause.status === 0 || cause.status === 503))
      setRemoteAvailable(false)
    if (localId && latest.current.project?.id !== localId) return
    setOnlineError(error)
    if (cause instanceof CloudError && cause.status === 409) {
      setOnlineState('conflict')
    } else if (cause instanceof CloudError && cause.status === 401) {
      setOnlineState('locked')
    } else
      setOnlineState(
        cause instanceof CloudError && (cause.status === 0 || cause.status === 503)
          ? 'offline'
          : 'error',
      )
  }

  async function refresh(auth = key.current) {
    const generation = ++listGeneration.current
    setLoading(true)
    try {
      const projects = await cloudApi.list(auth)
      if (mounted.current && generation === listGeneration.current) {
        setRemoteAvailable(true)
        setRemoteProjects(projects)
        setListError(null)
      }
    } catch (cause) {
      if (cause instanceof CloudError && cause.status === 401 && auth && auth === key.current) {
        lock()
        return
      }
      if (mounted.current && generation === listGeneration.current) {
        if (cause instanceof CloudError && (cause.status === 0 || cause.status === 503))
          setRemoteAvailable(false)
        setRemoteProjects([])
        setListError(cause instanceof Error ? cause.message : 'Could not load online projects.')
      }
    } finally {
      if (mounted.current && generation === listGeneration.current) setLoading(false)
    }
  }

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.current
      .catch(() => {})
      .then(async () => {
        busy.current = true
        setWorking(true)
        try {
          return await operation()
        } finally {
          busy.current = false
          if (mounted.current) setWorking(false)
        }
      })
    queue.current = result
    return result
  }

  function upsertRemote(project: RemoteProject) {
    if (!key.current) return
    setRemoteProjects((list) =>
      [project, ...list.filter((item) => item.id !== project.id)].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
    )
  }

  function updateLink(link: CloudLink, result: RemoteMutation): CloudLink {
    upsertRemote(result.project)
    return linkAfter(link, result)
  }

  async function saveSnapshot(allowCreate: boolean, draft?: Project) {
    if (!key.current) return
    const project = draft ?? (await latest.current.snapshot())
    if (!project || project.cloud?.mode === 'public' || (!project.cloud && !allowCreate)) return
    if (conflict.current.has(project.id))
      throw new CloudError(
        409,
        'Reload the remote draft before saving. Your local edits will be kept as a separate copy.',
      )
    const content = documentKey(projectDocument(project))
    if (project.cloud?.savedDocument === content && project.cloud.revision) {
      setOnlineState('saved')
      return
    }
    if (latest.current.project?.id === project.id) {
      setOnlineState('saving')
      setOnlineError(null)
    }
    try {
      await uploadDraft(
        project,
        key.current,
        (link) => latest.current.link(project.id, link),
        (result) => upsertRemote(result.project),
      )
      setRemoteAvailable(true)
      if (latest.current.project?.id === project.id) {
        const current = await latest.current.snapshot()
        setOnlineState(current && documentKey(current) !== content ? 'pending' : 'saved')
      }
    } catch (cause) {
      fail(cause, project.id)
      throw cause
    }
  }

  function save(allowCreate = true) {
    return exclusive(() => saveSnapshot(allowCreate))
  }

  function saveDrafts() {
    return exclusive(async () => {
      const current = await latest.current.snapshot()
      const drafts = await listProjects()
      for (const stored of drafts) {
        // Keep this tab's revision; another tab may have updated the shared IndexedDB record.
        const draft = current?.id === stored.id ? current : stored
        if (!key.current) break
        if (
          draft.cloud?.mode !== 'admin' ||
          conflict.current.has(draft.id) ||
          (draft.cloud.revision && documentKey(draft) === draft.cloud.savedDocument)
        )
          continue
        // Switching projects does not abandon an older project's pending upload.
        try {
          await saveSnapshot(false, draft)
        } catch {
          /* Other drafts can still save. */
        }
      }
    })
  }

  async function loadRemote(
    id: string,
    reload = false,
    mode: CloudLink['mode'] = key.current ? 'admin' : 'public',
  ) {
    let result: RemoteDocument
    try {
      result = await cloudApi.get(id, mode === 'admin' ? key.current : '')
      setRemoteAvailable(true)
    } catch (cause) {
      if (cause instanceof CloudError && cause.status === 401) lock()
      if (cause instanceof CloudError && (cause.status === 0 || cause.status === 503))
        setRemoteAvailable(false)
      throw cause
    }
    const current = await latest.current.open(result, mode, reload)
    if (reload) conflict.current.delete(current.id)
    else if (
      mode === 'admin' &&
      current.cloud?.revision &&
      current.cloud.revision !== result.revision &&
      current.cloud.pendingVersion?.id !== result.versionId
    )
      conflict.current.add(current.id)
    setOnlineError(null)
    setOnlineState(
      mode === 'public'
        ? 'local'
        : conflict.current.has(current.id)
          ? 'conflict'
          : documentKey(current) === current.cloud?.savedDocument
            ? 'saved'
            : 'pending',
    )
  }

  function openRemote(id: string, reload = false, mode?: CloudLink['mode']) {
    return exclusive(() => loadRemote(id, reload, mode))
  }

  async function mutation(operation: (link: CloudLink, auth: string) => Promise<RemoteMutation>) {
    const project = await latest.current.snapshot()
    if (!project?.cloud?.revision || project.cloud.mode !== 'admin' || !key.current)
      throw new Error('Open a remote draft while logged in first.')
    try {
      const result = await operation(project.cloud, key.current)
      await latest.current.link(project.id, updateLink(project.cloud, result))
      return result
    } catch (cause) {
      fail(cause, project.id)
      throw cause
    }
  }

  function publish() {
    return exclusive(async () => {
      await saveSnapshot(true)
      await mutation((link, auth) =>
        cloudApi.publish(link.id, auth, link.versionId, link.revision!),
      )
      toast.success('Published', { description: 'The public link now shows this saved version.' })
    })
  }

  function visibility(value: Visibility) {
    return exclusive(() =>
      mutation((link, auth) => cloudApi.visibility(link.id, auth, value, link.revision!)),
    )
  }

  async function loadVersions() {
    const project = await latest.current.snapshot()
    if (!project?.cloud || !key.current) return
    const result = await cloudApi.versions(project.cloud.id, key.current)
    setVersions(result.versions)
  }

  function pin(version: VersionInfo) {
    return exclusive(async () => {
      await mutation((link, auth) =>
        cloudApi.pin(link.id, auth, version.id, !version.pinned, link.revision!),
      )
      await loadVersions()
    })
  }

  function restore(versionId: string) {
    return exclusive(async () => {
      await saveSnapshot(false)
      const result = await mutation((link, auth) =>
        cloudApi.restore(link.id, auth, versionId, link.revision!),
      )
      await loadRemote(result!.project.id, true, 'admin')
      await loadVersions()
      toast.success('Version restored', {
        description: 'A new snapshot was created. The published version is unchanged.',
      })
    })
  }

  function deleteRemote(id: string) {
    return exclusive(async () => {
      const remote = await cloudApi.get(id, key.current)
      await cloudApi.delete(id, key.current, remote.revision!)
      await latest.current.removeRemote(id)
      setRemoteProjects((list) => list.filter((item) => item.id !== id))
      toast.success('Online project deleted', {
        description: 'Local copies are still available on this device.',
      })
    })
  }

  function changed() {
    if (
      latest.current.project?.cloud?.mode === 'admin' &&
      key.current &&
      !conflict.current.has(latest.current.project.id)
    )
      setOnlineState('pending')
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      // oxlint-disable-next-line react/exhaustive-deps -- Invalidate the current request generation at unmount; this ref is a counter, not a DOM node.
      ++listGeneration.current
    }
  }, [])

  useEffect(() => {
    if (authReady) void refresh()
    // oxlint-disable-next-line react/exhaustive-deps -- Authentication transitions trigger the refresh; it reads the current key from a ref.
  }, [authReady, admin])

  useEffect(() => {
    const project = options.project
    if (!project?.cloud || project.cloud.mode === 'public') setOnlineState('local')
    else if (!admin) setOnlineState('locked')
    else if (conflict.current.has(project.id)) setOnlineState('conflict')
    else if (!busy.current)
      setOnlineState(
        documentKey(project) === project.cloud.savedDocument && project.cloud.revision
          ? 'saved'
          : 'pending',
      )
  }, [options.project, admin])

  useEffect(() => {
    const retry = () => {
      void refresh()
      if (!busy.current && key.current) void saveDrafts().catch(() => {})
    }
    const timer = window.setInterval(() => {
      if (!busy.current && key.current) void saveDrafts().catch(() => {})
    }, REMOTE_SAVE_INTERVAL)
    const offline = () => setRemoteAvailable(false)
    window.addEventListener('online', retry)
    window.addEventListener('offline', offline)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', retry)
      window.removeEventListener('offline', offline)
    }
    // oxlint-disable-next-line react/exhaustive-deps -- Keep one autosave timer; its callbacks read the current project, key, queue, and busy refs.
  }, [])

  return {
    admin,
    isAdmin: () => Boolean(key.current),
    authReady,
    remoteProjects,
    loading,
    listError,
    remoteAvailable,
    onlineState,
    onlineError,
    working,
    versions,
    unlock,
    lock,
    refresh,
    save,
    publish,
    visibility,
    loadVersions,
    pin,
    restore,
    openRemote,
    deleteRemote,
    changed,
  }
}
