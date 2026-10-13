import { useEffect, useState } from 'react'
import { ArrowRightIcon, DownloadIcon, TriangleAlertIcon } from 'lucide-react'
import type { OptimizationResult } from '@/lib/optimize'
import { formatBytes } from '@/lib/format'
import { downloadSvg } from '@/lib/svg'
import { svgForExport, type ExportScope } from '@/lib/svg-export'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
  | { status: 'error'; message: string; svg: string | null }

export function ExportDialog({ open, onOpenChange, name, getSvg }: ExportDialogProps) {
  const [state, setState] = useState<State>({ status: 'optimizing' })
  const [scope, setScope] = useState<ExportScope>('visible')
  useCommandScope('dialog', open)

  function changeOpen(next: boolean) {
    if (!next) {
      setScope('visible')
      setState({ status: 'optimizing' })
    }
    onOpenChange(next)
  }

  // The document is locked while this modal is open; changing scope prepares a fresh copy.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    let url = ''
    let svg: string | null = null
    setState({ status: 'optimizing' })
    Promise.resolve()
      .then(() => {
        const source = getSvg()
        svg = svgForExport(source, scope)
        return import('@/lib/optimize').then(({ optimizeSvg }) => optimizeSvg(svg!))
      })
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
            svg,
          })
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
    // oxlint-disable-next-line react/exhaustive-deps -- Capture the locked document per opening/scope, regardless of callback identity.
  }, [open, scope])

  const result = state.status === 'done' ? state.result : null
  const saved = result ? 1 - result.optimizedBytes / result.originalBytes : 0

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Optimized export</DialogTitle>
          <DialogDescription>
            Choose which artwork to include. The canvas size stays the same.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <ToggleGroup
            aria-label="Artwork to export"
            variant="outline"
            size="sm"
            spacing={0}
            value={[scope]}
            onValueChange={(values) => {
              const next = values[0] as ExportScope | undefined
              if (!next || next === scope) return
              setState({ status: 'optimizing' })
              setScope(next)
            }}
            className="w-full"
          >
            <ToggleGroupItem value="visible" className="flex-1">
              Visible artwork only
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="flex-1">
              Entire document
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            {scope === 'visible'
              ? 'Hidden layers and objects are excluded. Resources used by visible artwork are kept.'
              : 'Includes all layers and objects, with their current visibility.'}
          </p>
        </div>

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
                ? state.svg
                  ? 'You can still download the standard SVG.'
                  : 'Show artwork or choose Entire document.'
                : 'Measuring size…'}
            </span>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          {state.status === 'error' ? (
            <Button
              disabled={!state.svg}
              onClick={() => {
                if (!state.svg) return
                downloadSvg(state.svg, scope === 'all' ? `${name || 'untitled'}.full` : name)
                changeOpen(false)
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
                  downloadSvg(
                    result.svg,
                    `${name || 'untitled'}${scope === 'all' ? '.full' : ''}.optimized`,
                  )
                  changeOpen(false)
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
