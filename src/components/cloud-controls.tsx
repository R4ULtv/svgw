import { useEffect, useState } from 'react'
import {
  CloudIcon,
  CloudOffIcon,
  CloudUploadIcon,
  GlobeIcon,
  HardDriveIcon,
  HistoryIcon,
  KeyRoundIcon,
  LockIcon,
  RotateCcwIcon,
  Share2Icon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Project } from '@/lib/projects'
import type { useCloudProjects } from '@/lib/use-cloud-projects'
import { documentKey } from '@/lib/cloud-types'
import { VersionHistoryDialog } from './version-history-dialog'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Spinner } from './ui/spinner'

type Cloud = ReturnType<typeof useCloudProjects>
const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'Could not complete the request.'

export function CloudControls({
  cloud,
  project,
  localState,
  onDelete,
}: {
  cloud: Cloud
  project: Project | null
  localState: 'saving' | 'saved' | 'error'
  onDelete: () => void
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  useEffect(() => {
    setHistoryOpen(false)
  }, [project?.id])

  async function action(operation: () => Promise<unknown>) {
    try {
      await operation()
    } catch (cause) {
      toast.error('Online project', { description: errorMessage(cause) })
    }
  }

  async function history() {
    setHistoryOpen(true)
    setHistoryBusy(true)
    setHistoryError(null)
    try {
      await cloud.loadVersions()
    } catch (cause) {
      setHistoryError(errorMessage(cause))
    } finally {
      setHistoryBusy(false)
    }
  }

  async function share() {
    if (!project?.cloud) return
    const url = new URL(`/project/${project.cloud.id}`, location.origin)
    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success('Public link copied')
    } catch {
      toast('Public project link', { description: url.toString(), duration: 15_000 })
    }
  }

  const owned = project?.cloud?.mode === 'admin'
  const remote = project?.cloud
  const savedOnline =
    cloud.admin &&
    owned &&
    Boolean(remote?.revision) &&
    localState === 'saved' &&
    project &&
    documentKey(project) === remote?.savedDocument &&
    cloud.onlineState !== 'pending' &&
    cloud.onlineState !== 'conflict'
  const savingOnline = cloud.admin && owned && cloud.onlineState === 'saving'
  const localStatus = {
    saving: 'Saving in this browser…',
    saved: 'Saved in this browser',
    error: 'Local save failed',
  }[localState]
  const status =
    !cloud.admin || !owned || localState === 'error'
      ? localStatus
      : savingOnline
        ? 'Saving online…'
        : owned && cloud.onlineState === 'conflict'
          ? 'Save conflict'
          : savedOnline
            ? 'Saved online'
            : owned && cloud.onlineState === 'error'
              ? 'Online save failed'
              : remote?.revision
                ? 'Changes not saved online'
                : 'Not saved online'
  const statusIcon =
    savingOnline || localState === 'saving' ? (
      <Spinner />
    ) : savedOnline ? (
      <CloudIcon />
    ) : !cloud.admin || !owned ? (
      <HardDriveIcon />
    ) : (
      <CloudOffIcon />
    )
  const saveStatus = (
    <>
      {statusIcon}
      <span role="status" className="truncate">
        {status}
      </span>
    </>
  )
  const statusClass =
    '-ml-1 flex h-5 max-w-full shrink items-center gap-1 px-1 text-[11px] font-normal text-muted-foreground [&_svg]:size-3 [&_svg]:shrink-0'

  return (
    <>
      {project &&
        (cloud.admin || remote?.mode === 'public' ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label="Project save status"
                  title={status}
                  disabled={cloud.working}
                  className={statusClass}
                />
              }
            >
              {saveStatus}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                {status}
                {cloud.admin &&
                  remote &&
                  ` · ${remote.visibility === 'public' ? 'Public' : 'Private'}`}
              </p>
              {cloud.admin && cloud.onlineError && (
                <p className="px-2 pb-2 text-[11px] text-destructive">{cloud.onlineError}</p>
              )}
              {cloud.admin && !cloud.remoteAvailable && !cloud.onlineError && (
                <p className="px-2 pb-2 text-[11px] text-muted-foreground">
                  The connection is unavailable. New changes will save online when it returns.
                </p>
              )}
              {localState === 'error' && (
                <p role="alert" className="px-2 pb-2 text-[11px] text-destructive">
                  Browser storage failed. Download your SVG to keep a copy.
                </p>
              )}
              <DropdownMenuSeparator />
              {cloud.admin ? (
                <>
                  {remote?.mode === 'public' ? (
                    <DropdownMenuItem
                      onClick={() => void action(() => cloud.openRemote(remote.id, false, 'admin'))}
                    >
                      <KeyRoundIcon />
                      Open latest version
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => void action(() => cloud.save())}>
                      <CloudUploadIcon />
                      {remote ? 'Save online now' : 'Save online'}
                    </DropdownMenuItem>
                  )}
                  {owned && remote?.revision && (
                    <>
                      <DropdownMenuItem onClick={() => void action(() => cloud.publish())}>
                        <GlobeIcon />
                        Publish latest version
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!remote.publishedVersionId}
                        onClick={() =>
                          void action(() =>
                            cloud.visibility(remote.visibility === 'public' ? 'private' : 'public'),
                          )
                        }
                      >
                        {remote.visibility === 'public' ? <LockIcon /> : <GlobeIcon />}
                        {remote.visibility === 'public' ? 'Make private' : 'Make public'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void history()}>
                        <HistoryIcon />
                        Version history
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          void action(() => cloud.openRemote(remote.id, true, 'admin'))
                        }
                      >
                        <RotateCcwIcon />
                        Reload saved version
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              ) : null}
              {remote && (
                <DropdownMenuItem
                  disabled={remote.visibility !== 'public' || !remote.publishedVersionId}
                  onClick={() => void share()}
                >
                  <Share2Icon />
                  Copy public link
                </DropdownMenuItem>
              )}
              {remote?.mode === 'public' && !cloud.admin && (
                <DropdownMenuItem
                  onClick={() => void action(() => cloud.openRemote(remote.id, true, 'public'))}
                >
                  <RotateCcwIcon />
                  Reload published version
                </DropdownMenuItem>
              )}
              {owned && cloud.admin && remote?.revision && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2Icon />
                    Delete online project…
                  </DropdownMenuItem>
                </>
              )}
              <p className="px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {cloud.admin
                  ? 'Changes save automatically. Online versions save every 30 seconds. Publish to update the public link.'
                  : 'Changes save automatically.'}
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div
            title={
              localState === 'error'
                ? 'Download your SVG to keep a copy.'
                : 'Changes save automatically.'
            }
            className={statusClass}
          >
            {saveStatus}
          </div>
        ))}

      <VersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        versions={cloud.versions}
        loading={historyBusy}
        error={historyError}
        working={cloud.working}
        latestVersionId={remote?.versionId}
        publishedVersionId={remote?.publishedVersionId}
        onPin={(version) => void action(() => cloud.pin(version))}
        onRestore={(version) => void action(() => cloud.restore(version.id))}
      />
    </>
  )
}
