import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { matchesKeyboardEvent } from '@tanstack/react-hotkeys'
import {
  ChevronRightIcon,
  CircleIcon,
  ComponentIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  GroupIcon,
  ImageIcon,
  LayersIcon,
  LockIcon,
  LockOpenIcon,
  PencilIcon,
  PlusIcon,
  SplineIcon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
  type LucideIcon,
} from 'lucide-react'
import type { SvgEditor } from '@/lib/editor'
import { createFrameTask } from '@/lib/frame-task'
import {
  isLayerExpanded,
  layerRows,
  layerRowWindow,
  layerSelectionRange,
  LAYER_ROW_HEIGHT,
  type LayerRow,
} from '@/lib/layer-rows'
import {
  buildLayerTree,
  centerSelectionOnArtboard,
  createLayer,
  isBlocked,
  isLayer,
  isLocked,
  keyOf,
  layerName,
  layerOf,
  moveElements,
  rename,
  restoreArtworkState,
  selectInLayers,
  setArtworkState,
  setHidden,
  setLocked,
  type DropTarget,
  type LayerNode,
} from '@/lib/layers'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CommandShortcut, useBinding } from './commands'

const ICONS: Record<string, LucideIcon> = {
  g: GroupIcon,
  rect: SquareIcon,
  circle: CircleIcon,
  ellipse: CircleIcon,
  path: SplineIcon,
  polyline: SplineIcon,
  polygon: SplineIcon,
  line: SplineIcon,
  text: TypeIcon,
  image: ImageIcon,
  use: ComponentIcon,
}

type DropPosition = 'above' | 'below' | 'inside'

interface LayersPanelProps {
  editor: SvgEditor | null
  documentRevision: number
  selectionRevision: number
  /** Call after editing the document so it is saved and the editor state refreshes. */
  onChange: () => void
  /** Call after changing only the selection or current layer. */
  onSelect: () => void
}

export const LayersPanel = memo(function LayersPanel({
  editor,
  documentRevision,
  selectionRevision,
  onChange,
  onSelect,
}: LayersPanelProps) {
  // oxlint-disable-next-line react/exhaustive-deps -- The engine mutates DOM in place; the revision token invalidates the tree cache.
  const tree = useMemo(() => (editor ? buildLayerTree(editor) : []), [editor, documentRevision])
  const selected = useMemo(
    () => new Set(editor?.getSelectedElements().filter((item): item is Element => !!item) ?? []),
    // oxlint-disable-next-line react/exhaustive-deps -- Selection changes inside the engine without changing its identity.
    [editor, selectionRevision],
  )
  // Node editing empties the engine's selection; the edited path still reads as selected, but
  // panel actions keep using the engine's selection.
  const highlighted = useMemo(() => {
    const edited = editor?.getMode() === 'pathedit' ? editor.getPathObj()?.elem : null
    return edited && !selected.has(edited) ? new Set([...selected, edited]) : selected
    // oxlint-disable-next-line react/exhaustive-deps -- The edited path changes with the selection revision.
  }, [editor, selected, selectionRevision])
  const currentLayer = editor?.getCurrentDrawing().getCurrentLayer() ?? null
  // Hidden or empty layers stay collapsed. Explicit choices survive visibility changes and edits.
  const [expansion, setExpansion] = useState<Map<string, boolean>>(() => new Map())
  const previousSelection = useRef<Set<Element>>(new Set())
  const selectionAnchor = useRef<Element | null>(null)
  const panelSelection = useRef<Set<Element> | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [dragging, setDragging] = useState<Element[]>([])
  const [drop, setDrop] = useState<{ key: string; position: DropPosition } | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<string | null>(null)
  const dragSource = useRef<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const [visibleWindow, setWindow] = useState({ top: 0, height: 640 })
  const rows = useMemo(() => layerRows(tree, expansion), [tree, expansion])
  const range = layerRowWindow(rows.length, visibleWindow.top, visibleWindow.height)
  const selectedParents = useMemo(() => {
    const parents = new Set<Element>()
    for (const element of highlighted) {
      for (
        let parent = element.parentElement;
        parent && parent.id !== 'svgcontent';
        parent = parent.parentElement
      )
        parents.add(parent)
    }
    return parents
    // oxlint-disable-next-line react/exhaustive-deps -- Reparenting mutates DOM ancestry without changing the selected elements.
  }, [highlighted, documentRevision])
  const deleteBinding = useBinding('selection.delete')
  const centerBinding = useBinding('selection.center')
  const hideBinding = useBinding('selection.hide')
  const lockBinding = useBinding('selection.lock')
  const showAllBinding = useBinding('layers.showAll')
  const unlockAllBinding = useBinding('layers.unlockAll')
  const undoBinding = useBinding('edit.undo')
  const redoBinding = useBinding('edit.redo')

  useEffect(() => {
    const element = treeRef.current
    if (!element) return
    const update = () =>
      setWindow((current) =>
        current.top === element.scrollTop && current.height === element.clientHeight
          ? current
          : { top: element.scrollTop, height: element.clientHeight },
      )
    const task = createFrameTask(update)
    const observer = new ResizeObserver(task.schedule)
    element.addEventListener('scroll', task.schedule, { passive: true })
    observer.observe(element)
    update()
    return () => {
      task.cancel()
      observer.disconnect()
      element.removeEventListener('scroll', task.schedule)
    }
  }, [editor])

  function revealRow(index: number) {
    const element = treeRef.current
    if (!element || index < 0) return
    const top = index * LAYER_ROW_HEIGHT
    if (top < element.scrollTop) element.scrollTop = top
    else if (top + LAYER_ROW_HEIGHT > element.scrollTop + element.clientHeight)
      element.scrollTop = top + LAYER_ROW_HEIGHT - element.clientHeight
    setWindow((current) =>
      current.top === element.scrollTop && current.height === element.clientHeight
        ? current
        : { top: element.scrollTop, height: element.clientHeight },
    )
  }

  function focusRow(index: number) {
    const item = rows[Math.max(0, Math.min(rows.length - 1, index))]
    if (!item) {
      treeRef.current?.focus()
      return
    }
    pendingFocus.current = item.node.key
    revealRow(rows.indexOf(item))
    const element = treeRef.current?.querySelector<HTMLElement>(
      `[data-layer-key="${item.node.key}"]`,
    )
    if (element) {
      pendingFocus.current = null
      element.focus()
    }
  }

  useLayoutEffect(() => {
    if (!pendingFocus.current) return
    const element = treeRef.current?.querySelector<HTMLElement>(
      `[data-layer-key="${pendingFocus.current}"]`,
    )
    if (element) {
      pendingFocus.current = null
      element.focus()
    }
  }, [rows, range.start, range.end])

  const isExpanded = (node: LayerNode) => isLayerExpanded(node, expansion)
  const toggle = (node: LayerNode) =>
    setExpansion((before) => {
      const next = new Map(before)
      next.set(node.key, !isLayerExpanded(node, before))
      return next
    })

  // Reveal canvas selections: expand their ancestors and scroll the first one into view.
  useEffect(() => {
    const previous = previousSelection.current
    previousSelection.current = highlighted
    // A layer anchors a range without being selected itself, until the canvas selects something.
    const anchor = selectionAnchor.current
    const fromPanel = panelSelection.current
    const panelMade =
      !selected.size ||
      (fromPanel?.size === selected.size &&
        [...selected].every((element) => fromPanel.has(element)))
    if (anchor && !selected.has(anchor) && !(isLayer(anchor) && anchor.isConnected && panelMade))
      selectionAnchor.current = null
    if (
      !highlighted.size ||
      (previous.size === highlighted.size &&
        [...highlighted].every((element) => previous.has(element)))
    )
      return
    setExpansion((before) => {
      const next = new Map(before)
      for (const element of highlighted) {
        for (
          let node = element.parentElement;
          node && node.id !== 'svgcontent';
          node = node.parentElement
        ) {
          const key = keyOf(node)
          next.set(key, true)
        }
      }
      return next.size === before.size &&
        [...next].every(([key, expanded]) => before.get(key) === expanded)
        ? before
        : next
    })
  }, [selected, highlighted])

  useEffect(() => {
    // Panel clicks already target a visible row; keep its scroll position while selecting a range.
    const fromPanel = panelSelection.current
    if (
      fromPanel?.size === selected.size &&
      [...selected].every((element) => fromPanel.has(element))
    )
      return
    panelSelection.current = null
    if (highlighted.size) revealRow(rows.findIndex((row) => highlighted.has(row.node.element)))
  }, [rows, selected, highlighted])

  if (!editor) return null

  function act(action: () => void, { mutates = true } = {}) {
    action()
    if (mutates) onChange()
    else onSelect()
  }

  function activate(node: LayerNode, event: MouseEvent | KeyboardEvent) {
    if (!editor) return
    const additive = event.metaKey || event.ctrlKey
    if (node.kind === 'layer' && !additive && !event.shiftKey) {
      selectionAnchor.current = node.element
      panelSelection.current = null
      act(
        () => {
          editor.leaveContext()
          editor.setCurrentLayer(node.name)
        },
        { mutates: false },
      )
      return
    }
    if (node.kind !== 'layer' && isBlocked(node.element)) return
    // Read the engine directly because its scheduled React refresh may lag behind rapid clicks.
    const selection = editor
      .getSelectedElements()
      .filter((element): element is Element => !!element)
    if (event.shiftKey) {
      const anchor =
        selectionAnchor.current ??
        rows.find((row) => selection.includes(row.node.element))?.node.element ??
        node.element
      selectionAnchor.current = anchor
      act(() => selectInLayers(editor, layerSelectionRange(rows, anchor, node.element), additive), {
        mutates: false,
      })
    } else {
      selectionAnchor.current = node.element
      // A layer toggles its artwork as a whole.
      const targets =
        node.kind === 'layer'
          ? layerSelectionRange(rows, node.element, node.element)
          : [node.element]
      const remove = additive && targets.length > 0 && targets.every((t) => selection.includes(t))
      act(
        () =>
          remove
            ? selectInLayers(
                editor,
                selection.filter((element) => !targets.includes(element)),
                false,
              )
            : selectInLayers(editor, targets, additive),
        { mutates: false },
      )
    }
    panelSelection.current = new Set(
      editor.getSelectedElements().filter((element): element is Element => !!element),
    )
  }

  function deleteLayer(node: LayerNode) {
    if (tree.length < 2) return
    act(() => {
      editor!.setCurrentLayer(node.name)
      editor!.deleteCurrentLayer()
    })
  }

  function duplicateLayer(node: LayerNode) {
    const names = new Set([...editor!.getSvgContent().children].filter(isLayer).map(layerName))
    let name = `${node.name} copy`
    for (let index = 2, base = name; names.has(name); index++) name = `${base} ${index}`
    act(() => {
      editor!.setCurrentLayer(node.name)
      editor!.cloneLayer(name)
    })
  }

  function deleteObject(node: LayerNode) {
    act(() => {
      selectInLayers(editor!, [node.element], false)
      editor!.deleteSelectedElements()
    })
  }

  // ---- Drag and drop -----------------------------------------------------

  function onDragStart(node: LayerNode, event: DragEvent) {
    dragSource.current = node.key
    const elements =
      node.kind === 'layer'
        ? [node.element]
        : selected.has(node.element)
          ? [...selected].filter(
              (element) =>
                !isLayer(element) &&
                ![...selected].some((other) => other !== element && other.contains(element)),
            )
          : [node.element]
    setDragging(elements)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', node.name)
  }

  /**
   * Layers and groups take drops in their middle and place them beside themselves near their
   * edges, so layers can nest in other layers and groups can move out between layers.
   */
  function positionFor(node: LayerNode, event: DragEvent): DropPosition | null {
    if (
      !dragging.length ||
      dragging.some((element) => element === node.element || element.contains(node.element))
    )
      return null
    const rect = event.currentTarget.getBoundingClientRect()
    const y = (event.clientY - rect.top) / rect.height
    const position: DropPosition =
      node.kind !== 'object' && y > 0.25 && y < 0.75 ? 'inside' : y < 0.5 ? 'above' : 'below'
    const { parent } = destinationFor(node, position)
    // Nothing moves into locked layers or groups, as in Illustrator.
    for (
      let item: Element | null = parent;
      item && item.id !== 'svgcontent';
      item = item.parentElement
    )
      if (isLocked(item)) return null
    return position
  }

  function destinationFor(node: LayerNode, position: DropPosition): DropTarget {
    const target = node.element
    // Just below an open layer or group is the top of its contents.
    if (position === 'inside' || (position === 'below' && node.children.length && isExpanded(node)))
      return { parent: target, before: null }
    // The tree lists topmost first, so "above" in the panel means later in the DOM.
    return {
      parent: target.parentElement!,
      before: position === 'above' ? target.nextElementSibling : target,
    }
  }

  function onDragOver(node: LayerNode, event: DragEvent) {
    const position = positionFor(node, event)
    if (!position) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (drop?.key !== node.key || drop.position !== position) setDrop({ key: node.key, position })
  }

  function onDrop(node: LayerNode, event: DragEvent) {
    event.preventDefault()
    const position = positionFor(node, event)
    if (position && node.element.parentElement) {
      const destination = destinationFor(node, position)
      const moving = dragging
      act(() => moveElements(editor!, moving, destination))
      // Keep the moved objects visible: open the layer or group they were dropped into.
      if (destination.parent === node.element && !isExpanded(node)) toggle(node)
    }
    setDragging([])
    dragSource.current = null
    setDrop(null)
  }

  // ---- Keyboard navigation (tree pattern) ---------------------------------

  function onNodeKeyDown(node: LayerNode, event: KeyboardEvent<HTMLDivElement>) {
    // Row controls and the rename input keep their own keyboard behavior.
    if (event.target !== event.currentTarget) return
    const matches = (binding: typeof deleteBinding) =>
      binding.kind === 'keys' &&
      binding.keys.some((key) => matchesKeyboardEvent(event.nativeEvent, key))
    if (matches(deleteBinding)) {
      event.preventDefault()
      event.stopPropagation()
      if (event.repeat || (node.kind === 'layer' ? tree.length < 2 : isBlocked(node.element)))
        return
      const index = rows.findIndex((row) => row.node === node)
      // Skip children of a deleted group; keep focus in the tree for the next action.
      const survives = (row: LayerRow) =>
        row.depth <= rows[index].depth && !selected.has(row.node.element)
      const next =
        rows.slice(index + 1).find(survives) ?? rows.slice(0, index).reverse().find(survives)
      // Move focus before removing its row so a modal sheet keeps it inside the tree.
      if (next) focusRow(rows.indexOf(next))
      else treeRef.current?.focus()
      if (node.kind === 'layer') deleteLayer(node)
      else if (selected.has(node.element)) act(() => editor!.deleteSelectedElements())
      else deleteObject(node)
    } else if (matches(hideBinding) || matches(lockBinding)) {
      event.preventDefault()
      event.stopPropagation()
      if (event.repeat) return
      const selection = editor!
        .getSelectedElements()
        .filter((element): element is Element => !!element)
      const elements = selection.length ? selection : [node.element]
      if (setArtworkState(editor!, elements, matches(hideBinding) ? 'hidden' : 'locked', true))
        onChange()
    } else if (matches(showAllBinding) || matches(unlockAllBinding)) {
      event.preventDefault()
      event.stopPropagation()
      if (
        !event.repeat &&
        restoreArtworkState(editor!, matches(showAllBinding) ? 'hidden' : 'locked')
      )
        onChange()
    } else if (matches(centerBinding) && selected.size) {
      event.preventDefault()
      event.stopPropagation()
      if (!event.repeat && centerSelectionOnArtboard(editor!)) onChange()
    } else if (matches(undoBinding) || matches(redoBinding)) {
      event.preventDefault()
      event.stopPropagation()
      act(() => (matches(undoBinding) ? editor!.undoMgr.undo() : editor!.undoMgr.redo()))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate(node, event)
    } else if (event.key === 'ArrowRight' && node.children.length && !isExpanded(node)) {
      event.preventDefault()
      toggle(node)
    } else if (event.key === 'ArrowLeft' && node.children.length && isExpanded(node)) {
      event.preventDefault()
      toggle(node)
    }
  }

  function onTreeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = (document.activeElement as HTMLElement | null)?.dataset.layerKey
    const index = rows.findIndex((row) => row.node.key === key)
    if (index < 0 || editing) return
    if (event.key === 'ArrowDown') focusRow(index + 1)
    else if (event.key === 'ArrowUp') focusRow(index - 1)
    else if (event.key === 'Home') focusRow(0)
    else if (event.key === 'End') focusRow(rows.length - 1)
    else return
    event.preventDefault()
  }

  // ---- Rendering ----------------------------------------------------------

  function renderNode({ node, depth, hiddenAbove, lockedAbove, position, siblings }: LayerRow) {
    const Icon = node.kind === 'layer' ? LayersIcon : (ICONS[node.tag] ?? SquareIcon)
    const expanded = isExpanded(node)
    const hasChildren = node.children.length > 0
    const isSelected = highlighted.has(node.element)
    const containsSelection = !isSelected && selectedParents.has(node.element)
    const dimmed = hiddenAbove || node.hidden
    const isCurrent = node.element === currentLayer
    const dropHere = drop?.key === node.key ? drop.position : null

    const row = (
      <div
        role="treeitem"
        aria-level={depth + 1}
        aria-posinset={position}
        aria-setsize={siblings}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={isSelected}
        aria-current={isCurrent ? 'true' : undefined}
        tabIndex={-1}
        data-layer-key={node.key}
        // Layers reorder even when locked; locked objects stay put, as in Illustrator.
        draggable={editing !== node.key && (node.kind === 'layer' || !(lockedAbove || node.locked))}
        onDragStart={(event) => onDragStart(node, event)}
        onDragOver={(event) => onDragOver(node, event)}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null)
        }}
        onDrop={(event) => onDrop(node, event)}
        onDragEnd={() => {
          dragSource.current = null
          setDragging([])
          setDrop(null)
        }}
        onClick={(event) => {
          event.currentTarget.focus()
          activate(node, event)
        }}
        onDoubleClick={() => setEditing(node.key)}
        onKeyDown={(event) => onNodeKeyDown(node, event)}
        className={cn(
          'group/row relative flex h-8 cursor-default items-center text-xs outline-none select-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
          node.kind === 'layer' ? 'bg-muted/30 font-medium hover:bg-muted' : 'hover:bg-muted/60',
          isSelected && 'bg-primary/10 hover:bg-primary/15',
          dropHere === 'inside' && 'bg-primary/15 ring-1 ring-primary ring-inset',
          dragging.includes(node.element) && 'opacity-40',
        )}
      >
        {isCurrent && (
          <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden="true" />
        )}
        {dropHere === 'above' && (
          <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-primary" />
        )}
        {dropHere === 'below' && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-0.5 bg-primary" />
        )}

        <div
          className={cn('flex min-w-0 flex-1 items-center gap-1.5 pr-1', dimmed && 'opacity-50')}
          style={{ paddingLeft: depth * 12 + 10 }}
        >
          {hasChildren ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={expanded ? 'Collapse' : 'Expand'}
              onClick={(event) => {
                event.stopPropagation()
                toggle(node)
              }}
              className="grid size-4 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
            >
              <ChevronRightIcon
                className={cn('size-3 transition-transform', expanded && 'rotate-90')}
              />
            </button>
          ) : (
            <span className="size-4 shrink-0" />
          )}
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          {node.swatch && (
            <span
              className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ background: node.swatch }}
            />
          )}
          {editing === node.key ? (
            <RenameInput
              initial={node.kind === 'layer' || !node.name.startsWith('<') ? node.name : ''}
              placeholder={node.name}
              onDone={(name) => {
                setEditing(null)
                if (name !== null && name.trim() && name !== node.name)
                  act(() => rename(editor!, node.element, name))
              }}
            />
          ) : (
            <span
              className={cn(
                'min-w-0 flex-1 truncate',
                node.kind !== 'layer' && node.name.startsWith('<') && 'text-muted-foreground',
              )}
            >
              {node.name}
            </span>
          )}
        </div>
        <RowToggle
          label={node.hidden ? `Show ${node.name}` : `Hide ${node.name}`}
          active={!node.hidden}
          faded={hiddenAbove}
          persistent={node.hidden}
          onClick={() => act(() => setHidden(editor!, node.element, !node.hidden))}
        >
          {node.hidden ? <EyeOffIcon /> : <EyeIcon />}
        </RowToggle>
        <RowToggle
          label={node.locked ? `Unlock ${node.name}` : `Lock ${node.name}`}
          active={node.locked}
          faded={lockedAbove}
          persistent={node.locked || lockedAbove}
          onClick={() => act(() => setLocked(editor!, node.element, !node.locked))}
        >
          {node.locked ? <LockIcon /> : <LockOpenIcon />}
        </RowToggle>
        {/* Illustrator's selection indicator: filled when selected, outlined when it contains the selection. */}
        <span
          className={cn(
            'mr-2 size-2 shrink-0',
            isSelected ? 'bg-primary' : containsSelection ? 'ring-1 ring-primary' : '',
          )}
          aria-hidden="true"
        />
      </div>
    )

    const otherLayers = tree.filter((layer) => layer.element !== layerOf(node.element))
    return (
      <li key={node.key} role="none" style={{ height: LAYER_ROW_HEIGHT }}>
        <ContextMenu>
          <ContextMenuTrigger render={row} />
          <ContextMenuContent className="w-52">
            <ContextMenuItem onClick={() => setEditing(node.key)}>
              <PencilIcon />
              Rename
            </ContextMenuItem>
            {node.kind === 'layer' && (
              <>
                <ContextMenuItem onClick={() => act(() => createLayer(editor!))}>
                  <PlusIcon />
                  New layer
                  <CommandShortcut command="layers.new" className="ml-auto" />
                </ContextMenuItem>
                <ContextMenuItem onClick={() => duplicateLayer(node)}>
                  <CopyIcon />
                  Duplicate layer
                </ContextMenuItem>
              </>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => act(() => setHidden(editor!, node.element, !node.hidden))}
            >
              {node.hidden ? <EyeIcon /> : <EyeOffIcon />}
              {node.hidden ? 'Show' : 'Hide'}
              {!node.hidden && <CommandShortcut command="selection.hide" className="ml-auto" />}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => act(() => setLocked(editor!, node.element, !node.locked))}
            >
              {node.locked ? <LockOpenIcon /> : <LockIcon />}
              {node.locked ? 'Unlock' : 'Lock'}
              {!node.locked && <CommandShortcut command="selection.lock" className="ml-auto" />}
            </ContextMenuItem>
            {node.kind !== 'layer' && otherLayers.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <LayersIcon />
                  Move to layer
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {otherLayers.map((layer) => (
                    <ContextMenuItem
                      key={layer.key}
                      disabled={layer.locked}
                      onClick={() =>
                        act(() =>
                          moveElements(editor!, [node.element], {
                            parent: layer.element,
                            before: null,
                          }),
                        )
                      }
                    >
                      {layer.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}
            <ContextMenuSeparator />
            {node.kind === 'layer' ? (
              <ContextMenuItem
                variant="destructive"
                disabled={tree.length < 2}
                onClick={() => deleteLayer(node)}
              >
                <Trash2Icon />
                Delete layer
                <CommandShortcut command="selection.delete" className="ml-auto" />
              </ContextMenuItem>
            ) : (
              <ContextMenuItem
                variant="destructive"
                disabled={isBlocked(node.element)}
                onClick={() => deleteObject(node)}
              >
                <Trash2Icon />
                Delete
                <CommandShortcut command="selection.delete" className="ml-auto" />
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </li>
    )
  }

  const current = tree.find((node) => node.element === currentLayer)
  // Preserve the DOM of active interactions when their row scrolls outside the visible window.
  const indices = new Set(
    Array.from({ length: range.end - range.start }, (_, index) => range.start + index),
  )
  for (const key of [editing, focused, dragSource.current]) {
    const index = key ? rows.findIndex((row) => row.node.key === key) : -1
    if (index >= 0) indices.add(index)
  }
  const rendered = []
  let cursor = 0
  for (const index of [...indices].sort((a, b) => a - b)) {
    if (index > cursor)
      rendered.push(
        <li
          key={`gap-${cursor}-${index}`}
          role="none"
          aria-hidden="true"
          style={{ height: (index - cursor) * LAYER_ROW_HEIGHT }}
        />,
      )
    rendered.push(renderNode(rows[index]))
    cursor = index + 1
  }
  if (cursor < rows.length)
    rendered.push(
      <li
        key={`gap-${cursor}-${rows.length}`}
        role="none"
        aria-hidden="true"
        style={{ height: (rows.length - cursor) * LAYER_ROW_HEIGHT }}
      />,
    )
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <LayersIcon className="size-3.5 text-muted-foreground" />
        <h2 className="text-xs font-medium">Layers</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">{tree.length}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label="New layer"
                onClick={() => act(() => createLayer(editor))}
              />
            }
          >
            <PlusIcon />
          </TooltipTrigger>
          <TooltipContent>
            New layer
            <CommandShortcut command="layers.new" />
          </TooltipContent>
        </Tooltip>
      </div>
      <div
        ref={treeRef}
        role="tree"
        aria-label="Layers"
        aria-multiselectable="true"
        tabIndex={0}
        onKeyDown={onTreeKeyDown}
        onFocus={(event) => {
          const key = (event.target as HTMLElement).closest<HTMLElement>('[data-layer-key]')
            ?.dataset.layerKey
          if (key) setFocused(key)
          if (event.target !== event.currentTarget) return
          const selectedIndex = rows.findIndex((row) => selected.has(row.node.element))
          focusRow(
            selectedIndex >= 0
              ? selectedIndex
              : rows.findIndex((row) => row.node.element === currentLayer),
          )
        }}
        className="min-h-0 flex-1 overflow-y-auto outline-none"
      >
        <ul role="none" className="border-b">
          {rendered}
        </ul>
      </div>
      <div className="flex h-10 shrink-0 items-center gap-1 border-t px-2">
        <span className="flex-1 truncate px-1 text-[11px] text-muted-foreground">
          {selected.size ? `${selected.size} selected` : 'Drag to reorder or nest'}
        </span>
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={selected.size ? 'Delete selection' : 'Delete layer'}
              disabled={!selected.size && (tree.length < 2 || !current)}
              onClick={() =>
                selected.size
                  ? act(() => editor.deleteSelectedElements())
                  : current && deleteLayer(current)
              }
            >
              <Trash2Icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {selected.size
              ? 'Delete selection'
              : tree.length < 2
                ? 'A document needs at least one layer'
                : `Delete ${current?.name ?? 'layer'}`}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
})

function RowToggle({
  label,
  active,
  faded,
  persistent,
  onClick,
  children,
}: {
  label: string
  active: boolean
  faded: boolean
  persistent: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      aria-pressed={active}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className={cn(
        'grid h-full w-6 shrink-0 place-items-center text-muted-foreground transition-opacity hover:text-foreground [&_svg]:size-3.5',
        faded && 'text-muted-foreground/40',
        !persistent &&
          'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 pointer-coarse:opacity-100',
      )}
    >
      {children}
    </button>
  )
}

function RenameInput({
  initial,
  placeholder,
  onDone,
}: {
  initial: string
  placeholder: string
  onDone: (value: string | null) => void
}) {
  const [value, setValue] = useState(initial)
  const done = useRef(false)
  const finish = (result: string | null) => {
    if (done.current) return
    done.current = true
    onDone(result)
  }
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      aria-label="Name"
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') finish(value)
        if (event.key === 'Escape') finish(null)
      }}
      onClick={(event) => event.stopPropagation()}
      className="h-5 min-w-0 flex-1 border border-ring bg-background px-1 text-xs outline-none"
    />
  )
}
