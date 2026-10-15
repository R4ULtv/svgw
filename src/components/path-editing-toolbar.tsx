import { Fragment, type ReactNode } from 'react'
import {
  CheckIcon,
  PlusIcon,
  SplineIcon,
  Trash2Icon,
  createLucideIcon,
  type LucideIcon,
} from 'lucide-react'
import type { CommandId } from '@/lib/commands'
import type { PathAction, PathEditingState } from '@/lib/path-editing'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CommandShortcut } from './commands'

interface PathTool {
  action: PathAction
  label: string
  /** What the action does, or why it is unavailable. */
  hint?: string
  command?: CommandId
  icon: LucideIcon
  enabled: boolean
}

/** Lucide's Spline with a straight segment, so the two segment types read as a pair. */
const StraightSegmentIcon = createLucideIcon('straight-segment', [
  ['circle', { cx: '19', cy: '5', r: '2', key: 'end' }],
  ['circle', { cx: '5', cy: '19', r: '2', key: 'start' }],
  ['path', { d: 'M6.4 17.6 17.6 6.4', key: 'segment' }],
])

export function PathEditingToolbar({
  state,
  onAction,
  onDone,
}: {
  state: PathEditingState
  onAction: (action: PathAction) => void
  onDone: () => void
}) {
  const plural = state.nodes === 1 ? 'node' : 'nodes'
  // The first node of a subpath has no segment before it; arcs cannot be split.
  const needsSegment = state.nodes ? 'Not available for the first node' : 'Select a node first'
  const groups: PathTool[][] = [
    [
      {
        action: 'add',
        label: 'Add node',
        hint: state.canSplit
          ? 'Insert a node halfway along the segment before each selected node'
          : state.nodes
            ? 'Select nodes after straight or curved segments'
            : 'Select a node first',
        icon: PlusIcon,
        enabled: state.canSplit,
      },
      {
        action: 'delete',
        label: 'Delete nodes',
        hint: state.nodes ? undefined : 'Select a node first',
        command: 'selection.delete',
        icon: Trash2Icon,
        enabled: state.nodes > 0,
      },
    ],
    [
      {
        action: 'line',
        label: 'Straight segment',
        hint: state.canConvert ? 'Straighten the segment before each selected node' : needsSegment,
        icon: StraightSegmentIcon,
        enabled: state.canConvert,
      },
      {
        action: 'curve',
        label: 'Curved segment',
        hint: state.canConvert
          ? 'Add handles to the segment before each selected node'
          : needsSegment,
        icon: SplineIcon,
        enabled: state.canConvert,
      },
    ],
  ]

  let status: ReactNode = state.rejected ? 'Only paths have editable nodes' : 'Click a path'
  if (state.editing)
    status = state.nodes ? (
      <>
        {state.nodes} {plural}
        {/* Phones keep the count without truncating it. */}
        <span className="max-sm:hidden"> selected</span>
      </>
    ) : (
      'Select nodes'
    )

  return (
    <div
      role="toolbar"
      aria-label="Path editing"
      className="absolute bottom-3 left-1/2 z-10 flex max-w-[calc(100%_-_1.5rem)] -translate-x-1/2 items-center gap-1 border bg-popover/95 p-1 shadow-md shadow-black/10 backdrop-blur dark:shadow-black/40"
    >
      <span
        className="min-w-20 truncate px-2 text-xs text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {status}
      </span>
      {state.editing &&
        groups.map((group, index) => (
          <Fragment key={index}>
            <Separator
              orientation="vertical"
              className="mx-1 data-vertical:h-5 data-vertical:self-center"
            />
            {group.map(({ action, label, hint, command, icon: Icon, enabled }) => (
              <Tooltip key={action}>
                {/* Wrapper keeps the tooltip available while the button is disabled. */}
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    disabled={!enabled}
                    onClick={() => onAction(action)}
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <span className="flex flex-col">
                    {label}
                    {hint && <span className="text-background/70">{hint}</span>}
                  </span>
                  {command && <CommandShortcut command={command} />}
                </TooltipContent>
              </Tooltip>
            ))}
          </Fragment>
        ))}
      <Separator
        orientation="vertical"
        className="mx-1 data-vertical:h-5 data-vertical:self-center"
      />
      <Tooltip>
        <TooltipTrigger render={<Button variant="secondary" size="sm" onClick={onDone} />}>
          <CheckIcon />
          Done
        </TooltipTrigger>
        <TooltipContent>
          Return to Select
          <CommandShortcut command="edit.escape" />
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
