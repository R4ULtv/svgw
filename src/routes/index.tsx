import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ArrowRightIcon, FileImageIcon, FolderOpenIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminSession } from '@/lib/admin-session'
import { cloudApi, CloudError } from '@/lib/cloud-api'
import type { RemoteProject } from '@/lib/cloud-types'
import { createProject, listProjects, saveProject, type Project } from '@/lib/projects'
import { projectLibrary } from '@/lib/project-library'
import { blankSvg, isSvgFile, sampleSvg, sanitizeSvg } from '@/lib/svg'
import { useCommands } from '@/components/commands'
import { designs, LandingPage, type LandingDesign } from '@/components/landing/landing-page'

export const Route = createFileRoute('/')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { design?: LandingDesign } => ({
    design:
      typeof search.design === 'string' && designs.includes(search.design as LandingDesign)
        ? (search.design as LandingDesign)
        : undefined,
  }),
  component: Home,
})

// All three concepts share the existing project lifecycle and canonical editor routes.
function Home() {
  const navigate = useNavigate()
  const { design: selectedDesign } = Route.useSearch()
  const design = selectedDesign ?? 'playground'
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
        else setRemoteError('Some projects could not be loaded. You can still open saved projects.')
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

  const library = projectLibrary(locals, remotes, session.admin)
  const projects = (
    <section
      id="projects"
      className="landing-projects border-t pt-12.5 pb-15 max-[481px]:pt-8.75 max-[481px]:pb-11.25 landing-container w-[min(1120px,_calc(100%_-_80px))] mx-auto max-[761px]:w-[calc(100%_-_40px)]"
      aria-labelledby="projects-heading"
    >
      <span className="landing-eyebrow inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[.12em] leading-[1.5] text-muted-foreground [&_>_svg]:w-3.5 [&_>_svg]:h-3.5 max-[481px]:text-[9px]">
        <FolderOpenIcon /> PICK UP WHERE YOU LEFT OFF
      </span>
      <div className="landing-project-heading flex justify-between items-center gap-5 mt-4 mb-6.25 [&_h2]:text-[30px] [&_>_span]:text-[11px] [&_>_span]:text-muted-foreground max-[481px]:items-start max-[481px]:flex-col max-[481px]:gap-2 max-[481px]:[&_h2]:text-[28px]">
        <h2 className="font-medium tracking-[-.055em]" id="projects-heading">
          Your corner of the canvas.
        </h2>
        <span>
          {library.length} {library.length === 1 ? 'project' : 'projects'}
        </span>
      </div>
      {localError && (
        <p
          role="status"
          className="landing-project-error text-[12px] mb-4.5! text-muted-foreground leading-[1.65]"
        >
          {localError}
        </p>
      )}
      {remoteError && (
        <p
          role="status"
          className="landing-project-error text-[12px] mb-4.5! text-muted-foreground leading-[1.65]"
        >
          {remoteError}
        </p>
      )}
      {library.length ? (
        <div className="landing-project-list grid grid-cols-3 gap-2.5 max-[761px]:grid-cols-2 max-[481px]:grid-cols-1">
          {library.map((project) => (
            <Link
              key={project.id}
              to="/project/$id"
              params={{ id: project.id }}
              className="landing-project-link flex items-center gap-2.75 p-4.25 border text-[12px] transition-[background] duration-150 ease-[ease] min-w-0 hover:bg-landing-surface [&_>_svg]:w-3.75 [&_>_svg]:h-3.75 [&_>_svg]:text-muted-foreground [&_>_span]:overflow-hidden [&_>_span]:whitespace-nowrap [&_>_span]:text-ellipsis [&_>_svg:last-child]:ml-auto [&_>_svg:last-child]:w-3"
            >
              <FileImageIcon />
              <span>{project.name || 'Untitled'}</span>
              <ArrowRightIcon />
            </Link>
          ))}
        </div>
      ) : (
        <div className="landing-projects-empty flex items-center justify-between gap-6.25 p-5.5 border border-dashed [&_>_div]:flex [&_>_div]:items-center [&_>_div]:gap-3.5 [&_svg]:w-5 [&_svg]:h-5 [&_svg]:text-muted-foreground [&_p]:text-[12px] [&_.landing-text-link]:mt-0 [&_.landing-text-link]:shrink-0 max-[481px]:items-start max-[481px]:flex-col max-[481px]:p-4.5 max-[481px]:gap-4.5">
          <div>
            <FolderOpenIcon />
            <p className="text-muted-foreground leading-[1.65]">
              Your ideas have a home here.
              <br />
              Projects will appear as you create them.
            </p>
          </div>
          <button
            type="button"
            className="landing-text-link inline-flex items-center gap-3.75 border-b pb-1.5 mt-6.25 text-[12px] [&_svg]:w-3.5 [&_svg]:h-3.5"
            disabled={creating || !session.authReady}
            onClick={() => void create()}
          >
            Make your first SVG
            <ArrowRightIcon />
          </button>
        </div>
      )}
    </section>
  )

  return (
    <LandingPage
      design={design}
      showDesignSwitcher={selectedDesign !== undefined}
      onDesignChange={(next) =>
        void navigate({ to: '/', search: { design: next }, hash: '', resetScroll: true }).then(() =>
          window.scrollTo(0, 0),
        )
      }
      onCreate={(svg, name) => void create(svg, name)}
      onImport={(file) => void importFile(file)}
      busy={creating || !session.authReady}
      projects={projects}
    />
  )
}
