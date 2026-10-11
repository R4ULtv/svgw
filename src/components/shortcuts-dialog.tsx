import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useHotkeyRecorder,
  useHotkeySequenceRecorder,
  type Hotkey,
  type HotkeySequence,
  type RecorderRejection,
} from '@tanstack/react-hotkeys'
import { RotateCcwIcon, SearchIcon, TriangleAlertIcon } from 'lucide-react'
import {
  bindingText,
  commandIds,
  findKeymapConflicts,
  getCommand,
  isUnbound,
  releaseBinding,
  scopes,
  type Binding,
  type CommandDefinition,
  type CommandId,
  type KeymapConflict,
} from '@/lib/commands'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Shortcut, useCommandContext, useCommandScope } from './commands'

const groups: CommandDefinition['group'][] = [
  'File',
  'Tools',
  'Edit',
  'Selection',
  'Layers',
  'View',
  'Navigate',
  'Help',
]

interface Pending {
  command: CommandId
  binding: Binding
  conflicts: KeymapConflict[]
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  useCommandScope('dialog', open)
  const { keymap, overrides, setBinding, resetAll } = useCommandContext()
  const [query, setQuery] = useState('')
  const [recording, setRecording] = useState<CommandId | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [rejection, setRejection] = useState<string | null>(null)
  // Recorder callbacks run outside React's render, so they read the target from a ref.
  const target = useRef<CommandId | null>(null)

  function finish() {
    target.current = null
    setRecording(null)
    setPending(null)
    setRejection(null)
  }

  function apply(id: CommandId, binding: Binding, conflicts: KeymapConflict[] = []) {
    for (const other of new Set(conflicts.map((conflict) => conflict.other)))
      setBinding(other, releaseBinding(keymap, other, binding))
    setBinding(id, binding)
    finish()
  }

  // Returning a message rejects the candidate and keeps recording; the conflict is offered for reassignment.
  function check(binding: Binding) {
    const id = target.current
    if (!id) return false
    const conflicts = findKeymapConflicts(keymap, { command: id, candidate: binding })
    if (!conflicts.length) return true
    setRejection(null)
    setPending({ command: id, binding, conflicts })
    return `${bindingText(binding)} is used by ${getCommand(conflicts[0].other).title}.`
  }

  // Validation rejections already set their own message or conflict in `check`.
  function onReject(rejection: RecorderRejection) {
    if (rejection.reason === 'validation') return
    setPending(null)
    setRejection(rejection.message)
  }

  const chordRecorder = useHotkeyRecorder({
    recordBy: 'key',
    validate: (hotkey: Hotkey) => check({ kind: 'keys', keys: [hotkey] }),
    onRecord: (hotkey) => {
      if (target.current) apply(target.current, { kind: 'keys', keys: [hotkey] })
    },
    onClear: () => {
      if (target.current) apply(target.current, { kind: 'keys', keys: [] })
    },
    onCancel: finish,
    onReject,
  })

  const sequenceRecorder = useHotkeySequenceRecorder({
    recordBy: 'key',
    validate: (sequence: HotkeySequence) => {
      if (sequence.length >= 2) return check({ kind: 'sequence', sequence })
      setPending(null)
      setRejection('Sequences need at least two steps.')
      return false
    },
    onRecord: (sequence) => {
      if (target.current) apply(target.current, { kind: 'sequence', sequence })
    },
    onClear: () => {
      if (target.current) apply(target.current, { kind: 'sequence', sequence: [] })
    },
    onCancel: finish,
    onReject,
  })

  function stopRecording() {
    chordRecorder.cancelRecording()
    sequenceRecorder.cancelRecording()
    finish()
  }

  function startRecording(id: CommandId) {
    stopRecording()
    target.current = id
    setRecording(id)
    if (getCommand(id).binding.kind === 'sequence') sequenceRecorder.startRecording()
    else chordRecorder.startRecording()
  }

  // Keep the active row, including its conflict prompt, visible in the scrolling list.
  useEffect(() => {
    document.querySelector('[data-recording]')?.scrollIntoView({ block: 'nearest' })
  }, [recording, pending, rejection])

  const conflictsByCommand = useMemo(() => {
    const map = new Map<CommandId, CommandId[]>()
    for (const { command, other } of findKeymapConflicts(keymap)) {
      map.set(command, [...(map.get(command) ?? []), other])
      map.set(other, [...(map.get(other) ?? []), command])
    }
    return map
  }, [keymap])

  const search = query.trim().toLowerCase()
  const visible = commandIds.filter(
    (id) =>
      !search ||
      getCommand(id).title.toLowerCase().includes(search) ||
      bindingText(keymap[id]).toLowerCase().includes(search),
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) stopRecording()
        onOpenChange(next)
      }}
    >
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="gap-1 border-b p-4">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts follow your platform: ⌘ on Mac, Ctrl on Windows and Linux. Click a shortcut to
            change it.
          </DialogDescription>
          <div className="relative mt-2">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search commands or keys"
              aria-label="Search shortcuts"
              className="pl-8"
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {groups.map((group) => {
            const ids = visible.filter((id) => getCommand(id).group === group)
            if (!ids.length) return null
            return (
              <section key={group} className="border-b last:border-b-0">
                <h3 className="sticky top-0 z-10 bg-popover px-4 pt-3 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  {group}
                </h3>
                <ul className="pb-2">
                  {ids.map((id) => {
                    const command = getCommand(id)
                    const isRecording = recording === id
                    const overridden = id in overrides
                    const clashes = conflictsByCommand.get(id)
                    return (
                      <li
                        key={id}
                        data-recording={isRecording || undefined}
                        className={cn('scroll-mt-10 px-4 py-1.5', isRecording && 'bg-muted/60')}
                      >
                        <div className="flex min-h-8 items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs">{command.title}</div>
                            {command.scope !== 'global' && (
                              <div className="text-[11px] text-muted-foreground">
                                {scopes[command.scope].label}
                              </div>
                            )}
                          </div>
                          {isRecording ? (
                            <RecordingPrompt
                              kind={command.binding.kind}
                              steps={sequenceRecorder.steps}
                              onCommit={sequenceRecorder.commitRecording}
                              onCancel={stopRecording}
                            />
                          ) : command.remappable === false ? (
                            <Tooltip>
                              <TooltipTrigger render={<span />}>
                                <Shortcut binding={keymap[id]} all />
                              </TooltipTrigger>
                              <TooltipContent>This shortcut can’t be changed</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-auto min-h-7 py-1 font-normal"
                              aria-label={`Change shortcut for ${command.title}`}
                              onClick={() => startRecording(id)}
                            >
                              {isUnbound(keymap[id]) ? (
                                <span className="text-muted-foreground">Not set</span>
                              ) : (
                                <Shortcut binding={keymap[id]} all />
                              )}
                            </Button>
                          )}
                          {overridden && !isRecording ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Reset ${command.title}`}
                                    onClick={() => setBinding(id, null)}
                                  />
                                }
                              >
                                <RotateCcwIcon />
                              </TooltipTrigger>
                              <TooltipContent>
                                Reset to {bindingText(command.binding) || 'none'}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="size-7 shrink-0" />
                          )}
                        </div>
                        {clashes && !isRecording && (
                          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-destructive">
                            <TriangleAlertIcon className="size-3" />
                            Conflicts with{' '}
                            {clashes.map((other) => getCommand(other).title).join(', ')}
                          </p>
                        )}
                        {isRecording && pending && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[11px]">
                            <TriangleAlertIcon className="size-3.5 shrink-0 text-destructive" />
                            <span className="flex-1">
                              <Shortcut binding={pending.binding} all /> is used by{' '}
                              {[
                                ...new Set(
                                  pending.conflicts.map(
                                    (conflict) => getCommand(conflict.other).title,
                                  ),
                                ),
                              ].join(', ')}
                              .
                            </span>
                            {pending.conflicts.every(
                              (conflict) => getCommand(conflict.other).remappable !== false,
                            ) ? (
                              <Button
                                size="xs"
                                variant="destructive"
                                onClick={() =>
                                  apply(pending.command, pending.binding, pending.conflicts)
                                }
                              >
                                Reassign
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">Try another shortcut.</span>
                            )}
                          </div>
                        )}
                        {isRecording && !pending && rejection && (
                          <p className="mt-1 text-[11px] text-destructive">{rejection}</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
          {!visible.length && (
            <p className="p-8 text-center text-xs text-muted-foreground">
              No commands match “{query}”.
            </p>
          )}
        </div>

        <DialogFooter className="m-0 flex-row items-center justify-between border-t p-3 sm:justify-between">
          <span className="text-[11px] text-muted-foreground">
            Changes are saved in this browser.
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!Object.keys(overrides).length}
            onClick={() => {
              stopRecording()
              resetAll()
            }}
          >
            Reset all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RecordingPrompt({
  kind,
  steps,
  onCommit,
  onCancel,
}: {
  kind: Binding['kind']
  steps: HotkeySequence
  onCommit: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {kind === 'sequence' && steps.length > 0 ? (
          <Shortcut binding={{ kind: 'sequence', sequence: steps }} />
        ) : (
          <span className="animate-pulse text-xs text-muted-foreground">
            {kind === 'sequence' ? 'Type the keys in order…' : 'Press a shortcut…'}
          </span>
        )}
        {kind === 'sequence' && (
          <Button size="xs" disabled={steps.length < 2} onClick={onCommit}>
            Save
          </Button>
        )}
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <span className="text-[10px] text-muted-foreground">
        {kind === 'sequence' ? (
          <>
            <Kbd>↵</Kbd> save ·{' '}
          </>
        ) : null}
        <Kbd>Esc</Kbd> cancel · <Kbd>⌫</Kbd> {kind === 'sequence' ? 'undo step' : 'remove'}
      </span>
    </div>
  )
}
