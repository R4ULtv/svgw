import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SparklesIcon } from 'lucide-react'
import { formatBytes } from '@/lib/format'
import type { ArtworkStats } from '@/lib/layers'
import { createBackgroundTask } from '@/lib/background-task'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CommandShortcut } from './commands'

interface DocumentInfoProps {
  /** Changes whenever the document does. */
  revision: number
  /** The SVG as it would be exported, and what it contains. */
  read: () => { svg: string; stats: ArtworkStats } | null
  onOptimize: () => void
}

type Optimized = { status: 'measuring' } | { status: 'done'; bytes: number } | { status: 'error' }

/** Layer and object counts, file size, and what optimizing would save. */
export function DocumentInfo({ revision, read, onOptimize }: DocumentInfoProps) {
  const root = useRef<HTMLDivElement>(null)
  // The desktop panel stays mounted while hidden on small screens; don't measure it there.
  const [visible, setVisible] = useState(false)
  const [info, setInfo] = useState<{ bytes: number; stats: ArtworkStats } | null>(null)
  const [optimized, setOptimized] = useState<Optimized>({ status: 'measuring' })

  useEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setVisible(entry.contentRect.width > 0))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()
    // Let edits settle first: serializing and optimizing a large document takes a moment.
    const task = createBackgroundTask(() => {
      const current = read()
      if (!current) return
      setInfo({ bytes: new Blob([current.svg]).size, stats: current.stats })
      setOptimized({ status: 'measuring' })
      import('@/lib/optimize')
        .then(({ optimizeSvg }) => optimizeSvg(current.svg, { signal: controller.signal }))
        .then((result) => {
          if (!controller.signal.aborted)
            setOptimized({ status: 'done', bytes: result.optimizedBytes })
        })
        .catch(() => {
          if (!controller.signal.aborted) setOptimized({ status: 'error' })
        })
    }, 400)
    task.schedule()
    return () => {
      controller.abort()
      task.cancel()
    }
    // oxlint-disable-next-line react/exhaustive-deps -- `read` reads the live editor; the revision says when it changed.
  }, [revision, visible])

  const saved =
    info && optimized.status === 'done' && info.bytes > 0 ? 1 - optimized.bytes / info.bytes : 0
  const types = info?.stats.types.map(
    ([type, count]) => `${count}\u00a0${type.toLowerCase()}${count === 1 ? '' : 's'}`,
  )

  return (
    <div ref={root} className="flex flex-col gap-1.5 text-xs">
      <Row label="Layers">{info?.stats.layers ?? '–'}</Row>
      <Row label="Objects">{info?.stats.objects ?? '–'}</Row>
      {!!types?.length && (
        <p className="-mt-1 text-right text-[11px] text-muted-foreground">{types.join(' · ')}</p>
      )}
      <Row label="File size">{info ? formatBytes(info.bytes) : '–'}</Row>
      <Row label="Optimized">
        {optimized.status === 'measuring' ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Spinner className="size-3" />
            Measuring…
          </span>
        ) : optimized.status === 'error' ? (
          <span className="text-muted-foreground">Unavailable</span>
        ) : saved > 0.005 ? (
          <>
            {formatBytes(optimized.bytes)}
            <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">
              −{Math.round(saved * 100)}%
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Already compact</span>
        )}
      </Row>
      <Tooltip>
        <TooltipTrigger
          render={<Button variant="outline" size="sm" className="mt-1.5" onClick={onOptimize} />}
        >
          <SparklesIcon />
          Optimize & download…
        </TooltipTrigger>
        <TooltipContent>
          Optimize & download
          <CommandShortcut command="file.optimize" />
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center tabular-nums">{children}</span>
    </div>
  )
}
