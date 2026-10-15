import type { ReactNode, Ref } from 'react'
import {
  CircleIcon,
  HandIcon,
  MousePointer2Icon,
  PenToolIcon,
  Redo2Icon,
  SlidersHorizontalIcon,
  SquareIcon,
  SplinePointerIcon,
  Trash2Icon,
  Undo2Icon,
  type LucideIcon,
} from 'lucide-react'
import type { CommandId } from '@/lib/commands'
import type { Tool } from '@/lib/editor'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CommandShortcut, ShortcutHint } from './commands'

const tools: { value: Tool; label: string; command: CommandId; icon: LucideIcon }[] = [
  { value: 'select', label: 'Select', command: 'tool.select', icon: MousePointer2Icon },
  { value: 'editpath', label: 'Edit path', command: 'tool.editPath', icon: SplinePointerIcon },
  { value: 'hand', label: 'Hand', command: 'tool.hand', icon: HandIcon },
  { value: 'rect', label: 'Rectangle', command: 'tool.rect', icon: SquareIcon },
  { value: 'ellipse', label: 'Ellipse', command: 'tool.ellipse', icon: CircleIcon },
  { value: 'path', label: 'Pen', command: 'tool.pen', icon: PenToolIcon },
]

interface EditorToolbarProps {
  ref?: Ref<HTMLDivElement>
  tool: Tool
  onToolChange: (tool: Tool) => void
  canUndo: boolean
  canRedo: boolean
  canDelete: boolean
  onUndo: () => void
  onRedo: () => void
  onDelete: () => void
  inspector: ReactNode
  className?: string
}

export function EditorToolbar({
  ref,
  tool,
  onToolChange,
  canUndo,
  canRedo,
  canDelete,
  onUndo,
  onRedo,
  onDelete,
  inspector,
  className,
}: EditorToolbarProps) {
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Editor tools"
      className={cn(
        'absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 border bg-popover/95 p-1 shadow-md shadow-black/10 backdrop-blur max-[480px]:flex-col dark:shadow-black/40',
        className,
      )}
    >
      <ToggleGroup
        value={[tool]}
        onValueChange={(value) => {
          if (value[0]) onToolChange(value[0] as Tool)
        }}
        spacing={1}
        aria-label="Drawing tool"
      >
        {tools.map(({ value, label, command, icon: Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  value={value}
                  aria-label={label}
                  className="data-pressed:bg-primary data-pressed:text-primary-foreground"
                />
              }
            >
              <Icon />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {label}
              <CommandShortcut command={command} />
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
      <Separator
        orientation="vertical"
        className="mx-1 data-vertical:h-5 data-vertical:self-center max-[480px]:hidden"
      />
      <div className="flex items-center gap-1">
        <ToolButton label="Undo" command="edit.undo" disabled={!canUndo} onClick={onUndo}>
          <Undo2Icon />
        </ToolButton>
        <ToolButton label="Redo" command="edit.redo" disabled={!canRedo} onClick={onRedo}>
          <Redo2Icon />
        </ToolButton>
        <ToolButton
          label="Delete"
          command="selection.delete"
          disabled={!canDelete}
          onClick={onDelete}
        >
          <Trash2Icon />
        </ToolButton>
        <div className="contents lg:hidden">
          <Separator
            orientation="vertical"
            className="mx-1 data-vertical:h-5 data-vertical:self-center"
          />
          <Popover>
            <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="Properties" />}>
              <SlidersHorizontalIcon />
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-[70dvh] w-72 overflow-y-auto p-0">
              {inspector}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}

function ToolButton({
  label,
  command,
  disabled,
  onClick,
  children,
}: {
  label: string
  command: CommandId
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      {/* Wrapper keeps the tooltip available while the button is disabled. */}
      <TooltipTrigger render={<span className="relative inline-flex" />}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
        <ShortcutHint command={command} />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        <CommandShortcut command={command} />
      </TooltipContent>
    </Tooltip>
  )
}
