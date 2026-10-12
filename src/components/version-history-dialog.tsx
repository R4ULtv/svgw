import { PinIcon, RotateCcwIcon } from 'lucide-react'
import type { VersionInfo } from '@/lib/cloud-types'
import { timeAgo } from '@/lib/format'
import { useCommandScope } from './commands'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Spinner } from './ui/spinner'

/** An online project's saved versions, to pin or restore. */
export function VersionHistoryDialog({
  open,
  onOpenChange,
  versions,
  loading,
  error,
  working,
  latestVersionId,
  publishedVersionId,
  onPin,
  onRestore,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  versions: VersionInfo[]
  loading: boolean
  error: string | null
  working: boolean
  latestVersionId?: string
  publishedVersionId?: string | null
  onPin: (version: VersionInfo) => void
  onRestore: (version: VersionInfo) => void
}) {
  useCommandScope('dialog', open)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            The latest 100 snapshots are retained, along with pinned and published versions.
            Restoring creates a new snapshot.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {loading ? (
          <div className="flex items-center gap-2">
            <Spinner />
            Loading versions…
          </div>
        ) : (
          <ul className="max-h-[55dvh] overflow-y-auto divide-y">
            {versions.map((version) => (
              <li key={version.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{version.name || 'Untitled'}</p>
                  <p
                    className="text-[11px] text-muted-foreground"
                    title={new Date(version.createdAt).toLocaleString()}
                  >
                    {timeAgo(version.createdAt)}
                    {version.id === latestVersionId && ' · Latest'}
                    {version.id === publishedVersionId && ' · Published'}
                  </p>
                </div>
                <Button
                  variant={version.pinned ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  aria-label={version.pinned ? 'Unpin version' : 'Pin version'}
                  title={version.pinned ? 'Unpin version' : 'Pin version'}
                  disabled={working}
                  onClick={() => onPin(version)}
                >
                  <PinIcon />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={working || version.id === latestVersionId}
                  onClick={() => onRestore(version)}
                >
                  <RotateCcwIcon />
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
