import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ArrowRightIcon, CloudIcon, CloudOffIcon, FolderOpenIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminSession } from '@/lib/admin-session'
import { cloudApi, CloudError } from '@/lib/cloud-api'
import type { RemoteProject } from '@/lib/cloud-types'
import {
  createProject,
  listProjects,
  projectRouteId,
  saveProject,
  type Project,
} from '@/lib/projects'
import { blankSvg, isSvgFile, sampleSvg, sanitizeSvg } from '@/lib/svg'
import { useCommands } from '@/components/commands'
import { LandingNextPage } from '@/components/landing-next/landing-page'

export const Route = createFileRoute('/landing-next')({
  ssr: false,
  component: Home,
})

// Independent landing-page copy; the current homepage is unchanged.
function Home() {
  const navigate = useNavigate()
  const session = useAdminSession()
  const [locals, setLocals] = useState<Project[]>([])
  const [remotes, setRemotes] = useState<RemoteProject[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)

  useEffect(() => {
    const legacyId = new URL(window.location.href).searchParams.get('project')
    if (legacyId) void navigate({ to: '/project/$id', params: { id: legacyId }, replace: true })
    let cancelled = false
    void listProjects()
      .then((projects) => {
        if (!cancelled) setLocals(projects)
      })
      .catch(() => {
        if (!cancelled) setLocalError('Local storage is unavailable.')
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  useEffect(() => {
    if (!session.authReady) return
    let cancelled = false
    setRemotes([])
    void cloudApi
      .list(session.key.current)
      .then((projects) => {
        if (!cancelled) {
          setRemotes(projects)
          setRemoteError(null)
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        if (cause instanceof CloudError && cause.status === 401) session.lock()
        else if (session.admin)
          setRemoteError('Remote projects are unavailable. You can still open local projects.')
      })
    return () => {
      cancelled = true
    }
    // oxlint-disable-next-line react/exhaustive-deps -- Refresh on authentication transitions; read the current key and lock action at that transition.
  }, [session.authReady, session.admin])

  async function create(svg = blankSvg, name = 'Untitled') {
    if (creatingRef.current || !session.authReady) return
    creatingRef.current = true
    setCreating(true)
    try {
      const project = createProject(name, svg)
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
      await navigate({ to: '/project/$id', params: { id: project.id } })
    } catch (cause) {
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
    'file.newSample': () => void create(sampleSvg, 'Sample logo'),
  })

  async function importFile(file: File) {
    if (creatingRef.current || !session.authReady) return
    try {
      if (!isSvgFile(file)) throw new Error('Choose an SVG file to open.')
      if (file.size > 8 * 1024 * 1024) throw new Error('Choose an SVG smaller than 8 MiB.')
      const svg = sanitizeSvg(await file.text())
      await create(svg, file.name.replace(/\.svg$/i, '') || 'Imported SVG')
    } catch (cause) {
      toast.error('Could not open SVG', {
        description: cause instanceof Error ? cause.message : 'Try another file.',
      })
    }
  }

  // Both copies of the same remote project open the same canonical route.
  const localProjects = locals.filter(
    (project, index) =>
      locals.findIndex((item) => projectRouteId(item) === projectRouteId(project)) === index,
  )
  const projects = (
    <section
      id="projects"
      className="next-projects border-t pt-10.5 pb-11.25 next-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]"
      aria-labelledby="projects-heading"
    >
      <div className="next-project-heading flex items-center justify-between gap-6 mb-6 [&_h2]:text-[29px] [&_h2]:leading-[1.2] [&_>_span]:text-[11px] [&_>_span]:text-muted-foreground [&_>_span]:whitespace-nowrap max-[761px]:[&_h2]:text-[27px] max-[481px]:flex-col max-[481px]:items-start max-[481px]:gap-2.5 max-[481px]:mb-5.5 max-[481px]:[&_h2]:text-[27px]">
        <h2 className="font-medium tracking-[-.055em]" id="projects-heading">
          Projects saved in this browser.
        </h2>
        <span>
          {localProjects.length} {localProjects.length === 1 ? 'project' : 'projects'}
        </span>
      </div>
      {localError && (
        <p role="status" className="next-project-error mb-4! text-[12px] text-muted-foreground">
          {localError}
        </p>
      )}
      {remoteError && (
        <p role="status" className="next-project-error mb-4! text-[12px] text-muted-foreground">
          {remoteError}
        </p>
      )}
      {localProjects.length ? (
        <div className="next-project-list grid grid-cols-3 gap-2.5 max-[761px]:grid-cols-2 max-[481px]:grid-cols-1">
          {localProjects.map((project) => (
            <Link
              key={project.id}
              to="/project/$id"
              params={{ id: projectRouteId(project) }}
              className="next-project-link flex items-center gap-3 min-w-0 pt-4.5 pr-4 pb-4.5 pl-4 border text-[12px] [&_>_span]:min-w-0 [&_>_span]:flex-1 [&_>_span]:overflow-hidden [&_>_span]:whitespace-nowrap [&_>_span]:text-ellipsis [&_>_svg]:w-3.75 [&_>_svg]:h-3.75 [&_>_svg]:text-muted-foreground [&_>_svg:last-child]:w-3 [&_>_svg:last-child]:h-3 hover:bg-muted"
            >
              <CloudOffIcon />
              <span>{project.name || 'Untitled'}</span>
              <ArrowRightIcon />
            </Link>
          ))}
        </div>
      ) : (
        <div className="next-projects-empty flex items-center justify-between gap-6 p-6 border [&_>_div]:flex [&_>_div]:items-center [&_>_div]:gap-3.5 [&_>_div_>_svg]:w-5.5 [&_>_div_>_svg]:h-5.5 [&_>_div_>_svg]:text-muted-foreground [&_p]:text-[12px] [&_p]:leading-[1.7] max-[481px]:flex-col max-[481px]:items-start max-[481px]:p-5 max-[481px]:gap-5">
          <div>
            <FolderOpenIcon />
            <p className="text-muted-foreground">
              No projects saved here yet.
              <br />
              Start a new SVG or open a file.
            </p>
          </div>
          <button
            type="button"
            className="next-text-link inline-flex items-center gap-2.5 text-[12px] shrink-0 [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 hover:underline hover:underline-offset-4"
            disabled={creating || !session.authReady}
            onClick={() => void create()}
          >
            New project
            <ArrowRightIcon />
          </button>
        </div>
      )}
      {!!remotes.length && (
        <section aria-label={session.admin ? 'Remote projects' : 'Public projects'}>
          <h3 className="next-project-subheading mt-6.25! mb-3! text-[12px] font-normal text-muted-foreground">
            {session.admin ? 'Remote projects' : 'Public projects'}
          </h3>
          <div className="next-project-list grid grid-cols-3 gap-2.5 max-[761px]:grid-cols-2 max-[481px]:grid-cols-1">
            {remotes.map((project) => (
              <Link
                key={project.id}
                to="/project/$id"
                params={{ id: project.id }}
                className="next-project-link flex items-center gap-3 min-w-0 pt-4.5 pr-4 pb-4.5 pl-4 border text-[12px] [&_>_span]:min-w-0 [&_>_span]:flex-1 [&_>_span]:overflow-hidden [&_>_span]:whitespace-nowrap [&_>_span]:text-ellipsis [&_>_svg]:w-3.75 [&_>_svg]:h-3.75 [&_>_svg]:text-muted-foreground [&_>_svg:last-child]:w-3 [&_>_svg:last-child]:h-3 hover:bg-muted"
              >
                <CloudIcon />
                <span>{project.name || 'Untitled'}</span>
                <ArrowRightIcon />
              </Link>
            ))}
          </div>
        </section>
      )}
    </section>
  )

  return (
    <LandingNextPage
      onCreate={(svg, name) => void create(svg, name)}
      onImport={(file) => void importFile(file)}
      busy={creating || !session.authReady}
      projects={projects}
    />
  )
}
