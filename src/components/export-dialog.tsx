import { useEffect, useId, useState } from 'react'
import { ArrowRightIcon, DownloadIcon, TriangleAlertIcon } from 'lucide-react'
import type { OptimizationResult } from '@/lib/optimize'
import { formatBytes } from '@/lib/format'
import { downloadSvg } from '@/lib/svg'
import {
  exportFileName,
  exportSummary,
  svgForExport,
  type ExportScope,
  type ExportSummary,
} from '@/lib/svg-export'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  /** The canvas size, so the preview shows the artboard's shape. */
  size: { w: number; h: number }
  getSvg: () => string
}

function describeStats({ layers, objects, types }: ExportSummary['stats']) {
  const count = (value: number, noun: string) =>
    `${value.toLocaleString()} ${noun}${value === 1 ? '' : 's'}`
  const summary = `${count(layers, 'layer')} · ${count(objects, 'object')}`
  return types.length
    ? `${summary}: ${types.map(([type, value]) => count(value, type.toLowerCase())).join(', ')}`
    : summary
}

type State =
  | { status: 'optimizing' }
  | { status: 'done'; result: OptimizationResult; url: string }
  | { status: 'error'; message: string; svg: string | null }

export function ExportDialog({ open, onOpenChange, name, size, getSvg }: ExportDialogProps) {
  const [state, setState] = useState<State>({ status: 'optimizing' })
  const [scope, setScope] = useState<ExportScope>('visible')
  const [summary, setSummary] = useState<ExportSummary | null>(null)
  // Null follows the suggested name, until the name is edited.
  const [fileName, setFileName] = useState<string | null>(null)
  const fileNameId = useId()
  useCommandScope('dialog', open)

  function changeOpen(next: boolean) {
    if (!next) {
      setScope('visible')
      setState({ status: 'optimizing' })
      setFileName(null)
    }
    onOpenChange(next)
  }

  // The document is locked while this modal is open; changing scope prepares a fresh copy.
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    let url = ''
    let svg: string | null = null
    setState({ status: 'optimizing' })
    setSummary(null)
    Promise.resolve()
      .then(() => {
        const source = getSvg()
        svg = svgForExport(source, scope)
        setSummary(exportSummary(source, scope))
        return import('@/lib/optimize').then(({ optimizeSvg }) =>
          optimizeSvg(svg!, { signal: controller.signal }),
        )
      })
      .then((result) => {
        if (controller.signal.aborted) return
        url = URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml' }))
        setState({ status: 'done', result, url })
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            message: cause instanceof Error ? cause.message : 'Optimization failed.',
            svg,
          })
      })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
    // oxlint-disable-next-line react/exhaustive-deps -- Capture the locked document per opening/scope, regardless of callback identity.
  }, [open, scope])

  const result = state.status === 'done' ? state.result : null
  const suggestedName = exportFileName(name, summary?.soleLayer ?? null, scope)
  const chosenName = fileName?.trim() || suggestedName
  const download = () => {
    const svg = state.status === 'error' ? state.svg : result?.svg
    if (!svg) return
    downloadSvg(svg, chosenName)
    changeOpen(false)
  }
  const ratio = size.w > 0 && size.h > 0 ? size.w / size.h : 1
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

        <div className="relative flex h-56 items-center justify-center border p-4 [container-type:size]">
          {/* The artboard at the canvas's aspect ratio, as large as fits. */}
          <div
            className="checker max-h-full max-w-full overflow-hidden ring-1 ring-border"
            style={{ aspectRatio: `${ratio}`, width: `min(100cqw, 100cqh * ${ratio})` }}
          >
            {state.status === 'done' && (
              <img
                src={state.url}
                alt="Optimized SVG preview"
                className="size-full object-contain"
              />
            )}
          </div>
          {/* Messages center on the preview area: a thin artboard could not fit them. */}
          {state.status === 'optimizing' && (
            <div className="absolute flex items-center gap-2 bg-background/90 px-3 py-2 text-xs text-muted-foreground">
              <Spinner />
              Optimizing…
            </div>
          )}
          {state.status === 'error' && (
            <div className="absolute flex max-w-xs items-start gap-2 bg-background/90 p-3 text-xs text-destructive">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              {state.message}
            </div>
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
        {/* Reserve the line so the dialog doesn't grow when counts arrive. */}
        <p className="-mt-2 min-h-4 text-xs text-muted-foreground tabular-nums">
          {summary && describeStats(summary.stats)}
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fileNameId} className="text-xs">
            File name
          </Label>
          <div className="flex items-center border border-input focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50 dark:bg-input/30">
            <Input
              id={fileNameId}
              value={fileName ?? suggestedName}
              placeholder={suggestedName}
              spellCheck={false}
              onChange={(event) => setFileName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  download()
                }
              }}
              className="border-0 bg-transparent focus-visible:ring-0 dark:bg-transparent"
            />
            <span className="pr-2.5 text-xs text-muted-foreground">.svg</span>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          {state.status === 'error' ? (
            <Button disabled={!state.svg} onClick={download}>
              <DownloadIcon data-icon="inline-start" />
              Download standard SVG
            </Button>
          ) : (
            <Button disabled={!result} onClick={download}>
              <DownloadIcon data-icon="inline-start" />
              Download optimized
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
