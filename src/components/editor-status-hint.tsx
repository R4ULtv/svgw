import { Fragment, type ReactNode } from 'react'
import { detectPlatform } from '@tanstack/react-hotkeys'
import { isUnbound, type CommandId } from '@/lib/commands'
import type { Tool } from '@/lib/editor'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CommandShortcut, useCommandContext } from './commands'

interface EditorStatusHintProps {
  tool: Tool
  mode: string
  canvasEmpty: boolean
  selectionLabel?: string
  previewing: boolean
  spacePan: boolean
  grabbing: boolean
}

const nudgeCommands = [
  'selection.nudgeLeft',
  'selection.nudgeUp',
  'selection.nudgeDown',
  'selection.nudgeRight',
] as const satisfies CommandId[]

export function CanvasZoomHint() {
  return (
    <>
      <Kbd>{detectPlatform() === 'mac' ? '⌘' : 'Ctrl'}</Kbd> + scroll to zoom
    </>
  )
}

/** Guidance follows the active interaction; every command uses the current keymap. */
export function EditorStatusHint({
  tool,
  mode,
  canvasEmpty,
  selectionLabel,
  previewing,
  spacePan,
  grabbing,
}: EditorStatusHintProps) {
  const { keymap } = useCommandContext()
  const commandHint = (command: CommandId, label: string) =>
    isUnbound(keymap[command]) ? null : (
      <>
        <CommandShortcut command={command} /> {label}
      </>
    )
  const backToSelect = commandHint('edit.escape', 'to return to Select')
  let hints: ReactNode[]

  if (previewing) {
    hints = [
      'Previewing without selection outlines',
      <>
        Release <CommandShortcut command="view.preview" showHold={false} /> to edit
      </>,
    ]
  } else if (spacePan && tool !== 'hand') {
    hints = [
      grabbing ? 'Panning the canvas' : 'Drag to pan',
      <>
        Release <CommandShortcut command="view.pan" showHold={false} /> to return to your tool
      </>,
    ]
  } else if (tool === 'hand' || grabbing) {
    hints = [
      grabbing ? 'Panning the canvas' : 'Drag to pan',
      <CanvasZoomHint key="zoom" />,
      backToSelect,
      <>
        <CommandShortcut command="view.pan" /> + drag to pan from any tool
      </>,
    ]
  } else if (mode === 'pathedit') {
    hints = [
      'Drag nodes or handles to reshape the path',
      <>
        <Kbd>Shift</Kbd> + click to add or remove nodes from the selection
      </>,
      backToSelect,
    ]
  } else if (mode === 'resize') {
    hints = [
      'Drag a corner to resize proportionally',
      <>
        Hold <Kbd>Shift</Kbd> for free corner resizing
      </>,
      <>
        Hold <Kbd>{detectPlatform() === 'mac' ? '⌘' : 'Ctrl'}</Kbd> to resize from the center
      </>,
    ]
  } else if (tool === 'rect') {
    hints = [
      'Drag to draw a rectangle',
      <>
        Hold <Kbd>Shift</Kbd> to draw a square
      </>,
      backToSelect,
    ]
  } else if (tool === 'ellipse') {
    hints = [
      'Drag from the center to draw an ellipse',
      <>
        Hold <Kbd>Shift</Kbd> to draw a circle
      </>,
      backToSelect,
    ]
  } else if (tool === 'path') {
    hints = [
      'Click to add points; drag to create curves',
      'Click the first point to close the path',
      commandHint('edit.escape', 'to cancel drawing'),
    ]
  } else if (selectionLabel) {
    const boundNudges = nudgeCommands.filter((command) => !isUnbound(keymap[command]))
    hints = [
      <span key="selection" className="inline-block max-w-48 truncate align-middle">
        {selectionLabel} selected
      </span>,
      'Drag a corner to resize proportionally',
      <>
        Hold <Kbd>Shift</Kbd> for free corner resizing
      </>,
      <>
        Hold <Kbd>{detectPlatform() === 'mac' ? '⌘' : 'Ctrl'}</Kbd> to resize from the center
      </>,
      boundNudges.length ? (
        <>
          <span className="inline-flex items-center gap-1 align-middle">
            {boundNudges.map((command) => (
              <CommandShortcut key={command} command={command} />
            ))}
          </span>{' '}
          to nudge 1 px
        </>
      ) : null,
      commandHint('edit.undo', 'to undo'),
      commandHint('edit.escape', 'to clear the selection'),
    ]
  } else if (canvasEmpty) {
    hints = [
      'Choose a drawing tool to start',
      <>
        Rectangle <CommandShortcut command="tool.rect" />
      </>,
      <>
        Ellipse <CommandShortcut command="tool.ellipse" />
      </>,
      <>
        Pen <CommandShortcut command="tool.pen" />
      </>,
    ]
  } else {
    hints = [
      'Click to select; drag to box-select',
      <>
        <Kbd>Shift</Kbd> + click to add or remove from the selection
      </>,
      'Double-click a group to edit inside',
    ]
  }

  const guidance = hints.filter(Boolean).map((hint, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <span className="mx-2 opacity-50" aria-hidden="true">
          ·
        </span>
      )}
      <span>{hint}</span>
    </Fragment>
  ))

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            aria-label="Editor guidance"
            className="min-w-0 flex-1 truncate **:data-[slot=kbd]:h-4 **:data-[slot=kbd]:min-w-4 **:data-[slot=kbd]:align-middle **:data-[slot=kbd]:text-[10px] **:data-[slot=kbd-group]:align-middle"
          />
        }
      >
        {guidance}
      </TooltipTrigger>
      <TooltipContent side="top" className="block max-w-[min(48rem,calc(100vw-2rem))] leading-6">
        {guidance}
      </TooltipContent>
    </Tooltip>
  )
}
