import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRightIcon,
  CloudIcon,
  FileImageIcon,
  FolderOpenIcon,
  GlobeIcon,
  HardDriveIcon,
  LockKeyholeIcon,
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
import type { RemoteProject } from '@/lib/cloud-types'
import { timeAgo } from '@/lib/format'
import { projectLibrary, type ProjectEntry } from '@/lib/project-library'
import { createProject, listProjects, saveProject, type Project } from '@/lib/projects'
import { blankSvg, sampleSvg } from '@/lib/svg'
import { PROJECT_ACCEPT, type ImportedDocument } from '@/lib/project-import'
import { ProjectImportDialog, type ImportRequest } from './project-import-dialog'
import { useCommands } from './commands'
import { LoginButton } from './login-button'
import { Logo } from './logo'
import { useTheme } from './theme'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Spinner } from './ui/spinner'

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
      for (const document of documents ?? [{ name, svg, guides: undefined }]) {
        const project = createProject(document.name, document.svg)
        if (document.guides) project.guides = document.guides
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
        last = project
      }
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

  useCommands({
    'file.newBlank': () => void create(),
    'file.newSample': () => void create({ svg: sampleSvg, name: 'Sample logo' }),
  })

  const localProjects = projectLibrary(locals, [], session.admin)
  const remoteProjects = session.admin
    ? projectLibrary(locals, remotes, true).filter((project) => project.remote)
    : []
  const query = search.trim().toLocaleLowerCase()
  const matches = (project: ProjectEntry) =>
    (project.name || 'Untitled').toLocaleLowerCase().includes(query)
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
          title="On this device"
          description="Local copies saved in this browser."
          projects={localProjects.filter(matches)}
          total={localProjects.length}
          loading={localLoading}
          error={localError}
          searching={Boolean(query)}
        />

        <div className="mt-12 border-t pt-9">
          {session.admin || !session.authReady ? (
            <ProjectSection
              remote
              title="Remote projects"
              description="Projects saved online on your instance."
              projects={remoteProjects.filter(matches)}
              total={remoteProjects.length}
              loading={remoteLoading}
              error={remoteError}
              searching={Boolean(query)}
            />
          ) : (
            <section
              aria-labelledby="remote-login-heading"
              className="flex items-start gap-4 border border-dashed bg-landing-surface p-6 sm:p-8"
            >
              <CloudIcon className="mt-1 size-6 shrink-0 text-muted-foreground" />
              <div>
                <h2 id="remote-login-heading" className="text-base font-medium">
                  Log in to see remote projects.
                </h2>
                <p className="mt-2 max-w-120 text-sm leading-relaxed text-muted-foreground">
                  Access the projects saved on your instance. Your local projects are always
                  available here.
                </p>
              </div>
            </section>
          )}
        </div>
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
      <ProjectImportDialog
        request={importRequest}
        onClose={() => setImportRequest(null)}
        onImport={(documents) => create({ documents })}
      />
    </div>
  )
}

function ProjectSection({
  title,
  description,
  projects,
  total,
  loading,
  error,
  searching,
  remote = false,
}: {
  title: string
  description: string
  projects: ProjectEntry[]
  total: number
  loading: boolean
  error: string | null
  searching: boolean
  remote?: boolean
}) {
  const headingId = remote ? 'remote-projects-heading' : 'local-projects-heading'
  return (
    <section aria-labelledby={headingId} aria-busy={loading}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 id={headingId} className="flex items-center gap-2 text-base font-medium">
            {remote ? (
              <CloudIcon className="size-4 text-muted-foreground" />
            ) : (
              <HardDriveIcon className="size-4 text-muted-foreground" />
            )}
            {title}
            <span className="ml-1 border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
              {searching ? `${projects.length} / ${total}` : total}
            </span>
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {error && (
        <p
          role="status"
          className="mb-4 border border-dashed p-4 text-xs leading-relaxed text-muted-foreground"
        >
          {error}
        </p>
      )}
      {projects.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} remote={remote} />
          ))}
        </ul>
      ) : (
        !error && (
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
                  : remote
                    ? 'No remote projects yet. Create a project while logged in, or save one online from the editor.'
                    : 'No local projects yet. Start a new project or import an SVG or project.'}
            </p>
          </div>
        )
      )}
    </section>
  )
}

function ProjectCard({ project, remote }: { project: ProjectEntry; remote: boolean }) {
  const svg = project.local?.svg
  const thumbnail = useMemo(
    () =>
      svg === undefined ? null : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    [svg],
  )
  const isPublic = project.remote?.visibility === 'public'
  return (
    <li>
      <Link
        to="/project/$id"
        params={{ id: project.id }}
        className="group block overflow-hidden border bg-background transition-colors hover:border-muted-foreground/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <div className="checker relative flex h-44 items-center justify-center overflow-hidden border-b">
          {thumbnail ? (
            <img src={thumbnail} alt="" loading="lazy" className="size-full object-contain p-6" />
          ) : (
            <FileImageIcon className="size-10 text-muted-foreground/50" />
          )}
          <span className="absolute top-3 right-3 border bg-background px-2 py-1 text-[10px] text-muted-foreground">
            {remote ? (
              <span className="flex items-center gap-1.5">
                {isPublic ? (
                  <GlobeIcon className="size-3" />
                ) : (
                  <LockKeyholeIcon className="size-3" />
                )}
                {isPublic ? 'Public' : 'Private'}
              </span>
            ) : (
              'Local copy'
            )}
          </span>
        </div>
        <div className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{project.name || 'Untitled'}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Edited {timeAgo(project.updatedAt)}
            </p>
          </div>
          <ArrowUpRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          />
        </div>
      </Link>
    </li>
  )
}
