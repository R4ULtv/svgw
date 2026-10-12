import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  FileUpIcon,
  FolderOpenIcon,
  LayersIcon,
  MinusIcon,
  PlusIcon,
  UploadIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  readSelection,
  serializeDocument,
  paintTargets,
  stripNullAttributes,
  type Selection,
  type StyleTarget,
  type SvgEditor,
  type Tool,
} from '@/lib/editor'
import { createAttributePreview } from '@/lib/attribute-preview'
import { createFrameTask } from '@/lib/frame-task'
import {
  readDocumentColors,
  startColorReplacement,
  type DocumentColor,
} from '@/lib/document-colors'
import { createSelectionStore } from '@/lib/selection-store'
import { setSelectionStyle } from '@/lib/selection-style'
import { syncDocumentSize } from '@/lib/document-dimensions'
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  projectRouteId,
  saveProject,
  upsertProject,
  type Project,
} from '@/lib/projects'
import { projectLibrary } from '@/lib/project-library'
import {
  documentKey,
  type CloudLink,
  type RemoteDocument,
  type RemoteProject,
} from '@/lib/cloud-types'
import { useCloudProjects } from '@/lib/use-cloud-projects'
import { CloudError } from '@/lib/cloud-api'
import { blankSvg, downloadSvg, isSvgFile, sampleSvg, sanitizeSvg } from '@/lib/svg'
import {
  alignSelection,
  artworkStats,
  centerSelectionOnArtboard,
  createLayer,
  distributeSelection,
  exportLayers,
  fitCanvasToArtwork as fitArtwork,
  hasArtwork,
  isBlocked,
  layerName,
  layerOf,
  promoteLayers,
  setSelectionBounds,
  setSelectionRotation,
  type Alignment,
  type Bounds,
} from '@/lib/layers'
import {
  loadViewPrefs,
  noGuides,
  saveViewPrefs,
  SNAP_DISTANCE,
  snapBox,
  snapLines,
  snapPoint,
  type Guides,
  type ViewPrefs,
} from '@/lib/guides'
import { extractSvg, inlineStyles, insertSvg, PLACE_LABEL } from '@/lib/svg-import'
import { PROJECT_ACCEPT, type ImportedDocument } from '@/lib/project-import'
import { downloadProjectFile } from '@/lib/project-download'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CommandShortcut, useCommandHeld, useCommands, useCommandScope } from './commands'
import { EditorToolbar } from './editor-toolbar'
import { CanvasZoomHint, EditorStatusHint } from './editor-status-hint'
import { ExportDialog } from './export-dialog'
import { Inspector, type Backdrop } from './inspector'
import { Logo } from './logo'
import { LoginButton } from './login-button'
import { CanvasGuides } from './canvas-guides'
import { CanvasStarter } from './canvas-starter'
import { LayersPanel } from './layers-panel'
import { useTheme } from './theme'
import { ProjectList } from './project-list'
import { ShortcutsDialog } from './shortcuts-dialog'
import { ProjectRenameDialog } from './project-rename-dialog'
import { WorkspaceHeader } from './workspace-header'
import { ProjectImportDialog, type ImportRequest } from './project-import-dialog'

type SaveState = 'saved' | 'saving' | 'error'

// SVG-Edit modes shown as toolbar tools (the hand tool is ours, not a mode).
const modeTools: Tool[] = ['select', 'rect', 'ellipse', 'path']
const isTool = (mode: string): mode is Tool => modeTools.includes(mode as Tool)
const message = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback

/** Space around the artboard, in screen pixels, for the toolbar, rulers, and dragging past the edge. */
const PASTEBOARD = 96
// Zoom controls are relative to the fitted artboard, not SVG-Edit's pixels-per-unit scale.
const MIN_ZOOM = 0.05
const MAX_ZOOM = 64
const ZOOM_STEPS = [
  0.05, 0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64,
]

export function Workspace({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const routeId = useRef(projectId)
  routeId.current = projectId
  const loadedRoute = useRef('')
  const [opening, setOpening] = useState(true)
  const [openError, setOpenError] = useState<string | null>(null)
  const [openAttempt, setOpenAttempt] = useState(0)
  const host = useRef<HTMLDivElement>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [importRequest, setImportRequest] = useState<ImportRequest | null>(null)
  const engine = useRef<SvgEditor | null>(null)
  const active = useRef<Project | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [ready, setReady] = useState(false)
  const [tool, setTool] = useState<Tool>('select')
  const [canvasEmpty, setCanvasEmpty] = useState(false)
  const [starterDismissed, setStarterDismissed] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [selectionStore] = useState(createSelectionStore)
  const [documentColors, setDocumentColors] = useState<DocumentColor[]>([])
  const [history, setHistory] = useState({ undo: false, redo: false })
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [backdrop, setBackdrop] = useState<Backdrop>('checker')
  const [exporting, setExporting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'layers' | 'projects'>('layers')
  const [renaming, setRenaming] = useState(false)
  // SVG-Edit's raw mode ('select', 'rect', 'pathedit', …); `tool` is the toolbar's view of it.
  const [mode, setMode] = useState('select')
  // View updates never invalidate the layer tree; selection updates reuse its document snapshot.
  const [revision, setRevision] = useState(0)
  const [documentRevision, setDocumentRevision] = useState(0)
  const [selectionRevision, setSelectionRevision] = useState(0)
  const documentRefresh = useRef(false)
  const lastSelection = useRef<{ elements: Element[]; layer: Element | null }>({
    elements: [],
    layer: null,
  })
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  const pendingZoom = useRef<{ value: number; anchor?: { x: number; y: number } } | null>(null)
  const zoomUpdate = useRef<ReturnType<typeof createFrameTask> | null>(null)
  if (!zoomUpdate.current)
    zoomUpdate.current = createFrameTask(() => {
      const pending = pendingZoom.current
      if (pending) zoomTo(pending.value, pending.anchor)
    })
  const zoomProject = useRef<string | null>(null)
  const [guides, setGuides] = useState<Guides>(noGuides)
  const [view, setView] = useState<ViewPrefs>(loadViewPrefs)
  const [snapped, setSnapped] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  })
  const viewport = useRef<HTMLDivElement>(null)
  const { preference: themePreference, setPreference: setThemePreference } = useTheme()
  // Event listeners registered once read the latest guides and view settings through refs.
  const guidesRef = useRef(guides)
  const viewRef = useRef(view)
  const sizeRef = useRef(size)
  useEffect(() => {
    guidesRef.current = guides
    viewRef.current = view
    sizeRef.current = size
  })
  const [dragging, setDragging] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [pendingRemoteDelete, setPendingRemoteDelete] = useState<RemoteProject | null>(null)

  // Saves are debounced, then serialized so a slower older write cannot replace a newer document.
  const writes = useRef(Promise.resolve())
  const saveTimer = useRef<number | undefined>(undefined)
  const unsaved = useRef(false)
  const contentChanged = useRef(false)
  const localFailure = useRef<string | null>(null)
  const editorRefresh = useRef<ReturnType<typeof createFrameTask> | null>(null)
  if (!editorRefresh.current) editorRefresh.current = createFrameTask(syncEditorState)
  const attributePreview = useRef<ReturnType<typeof createAttributePreview> | null>(null)
  if (!attributePreview.current)
    attributePreview.current = createAttributePreview({
      editor: () => (active.current ? engine.current : null),
      targets: (selected, attr) => (attr === 'opacity' ? selected : paintTargets(selected, attr)),
      previewed: selectionStore.preview,
      committed: documentChanged,
      started: () => {
        editorRefresh.current!.flush()
        window.clearTimeout(saveTimer.current)
      },
      finished: () => {
        window.clearTimeout(saveTimer.current)
        if (unsaved.current) saveTimer.current = window.setTimeout(() => void flushSave(), 1000)
      },
    })
  const cloud = useCloudProjects({
    project,
    snapshot: async () => {
      commitAttribute()
      await flushSave()
      if (localFailure.current === active.current?.id)
        throw new Error(
          'Local storage failed. Export your SVG to keep a copy before saving online.',
        )
      return active.current
    },
    link: updateCloudLink,
    open: openCloudDocument,
    removeRemote: detachRemote,
  })

  async function updateCloudLink(localId: string, link: CloudLink | undefined) {
    if (active.current?.id === localId) {
      const previousRoute = projectRouteId(active.current)
      active.current = { ...active.current, cloud: link }
      setProject(active.current)
      const id = projectRouteId(active.current)
      if (id !== previousRoute) {
        loadedRoute.current = `${id}:${cloud.isAdmin()}:${openAttempt}`
        void navigate({ to: '/project/$id', params: { id }, replace: true })
      }
    }
    const write = writes.current.then(async () => {
      const stored = await getProject(localId)
      if (!stored) return
      const next = { ...stored, cloud: link }
      await saveProject(next)
      setProjects((list) => upsertProject(list, next))
    })
    writes.current = write.catch(() => {})
    await write
  }

  async function detachRemote(id: string) {
    const locals = await listProjects()
    for (const local of locals)
      if (local.cloud?.id === id) await updateCloudLink(local.id, undefined)
  }

  async function openCloudDocument(
    result: RemoteDocument,
    mode: CloudLink['mode'],
    reload = false,
  ) {
    const stillRequested = () =>
      engine.current &&
      routeId.current === result.project.id &&
      (mode === 'admin') === cloud.isAdmin()
    if (!stillRequested()) throw new Error('The requested project changed.')
    commitAttribute()
    await flushSave()
    const locals = await listProjects()
    if (!stillRequested()) throw new Error('The requested project changed.')
    const existing = locals.find(
      (item) => item.cloud?.id === result.project.id && item.cloud.mode === mode,
    )
    const dirty = existing && documentKey(existing) !== existing.cloud!.savedDocument
    const sameRemote =
      existing &&
      (mode === 'admin'
        ? existing.cloud!.revision === result.revision
        : existing.cloud!.versionId === result.versionId)
    if (existing && !reload && (dirty || sameRemote)) {
      openProject(existing, false)
      if (dirty)
        toast('Your edits restored', {
          description:
            mode === 'admin'
              ? 'Your edits were kept. Use Reload saved version to load the online version.'
              : 'Your edits were kept. Use Reload published version to load the shared original.',
        })
      return existing
    }
    if (existing && dirty) {
      const backup = {
        ...createProject(`${existing.name || 'Untitled'} local backup`, existing.svg),
        guides: existing.guides,
      }
      await saveProject(backup)
      setProjects((list) => upsertProject(list, backup))
      toast('Local edits kept as a backup copy')
    }
    const next: Project = {
      ...createProject(result.document.name, sanitizeSvg(result.document.svg)),
      ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
      guides: result.document.guides,
    }
    next.cloud = {
      id: result.project.id,
      mode,
      revision: result.revision,
      versionId: result.versionId,
      savedDocument: documentKey(next),
      visibility: result.project.visibility,
      publishedVersionId: result.project.publishedVersionId,
    }
    await saveProject(next)
    setProjects((list) => upsertProject(list, next))
    if (!stillRequested()) throw new Error('The requested project changed.')
    openProject(next, false)
    return next
  }

  function flushSave() {
    commitAttribute()
    window.clearTimeout(saveTimer.current)
    const current = active.current
    if (!current || !unsaved.current) return writes.current
    unsaved.current = false
    const next =
      contentChanged.current && engine.current
        ? { ...current, svg: serializeDocument(engine.current) }
        : current
    contentChanged.current = false
    active.current = next
    writes.current = writes.current
      .then(async () => {
        await saveProject(next)
        localFailure.current = null
        setProjects((list) => upsertProject(list, next))
        if (!unsaved.current && active.current?.id === next.id) {
          setProject(active.current)
          setSaveState('saved')
        }
      })
      .catch((cause: unknown) => {
        localFailure.current = next.id
        if (active.current?.id === next.id) {
          unsaved.current = true
          setSaveState('error')
        }
        toast.error('Could not save locally', {
          description: message(
            cause,
            'Browser storage is unavailable. Download your SVG to keep a copy.',
          ),
        })
      })
    return writes.current
  }

  function markUnsaved(content: boolean) {
    if (!active.current) return
    active.current = { ...active.current, updatedAt: Date.now() }
    unsaved.current = true
    if (content) contentChanged.current = true
    cloud.changed()
    setSaveState('saving')
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => void flushSave(), 1000)
  }

  const refreshEditorState = useCallback(() => editorRefresh.current!.schedule(), [])

  function syncEditorState() {
    const editor = engine.current
    if (!editor) return
    const elements = editor.getSelectedElements().filter((item): item is Element => item !== null)
    const layer = editor.getCurrentDrawing().getCurrentLayer()
    const previous = lastSelection.current
    const selectionChanged =
      layer !== previous.layer ||
      elements.length !== previous.elements.length ||
      elements.some((element, index) => element !== previous.elements[index])
    if (selectionChanged) {
      lastSelection.current = { elements, layer }
      setSelectionRevision((value) => value + 1)
    }
    if (selectionChanged || documentRefresh.current) {
      const next = readSelection(elements, editor.getSvgContent())
      selectionStore.set(next)
      setSelection((current) =>
        current &&
        next &&
        (Object.keys(next) as (keyof Selection)[]).every((key) => current[key] === next[key])
          ? current
          : next,
      )
    }
    const undo = editor.undoMgr.getUndoStackSize() > 0
    const redo = editor.undoMgr.getRedoStackSize() > 0
    setHistory((current) =>
      current.undo === undo && current.redo === redo ? current : { undo, redo },
    )
    // getResolution divides the displayed width by zoom; setResolution temporarily writes an
    // unscaled width before the next layout. Document dimensions remain authoritative throughout.
    const w = Math.round(editor.contentW),
      h = Math.round(editor.contentH)
    setSize((current) => (current.w === w && current.h === h ? current : { w, h }))
    const current = editor.getMode()
    setMode(current)
    // The hand tool keeps SVG-Edit idle in 'select', so a 'select' mode means it is still active.
    setTool((previous) =>
      previous === 'hand' && current === 'select' ? 'hand' : isTool(current) ? current : 'select',
    )
    if (documentRefresh.current) {
      const colors = readDocumentColors(editor.getSvgContent())
      setDocumentColors((current) =>
        current.length === colors.length &&
        current.every(
          (item, index) => item.color === colors[index].color && item.uses === colors[index].uses,
        )
          ? current
          : colors,
      )
      const artwork = hasArtwork(editor.getSvgContent())
      setCanvasEmpty(!artwork)
      if (artwork) setStarterDismissed(true)
      documentRefresh.current = false
      setDocumentRevision((value) => value + 1)
    }
  }

  /**
   * Sizes SVG-Edit's root to cover the viewport, so the area around the artboard is a working
   * pasteboard (drags and selection boxes can start and end there), with the artboard centered.
   */
  function layoutCanvas() {
    const editor = engine.current
    const element = viewport.current
    const surface = host.current
    if (!editor || !element || !surface) return
    const scale = editor.getZoom()
    // Nearly a viewport of room on each side lets you pan the artboard anywhere and keeps the point
    // under the cursor fixed while zooming, as in Illustrator.
    const marginX = Math.max(PASTEBOARD, element.clientWidth - PASTEBOARD)
    const marginY = Math.max(PASTEBOARD, element.clientHeight - PASTEBOARD)
    const width = Math.ceil(editor.contentW * scale) + marginX * 2
    const height = Math.ceil(editor.contentH * scale) + marginY * 2
    surface.style.width = `${width}px`
    surface.style.height = `${height}px`
    editor.updateCanvas(width, height)
  }

  /** Converts fitted 100% zoom into SVG-Edit's pixels-per-unit scale. */
  function fittedScale() {
    const editor = engine.current
    const element = viewport.current
    if (!editor || !element) return 1
    return Math.min(
      Math.max(1, element.clientWidth - PASTEBOARD * 2) / editor.contentW,
      Math.max(1, element.clientHeight - PASTEBOARD * 2) / editor.contentH,
    )
  }

  /** Center the view in the open space below the floating toolbar. */
  function toolbarInset(element: HTMLDivElement) {
    const top = element.getBoundingClientRect().top
    return Math.min(
      element.clientHeight,
      Math.max(0, (toolbar.current?.getBoundingClientRect().bottom ?? top) - top),
    )
  }

  /** Zooms relative to the fitted artboard, keeping the document point under `anchor` in place. */
  function zoomTo(next: number, anchor?: { x: number; y: number }) {
    zoomUpdate.current!.cancel()
    pendingZoom.current = null
    const editor = engine.current
    const element = viewport.current
    if (!editor || !element || !active.current) return
    const target = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    const rect = element.getBoundingClientRect()
    const point = anchor ?? {
      x: rect.left + element.clientWidth / 2,
      y: rect.top + (element.clientHeight + toolbarInset(element)) / 2,
    }
    const content = editor.getSvgContent()
    const fixed = new DOMPoint(point.x, point.y).matrixTransform(content.getScreenCTM()!.inverse())
    editor.setCurrentZoom(target * fittedScale())
    layoutCanvas()
    const moved = new DOMPoint(fixed.x, fixed.y).matrixTransform(content.getScreenCTM()!)
    element.scrollLeft += moved.x - point.x
    element.scrollTop += moved.y - point.y
    zoomRef.current = target
    setZoom(target)
    setRevision((value) => value + 1)
  }

  function stepZoom(direction: 1 | -1) {
    const current = zoomRef.current
    const next =
      direction > 0
        ? ZOOM_STEPS.find((step) => step > current * 1.001)
        : [...ZOOM_STEPS].reverse().find((step) => step < current / 1.001)
    zoomTo(next ?? current)
  }

  function centerCanvas() {
    const editor = engine.current
    const element = viewport.current
    const matrix = editor?.getSvgContent().getScreenCTM()
    if (!editor || !element || !matrix) return
    // Center the document itself: artwork and selection handles outside its bounds can
    // enlarge the scrollable pasteboard without changing the drawing area's center.
    const center = new DOMPoint(editor.contentW / 2, editor.contentH / 2).matrixTransform(matrix)
    const rect = element.getBoundingClientRect()
    element.scrollLeft += center.x - (rect.left + element.clientLeft + element.clientWidth / 2)
    element.scrollTop +=
      center.y - (rect.top + element.clientTop + (element.clientHeight + toolbarInset(element)) / 2)
  }

  /** Fits and centers the artboard at 100%, including small documents that need enlarging. */
  function zoomToFit() {
    zoomTo(1)
    centerCanvas()
  }

  function documentChanged() {
    documentRefresh.current = true
    refreshEditorState()
    markUnsaved(true)
  }

  const previewAttribute = useCallback(
    (attr: string, value: string | number) => attributePreview.current!.preview(attr, value),
    [],
  )
  const commitAttribute = useCallback(() => attributePreview.current!.commit(), [])
  // oxlint-disable-next-line react/exhaustive-deps -- Layer callbacks read current editor/project refs; keep their identity stable during previews.
  const onLayerChange = useCallback(() => documentChanged(), [])

  function openProject(next: Project, updateRoute = true) {
    const editor = engine.current
    if (!editor) return
    commitAttribute()
    void flushSave()
    // Promote Illustrator/Inkscape layers before sanitizing, which drops Inkscape's namespaced attributes.
    if (!editor.setSvgString(sanitizeSvg(promoteLayers(next.svg)), true))
      throw new Error('The SVG engine could not open this document.')
    editor.undoMgr.resetUndoStack()
    editor.setMode('select')
    setTool('select')
    setCanvasEmpty(false)
    setStarterDismissed(false)
    active.current = next
    if (updateRoute) {
      const id = projectRouteId(next)
      loadedRoute.current = `${id}:${cloud.isAdmin()}:${openAttempt}`
      setOpening(false)
      setOpenError(null)
      if (id !== routeId.current) void navigate({ to: '/project/$id', params: { id } })
    }
    setProject(next)
    setGuides(next.guides ?? noGuides)
    setSaveState('saved')
    setSidebarOpen(false)
    documentRefresh.current = true
    refreshEditorState()
  }

  function tryOpen(next: Project) {
    try {
      openProject(next)
    } catch (cause) {
      toast.error('Could not open project', {
        description: message(cause, 'The document may be damaged.'),
      })
    }
  }

  function addProject(name: string, svg: string, importedGuides?: Guides) {
    const next = createProject(name, sanitizeSvg(svg))
    if (importedGuides) next.guides = importedGuides
    // New projects created during an admin session automatically begin private online drafts.
    if (cloud.isAdmin())
      next.cloud = {
        id: next.id,
        mode: 'admin',
        revision: null,
        versionId: '',
        savedDocument: '',
        visibility: 'private',
        publishedVersionId: null,
      }
    openProject(next)
    setProjects((list) => upsertProject(list, next))
    unsaved.current = true
    void flushSave()
  }

  /** Imports files as new layers of the open document, or as new projects when asked (or none is open). */
  function importFiles(files: File[], { asProjects = false } = {}) {
    if (files.length) setImportRequest({ files, asProjects: asProjects || !active.current })
  }

  async function importDocuments(documents: ImportedDocument[], asProjects: boolean) {
    for (const document of documents) {
      if (asProjects) {
        addProject(document.name, document.svg, document.guides)
        await flushSave()
      } else placeSvg(document.svg, document.name)
    }
  }

  // Which way the shared file picker imports: into the open document, or as new projects.
  const importAsProjects = useRef(false)
  function chooseFiles(asProjects: boolean) {
    importAsProjects.current = asProjects
    fileInput.current?.click()
  }

  function newProject(kind: 'blank' | 'sample') {
    try {
      addProject(
        kind === 'blank' ? 'Untitled' : 'Sample logo',
        kind === 'blank' ? blankSvg : sampleSvg,
      )
    } catch (cause) {
      toast.error('Could not create project', { description: message(cause, 'Try again.') })
    }
  }

  /** The latest markup for a project. `forExport` strips svgw-only metadata for files leaving the app. */
  function currentSvg(target: Project, { forExport = false } = {}) {
    if (active.current?.id === target.id && engine.current) {
      commitAttribute()
      return serializeDocument(engine.current, { forExport })
    }
    if (!forExport) return target.svg
    const root = new DOMParser().parseFromString(target.svg, 'image/svg+xml').documentElement
    exportLayers(root, { forExport })
    return new XMLSerializer().serializeToString(root)
  }

  function duplicateProject(target: Project) {
    try {
      addProject(`${target.name || 'Untitled'} copy`, currentSvg(target))
    } catch (cause) {
      toast.error('Could not duplicate project', { description: message(cause, 'Try again.') })
    }
  }

  async function removeProject(target: Project) {
    const wasActive = active.current?.id === target.id
    if (wasActive) {
      // Drop pending edits so a queued save cannot recreate the project after deletion.
      window.clearTimeout(saveTimer.current)
      attributePreview.current!.cancel()
      unsaved.current = false
      contentChanged.current = false
      active.current = null
    }
    const removal = writes.current.then(() => deleteProject(target.id))
    writes.current = removal.catch(() => {})
    try {
      await removal
    } catch (cause) {
      toast.error('Could not delete project', {
        description: message(cause, 'Browser storage is unavailable.'),
      })
      if (wasActive) tryOpen(target)
      return
    }
    const remaining = projects.filter((item) => item.id !== target.id)
    setProjects((list) => list.filter((item) => item.id !== target.id))
    if (wasActive) {
      if (remaining[0]) {
        setProject(null)
        setSelection(null)
        const id = projectRouteId(remaining[0])
        if (id === projectId) setOpenAttempt((value) => value + 1)
        else void navigate({ to: '/project/$id', params: { id } })
      } else {
        engine.current?.clearSelection()
        void navigate({ to: '/' })
      }
    }
    toast.success(`Deleted “${target.name || 'Untitled'}”`)
  }

  function rename(name: string) {
    if (!active.current) return
    active.current = { ...active.current, name }
    setProject(active.current)
    setProjects((list) =>
      list.map((item) => (item.id === active.current?.id ? { ...item, name } : item)),
    )
    markUnsaved(false)
  }

  useEffect(() => {
    setRenaming(false)
    setSidebarOpen(false)
  }, [project?.id])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)')
    const closeSidebar = () => {
      if (desktop.matches) setSidebarOpen(false)
    }
    desktop.addEventListener('change', closeSidebar)
    return () => desktop.removeEventListener('change', closeSidebar)
  }, [])

  function saveNow() {
    if (cloud.admin && active.current?.cloud?.mode !== 'public')
      void cloud.save().catch((cause: unknown) =>
        toast.error('Could not save online', {
          description: message(cause, 'Your local draft is safe.'),
        }),
      )
    else
      void flushSave().then(() => {
        if (!localFailure.current) toast('Saved')
      })
  }

  useEffect(() => {
    if (!ready || !cloud.authReady) return
    const request = `${projectId}:${cloud.admin}:${openAttempt}`
    if (loadedRoute.current === request) return
    loadedRoute.current = ''
    let cancelled = false
    const stillRequested = () =>
      !cancelled && routeId.current === projectId && cloud.isAdmin() === cloud.admin
    async function load() {
      setOpening(true)
      setOpenError(null)
      commitAttribute()
      await flushSave()
      if (!stillRequested()) return
      active.current = null
      setProject(null)
      setSelection(null)
      const locals = await listProjects()
      if (!stillRequested()) return
      const local =
        locals.find((item) => item.cloud?.id === projectId && item.cloud.mode === 'public') ??
        locals.find((item) => item.id === projectId && item.cloud?.mode !== 'admin')
      const draft = locals.find(
        (item) => item.cloud?.id === projectId && item.cloud.mode === 'admin',
      )
      if (!cloud.admin && local) {
        openProject(local, false)
        return
      }
      // New remote drafts have not reached R2 yet; their persisted upload identity must survive reloads.
      if (cloud.admin && draft && !draft.cloud!.revision) {
        openProject(draft, false)
        return
      }
      try {
        await cloud.openRemote(projectId, false, cloud.admin ? 'admin' : 'public')
      } catch (cause) {
        if (!stillRequested()) return
        const offline = cause instanceof CloudError && (cause.status === 0 || cause.status === 503)
        const missing = cause instanceof CloudError && cause.status === 404
        if (cloud.admin && ((offline && (draft || local)) || (missing && local && !local.cloud))) {
          const fallback = draft ?? local!
          openProject(fallback, false)
          if (offline)
            toast('Opened local draft', {
              description:
                'The remote is unavailable. Your edits stay on this device until it reconnects.',
            })
        } else if (!cloud.admin && draft && (offline || missing)) {
          // Disconnecting never turns local edits into an admin upload when reconnecting.
          const copy = {
            ...createProject(draft.name, draft.svg),
            guides: draft.guides,
            cloud: {
              ...draft.cloud!,
              mode: 'public' as const,
              revision: null,
              pendingVersion: undefined,
              savedDocument: documentKey(draft),
            },
          }
          await saveProject(copy)
          if (!stillRequested()) return
          setProjects((list) => upsertProject(list, copy))
          openProject(copy, false)
        } else throw cause
      }
    }
    void load()
      .catch((cause: unknown) => {
        if (stillRequested())
          setOpenError(message(cause, 'The project may be private or unavailable.'))
      })
      .finally(() => {
        if (stillRequested()) {
          loadedRoute.current = request
          setOpening(false)
        }
      })
    return () => {
      cancelled = true
    }
    // oxlint-disable-next-line react/exhaustive-deps -- Reload only on route/session transitions; editor and saving helpers operate on current refs.
  }, [ready, cloud.authReady, cloud.admin, projectId, openAttempt])

  function changeGuides(next: Guides) {
    setGuides(next)
    if (!active.current) return
    active.current = { ...active.current, guides: next }
    markUnsaved(false)
  }

  function toggleView(key: keyof ViewPrefs) {
    setView((current) => {
      const next = { ...current, [key]: !current[key] }
      saveViewPrefs(next)
      return next
    })
  }

  function resizeCanvas(width: number, height: number) {
    commitAttribute()
    engine.current?.setResolution(width, height)
  }

  function fitCanvasToArtwork() {
    commitAttribute()
    if (engine.current && !fitArtwork(engine.current))
      toast('Nothing to fit', { description: 'Add or show some artwork first.' })
  }

  function centerSelection() {
    commitAttribute()
    if (engine.current) centerSelectionOnArtboard(engine.current)
  }

  function changeSelectionBounds(next: Bounds) {
    commitAttribute()
    return engine.current ? setSelectionBounds(engine.current, next) : false
  }

  function rotateSelection(angle: number) {
    commitAttribute()
    return engine.current ? setSelectionRotation(engine.current, angle) : false
  }

  function changeStyle(target: StyleTarget, values: Record<string, string | null>) {
    commitAttribute()
    return engine.current ? setSelectionStyle(engine.current, target, values) : false
  }

  function replaceColor(from: string) {
    commitAttribute()
    return engine.current ? startColorReplacement(engine.current, from) : null
  }

  function align(alignment: Alignment) {
    commitAttribute()
    if (engine.current) alignSelection(engine.current, alignment)
  }

  function distribute(axis: 'horizontal' | 'vertical') {
    commitAttribute()
    if (engine.current) distributeSelection(engine.current, axis)
  }

  /**
   * Places pasted or imported SVG in a new layer of the open document, centered on the artboard.
   * With no project open, it becomes a new project instead.
   */
  function placeSvg(markup: string, name: string) {
    const clean = sanitizeSvg(inlineStyles(markup))
    const editor = engine.current
    if (!editor || !active.current) {
      addProject(name, clean)
      toast.success(`Opened “${name}” as a new project`)
      return
    }
    commitAttribute()
    const { layer, scaled } = insertSvg(editor, clean, name)
    toast.success(`Added “${layer}” as a new layer`, {
      description: scaled ? 'Scaled down to fit the canvas.' : undefined,
      action: {
        label: 'Open as new project',
        onClick: () => {
          if (engine.current?.undoMgr.getNextUndoCommandText() === PLACE_LABEL)
            engine.current.undoMgr.undo()
          addProject(name, clean)
        },
      },
    })
  }

  function selectTool(next: Tool) {
    commitAttribute()
    if (next === 'rect' || next === 'ellipse' || next === 'path') setStarterDismissed(true)
    const mode = next === 'hand' ? 'select' : next
    engine.current?.setMode(mode)
    setMode(mode)
    setTool(next)
  }

  useEffect(() => {
    let cancelled = false
    let canvas: SvgEditor | undefined
    async function initialize() {
      try {
        const [{ default: Canvas }, saved] = await Promise.all([
          import('@svgedit/svgcanvas'),
          listProjects(),
        ])
        if (cancelled || !host.current) return
        const surface = document.createElement('div')
        host.current.append(surface)
        canvas = new Canvas(surface, {
          dimensions: [480, 360],
          imgPath: '/editor',
          baseUnit: 'px',
          initFill: { color: '5b8def', opacity: 1 },
          initStroke: { color: 'none', width: 1, opacity: 1 },
          initOpacity: 1,
          text: { font_size: 24, font_family: 'sans-serif', stroke_width: 0 },
          selectionColor: '#3b82f6',
          // Artwork past the artboard stays visible on the pasteboard, as in Illustrator.
          show_outside_canvas: true,
          selectNew: true,
        }) as unknown as SvgEditor
        canvas.setSvgOption('round_digits', 5)
        container = surface
        addCheckerPattern(canvas.getSvgRoot())
        // SVG-Edit records some edits (dragging objects, for one) without emitting 'changed', which
        // left them unsaved. Editor state synchronization coalesces all notifications per frame.
        const addCommand = canvas.undoMgr.addCommandToHistory.bind(canvas.undoMgr)
        canvas.undoMgr.addCommandToHistory = (command) => {
          addCommand(command)
          if (!cancelled) documentChanged()
        }
        // Undo/redo can add or remove whole layers, and SVG-Edit doesn't always re-read them: it may
        // keep a removed layer as current, or leave a restored one interactive. Re-detect layers after
        // every step, keep the same current layer when it still exists, then sync once more (SVG-Edit
        // announces the change before its layers settle).
        for (const method of ['undo', 'redo'] as const) {
          const step = canvas.undoMgr[method].bind(canvas.undoMgr)
          canvas.undoMgr[method] = () => {
            const previous = canvas!.getCurrentDrawing().getCurrentLayer()
            const previousViewBox = canvas!.getSvgContent().getAttribute('viewBox')
            step()
            syncDocumentSize(canvas!, previousViewBox)
            canvas!.identifyLayers()
            if (previous?.parentNode === canvas!.getSvgContent())
              canvas!.setCurrentLayer(layerName(previous))
            documentChanged()
          }
        }
        engine.current = canvas
        canvas.bind('changed', (_window: Window, elements?: (Element | null)[]) => {
          for (const element of elements ?? []) if (element) stripNullAttributes(element)
          documentChanged()
        })
        canvas.bind('selected', () => {
          // Rubber-band selection can reach locked or hidden objects; Illustrator never selects those.
          const blocked = canvas!
            .getSelectedElements()
            .filter((item): item is Element => !!item && isBlocked(item))
          if (blocked.length) canvas!.removeFromSelection(blocked)
          commitAttribute()
          refreshEditorState()
        })
        host.current.addEventListener('mousedown', switchLayerOnPress, true)
        setProjects(saved)
        setReady(true)
      } catch (cause) {
        if (!cancelled)
          toast.error('Could not open the workspace', {
            description: message(cause, 'Reload the page to try again.'),
            duration: Infinity,
          })
      }
    }
    // SVG-Edit only hit-tests the current layer. In Select mode, every unlocked layer is clickable
    // (see styles.css), so switch to the pressed object's layer before SVG-Edit handles the press.
    function switchLayerOnPress(event: MouseEvent) {
      const editor = engine.current
      if (!editor || editor.getMode() !== 'select' || !(event.target instanceof Element)) return
      const layer = layerOf(event.target)
      if (!layer || layer === editor.getCurrentDrawing().getCurrentLayer()) return
      editor.leaveContext()
      editor.setCurrentLayer(layerName(layer))
    }
    // Snapping: while dragging on the canvas, rewrite pointer events so SVG-Edit sees positions that
    // land on guides or the artboard's edges and center. Moves snap the selection's edges and center;
    // drawing and resize handles snap the pointer itself.
    const synthetic = new WeakSet<Event>()
    let snapping: {
      kind: 'move' | 'point'
      start: DOMPoint
      box: { x: number; y: number; width: number; height: number } | null
    } | null = null
    const toDocument = (editor: SvgEditor, x: number, y: number) =>
      new DOMPoint(x, y).matrixTransform(editor.getSvgContent().getScreenCTM()!.inverse())
    const toClient = (editor: SvgEditor, x: number, y: number) =>
      new DOMPoint(x, y).matrixTransform(editor.getSvgContent().getScreenCTM()!)
    const DRAW_MODES = new Set(['rect', 'square', 'ellipse', 'circle', 'line', 'path', 'pathedit'])

    function redispatch(event: MouseEvent, x: number, y: number) {
      event.stopImmediatePropagation()
      const copy = new MouseEvent(event.type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        detail: event.detail,
        screenX: event.screenX + (x - event.clientX),
        screenY: event.screenY + (y - event.clientY),
        clientX: x,
        clientY: y,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        button: event.button,
        buttons: event.buttons,
        relatedTarget: event.relatedTarget,
      })
      synthetic.add(copy)
      event.target?.dispatchEvent(copy)
    }

    function snap(event: MouseEvent) {
      const editor = engine.current
      if (!editor || !snapping) return
      if (snapping.kind === 'move' && !snapping.box) {
        const selected = editor.getSelectedElements().filter((item): item is Element => !!item)
        snapping.box = selected.length ? editor.getStrokedBBox(selected) : null
        if (!snapping.box) {
          snapping = null
          return
        }
      }
      const scale = editor.getSvgContent().getScreenCTM()?.a || 1
      const lines = snapLines(
        viewRef.current.guides ? guidesRef.current : noGuides,
        sizeRef.current,
      )
      const pointer = toDocument(editor, event.clientX, event.clientY)
      const result =
        snapping.kind === 'move' && snapping.box
          ? snapBox(pointer, snapping.start, snapping.box, lines, SNAP_DISTANCE / scale)
          : snapPoint(pointer, lines, SNAP_DISTANCE / scale)
      setSnapped((current) =>
        current.x === result.lines.x && current.y === result.lines.y ? current : result.lines,
      )
      if (result.x === pointer.x && result.y === pointer.y) return
      const client = toClient(editor, result.x, result.y)
      redispatch(event, client.x, client.y)
    }

    function snapPress(event: MouseEvent) {
      snapping = null
      const editor = engine.current
      if (
        synthetic.has(event) ||
        !editor ||
        event.button !== 0 ||
        !viewRef.current.snap ||
        !(event.target instanceof Element)
      )
        return
      const mode = editor.getMode()
      const start = toDocument(editor, event.clientX, event.clientY)
      if (mode === 'select') {
        if (event.target.closest('[id^="selectorGrip_resize_"]'))
          snapping = { kind: 'point', start, box: null }
        else if (event.target.closest('#svgcontent')) snapping = { kind: 'move', start, box: null }
      } else if (DRAW_MODES.has(mode)) {
        snapping = { kind: 'point', start, box: null }
        // The press itself places a corner or path node, so it snaps too.
        snap(event)
        if (snapping) snapping.start = toDocument(editor, event.clientX, event.clientY)
      }
    }

    function snapMove(event: MouseEvent) {
      if (synthetic.has(event) || !snapping) return
      if (!(event.buttons & 1) && snapping.kind === 'move') return
      snap(event)
    }

    function snapRelease(event: MouseEvent) {
      if (synthetic.has(event)) return
      if (snapping) snap(event)
      snapping = null
      setSnapped({ x: null, y: null })
    }

    async function onPaste(event: ClipboardEvent) {
      const target = event.target instanceof Element ? event.target : null
      if (
        !engine.current ||
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"]',
        )
      )
        return
      const data = event.clipboardData
      if (!data) return
      const file = [...data.files].find(isSvgFile)
      const text =
        data.getData('image/svg+xml') || data.getData('text/plain') || data.getData('text/html')
      const markup = file ? null : extractSvg(text)
      if (!file && !markup) {
        if ([...data.files].some((item) => item.type.startsWith('image/'))) {
          event.preventDefault()
          toast.error('Only SVG can be pasted', {
            description: 'Copy the artwork as SVG, or export it as an SVG file.',
          })
        }
        return
      }
      event.preventDefault()
      try {
        placeSvg(
          file ? await file.text() : markup!,
          file ? file.name.replace(/\.svg$/i, '') : 'Pasted SVG',
        )
      } catch (cause) {
        toast.error('Could not paste SVG', {
          description: message(cause, 'The clipboard content is not valid SVG.'),
        })
      }
    }

    // SVG-Edit listens for mouse events only on its own surface. Once a drag leaves it (over the
    // sidebar, rulers, or outside the window) it never sees the release and the drag gets stuck.
    // While a drag is active, forward moves and the release from anywhere, and don't let SVG-Edit
    // end drawing just because the pointer left the surface.
    let container: HTMLElement | null = null
    let dragging = false
    function forwardCopy(event: MouseEvent, type: string) {
      container?.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          detail: event.detail,
          screenX: event.screenX,
          screenY: event.screenY,
          clientX: event.clientX,
          clientY: event.clientY,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          button: 0,
          buttons: type === 'mouseup' ? 0 : event.buttons,
        }),
      )
    }
    function dragStart(event: MouseEvent) {
      if (event.button === 0) dragging = true
    }
    function dragForward(event: MouseEvent) {
      if (!dragging || !container) return
      // The button was released outside the window: finish the drag where the pointer is now.
      if (event.type === 'mousemove' && !(event.buttons & 1)) {
        dragging = false
        forwardCopy(event, 'mouseup')
        return
      }
      if (event.type === 'mouseup') dragging = false
      if (!container.contains(event.target as Node)) forwardCopy(event, event.type)
    }
    function dragKeepInside(event: MouseEvent) {
      if (dragging) event.stopImmediatePropagation()
    }

    // Panning: with the hand tool, while holding Space, or with the middle mouse button, a drag on the
    // canvas scrolls the view. It is registered first and stops the press from reaching anything else,
    // so panning never selects or moves artwork.
    let pan: { x: number; y: number; left: number; top: number } | null = null
    function panStart(event: MouseEvent) {
      const element = viewport.current
      if (!element || !active.current) return
      if (!(event.button === 1 || (event.button === 0 && panReadyRef.current))) return
      event.preventDefault()
      event.stopImmediatePropagation()
      pan = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop }
      setGrabbing(true)
    }
    function panMove(event: MouseEvent) {
      const element = viewport.current
      if (!pan || !element) return
      event.stopImmediatePropagation()
      element.scrollLeft = pan.left - (event.clientX - pan.x)
      element.scrollTop = pan.top - (event.clientY - pan.y)
    }
    function panEnd(event: MouseEvent) {
      if (!pan) return
      event.stopImmediatePropagation()
      pan = null
      setGrabbing(false)
    }

    const surface = host.current
    surface?.addEventListener('mousedown', panStart, true)
    window.addEventListener('mousemove', panMove, true)
    window.addEventListener('mouseup', panEnd, true)
    surface?.addEventListener('mousedown', dragStart, true)
    surface?.addEventListener('mouseleave', dragKeepInside, true)
    window.addEventListener('mousemove', dragForward, true)
    window.addEventListener('mouseup', dragForward, true)
    surface?.addEventListener('mousedown', snapPress, true)
    surface?.addEventListener('mousemove', snapMove, true)
    surface?.addEventListener('mouseup', snapRelease, true)
    document.addEventListener('paste', onPaste)
    void initialize()
    const flushOnHide = () => {
      if (document.visibilityState === 'hidden') void flushSave()
    }
    document.addEventListener('visibilitychange', flushOnHide)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', flushOnHide)
      surface?.removeEventListener('mousedown', switchLayerOnPress, true)
      surface?.removeEventListener('mousedown', panStart, true)
      window.removeEventListener('mousemove', panMove, true)
      window.removeEventListener('mouseup', panEnd, true)
      surface?.removeEventListener('mousedown', dragStart, true)
      surface?.removeEventListener('mouseleave', dragKeepInside, true)
      window.removeEventListener('mousemove', dragForward, true)
      window.removeEventListener('mouseup', dragForward, true)
      surface?.removeEventListener('mousedown', snapPress, true)
      surface?.removeEventListener('mousemove', snapMove, true)
      surface?.removeEventListener('mouseup', snapRelease, true)
      document.removeEventListener('paste', onPaste)
      void flushSave()
      editorRefresh.current!.cancel()
      zoomUpdate.current!.cancel()
      pendingZoom.current = null
      if (canvas) {
        // The engine has no public destroy method; release host listeners and event callbacks.
        canvas.bind('changed', () => {})
        canvas.bind('selected', () => {})
        surface?.replaceChildren()
      }
      engine.current = null
    }
    // oxlint-disable-next-line react/exhaustive-deps -- Create and dispose one engine per mount; its callbacks read the live editor/project refs.
  }, [])

  // Open at 100%. Resizing the document keeps the relative zoom and centers its new bounds.
  const zoomProjectId = project?.id
  useLayoutEffect(() => {
    if (!zoomProjectId) {
      zoomProject.current = null
      return
    }
    zoomTo(zoomProject.current === zoomProjectId ? zoomRef.current : 1)
    zoomProject.current = zoomProjectId
    centerCanvas()
  }, [zoomProjectId, size.w, size.h])

  // A viewport resize changes the fitted scale, while preserving the selected zoom percentage.
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      if (!active.current) {
        layoutCanvas()
        return
      }
      if (zoomRef.current === 1) zoomToFit()
      else zoomTo(zoomRef.current)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Ctrl/⌘ + wheel and trackpad pinch zoom the canvas, never the page.
  useEffect(() => {
    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const editor = engine.current
      if (!editor || !active.current) return
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      const overCanvas = viewport.current?.contains(event.target as Node)
      pendingZoom.current = {
        value: Math.min(
          MAX_ZOOM,
          Math.max(
            MIN_ZOOM,
            (pendingZoom.current?.value ?? zoomRef.current) * Math.exp(-delta * 0.0025),
          ),
        ),
        anchor: overCanvas ? { x: event.clientX, y: event.clientY } : undefined,
      }
      zoomUpdate.current!.schedule()
    }
    // Safari reports pinches as gesture events instead of ctrl + wheel.
    let pinchStart = 1
    function onGestureStart(event: Event) {
      event.preventDefault()
      pinchStart = zoomRef.current
    }
    function onGestureChange(event: Event) {
      event.preventDefault()
      const { scale, clientX, clientY } = event as Event & {
        scale: number
        clientX: number
        clientY: number
      }
      pendingZoom.current = { value: pinchStart * scale, anchor: { x: clientX, y: clientY } }
      zoomUpdate.current!.schedule()
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('gesturestart', onGestureStart)
    window.addEventListener('gesturechange', onGestureChange)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('gesturestart', onGestureStart)
      window.removeEventListener('gesturechange', onGestureChange)
    }
  }, [])

  useCommandScope('editor', Boolean(project))
  useCommandScope('selection', Boolean(project && selection))
  useCommandScope('dialog', sidebarOpen || confirmingDelete || Boolean(pendingRemoteDelete))
  const previewing = useCommandHeld('view.preview')
  const spacePan = useCommandHeld('view.pan')
  const [grabbing, setGrabbing] = useState(false)
  const panReady = Boolean(project) && (tool === 'hand' || spacePan)
  const panReadyRef = useRef(panReady)
  useEffect(() => {
    panReadyRef.current = panReady
  })

  // Space pans, so keep it from scrolling the canvas or doing anything else while held on the canvas.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || !active.current) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (
        target?.isContentEditable ||
        target?.closest(
          'input, textarea, select, button, [role="button"], [role="menuitem"], [role="tab"], [role="treeitem"]',
        )
      )
        return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function nudge(dx: number, dy: number) {
    commitAttribute()
    engine.current?.moveSelectedElements(dx, dy, true)
  }

  function focusFirst(selector: string) {
    const target = [...document.querySelectorAll<HTMLElement>(selector)].find(
      (element) => element.offsetParent !== null,
    )
    target?.focus()
    return Boolean(target)
  }

  function showSidebar(tab: 'layers' | 'projects') {
    setSidebarTab(tab)
    if (!window.matchMedia('(min-width: 768px)').matches) setSidebarOpen(true)
    else
      requestAnimationFrame(() => {
        if (tab === 'layers' && focusFirst('aside[aria-label="Sidebar"] [role="tree"]')) return
        focusFirst(`aside[aria-label="Sidebar"] [data-sidebar-tab="${tab}"]`)
      })
  }

  useCommands({
    'file.newBlank': () => {
      if (ready) newProject('blank')
    },
    'file.newSample': () => {
      if (ready) newProject('sample')
    },
    'file.import': () => {
      if (ready) chooseFiles(false)
    },
    'file.save': saveNow,
    'file.download': () => {
      if (project) downloadSvg(currentSvg(project, { forExport: true }), project.name)
    },
    'file.optimize': () => {
      commitAttribute()
      setExporting(true)
    },
    'file.rename': () => setRenaming(true),
    'tool.select': () => selectTool('select'),
    'tool.rect': () => selectTool('rect'),
    'tool.ellipse': () => selectTool('ellipse'),
    'tool.pen': () => selectTool('path'),
    'tool.hand': () => selectTool('hand'),
    'edit.undo': () => {
      commitAttribute()
      engine.current?.undoMgr.undo()
    },
    'edit.redo': () => {
      commitAttribute()
      engine.current?.undoMgr.redo()
    },
    'edit.escape': () => {
      if (tool === 'hand' || engine.current?.getMode() !== 'select') selectTool('select')
      else engine.current?.clearSelection()
    },
    'selection.delete': () => engine.current?.deleteSelectedElements(),
    'selection.center': centerSelection,
    'selection.alignLeft': () => align('left'),
    'selection.alignCenter': () => align('center'),
    'selection.alignRight': () => align('right'),
    'selection.alignTop': () => align('top'),
    'selection.alignMiddle': () => align('middle'),
    'selection.alignBottom': () => align('bottom'),
    'selection.distributeHorizontal': () => distribute('horizontal'),
    'selection.distributeVertical': () => distribute('vertical'),
    'selection.nudgeLeft': () => nudge(-1, 0),
    'selection.nudgeRight': () => nudge(1, 0),
    'selection.nudgeUp': () => nudge(0, -1),
    'selection.nudgeDown': () => nudge(0, 1),
    'selection.nudgeLeftFar': () => nudge(-10, 0),
    'selection.nudgeRightFar': () => nudge(10, 0),
    'selection.nudgeUpFar': () => nudge(0, -10),
    'selection.nudgeDownFar': () => nudge(0, 10),
    'navigate.projects': () => showSidebar('projects'),
    'navigate.inspector': () => {
      focusFirst('aside[aria-label="Properties"] input, aside[aria-label="Properties"] button')
    },
    'layers.new': () => {
      if (!engine.current) return
      createLayer(engine.current)
      documentChanged()
    },
    'navigate.layers': () => showSidebar('layers'),
    'view.zoomIn': () => stepZoom(1),
    'view.zoomOut': () => stepZoom(-1),
    'view.zoomFit': () => zoomToFit(),
    'view.zoomActual': () => zoomTo(1),
    'view.rulers': () => toggleView('rulers'),
    'view.guides': () => toggleView('guides'),
    'view.snap': () => {
      toggleView('snap')
      toast(viewRef.current.snap ? 'Snapping off' : 'Snapping to guides and artboard')
    },
    'view.lockGuides': () => toggleView('lockGuides'),
    'view.clearGuides': () => changeGuides(noGuides),
    'view.theme': () =>
      setThemePreference(
        ({ system: 'light', light: 'dark', dark: 'system' } as const)[themePreference],
      ),
    'help.shortcuts': () => setShortcutsOpen(true),
  })

  function onDragOver(event: DragEvent) {
    if (!ready || !event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }

  function onDragLeave(event: DragEvent) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
  }

  function onDrop(event: DragEvent) {
    if (!ready) return
    event.preventDefault()
    setDragging(false)
    const files = [...event.dataTransfer.files]
    void importFiles(files, {
      asProjects: files.some(
        (file) => /\.json$/i.test(file.name) || file.type === 'application/json',
      ),
    })
  }

  const projectList = (
    <ProjectList
      projects={projectLibrary(projects, cloud.remoteProjects, cloud.admin)}
      activeId={project ? projectRouteId(project) : undefined}
      loggedIn={cloud.admin}
      loading={cloud.loading}
      error={cloud.listError}
      onRefresh={() => void cloud.refresh()}
      onOpen={(item) => {
        setSidebarOpen(false)
        if (item.id !== projectId) void navigate({ to: '/project/$id', params: { id: item.id } })
        else if (!project) setOpenAttempt((value) => value + 1)
      }}
      onDuplicate={duplicateProject}
      onDownload={(item) => downloadSvg(currentSvg(item, { forExport: true }), item.name)}
      onDelete={(item) => {
        setPendingDelete(item)
        setConfirmingDelete(true)
      }}
      onDeleteRemote={setPendingRemoteDelete}
    />
  )

  const sidebar = (
    <Tabs
      value={sidebarTab}
      onValueChange={(value) => setSidebarTab(value as 'layers' | 'projects')}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <div className="shrink-0 border-b px-2 py-2">
        <TabsList className="h-8 w-full">
          <TabsTrigger value="layers" data-sidebar-tab="layers">
            <LayersIcon />
            Layers
          </TabsTrigger>
          <TabsTrigger value="projects" data-sidebar-tab="projects">
            <FolderOpenIcon />
            Projects
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="layers" className="flex min-h-0 flex-col">
        {project ? (
          <LayersPanel
            editor={engine.current}
            documentRevision={documentRevision}
            selectionRevision={selectionRevision}
            onChange={onLayerChange}
            onSelect={refreshEditorState}
          />
        ) : (
          <p className="px-4 py-5 text-xs leading-relaxed text-muted-foreground">
            Open a project to view its layers.
          </p>
        )}
      </TabsContent>
      <TabsContent value="projects" className="flex min-h-0 flex-col">
        {projectList}
        <div className="flex shrink-0 gap-2 border-t p-3">
          <Button
            size="sm"
            className="flex-1"
            aria-label="New project"
            disabled={!ready}
            onClick={() => {
              setSidebarOpen(false)
              newProject('blank')
            }}
          >
            <PlusIcon />
            New project
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={!ready}
            onClick={() => {
              setSidebarOpen(false)
              chooseFiles(true)
            }}
          >
            <FileUpIcon />
            Import project
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  )

  const inspector = (
    <Inspector
      selectionStore={selectionStore}
      size={size}
      backdrop={backdrop}
      onBackdropChange={setBackdrop}
      onPreview={previewAttribute}
      onCommit={commitAttribute}
      onResize={resizeCanvas}
      onFitToArtwork={fitCanvasToArtwork}
      onCenterSelection={centerSelection}
      onBoundsChange={changeSelectionBounds}
      onRotate={rotateSelection}
      onAlign={align}
      onDistribute={distribute}
      colors={documentColors}
      onReplaceColor={replaceColor}
      onStyleChange={changeStyle}
      documentRevision={documentRevision}
      readDocument={() =>
        project && engine.current
          ? {
              svg: currentSvg(project, { forExport: true }),
              stats: artworkStats(engine.current.getSvgContent()),
            }
          : null
      }
      onOptimize={() => {
        commitAttribute()
        setExporting(true)
      }}
    />
  )

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <WorkspaceHeader
        project={project}
        ready={ready}
        saveState={saveState}
        cloud={cloud}
        view={view}
        guides={guides}
        theme={themePreference}
        onTheme={setThemePreference}
        onToggleView={toggleView}
        onClearGuides={() => changeGuides(noGuides)}
        onNew={newProject}
        onImport={chooseFiles}
        onRename={() => setRenaming(true)}
        onDuplicate={() => {
          if (project) duplicateProject(project)
        }}
        onProjects={() => showSidebar('projects')}
        onLayers={() => showSidebar(sidebarTab)}
        onSave={saveNow}
        onDownload={() => {
          if (project) downloadSvg(currentSvg(project, { forExport: true }), project.name)
        }}
        onDownloadProject={() => {
          if (project) downloadProjectFile({ name: project.name, svg: currentSvg(project), guides })
        }}
        onOptimize={() => {
          commitAttribute()
          setExporting(true)
        }}
        onShortcuts={() => setShortcutsOpen(true)}
        onDeleteRemote={() => {
          const remote = cloud.remoteProjects.find((item) => item.id === project?.cloud?.id)
          if (remote) setPendingRemoteDelete(remote)
        }}
      />
      <input
        ref={fileInput}
        aria-label="Import an SVG or project file"
        type="file"
        accept={PROJECT_ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          void importFiles(files, { asProjects: importAsProjects.current })
        }}
      />
      <ProjectImportDialog
        request={importRequest}
        onClose={() => setImportRequest(null)}
        onImport={importDocuments}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)_16rem]">
        <aside
          className="hidden min-h-0 flex-col border-r bg-sidebar/40 md:flex"
          aria-label="Sidebar"
        >
          {sidebar}
        </aside>

        <main className="relative flex min-h-0 min-w-0 flex-col bg-muted/50 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-size-[16px_16px]">
          {project && (
            <EditorToolbar
              ref={toolbar}
              tool={tool}
              onToolChange={selectTool}
              canUndo={history.undo}
              canRedo={history.redo}
              canDelete={Boolean(selection)}
              onUndo={() => {
                commitAttribute()
                engine.current?.undoMgr.undo()
              }}
              onRedo={() => {
                commitAttribute()
                engine.current?.undoMgr.redo()
              }}
              onDelete={() => engine.current?.deleteSelectedElements()}
              inspector={inspector}
              className={view.rulers ? 'top-8' : undefined}
            />
          )}
          <div className="relative flex min-h-0 flex-1 flex-col">
            {project && (
              <CanvasGuides
                editor={engine.current}
                viewport={viewport}
                revision={revision}
                size={size}
                guides={guides}
                onGuidesChange={changeGuides}
                showRulers={view.rulers}
                showGuides={view.guides}
                locked={view.lockGuides}
                onLockedChange={() => toggleView('lockGuides')}
                snapped={snapped}
              />
            )}
            <div
              ref={viewport}
              className={cn('flex min-h-0 flex-1 overflow-auto', !project && 'p-6 sm:p-10')}
            >
              {(!ready || opening) && !project && (
                <div className="m-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner />
                  Opening your project…
                </div>
              )}
              {ready && !opening && !project && (
                <Empty className="m-auto max-w-md border bg-background p-10 shadow-sm">
                  <EmptyHeader>
                    <EmptyMedia>
                      <Logo className="size-12" />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">Project unavailable</EmptyTitle>
                    <EmptyDescription>
                      {openError ??
                        'This project is not saved on this device and could not be opened remotely.'}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={() => setOpenAttempt((value) => value + 1)}>
                        Try again
                      </Button>
                      <Button variant="outline" render={<Link to="/" />} nativeButton={false}>
                        Go home
                      </Button>
                    </div>
                  </EmptyContent>
                </Empty>
              )}
              <div
                ref={host}
                data-backdrop={backdrop}
                data-previewing={previewing || undefined}
                data-mode={mode}
                data-pan={grabbing ? 'grabbing' : panReady ? 'ready' : undefined}
                className="svg-host shrink-0"
                hidden={!project}
                aria-label="SVG editing canvas"
              />
            </div>
            {ready &&
              !opening &&
              project &&
              canvasEmpty &&
              !starterDismissed &&
              tool === 'select' && (
                <CanvasStarter onStart={selectTool} onDismiss={() => setStarterDismissed(true)} />
              )}
          </div>
        </main>

        <aside
          className="hidden min-h-0 flex-col overflow-y-auto border-l bg-sidebar/40 lg:flex"
          aria-label="Properties"
        >
          {project && inspector}
        </aside>
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-3 border-t bg-background px-3 text-[11px] text-muted-foreground">
        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/"
            aria-label="svgw home"
            className="flex size-6 shrink-0 items-center justify-center outline-none hover:opacity-80 focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Logo className="size-4.5" />
          </Link>
          <LoginButton iconOnly />
        </div>
        {project && (
          <>
            <span className="h-3.5 w-px shrink-0 bg-border" aria-hidden="true" />
            <EditorStatusHint
              tool={tool}
              mode={mode}
              canvasEmpty={canvasEmpty}
              selectionLabel={selection?.label}
              previewing={previewing}
              spacePan={spacePan}
              grabbing={grabbing}
            />
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden tabular-nums sm:inline">
                {size.w} × {size.h} px
              </span>
              <ZoomControl
                zoom={zoom}
                onStep={stepZoom}
                onZoom={(value) => zoomTo(value)}
                onFit={() => zoomToFit()}
              />
            </div>
          </>
        )}
      </footer>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="gap-0 p-0 data-[side=left]:w-72"
          showCloseButton={false}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Workspace sidebar</SheetTitle>
            <SheetDescription>Switch projects or organize your layers.</SheetDescription>
          </SheetHeader>
          <div className="flex shrink-0 items-center gap-3 border-b px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {project?.name || 'Untitled'}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
              Done
            </Button>
          </div>
          {sidebar}
        </SheetContent>
      </Sheet>

      <ProjectRenameDialog
        open={renaming}
        onOpenChange={setRenaming}
        name={project?.name ?? ''}
        onRename={rename}
      />

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {project && (
        <ExportDialog
          open={exporting}
          onOpenChange={setExporting}
          name={project.name}
          getSvg={() => currentSvg(project, { forExport: true })}
        />
      )}

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name || 'Untitled'}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project from this browser. It can’t be undone, so download the SVG
              first if you want to keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete) void removeProject(pendingDelete)
                setConfirmingDelete(false)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRemoteDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingRemoteDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete online “{pendingRemoteDelete?.name || 'Untitled'}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the remote project and its version history. Local copies on this device
              are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cloud.working}
              onClick={() => {
                if (pendingRemoteDelete)
                  void cloud.deleteRemote(pendingRemoteDelete.id).catch((cause: unknown) =>
                    toast.error('Could not delete online project', {
                      description: message(cause, 'Try again.'),
                    }),
                  )
                setPendingRemoteDelete(null)
              }}
            >
              Delete online
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 border border-dashed border-foreground/30 bg-popover px-12 py-10 text-center">
            <UploadIcon className="size-6 text-muted-foreground" />
            <div className="text-sm font-medium">Drop SVG or .json project files</div>
            <div className="text-xs text-muted-foreground">
              {project
                ? 'Each file is added as a new layer, centered'
                : 'Each file opens as a new project'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ZoomControl({
  zoom,
  onStep,
  onZoom,
  onFit,
}: {
  zoom: number
  onStep: (direction: 1 | -1) => void
  onZoom: (zoom: number) => void
  onFit: () => void
}) {
  return (
    <div className="flex items-center">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Zoom out"
              disabled={zoom <= MIN_ZOOM}
              onClick={() => onStep(-1)}
            />
          }
        >
          <MinusIcon />
        </TooltipTrigger>
        <TooltipContent side="top">
          Zoom out
          <CommandShortcut command="view.zoomOut" />
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="w-12 justify-center px-1 font-normal tabular-nums"
              aria-label="Zoom level"
            />
          }
        >
          {Math.round(zoom * 100)}%
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-52">
          <DropdownMenuItem onClick={() => onStep(1)}>
            Zoom in
            <MenuShortcut command="view.zoomIn" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStep(-1)}>
            Zoom out
            <MenuShortcut command="view.zoomOut" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onFit}>
            Zoom to fit
            <MenuShortcut command="view.zoomFit" />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {[0.5, 1, 2, 4].map((level) => (
            <DropdownMenuItem key={level} onClick={() => onZoom(level)}>
              {level * 100}%{level === 1 && <MenuShortcut command="view.zoomActual" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
            100% fits the artboard. <CanvasZoomHint />, or pinch on a trackpad.
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Zoom in"
              disabled={zoom >= MAX_ZOOM}
              onClick={() => onStep(1)}
            />
          }
        >
          <PlusIcon />
        </TooltipTrigger>
        <TooltipContent side="top">
          Zoom in
          <CommandShortcut command="view.zoomIn" />
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

/** The artboard's transparency grid, drawn inside SVG-Edit's root so it scales and moves with the artboard. */
function addCheckerPattern(root: SVGSVGElement) {
  const ns = 'http://www.w3.org/2000/svg'
  const defs =
    root.querySelector('defs') ??
    root.insertBefore(document.createElementNS(ns, 'defs'), root.firstChild)
  const pattern = document.createElementNS(ns, 'pattern')
  pattern.id = 'svgw-checker'
  for (const [name, value] of Object.entries({
    width: '16',
    height: '16',
    patternUnits: 'userSpaceOnUse',
  }))
    pattern.setAttribute(name, value)
  for (const [x, y, fill] of [
    [0, 0, 'var(--checker-base)'],
    [8, 8, 'var(--checker-base)'],
    [8, 0, 'var(--checker-contrast)'],
    [0, 8, 'var(--checker-contrast)'],
  ] as const) {
    const cell = document.createElementNS(ns, 'rect')
    for (const [name, value] of Object.entries({ x, y, width: 8, height: 8, fill }))
      cell.setAttribute(name, String(value))
    pattern.append(cell)
  }
  defs.append(pattern)
}

function MenuShortcut({ command }: { command: Parameters<typeof CommandShortcut>[0]['command'] }) {
  return (
    <DropdownMenuShortcut className="tracking-normal">
      <CommandShortcut command={command} />
    </DropdownMenuShortcut>
  )
}
