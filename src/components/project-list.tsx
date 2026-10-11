import { useMemo } from 'react'
import {
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  FileImageIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react'
import type { Project } from '@/lib/projects'
import type { RemoteProject } from '@/lib/cloud-types'
import type { ProjectEntry } from '@/lib/project-library'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'

interface ProjectListProps {
  projects: ProjectEntry[]
  activeId?: string
  loggedIn: boolean
  loading: boolean
  error: string | null
  onRefresh: () => void
  onOpen: (project: ProjectEntry) => void
  onDuplicate: (project: Project) => void
  onDownload: (project: Project) => void
  onDelete: (project: Project) => void
  onDeleteRemote: (project: RemoteProject) => void
}

export function ProjectList({
  projects,
  activeId,
  loading,
  error,
  onRefresh,
  ...actions
}: ProjectListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-4 py-2 text-[11px] text-muted-foreground">
        <span>
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Refresh projects"
          disabled={loading}
          onClick={onRefresh}
        >
          {loading ? <Spinner /> : <RefreshCwIcon />}
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {error && (
          <p role="status" className="px-4 pb-3 text-[11px] leading-relaxed text-muted-foreground">
            Some projects could not be loaded. Refresh to try again.
          </p>
        )}
        {projects.length ? (
          <ul className="flex flex-col gap-px p-2">
            {projects.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                active={project.id === activeId}
                {...actions}
              />
            ))}
          </ul>
        ) : (
          <p role="status" className="p-4 text-xs leading-relaxed text-muted-foreground">
            {loading
              ? 'Loading projects…'
              : 'No projects yet. Import an SVG or start a blank canvas.'}
          </p>
        )}
      </ScrollArea>
    </div>
  )
}

function ProjectItem({
  project,
  active,
  loggedIn,
  onOpen,
  onDuplicate,
  onDownload,
  onDelete,
  onDeleteRemote,
}: { project: ProjectEntry; active: boolean } & Omit<
  ProjectListProps,
  'projects' | 'activeId' | 'loading' | 'error' | 'onRefresh'
>) {
  // Images render SVG without running scripts, so stored markup is safe to preview this way.
  const svg = project.local?.svg
  const thumbnail = useMemo(
    () =>
      svg === undefined ? null : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    [svg],
  )
  const { local, remote } = project
  const canDeleteRemote = loggedIn && remote
  const hasActions = local || canDeleteRemote
  return (
    <li className="group/project relative">
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        onClick={() => onOpen(project)}
        className={cn(
          'flex w-full items-center gap-3 p-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring',
          hasActions && 'pr-9',
          active && 'bg-muted hover:bg-muted',
        )}
      >
        <span className="checker grid size-10 shrink-0 place-items-center overflow-hidden border border-border">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="size-full object-contain p-0.5" loading="lazy" />
          ) : (
            <FileImageIcon className="size-4 text-muted-foreground" />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn('truncate text-xs font-medium', !project.name && 'text-muted-foreground')}
          >
            {project.name || 'Untitled'}
          </span>
          <span className="text-[11px] text-muted-foreground">{timeAgo(project.updatedAt)}</span>
        </span>
      </button>
      {hasActions && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${project.name || 'Untitled'}`}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 group-hover/project:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
              />
            }
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {local && (
              <>
                <DropdownMenuItem onClick={() => onDuplicate(local)}>
                  <CopyIcon />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDownload(local)}>
                  <DownloadIcon />
                  Download SVG
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(local)}>
                  <Trash2Icon />
                  {canDeleteRemote ? 'Remove from this device…' : 'Delete…'}
                </DropdownMenuItem>
              </>
            )}
            {canDeleteRemote && (
              <DropdownMenuItem variant="destructive" onClick={() => onDeleteRemote(remote)}>
                <Trash2Icon />
                Delete online project…
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}
