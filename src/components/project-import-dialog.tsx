import { useEffect, useMemo, useState } from 'react'
import { AlertTriangleIcon, CheckIcon, DownloadIcon, FileUpIcon, LayersIcon } from 'lucide-react'
import { importProjectFile, type ProjectImport, type ImportedDocument } from '@/lib/project-import'
import { downloadSvg } from '@/lib/svg'
import { exportLayers } from '@/lib/layers'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Spinner } from './ui/spinner'

export interface ImportRequest {
  files: File[]
  asProjects: boolean
}
interface ImportItem {
  key: string
  source: ProjectImport['source']
  fileName: string
  document: ImportedDocument
}

export function ProjectImportDialog({
  request,
  onClose,
  onImport,
}: {
  request: ImportRequest | null
  onClose: () => void
  onImport: (documents: ImportedDocument[], asProjects: boolean) => void | Promise<void>
}) {
  const [items, setItems] = useState<ImportItem[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [background, setBackground] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    if (!request) return
    const controller = new AbortController()
    setLoading(true)
    setItems([])
    setErrors([])
    setSelected(new Set())
    setPreview('')
    void (async () => {
      const loaded: ImportItem[] = [],
        failures: string[] = []
      for (let index = 0; index < request.files.length; index++) {
        if (controller.signal.aborted) return
        const file = request.files[index]
        try {
          const result = await importProjectFile(file, controller.signal)
          result.documents.forEach((document, page) =>
            loaded.push({
              key: `${index}:${page}`,
              source: result.source,
              fileName: file.name,
              document,
            }),
          )
        } catch (cause) {
          if (controller.signal.aborted) return
          failures.push(
            `${file.name}: ${cause instanceof Error ? cause.message : 'The file could not be read.'}`,
          )
        }
      }
      if (controller.signal.aborted) return
      setItems(loaded)
      setErrors(failures)
      setSelected(new Set(loaded.map((item) => item.key)))
      setPreview(loaded[0]?.key ?? '')
      setLoading(false)
    })()
    return () => controller.abort()
  }, [request])
  const current = items.find((item) => item.key === preview)
  const layerDetails = useMemo(() => {
    if (!current) return []
    const root = new DOMParser().parseFromString(
      current.document.svg,
      'image/svg+xml',
    ).documentElement
    return [...root.children]
      .filter((element) => element.classList.contains('layer'))
      .map((element) => ({
        name: element.querySelector(':scope > title')?.textContent ?? 'Layer',
        hidden: element.getAttribute('display') === 'none',
        locked: element.getAttribute('data-svgw-locked') === 'true',
      }))
  }, [current])
  const chosen = items.filter((item) => selected.has(item.key))
  const placementNote =
    !request?.asProjects && current?.document.guides
      ? 'Ruler guides are restored when opening this file as a project. Importing it as a layer adds only its artwork.'
      : null
  const hasWarnings = chosen.some((item) => item.document.warnings.length)
  async function confirm() {
    if (!request || !chosen.length || importing) return
    setImporting(true)
    try {
      await onImport(
        chosen.map((item) => item.document),
        request.asProjects,
      )
      onClose()
    } catch (cause) {
      setErrors((errors) => [
        ...errors,
        cause instanceof Error ? cause.message : 'Import failed. Try again.',
      ])
    } finally {
      setImporting(false)
    }
  }
  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open && !importing) onClose()
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
        showCloseButton={!importing}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUpIcon className="size-4" /> Import artwork
          </DialogTitle>
          <DialogDescription>
            {loading
              ? 'Reading your SVG or project file…'
              : 'Review the artwork, layers, and notes before importing.'}{' '}
            Files are read on this device.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div
            className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"
            role="status"
          >
            <Spinner /> Reading artwork…
          </div>
        ) : (
          <>
            {!!errors.length && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
              >
                {errors.map((error, i) => (
                  <p key={i}>{error}</p>
                ))}
              </div>
            )}
            {!!items.length && (
              <div className="grid min-w-0 gap-4 sm:grid-cols-[190px_1fr]">
                <div
                  className="max-h-72 space-y-1 overflow-y-auto sm:max-h-96"
                  aria-label="Files to import"
                >
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-2',
                        preview === item.key ? 'border-primary bg-muted' : 'border-transparent',
                      )}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Import ${item.document.name}`}
                        checked={selected.has(item.key)}
                        disabled={importing}
                        onChange={() =>
                          setSelected((before) => {
                            const next = new Set(before)
                            if (next.has(item.key)) next.delete(item.key)
                            else next.add(item.key)
                            return next
                          })
                        }
                        className="size-4 shrink-0 accent-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setPreview(item.key)}
                        className="min-w-0 flex-1 text-left text-sm"
                        aria-pressed={preview === item.key}
                      >
                        <span className="block break-words font-medium">{item.document.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.source} · {item.document.layers}{' '}
                          {item.document.layers === 1 ? 'layer' : 'layers'}
                        </span>
                      </button>
                      {!!item.document.warnings.length && (
                        <AlertTriangleIcon
                          aria-label="Conversion notes"
                          className="size-3.5 shrink-0 text-amber-600"
                        />
                      )}
                    </div>
                  ))}
                </div>
                {current && (
                  <div className="min-w-0 space-y-3">
                    <div
                      className={cn(
                        'grid h-64 place-items-center overflow-hidden rounded-lg border p-5',
                        background === 'dark' ? 'bg-zinc-900' : 'bg-zinc-100',
                      )}
                    >
                      <img
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(current.document.svg)}`}
                        alt={`Preview of ${current.document.name}`}
                        className="h-full min-h-0 w-full min-w-0 object-contain"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {Math.round(current.document.width * 100) / 100} ×{' '}
                        {Math.round(current.document.height * 100) / 100} ·{' '}
                        {current.document.objects} objects
                      </span>
                      <div className="flex gap-1" aria-label="Preview background">
                        <Button
                          size="sm"
                          variant={background === 'light' ? 'secondary' : 'ghost'}
                          onClick={() => setBackground('light')}
                        >
                          Light
                        </Button>
                        <Button
                          size="sm"
                          variant={background === 'dark' ? 'secondary' : 'ghost'}
                          onClick={() => setBackground('dark')}
                        >
                          Dark
                        </Button>
                      </div>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <LayersIcon className="size-3.5" /> Layer names, groups, and visibility are
                      kept where available.
                    </p>
                    {current.document.guides && (
                      <p className="text-xs text-muted-foreground">
                        {current.document.guides.x.length + current.document.guides.y.length} ruler
                        guides{request?.asProjects ? ' will be restored.' : '. ' + placementNote}
                      </p>
                    )}
                    {!!layerDetails.length && (
                      <details className="rounded-lg border p-3 text-xs">
                        <summary className="cursor-pointer font-medium">
                          {layerDetails.length} {layerDetails.length === 1 ? 'layer' : 'layers'} ·{' '}
                          {layerDetails.filter((layer) => layer.hidden).length} hidden ·{' '}
                          {layerDetails.filter((layer) => layer.locked).length} locked
                        </summary>
                        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                          {layerDetails.map((layer, i) => (
                            <li key={i} className="flex justify-between gap-2">
                              <span>{layer.name}</span>
                              <span className="text-muted-foreground">
                                {[layer.hidden && 'Hidden', layer.locked && 'Locked']
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {!!current.document.warnings.length && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed">
                        <p className="mb-2 flex items-center gap-1.5 font-medium">
                          <AlertTriangleIcon className="size-3.5" /> Conversion notes
                        </p>
                        <ul className="list-disc space-y-1 pl-4">
                          {current.document.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const root = new DOMParser().parseFromString(
                          current.document.svg,
                          'image/svg+xml',
                        ).documentElement
                        exportLayers(root, { forExport: true })
                        downloadSvg(
                          new XMLSerializer().serializeToString(root),
                          current.document.name,
                        )
                      }}
                    >
                      <DownloadIcon /> Download SVG
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <DialogFooter className="sticky -bottom-4 -mx-4 -mb-4 border-t bg-popover p-4">
          <Button variant="outline" disabled={importing} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={loading || importing || !chosen.length} onClick={() => void confirm()}>
            {importing ? <Spinner /> : <CheckIcon />}
            {hasWarnings
              ? 'Import with notes'
              : request?.asProjects
                ? 'Open as project'
                : 'Import as layer'}
            {chosen.length > 1 ? ` (${chosen.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
