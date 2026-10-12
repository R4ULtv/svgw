import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  useHotkeyHint,
  useHotkeys,
  useHotkeySequences,
  useKeyHold,
  type Hotkey,
  type UseHotkeyDefinition,
  type UseHotkeySequenceDefinition,
} from '@tanstack/react-hotkeys'
import {
  bindingChords,
  bindingText,
  buildKeymap,
  findKeymapConflicts,
  getCommand,
  loadOverrides,
  saveOverrides,
  scopes,
  type ActionCommandId,
  type Binding,
  type CommandHandlers,
  type CommandId,
  type HoldCommandId,
  type Keymap,
  type KeymapOverrides,
  type Scope,
} from '@/lib/commands'
import { cn } from '@/lib/utils'
import { Kbd, KbdGroup } from '@/components/ui/kbd'

interface CommandContextValue {
  keymap: Keymap
  overrides: KeymapOverrides
  /** Pass `null` to restore the default binding. */
  setBinding: (id: CommandId, binding: Binding | null) => void
  resetAll: () => void
  isScopeActive: (scope: Scope) => boolean
  enterScope: (scope: Scope) => () => void
}

const CommandContext = createContext<CommandContextValue | null>(null)

export function CommandProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<KeymapOverrides>(() =>
    typeof window === 'undefined' ? {} : loadOverrides(),
  )
  // Scopes are reference-counted so nested or repeated owners can enter the same scope.
  const [scopeCounts, setScopeCounts] = useState<Partial<Record<Scope, number>>>({})
  const keymap = useMemo(() => buildKeymap(overrides), [overrides])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    for (const { command, other, kind } of findKeymapConflicts(keymap))
      console.warn(
        `[commands] ${command} and ${other} ${kind === 'same' ? 'share a binding' : 'have overlapping sequences'}.`,
      )
  }, [keymap])

  const setBinding = useCallback((id: CommandId, binding: Binding | null) => {
    setOverrides((current) => {
      const next = { ...current }
      if (binding === null || JSON.stringify(binding) === JSON.stringify(getCommand(id).binding))
        delete next[id]
      else next[id] = binding
      saveOverrides(next)
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    saveOverrides({})
    setOverrides({})
  }, [])

  const enterScope = useCallback((scope: Scope) => {
    setScopeCounts((counts) => ({ ...counts, [scope]: (counts[scope] ?? 0) + 1 }))
    return () =>
      setScopeCounts((counts) => ({ ...counts, [scope]: Math.max(0, (counts[scope] ?? 0) - 1) }))
  }, [])

  const isScopeActive = useCallback(
    (scope: Scope) => {
      const modalOpen = (Object.keys(scopeCounts) as Scope[]).some(
        (name) => scopes[name].modal && (scopeCounts[name] ?? 0) > 0,
      )
      if (modalOpen) return scopes[scope].modal && (scopeCounts[scope] ?? 0) > 0
      return scope === 'global' || (scopeCounts[scope] ?? 0) > 0
    },
    [scopeCounts],
  )

  const value = useMemo(
    () => ({ keymap, overrides, setBinding, resetAll, isScopeActive, enterScope }),
    [keymap, overrides, setBinding, resetAll, isScopeActive, enterScope],
  )
  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>
}

export function useCommandContext() {
  const context = useContext(CommandContext)
  if (!context) throw new Error('Command hooks must be used inside <CommandProvider>.')
  return context
}

/** Activates `scope` while `active` is true and the component is mounted. */
export function useCommandScope(scope: Scope, active = true) {
  const { enterScope } = useCommandContext()
  useEffect(() => (active ? enterScope(scope) : undefined), [scope, active, enterScope])
}

// Overlays handle their own keys. The tree also allows shortcuts to another panel.
const OVERLAY = '[role="menu"], [role="listbox"], [role="tree"]'

const isTypingTarget = (element: Element | null) =>
  element instanceof HTMLElement &&
  (element.isContentEditable ||
    element.matches('input:not([type="button"],[type="submit"],[type="reset"]), textarea, select'))

/**
 * Registers handlers for the current keymap. Only commands with a handler are bound, so a
 * command is live exactly while the component that can perform it is mounted.
 */
export function useCommands(handlers: CommandHandlers) {
  const { keymap, isScopeActive } = useCommandContext()
  const chords: UseHotkeyDefinition[] = []
  const sequences: UseHotkeySequenceDefinition[] = []

  for (const id of Object.keys(handlers) as ActionCommandId[]) {
    const handler = handlers[id]
    if (!handler) continue
    const command = getCommand(id)
    const binding = keymap[id]
    const options = {
      enabled: isScopeActive(command.scope),
      ignoreInputs: command.inputs !== 'allow',
      // The callback decides; overlays and filtered events keep their default behavior.
      preventDefault: false,
      stopPropagation: false,
      // Scope-aware conflicts are checked against the whole keymap in findKeymapConflicts.
      conflictBehavior: 'allow' as const,
      meta: { name: command.title, group: command.group },
    }
    const callback = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const overlay = target?.closest(OVERLAY)
      if (
        command.inputs !== 'allow' &&
        overlay &&
        !(overlay.getAttribute('role') === 'tree' && command.group === 'Navigate')
      )
        return
      event.preventDefault()
      handler(event)
    }
    if (binding.kind === 'keys') {
      for (const hotkey of binding.keys)
        chords.push({ hotkey, callback, options: { ...options, requireReset: !command.repeat } })
    } else if (binding.kind === 'sequence' && binding.sequence.length) {
      sequences.push({ sequence: binding.sequence, callback, options })
    }
  }

  useHotkeys(chords)
  useHotkeySequences(sequences)
}

/** True while the command's hold key is down, its scope is active, and focus is not in a control the key would type into or press. */
export function useCommandHeld(id: HoldCommandId) {
  const { keymap, isScopeActive } = useCommandContext()
  const binding = keymap[id]
  const held = useKeyHold(binding.kind === 'hold' ? binding.key : 'Space')
  const focused = typeof document === 'undefined' ? null : document.activeElement
  return (
    held &&
    isScopeActive(getCommand(id).scope) &&
    !isTypingTarget(focused) &&
    !(focused instanceof HTMLButtonElement)
  )
}

export function useBinding(id: CommandId) {
  return useCommandContext().keymap[id]
}

/** Renders a binding as keycaps: ⇧⌘S on macOS, Ctrl Shift S elsewhere. Sequences read "G then P". */
export function Shortcut({
  binding,
  all = false,
  showHold = true,
  className,
}: {
  binding: Binding
  all?: boolean
  showHold?: boolean
  className?: string
}) {
  const chords = bindingChords(binding)
  if (!chords.length) return null
  const shown = binding.kind === 'keys' && !all ? chords.slice(0, 1) : chords
  const separator = binding.kind === 'sequence' ? 'then' : 'or'
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {binding.kind === 'hold' && showHold && (
        <span className="text-[11px] text-muted-foreground">Hold</span>
      )}
      {shown.map((parts, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="text-[11px] text-muted-foreground">{separator}</span>}
          <KbdGroup>
            {parts.map((part, partIndex) => (
              <Kbd key={partIndex}>{part}</Kbd>
            ))}
          </KbdGroup>
        </Fragment>
      ))}
    </span>
  )
}

export function CommandShortcut({
  command,
  all,
  showHold,
  className,
}: {
  command: CommandId
  all?: boolean
  showHold?: boolean
  className?: string
}) {
  return (
    <Shortcut binding={useBinding(command)} all={all} showHold={showHold} className={className} />
  )
}

/**
 * A keycap badge that appears while the user holds a modifier from the command's first chord,
 * for example holding ⌘ reveals ⌘Z on the Undo button. Place inside a `relative` parent.
 */
export function ShortcutHint({ command, className }: { command: CommandId; className?: string }) {
  const binding = useBinding(command)
  const first = binding.kind === 'keys' ? binding.keys[0] : undefined
  // Hooks cannot be conditional; F24 has no modifiers, so it never matches held modifiers.
  const visible = useHotkeyHint(first ?? ('F24' satisfies Hotkey)) && first !== undefined
  if (!visible) return null
  // One compact keycap (⇧⌘Z) so hints on adjacent icon buttons don't overlap.
  return (
    <Kbd
      className={cn(
        'pointer-events-none absolute -bottom-2.5 left-1/2 z-20 h-4 -translate-x-1/2 bg-popover px-1 text-[10px] text-foreground shadow-sm ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95',
        className,
      )}
    >
      {bindingText(binding)}
    </Kbd>
  )
}
