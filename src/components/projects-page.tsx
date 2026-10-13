import { Link, useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  CloudIcon,
  FileImageIcon,
  FolderOpenIcon,
  MoonIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SunIcon,
  UploadIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAdminSession } from '@/lib/admin-session'
import { cloudApi, CloudError } from '@/lib/cloud-api'
import { copyFromRemote, hasUnsavedOnlineChanges, linkAfter, uploadDraft } from '@/lib/cloud-sync'
import type {
  CloudLink,
  RemoteMutation,
  RemoteProject,
  VersionInfo,
  Visibility,
} from '@/lib/cloud-types'
import { exportedSvg } from '@/lib/layers'
import { projectLibrary, type ProjectEntry } from '@/lib/project-library'
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  projectRouteId,
  saveProject,
  type Project,
} from '@/lib/projects'
import { blankSvg, downloadSvg, sampleSvg } from '@/lib/svg'
import { PROJECT_ACCEPT, type ImportedDocument } from '@/lib/project-import'
import { ProjectCard, type ProjectActions } from './project-card'
import type { ImportRequest } from './project-import-dialog'
import { useCommands, useCommandScope } from './commands'
import { ProjectRenameDialog } from './project-rename-dialog'
import { LoginButton } from './login-button'
import { Logo } from './logo'
import { useTheme } from './theme'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Spinner } from './ui/spinner'
import { VersionHistoryDialog } from './version-history-dialog'

const ProjectImportDialog = lazy(() =>
  import('./project-import-dialog').then((module) => ({ default: module.ProjectImportDialog })),
)

type PendingDelete =
  /** `online`: the project is also saved online, so only this device's copy goes. */
  { kind: 'local'; project: Project; online: boolean } | { kind: 'remote'; project: RemoteProject }

const message = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback

export function ProjectsPage() {
  const navigate = useNavigate()
  const session = useAdminSession()
  const { resolved, setPreference } = useTheme()
  const [locals, setLocals] = useState<Project[]>([])
  const [remotes, setRemotes] = useState<RemoteProject[]>([])
  const [localLoading, setLocalLoading] = useState(true)
  const [remoteLoading, setRemoteLoading] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [importRequest, setImportRequest] = useState<ImportRequest | null>(null)
  const [renaming, setRenaming] = useState<Project | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  useCommandScope('dialog', Boolean(pendingDelete))
  // Projects with an online action in flight; their menus wait for it.
  const [working, setWorking] = useState<ReadonlySet<string>>(new Set())
  const [history, setHistory] = useState<{
    entry: ProjectEntry
    versions: VersionInfo[]
    revision: string | null
    loading: boolean
    error: string | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLocalLoading(true)
    void listProjects()
      .then((projects) => {
        if (!cancelled) {
          setLocals(projects)
          setLocalError(null)
        }
      })
      .catch(() => {
        if (!cancelled) setLocalError('Local storage is unavailable. Refresh to try again.')
      })
      .finally(() => {
        if (!cancelled) setLocalLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refresh])

  useEffect(() => {
    setRemotes([])
    setRemoteError(null)
    if (!session.authReady || !session.admin) {
      setRemoteLoading(!session.authReady)
      return
    }
    let cancelled = false
    setRemoteLoading(true)
    void cloudApi
      .list(session.key.current)
      .then((projects) => {
        if (!cancelled) setRemotes(projects)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        if (cause instanceof CloudError && cause.status === 401) session.lock()
        else setRemoteError('Remote projects are unavailable. You can still open local projects.')
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false)
      })
    return () => {
      cancelled = true
    }
    // oxlint-disable-next-line react/exhaustive-deps -- Refresh on authentication transitions; use the key and lock action for that session.
  }, [session.authReady, session.admin, refresh])

  useEffect(() => {
    const reload = () => setRefresh((value) => value + 1)
    window.addEventListener('focus', reload)
    window.addEventListener('online', reload)
    return () => {
      window.removeEventListener('focus', reload)
      window.removeEventListener('online', reload)
    }
  }, [])

  async function create({
    svg = blankSvg,
    name = 'Untitled',
    documents,
  }: {
    svg?: string
    name?: string
    documents?: ImportedDocument[]
  } = {}) {
    if (creatingRef.current || !session.authReady) return
    creatingRef.current = true
    setCreating(true)
    try {
      let last: Project | undefined
      for (const document of documents ?? [{ name, svg, guides: undefined }])
        last = await addProject(document.name, document.svg, document.guides)
      if (last) await navigate({ to: '/project/$id', params: { id: last.id } })
    } catch (cause) {
      if (documents) throw cause
      toast.error('Could not create project', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      })
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  /** Saves a new project on this device. In an admin session it also starts a private online draft. */
  async function addProject(name: string, svg: string, guides?: Project['guides']) {
    const project = createProject(name, svg)
    if (guides) project.guides = guides
    if (session.admin)
      project.cloud = {
        id: project.id,
        mode: 'admin',
        revision: null,
        versionId: '',
        savedDocument: '',
        visibility: 'private',
        publishedVersionId: null,
      }
    await saveProject(project)
    setLocals((locals) => [project, ...locals])
    return project
  }

  async function duplicate(project: Project) {
    try {
      await addProject(`${project.name || 'Untitled'} copy`, project.svg, project.guides)
      toast.success(`Duplicated “${project.name || 'Untitled'}”`)
    } catch (cause) {
      toast.error('Could not duplicate project', { description: message(cause, 'Try again.') })
    }
  }

  async function rename(project: Project, name: string) {
    const next = { ...project, name, updatedAt: Date.now() }
    try {
      await saveProject(next)
      setLocals((locals) => locals.map((item) => (item.id === next.id ? next : item)))
    } catch (cause) {
      toast.error('Could not rename project', {
        description: message(cause, 'Browser storage is unavailable.'),
      })
    }
  }

  async function remove(project: Project, online: boolean) {
    try {
      await deleteProject(project.id)
      setLocals((locals) => locals.filter((item) => item.id !== project.id))
      toast.success(
        online
          ? `Removed “${project.name || 'Untitled'}” from this device`
          : `Deleted “${project.name || 'Untitled'}”`,
      )
    } catch (cause) {
      toast.error('Could not delete project', {
        description: message(cause, 'Browser storage is unavailable.'),
      })
    }
  }

  function removeRemote(project: RemoteProject) {
    void online(project.id, 'Could not delete online project', async () => {
      const key = session.key.current
      const current = await cloudApi.get(project.id, key)
      await cloudApi.delete(project.id, key, current.revision!)
      // Copies on this device stay, as ordinary local projects.
      const copies = (await listProjects()).filter((local) => local.cloud?.id === project.id)
      for (const local of copies) await persistLink(local.id, undefined)
      setRemotes((list) => list.filter((item) => item.id !== project.id))
      toast.success('Online project deleted', {
        description: copies.length ? 'The copy on this device is still available.' : undefined,
      })
    })
  }

  /** Runs an online action on one project, reporting failures; a rejected login locks the session. */
  async function online(id: string, title: string, operation: () => Promise<void>) {
    setWorking((ids) => new Set(ids).add(id))
    try {
      await operation()
    } catch (cause) {
      if (cause instanceof CloudError && cause.status === 401) session.lock()
      toast.error(title, { description: message(cause, 'Try again.') })
    } finally {
      setWorking((ids) => {
        const next = new Set(ids)
        next.delete(id)
        return next
      })
    }
  }

  /** Stores a link on a local copy, as the editor does, keeping its current content. */
  async function persistLink(localId: string, link: CloudLink | undefined) {
    const stored = await getProject(localId)
    if (!stored) throw new Error('The project is no longer on this device.')
    const next = { ...stored, cloud: link }
    await saveProject(next)
    setLocals((list) => list.map((item) => (item.id === localId ? next : item)))
    return next
  }

  function upsertRemote(project: RemoteProject) {
    setRemotes((list) => [project, ...list.filter((item) => item.id !== project.id)])
  }

  /**
   * Applies an online change made from revision `from` to this device's copies, so the editor
   * doesn't report a conflict. A copy already behind `from` keeps its link: it really is behind.
   */
  async function syncCopies(from: string, result: RemoteMutation) {
    upsertRemote(result.project)
    for (const local of await listProjects())
      if (
        local.cloud?.id === result.project.id &&
        local.cloud.mode === 'admin' &&
        local.cloud.revision === from
      )
        await persistLink(local.id, linkAfter(local.cloud, result))
  }

  /** Uploads this device's newer changes to a project's online draft. */
  async function upload(project: Project) {
    const stored = (await getProject(project.id)) ?? project
    await uploadDraft(
      stored,
      session.key.current,
      async (link) => void (await persistLink(stored.id, link)),
      (result) => upsertRemote(result.project),
    )
  }

  /** The online project's current state, after uploading this device's newer changes. */
  async function latestOnline(entry: ProjectEntry) {
    if (entry.local && hasUnsavedOnlineChanges(entry.local)) await upload(entry.local)
    return cloudApi.get(entry.id, session.key.current)
  }

  function publish(entry: ProjectEntry) {
    void online(entry.id, 'Could not publish', async () => {
      const current = await latestOnline(entry)
      const result = await cloudApi.publish(
        entry.id,
        session.key.current,
        current.versionId,
        current.revision!,
      )
      await syncCopies(current.revision!, result)
      toast.success('Published', { description: 'The public link now shows the latest version.' })
    })
  }

  function changeVisibility(entry: ProjectEntry, visibility: Visibility) {
    void online(entry.id, 'Could not change visibility', async () => {
      const current = await cloudApi.get(entry.id, session.key.current)
      const result = await cloudApi.visibility(
        entry.id,
        session.key.current,
        visibility,
        current.revision!,
      )
      await syncCopies(current.revision!, result)
      toast.success(visibility === 'public' ? 'Project is public' : 'Project is private')
    })
  }

  async function copyLink(id: string) {
    const url = new URL(`/project/${id}`, location.origin).toString()
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Public link copied')
    } catch {
      toast('Public project link', { description: url, duration: 15_000 })
    }
  }

  async function loadHistory(entry: ProjectEntry) {
    setHistory({ entry, versions: [], revision: null, loading: true, error: null })
    try {
      const result = await cloudApi.versions(entry.id, session.key.current)
      setHistory((current) =>
        current?.entry.id === entry.id
          ? { ...current, versions: result.versions, revision: result.revision, loading: false }
          : current,
      )
    } catch (cause) {
      if (cause instanceof CloudError && cause.status === 401) session.lock()
      setHistory((current) =>
        current?.entry.id === entry.id
          ? { ...current, loading: false, error: message(cause, 'Could not load versions.') }
          : current,
      )
    }
  }

  function pin(version: VersionInfo) {
    const current = history
    if (!current?.revision) return
    void online(current.entry.id, 'Could not update the version', async () => {
      const result = await cloudApi.pin(
        current.entry.id,
        session.key.current,
        version.id,
        !version.pinned,
        current.revision!,
      )
      await syncCopies(current.revision!, result)
      await loadHistory({ ...current.entry, remote: result.project })
    })
  }

  function restore(version: VersionInfo) {
    const current = history
    if (!current?.revision) return
    void online(current.entry.id, 'Could not restore the version', async () => {
      const from = current.revision!
      const result = await cloudApi.restore(current.entry.id, session.key.current, version.id, from)
      upsertRemote(result.project)
      // Bring an up-to-date copy on this device to the restored version. A copy with newer
      // changes is left alone; the editor offers to reload it.
      const copies = (await listProjects()).filter(
        (local) =>
          local.cloud?.id === current.entry.id &&
          local.cloud.mode === 'admin' &&
          local.cloud.revision === from &&
          !hasUnsavedOnlineChanges(local),
      )
      if (copies.length) {
        const restored = await cloudApi.get(current.entry.id, session.key.current)
        for (const local of copies) {
          const next = copyFromRemote(restored, 'admin', local)
          await saveProject(next)
          setLocals((list) => list.map((item) => (item.id === next.id ? next : item)))
        }
      }
      await loadHistory({ ...current.entry, remote: result.project })
      toast.success('Version restored', {
        description: 'A new snapshot was created. The published version is unchanged.',
      })
    })
  }

  async function download(entry: ProjectEntry) {
    try {
      const svg =
        entry.local?.svg ?? (await cloudApi.get(entry.id, session.key.current)).document.svg
      downloadSvg(exportedSvg(svg), entry.name)
    } catch (cause) {
      toast.error('Could not download SVG', { description: message(cause, 'Try again.') })
    }
  }

  const actions: ProjectActions = {
    onRename: setRenaming,
    onDuplicate: (project) => void duplicate(project),
    onDownload: (entry) => void download(entry),
    onDelete: (project) =>
      setPendingDelete({
        kind: 'local',
        project,
        online:
          session.admin &&
          project.cloud?.mode === 'admin' &&
          remotes.some((remote) => remote.id === project.cloud!.id),
      }),
    onSaveOnline: (project) =>
      void online(projectRouteId(project), 'Could not save online', async () => {
        await upload(project)
        toast.success('Saved online')
      }),
    onPublish: publish,
    onVisibility: changeVisibility,
    onCopyLink: (id) => void copyLink(id),
    onHistory: (entry) => void loadHistory(entry),
    onDeleteRemote: (project) => setPendingDelete({ kind: 'remote', project }),
  }

  useCommands({
    'file.newBlank': () => void create(),
    'file.newSample': () => void create({ svg: sampleSvg, name: 'Sample logo' }),
  })

  // One entry per project, whether it is on this device, online, or both.
  const allProjects = useMemo(
    () => projectLibrary(locals, session.admin ? remotes : [], session.admin),
    [locals, remotes, session.admin],
  )
  const deferredSearch = useDeferredValue(search)
  const query = deferredSearch.trim().toLocaleLowerCase()
  const matches = useMemo(
    () =>
      allProjects.filter((project) =>
        (project.name || 'Untitled').toLocaleLowerCase().includes(query),
      ),
    [allProjects, query],
  )
  const busy = creating || !session.authReady
  const loading = localLoading || remoteLoading

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#projects-main" className="fixed -top-16 left-5 z-50 bg-background p-3 focus:top-3">
        Skip to content
      </a>
      <header className="mx-auto flex h-19 max-w-300 items-center gap-6 border-b px-5 sm:px-10">
        <Link
          to="/"
          aria-label="svgw home"
          className="flex items-center gap-2.5 text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Logo className="size-8" />
          <span>
            svgw<span className="text-muted-foreground">.</span>
          </span>
        </Link>
        <span className="hidden border-l pl-6 text-xs text-muted-foreground sm:block">
          Your workspace
        </span>
        <nav aria-label="Account and appearance" className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
            onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')}
          >
            {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
          </Button>
          <LoginButton />
        </nav>
      </header>

      <main id="projects-main" className="mx-auto max-w-290 px-5 pt-10 pb-16 sm:px-10 sm:pt-14">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] tracking-[.14em] text-muted-foreground">
              <FolderOpenIcon className="size-3.5" /> A HOME FOR YOUR IDEAS
            </p>
            <h1 className="text-4xl font-medium tracking-[-.055em] sm:text-5xl">Your projects.</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Pick up where you left off, or start with a blank canvas.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-10 px-4"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <UploadIcon /> Import project
            </Button>
            <Button className="h-10 px-4" disabled={busy} onClick={() => void create()}>
              {creating ? <Spinner /> : <PlusIcon />} New project
            </Button>
          </div>
        </div>

        <div className="mt-8 mb-10 flex items-center gap-3 border-y py-4">
          <div className="relative w-full sm:max-w-80">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search projects"
              placeholder="Search projects…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 pl-9"
            />
          </div>
          <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
            Newest first
          </span>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Refresh projects"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            {loading ? <Spinner /> : <RefreshCwIcon />}
          </Button>
        </div>

        <ProjectSection
          projects={matches}
          total={allProjects.length}
          loading={loading}
          errors={[localError, remoteError]}
          searching={Boolean(query)}
          admin={session.admin}
          working={working}
          actions={actions}
        />

        {session.authReady && !session.admin && (
          <section
            aria-labelledby="remote-login-heading"
            className="mt-12 flex items-start gap-4 border border-dashed bg-landing-surface p-6 sm:p-8"
          >
            <CloudIcon className="mt-1 size-6 shrink-0 text-muted-foreground" />
            <div>
              <h2 id="remote-login-heading" className="text-base font-medium">
                Log in to see projects saved online.
              </h2>
              <p className="mt-2 max-w-120 text-sm leading-relaxed text-muted-foreground">
                They appear in this list next to the ones on this device, marked with a cloud.
              </p>
            </div>
          </section>
        )}
      </main>

      <input
        ref={fileInput}
        type="file"
        accept={PROJECT_ACCEPT}
        multiple
        className="hidden"
        aria-label="Import an SVG or project file"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          if (files.length) setImportRequest({ files, asProjects: true })
        }}
      />
      {importRequest && (
        <Suspense fallback={null}>
          <ProjectImportDialog
            request={importRequest}
            onClose={() => setImportRequest(null)}
            onImport={(documents) => create({ documents })}
          />
        </Suspense>
      )}
      <ProjectRenameDialog
        open={Boolean(renaming)}
        onOpenChange={(open) => {
          if (!open) setRenaming(null)
        }}
        name={renaming?.name ?? ''}
        onRename={(name) => {
          if (renaming) void rename(renaming, name)
          setRenaming(null)
        }}
      />
      <VersionHistoryDialog
        open={Boolean(history)}
        onOpenChange={(open) => {
          if (!open) setHistory(null)
        }}
        versions={history?.versions ?? []}
        loading={history?.loading ?? false}
        error={history?.error ?? null}
        working={history ? working.has(history.entry.id) : false}
        latestVersionId={history?.entry.remote?.latestVersionId}
        publishedVersionId={history?.entry.remote?.publishedVersionId}
        onPin={pin}
        onRestore={restore}
      />
      <DeleteDialog
        pending={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={(pending) => {
          if (pending.kind === 'local') void remove(pending.project, pending.online)
          else removeRemote(pending.project)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}

function DeleteDialog({
  pending,
  onClose,
  onConfirm,
}: {
  pending: PendingDelete | null
  onClose: () => void
  onConfirm: (pending: PendingDelete) => void
}) {
  // Keep the last request while the dialog animates closed.
  const last = useRef(pending)
  if (pending) last.current = pending
  const shown = last.current
  const name = shown?.project.name || 'Untitled'
  const online = shown?.kind === 'local' && shown.online
  return (
    <AlertDialog
      open={Boolean(pending)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {shown?.kind === 'remote'
              ? `Delete online “${name}”?`
              : online
                ? `Remove “${name}” from this device?`
                : `Delete “${name}”?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {shown?.kind === 'remote'
              ? 'This deletes the remote project and its version history. Local copies on this device are kept.'
              : online
                ? 'This removes the copy saved in this browser. The project stays online and in this list; changes not yet saved online are lost.'
                : 'This removes the project from this browser. It can’t be undone, so download the SVG first if you want to keep it.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (pending) onConfirm(pending)
            }}
          >
            {shown?.kind === 'remote' ? 'Delete online' : online ? 'Remove' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ProjectSection({
  projects,
  total,
  loading,
  errors,
  searching,
  admin,
  working,
  actions,
}: {
  projects: ProjectEntry[]
  total: number
  loading: boolean
  errors: (string | null)[]
  searching: boolean
  admin: boolean
  working: ReadonlySet<string>
  actions: ProjectActions
}) {
  return (
    <section aria-labelledby="projects-heading" aria-busy={loading}>
      <div className="mb-5">
        <h2 id="projects-heading" className="flex items-center gap-2 text-base font-medium">
          All projects
          <span className="ml-1 border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
            {searching ? `${projects.length} / ${total}` : total}
          </span>
        </h2>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {admin
            ? 'Saved in this browser and online. A cloud marks the projects saved online.'
            : 'Saved in this browser.'}
        </p>
      </div>
      {errors.filter(Boolean).map((error) => (
        <p
          key={error}
          role="status"
          className="mb-4 border border-dashed p-4 text-xs leading-relaxed text-muted-foreground"
        >
          {error}
        </p>
      ))}
      {projects.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              admin={admin}
              busy={working.has(project.id)}
              actions={actions}
            />
          ))}
        </ul>
      ) : (
        <div
          role="status"
          className="flex min-h-40 flex-col items-center justify-center gap-3 border border-dashed p-6 text-center text-sm text-muted-foreground"
        >
          {loading ? <Spinner className="size-5" /> : <FileImageIcon className="size-6" />}
          <p>
            {loading
              ? 'Loading projects…'
              : searching
                ? 'No projects match your search.'
                : 'No projects yet. Start a new project or import an SVG or project.'}
          </p>
        </div>
      )}
    </section>
  )
}
