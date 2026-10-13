import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  CloudIcon,
  CloudUploadIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  FileImageIcon,
  GlobeIcon,
  HistoryIcon,
  LockIcon,
  PencilIcon,
  Share2Icon,
  Trash2Icon,
} from 'lucide-react'
import { hasUnsavedOnlineChanges } from '@/lib/cloud-sync'
import type { RemoteProject, Visibility } from '@/lib/cloud-types'
import { timeAgo } from '@/lib/format'
import type { ProjectEntry } from '@/lib/project-library'
import type { Project } from '@/lib/projects'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Spinner } from './ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

/** Actions on a project card. Local ones need a copy on this device; online ones a login. */
export interface ProjectActions {
  onRename: (project: Project) => void
  onDuplicate: (project: Project) => void
  onDownload: (entry: ProjectEntry) => void
  onDelete: (project: Project) => void
  onSaveOnline: (project: Project) => void
  onPublish: (entry: ProjectEntry) => void
  onVisibility: (entry: ProjectEntry, visibility: Visibility) => void
  onCopyLink: (id: string) => void
  onHistory: (entry: ProjectEntry) => void
  onDeleteRemote: (project: RemoteProject) => void
}

export function ProjectCard({
  project,
  admin,
  busy,
  actions,
}: {
  project: ProjectEntry
  /** Logged in: show where the project is saved, and the online actions. */
  admin: boolean
  /** An online action on this project is running. */
  busy: boolean
  actions: ProjectActions
}) {
  const svg = project.local?.svg
  const card = useRef<HTMLLIElement>(null)
  const [visible, setVisible] = useState(false)
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  useEffect(() => {
    const element = card.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '300px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible || svg === undefined) {
      setThumbnail(null)
      return
    }
    // Blob URLs avoid URI-encoding and duplicating large SVGs in every card's DOM.
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    setThumbnail(url)
    return () => URL.revokeObjectURL(url)
  }, [svg, visible])
  const name = project.name || 'Untitled'
  return (
    <li
      ref={card}
      className="relative [content-visibility:auto] [contain-intrinsic-size:auto_250px]"
    >
      <Link
        to="/project/$id"
        params={{ id: project.id }}
        className="group block overflow-hidden border bg-background transition-colors hover:border-muted-foreground/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <div className="checker relative flex h-44 items-center justify-center overflow-hidden border-b">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-contain p-6"
            />
          ) : (
            <FileImageIcon className="size-10 text-muted-foreground/50" />
          )}
        </div>
        {/* Leave room on the right for the status and actions, which sit over the card. */}
        <div className="p-4 pr-20">
          <h3 className="truncate text-sm font-medium">{name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Edited {timeAgo(project.updatedAt)}</p>
        </div>
      </Link>
      <div className="absolute right-3 bottom-4 flex items-center gap-1">
        {busy ? (
          <Spinner className="mx-2 size-3.5 text-muted-foreground" />
        ) : (
          admin && <OnlineStatus project={project} />
        )}
        <ProjectMenu project={project} name={name} admin={admin} busy={busy} actions={actions} />
      </div>
    </li>
  )
}

/** Whether the project is saved online, and whether it is public. */
function OnlineStatus({ project }: { project: ProjectEntry }) {
  const { local, remote } = project
  if (!remote) return null
  const pending = local && hasUnsavedOnlineChanges(local)
  const isPublic = remote.visibility === 'public' && remote.publishedVersionId
  const label = [
    pending ? 'Saved online, with newer changes on this device' : 'Saved online',
    isPublic ? 'Public' : 'Private',
    !local && 'Not on this device yet',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={label}
            className="flex h-8 items-center gap-1 px-1 text-muted-foreground [&_svg]:size-3.5"
          />
        }
      >
        {pending ? <CloudUploadIcon /> : <CloudIcon />}
        {isPublic && <GlobeIcon />}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ProjectMenu({
  project,
  name,
  admin,
  busy,
  actions,
}: {
  project: ProjectEntry
  name: string
  admin: boolean
  busy: boolean
  actions: ProjectActions
}) {
  const { local, remote } = project
  // A copy opened from someone's public link cannot be saved over their project.
  const canSaveOnline =
    admin && local && local.cloud?.mode !== 'public' && (!remote || hasUnsavedOnlineChanges(local))
  const published = Boolean(remote?.publishedVersionId)
  const isPublic = remote?.visibility === 'public'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`} disabled={busy} />
        }
      >
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {local && (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => actions.onRename(local)}>
              <PencilIcon />
              Rename…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.onDuplicate(local)}>
              <CopyIcon />
              Duplicate
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
        <DropdownMenuItem onClick={() => actions.onDownload(project)}>
          <DownloadIcon />
          Download SVG
        </DropdownMenuItem>
        {admin && (canSaveOnline || remote) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Online</DropdownMenuLabel>
              {canSaveOnline && (
                <DropdownMenuItem onClick={() => actions.onSaveOnline(local)}>
                  <CloudUploadIcon />
                  {remote ? 'Save changes online' : 'Save online'}
                </DropdownMenuItem>
              )}
              {remote && (
                <>
                  <DropdownMenuItem onClick={() => actions.onPublish(project)}>
                    <GlobeIcon />
                    Publish latest version
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!published}
                    onClick={() => actions.onVisibility(project, isPublic ? 'private' : 'public')}
                  >
                    {isPublic ? <LockIcon /> : <GlobeIcon />}
                    {isPublic ? 'Make private' : 'Make public'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!isPublic || !published}
                    onClick={() => actions.onCopyLink(remote.id)}
                  >
                    <Share2Icon />
                    Copy public link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => actions.onHistory(project)}>
                    <HistoryIcon />
                    Version history
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuGroup>
          </>
        )}
        {(local || (admin && remote)) && <DropdownMenuSeparator />}
        {local && (
          <DropdownMenuItem variant="destructive" onClick={() => actions.onDelete(local)}>
            <Trash2Icon />
            {local.cloud?.mode === 'admin' && remote ? 'Remove from this device…' : 'Delete…'}
          </DropdownMenuItem>
        )}
        {admin && remote && (
          <DropdownMenuItem variant="destructive" onClick={() => actions.onDeleteRemote(remote)}>
            <Trash2Icon />
            Delete online project…
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
