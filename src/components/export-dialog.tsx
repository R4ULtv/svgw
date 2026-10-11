import { useEffect, useState } from 'react'
import { ArrowRightIcon, DownloadIcon, TriangleAlertIcon } from 'lucide-react'
import type { OptimizationResult } from '@/lib/optimize'
import { formatBytes } from '@/lib/format'
import { downloadSvg } from '@/lib/svg'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useCommandScope } from './commands'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  getSvg: () => string
}

type State =
  | { status: 'optimizing' }
  | { status: 'done'; result: OptimizationResult; url: string }
  | { status: 'error'; message: string }

export function ExportDialog({ open, onOpenChange, name, getSvg }: ExportDialogProps) {
  const [state, setState] = useState<State>({ status: 'optimizing' })
  useCommandScope('dialog', open)

  // The document cannot change while this modal is open, so one optimization per opening is enough.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    let url = ''
    setState({ status: 'optimizing' })
    const svg = getSvg()
    import('@/lib/optimize')
      .then(({ optimizeSvg }) => optimizeSvg(svg))
      .then((result) => {
        if (cancelled) return
        url = URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml' }))
        setState({ status: 'done', result, url })
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setState({
            status: 'error',
            message: cause instanceof Error ? cause.message : 'Optimization failed.',
          })
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
    // oxlint-disable-next-line react/exhaustive-deps -- Capture the locked document once per modal opening, regardless of callback identity.
  }, [open])

  const result = state.status === 'done' ? state.result : null
  const saved = result ? 1 - result.optimizedBytes / result.originalBytes : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Optimized export</DialogTitle>
          <DialogDescription>
            A smaller copy for the web. IDs, groups, and the viewBox are kept; your editable project
            is unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="checker flex h-56 items-center justify-center overflow-hidden border p-4">
          {state.status === 'optimizing' && (
            <div className="flex items-center gap-2 bg-background/90 px-3 py-2 text-xs text-muted-foreground">
              <Spinner />
              Optimizing…
            </div>
          )}
          {state.status === 'error' && (
            <div className="flex max-w-xs items-start gap-2 bg-background/90 p-3 text-xs text-destructive">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              {state.message}
            </div>
          )}
          {state.status === 'done' && (
            <img src={state.url} alt="Optimized SVG preview" className="size-full object-contain" />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border bg-muted/30 px-3 py-2.5 text-xs tabular-nums">
          {result ? (
            <>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">{formatBytes(result.originalBytes)}</span>
                <ArrowRightIcon className="size-3 text-muted-foreground" />
                <span className="font-medium">{formatBytes(result.optimizedBytes)}</span>
              </span>
              <span
                className={
                  saved > 0
                    ? 'font-medium text-emerald-700 dark:text-emerald-400'
                    : 'text-muted-foreground'
                }
              >
                {saved > 0 ? `${Math.round(saved * 100)}% smaller` : 'Already optimal'}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {state.status === 'error'
                ? 'You can still download the standard SVG.'
                : 'Measuring size…'}
            </span>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          {state.status === 'error' ? (
            <Button
              onClick={() => {
                downloadSvg(getSvg(), name)
                onOpenChange(false)
              }}
            >
              <DownloadIcon data-icon="inline-start" />
              Download standard SVG
            </Button>
          ) : (
            <Button
              disabled={!result}
              onClick={() => {
                if (result) {
                  downloadSvg(result.svg, `${name || 'untitled'}.optimized`)
                  onOpenChange(false)
                }
              }}
            >
              <DownloadIcon data-icon="inline-start" />
              Download optimized
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
