import {
  detectPlatform,
  formatForDisplay,
  normalizeHotkey,
  validateHotkey,
  type Hotkey,
  type HotkeySequence,
  type IndividualKey,
} from '@tanstack/react-hotkeys'

/**
 * Scopes decide when a command can fire. Non-modal scopes stack (global, editor, and
 * selection can all be active together). While any modal scope is active, only commands in
 * active modal scopes fire, so shortcuts never act on the editor behind an open dialog.
 */
export const scopes = {
  global: { label: 'Anywhere', modal: false },
  editor: { label: 'Editor', modal: false },
  selection: { label: 'Selection', modal: false },
  dialog: { label: 'Dialog', modal: true },
} as const satisfies Record<string, { label: string; modal: boolean }>

export type Scope = keyof typeof scopes

/** A command has exactly one kind of binding. Chords may list alternatives (Mod+Shift+Z or Mod+Y). */
export type Binding =
  | { kind: 'keys'; keys: Hotkey[] }
  | { kind: 'sequence'; sequence: HotkeySequence }
  | { kind: 'hold'; key: IndividualKey }

export interface CommandDefinition {
  title: string
  group: 'File' | 'Tools' | 'Edit' | 'Selection' | 'Layers' | 'View' | 'Navigate' | 'Help'
  scope: Scope
  binding: Binding
  /**
   * Whether the command fires while typing in a text field. Defaults to 'ignore', so
   * Mod+Z undoes text in the name field instead of the canvas.
   */
  inputs?: 'ignore' | 'allow'
  /** Fire again on key repeat while held. Defaults to false (one trigger per press). */
  repeat?: boolean
  /** Users can rebind it in the shortcuts editor. Defaults to true. */
  remappable?: boolean
}

// Each helper keeps its literal `kind` so command ids can be filtered by binding type.
const keys = (...hotkeys: Hotkey[]) => ({ kind: 'keys', keys: hotkeys }) satisfies Binding
const sequence = (...steps: HotkeySequence) =>
  ({ kind: 'sequence', sequence: steps }) satisfies Binding
const hold = (key: IndividualKey) => ({ kind: 'hold', key }) satisfies Binding

// `Mod` is Command on macOS and Control elsewhere, so every binding below is portable.
export const commands = {
  'cloud.connect': {
    title: 'Admin access',
    group: 'File',
    scope: 'global',
    binding: keys('Mod+Shift+K'),
    remappable: false,
    inputs: 'allow',
  },
  'file.newBlank': {
    title: 'New project',
    group: 'File',
    scope: 'global',
    binding: sequence('N', 'N'),
  },
  'file.newSample': {
    title: 'New sample logo',
    group: 'File',
    scope: 'global',
    binding: sequence('N', 'S'),
  },
  'file.import': {
    title: 'Import artwork as a new layer…',
    group: 'File',
    scope: 'global',
    binding: keys('Mod+O'),
  },
  'file.save': {
    title: 'Save now',
    group: 'File',
    scope: 'editor',
    binding: keys('Mod+S'),
    inputs: 'allow',
  },
  'file.download': {
    title: 'Download SVG',
    group: 'File',
    scope: 'editor',
    binding: keys('Mod+Shift+S'),
    inputs: 'allow',
  },
  'file.optimize': {
    title: 'Optimize & download…',
    group: 'File',
    scope: 'editor',
    binding: keys('Mod+Shift+E'),
    inputs: 'allow',
  },
  'file.rename': { title: 'Rename project', group: 'File', scope: 'editor', binding: keys('F2') },

  'tool.select': { title: 'Select tool', group: 'Tools', scope: 'editor', binding: keys('V') },
  'tool.hand': { title: 'Hand tool', group: 'Tools', scope: 'editor', binding: keys('H') },
  'tool.rect': { title: 'Rectangle tool', group: 'Tools', scope: 'editor', binding: keys('R') },
  'tool.ellipse': { title: 'Ellipse tool', group: 'Tools', scope: 'editor', binding: keys('E') },
  'tool.pen': { title: 'Pen tool', group: 'Tools', scope: 'editor', binding: keys('P') },

  'edit.undo': {
    title: 'Undo',
    group: 'Edit',
    scope: 'editor',
    binding: keys('Mod+Z'),
    repeat: true,
  },
  'edit.redo': {
    title: 'Redo',
    group: 'Edit',
    scope: 'editor',
    binding: keys('Mod+Shift+Z', 'Mod+Y'),
    repeat: true,
  },
  'edit.escape': {
    title: 'Back to Select / clear selection',
    group: 'Edit',
    scope: 'editor',
    binding: keys('Escape'),
  },

  'selection.delete': {
    title: 'Delete selection',
    group: 'Selection',
    scope: 'selection',
    binding: keys('Backspace', 'Delete'),
  },
  'selection.center': {
    title: 'Center selection on artboard',
    group: 'Selection',
    scope: 'selection',
    binding: keys('Shift+C'),
  },
  'selection.nudgeLeft': {
    title: 'Nudge left 1px',
    group: 'Selection',
    scope: 'selection',
    binding: keys('ArrowLeft'),
    repeat: true,
  },
  'selection.nudgeRight': {
    title: 'Nudge right 1px',
    group: 'Selection',
    scope: 'selection',
    binding: keys('ArrowRight'),
    repeat: true,
  },
  'selection.nudgeUp': {
    title: 'Nudge up 1px',
    group: 'Selection',
    scope: 'selection',
    binding: keys('ArrowUp'),
    repeat: true,
  },
  'selection.nudgeDown': {
    title: 'Nudge down 1px',
    group: 'Selection',
    scope: 'selection',
    binding: keys('ArrowDown'),
    repeat: true,
  },
  'selection.nudgeLeftFar': {
    title: 'Nudge left 10px',
    group: 'Selection',
    scope: 'selection',
    binding: keys('Shift+ArrowLeft'),
    repeat: true,
  },
  'selection.nudgeRightFar': {
    title: 'Nudge right 10px',
    group: 'Selection',
    scope: 'selection',
    binding: keys('Shift+ArrowRight'),
    repeat: true,
  },
  'selection.nudgeUpFar': {
    title: 'Nudge up 10px',
    group: 'Selection',
    scope: 'selection',
    binding: keys('Shift+ArrowUp'),
    repeat: true,
  },
  'selection.nudgeDownFar': {
    title: 'Nudge down 10px',
    group: 'Selection',
    scope: 'selection',
    binding: keys('Shift+ArrowDown'),
    repeat: true,
  },

  'layers.new': {
    title: 'New layer',
    group: 'Layers',
    scope: 'editor',
    binding: keys('Mod+Shift+L'),
  },

  'view.rulers': {
    title: 'Show or hide rulers',
    group: 'View',
    scope: 'editor',
    binding: keys('Shift+R'),
  },
  'view.guides': {
    title: 'Show or hide guides',
    group: 'View',
    scope: 'editor',
    binding: keys('Mod+;'),
  },
  'view.snap': {
    title: 'Snap to guides',
    group: 'View',
    scope: 'editor',
    binding: keys('Shift+S'),
  },
  'view.lockGuides': {
    title: 'Lock guides',
    group: 'View',
    scope: 'editor',
    binding: keys('Shift+L'),
  },
  'view.clearGuides': { title: 'Clear guides', group: 'View', scope: 'editor', binding: keys() },
  'view.theme': {
    title: 'Switch theme (light, dark, system)',
    group: 'View',
    scope: 'global',
    binding: keys(),
  },
  'view.zoomIn': {
    title: 'Zoom in',
    group: 'View',
    scope: 'global',
    binding: keys('Mod+=', 'Mod+Shift+[Equal]', 'Mod+[NumpadAdd]'),
    inputs: 'allow',
    repeat: true,
  },
  'view.zoomOut': {
    title: 'Zoom out',
    group: 'View',
    scope: 'global',
    binding: keys('Mod+-', 'Mod+[NumpadSubtract]'),
    inputs: 'allow',
    repeat: true,
  },
  'view.zoomFit': {
    title: 'Zoom to fit',
    group: 'View',
    scope: 'global',
    binding: keys('Mod+0', 'Shift+[Digit1]'),
  },
  'view.zoomActual': {
    title: 'Zoom to 100%',
    group: 'View',
    scope: 'global',
    binding: keys('Shift+[Digit0]'),
  },
  'view.pan': {
    title: 'Pan while held (any tool)',
    group: 'View',
    scope: 'editor',
    binding: hold('Space'),
    remappable: false,
  },
  'view.preview': {
    title: 'Preview without selection outlines',
    group: 'View',
    scope: 'editor',
    binding: hold('Y'),
    remappable: false,
  },

  'navigate.projects': {
    title: 'Go to projects',
    group: 'Navigate',
    scope: 'global',
    binding: sequence('G', 'P'),
  },
  'navigate.layers': {
    title: 'Go to layers',
    group: 'Navigate',
    scope: 'editor',
    binding: sequence('G', 'L'),
  },
  'navigate.inspector': {
    title: 'Go to inspector',
    group: 'Navigate',
    scope: 'editor',
    binding: sequence('G', 'I'),
  },

  'help.shortcuts': {
    title: 'Keyboard shortcuts',
    group: 'Help',
    scope: 'global',
    binding: keys('Mod+/', 'Shift+/'),
  },
} as const satisfies Record<string, CommandDefinition>

export type CommandId = keyof typeof commands
type BindingKind<K extends Binding['kind']> = {
  [Id in CommandId]: (typeof commands)[Id]['binding'] extends { kind: K } ? Id : never
}[CommandId]
/** Commands triggered by key presses or sequences; each needs a handler. */
export type ActionCommandId = Exclude<CommandId, HoldCommandId>
/** Commands that are active only while a key is held; read their state instead of handling events. */
export type HoldCommandId = BindingKind<'hold'>
export type CommandHandlers = Partial<Record<ActionCommandId, (event: KeyboardEvent) => void>>

export const commandIds = Object.keys(commands) as CommandId[]
export const getCommand = (id: CommandId): CommandDefinition => commands[id]

export type Keymap = Record<CommandId, Binding>
export type KeymapOverrides = Partial<Record<CommandId, Binding>>

export function buildKeymap(overrides: KeymapOverrides): Keymap {
  return Object.fromEntries(
    commandIds.map((id) => [id, overrides[id] ?? commands[id].binding]),
  ) as Keymap
}

// ---------------------------------------------------------------------------
// Conflicts

export interface KeymapConflict {
  command: CommandId
  other: CommandId
  /** 'same': both fire on the same keys. 'prefix': one binding starts the other's sequence. */
  kind: 'same' | 'prefix'
}

function scopesOverlap(a: Scope, b: Scope) {
  return a === b || (!scopes[a].modal && !scopes[b].modal)
}

/** Each way a binding can start, as normalized chord steps. Alternatives are separate triggers. */
function triggers(binding: Binding): string[][] {
  if (binding.kind === 'keys') return binding.keys.map((key) => [normalizeHotkey(key)])
  if (binding.kind === 'sequence') return [binding.sequence.map((step) => normalizeHotkey(step))]
  return [[normalizeHotkey(binding.key as Hotkey)]]
}

const startsWith = (long: string[], short: string[]) =>
  short.every((step, index) => long[index] === step)

/**
 * Finds bindings that would fire together, using scopes rather than the live registry, so
 * commands from unmounted components are covered too. Pass `candidate` to test a binding
 * for `command` before applying it.
 */
export function findKeymapConflicts(
  keymap: Keymap,
  options: { command?: CommandId; candidate?: Binding } = {},
): KeymapConflict[] {
  const conflicts: KeymapConflict[] = []
  const subjects = options.command ? [options.command] : commandIds
  for (const [index, command] of subjects.entries()) {
    const binding =
      options.command === command && options.candidate ? options.candidate : keymap[command]
    const others = options.command
      ? commandIds.filter((id) => id !== command)
      : commandIds.slice(index + 1)
    for (const other of others) {
      if (!scopesOverlap(commands[command].scope, commands[other].scope)) continue
      for (const a of triggers(binding)) {
        for (const b of triggers(keymap[other])) {
          if (!startsWith(a, b) && !startsWith(b, a)) continue
          conflicts.push({ command, other, kind: a.length === b.length ? 'same' : 'prefix' })
        }
      }
    }
  }
  return conflicts
}

/** Returns `other`'s binding without the alternatives that overlap `candidate`; a clashing sequence is unbound. */
export function releaseBinding(keymap: Keymap, other: CommandId, candidate: Binding): Binding {
  const binding = keymap[other]
  const taken = triggers(candidate)
  const overlaps = (steps: string[]) =>
    taken.some((a) => startsWith(a, steps) || startsWith(steps, a))
  if (binding.kind === 'keys')
    return { kind: 'keys', keys: binding.keys.filter((key) => !overlaps([normalizeHotkey(key)])) }
  if (binding.kind === 'sequence') return { kind: 'sequence', sequence: [] }
  return binding
}

// ---------------------------------------------------------------------------
// Persistence

const STORAGE_KEY = 'svgw:keymap:v1'

function isValidBinding(id: CommandId, value: unknown): value is Binding {
  if (!value || typeof value !== 'object') return false
  const binding = value as Binding
  if (binding.kind !== commands[id].binding.kind) return false
  if (binding.kind === 'keys')
    return Array.isArray(binding.keys) && binding.keys.every((key) => validateHotkey(key).valid)
  if (binding.kind === 'sequence')
    return (
      Array.isArray(binding.sequence) && binding.sequence.every((key) => validateHotkey(key).valid)
    )
  return false
}

export function loadOverrides(): KeymapOverrides {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    // Drop entries for removed commands or with bindings that no longer parse.
    return Object.fromEntries(
      Object.entries(stored).filter(
        ([id, binding]) => id in commands && isValidBinding(id as CommandId, binding),
      ),
    ) as KeymapOverrides
  } catch {
    return {}
  }
}

export function saveOverrides(overrides: KeymapOverrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    /* Private mode: remaps last for the session. */
  }
}

// ---------------------------------------------------------------------------
// Display

// '␣' reads poorly in a "Hold Space" label.
const displayOptions = { parts: true, keyLabels: { Space: 'Space' } } as const

/** Platform-aware labels: ⇧⌘S on macOS, Ctrl+Shift+S elsewhere. One array of key labels per chord. */
export function bindingChords(binding: Binding): string[][] {
  if (binding.kind === 'keys')
    return binding.keys.map((key) => formatForDisplay(key, displayOptions))
  if (binding.kind === 'sequence')
    return binding.sequence.map((step) => formatForDisplay(step, displayOptions))
  return [formatForDisplay(binding.key as Hotkey, displayOptions)]
}

// Inline text uses compact macOS symbols (⇧⌘S) and the platform's default separator (Ctrl+Shift+S) elsewhere.
const chordText = (hotkey: Hotkey) =>
  formatForDisplay(hotkey, {
    keyLabels: { Space: 'Space' },
    separatorToken: detectPlatform() === 'mac' ? '' : null,
  })

export function bindingText(binding: Binding) {
  if (binding.kind === 'keys') return binding.keys.length ? chordText(binding.keys[0]) : ''
  if (binding.kind === 'sequence') return binding.sequence.map(chordText).join(' then ')
  return `Hold ${chordText(binding.key as Hotkey)}`
}

export const isUnbound = (binding: Binding) =>
  (binding.kind === 'keys' && binding.keys.length === 0) ||
  (binding.kind === 'sequence' && binding.sequence.length === 0)
