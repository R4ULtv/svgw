import { CircleIcon, PenToolIcon, SquareIcon, XIcon } from 'lucide-react'
import type { Tool } from '@/lib/editor'
import { Button } from './ui/button'

export function CanvasStarter({
  onStart,
  onDismiss,
}: {
  onStart: (tool: Tool) => void
  onDismiss: () => void
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4 pt-16">
      <section
        aria-labelledby="canvas-starter-heading"
        className="pointer-events-auto relative w-full max-w-sm border bg-background p-5 shadow-sm"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss drawing guide"
          className="absolute top-2 right-2"
          onClick={onDismiss}
        >
          <XIcon />
        </Button>
        <h2 id="canvas-starter-heading" className="pr-5 text-sm font-medium">
          Draw your first shape.
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Choose a shape and drag on the canvas, or use the pen to draw a path.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onStart('rect')}>
            <SquareIcon /> Rectangle
          </Button>
          <Button variant="outline" onClick={() => onStart('ellipse')}>
            <CircleIcon /> Ellipse
          </Button>
          <Button variant="outline" onClick={() => onStart('path')}>
            <PenToolIcon /> Pen
          </Button>
        </div>
      </section>
    </div>
  )
}
