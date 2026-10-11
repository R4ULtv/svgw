import {
  ArrowLeftIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  FilePlusIcon,
  FileUpIcon,
  FolderOpenIcon,
  KeyboardIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  PencilIcon,
  SaveIcon,
  Settings2Icon,
  SparklesIcon,
  SunIcon,
  UploadIcon,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { Project } from '@/lib/projects'
import type { Guides, ViewPrefs } from '@/lib/guides'
import type { useCloudProjects } from '@/lib/use-cloud-projects'
import type { CommandId } from '@/lib/commands'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { CommandShortcut } from './commands'
import { CloudControls } from './cloud-controls'
import { LoginButton } from './login-button'
import type { ThemePreference } from './theme'

interface WorkspaceHeaderProps {
  project: Project | null
  ready: boolean
  saveState: 'saving' | 'saved' | 'error'
  cloud: ReturnType<typeof useCloudProjects>
  view: ViewPrefs
  guides: Guides
  theme: ThemePreference
  onTheme: (theme: ThemePreference) => void
  onToggleView: (key: keyof ViewPrefs) => void
  onClearGuides: () => void
  onNew: (kind: 'blank' | 'sample') => void
  onImport: (asProjects: boolean) => void
  onRename: () => void
  onDuplicate: () => void
  onProjects: () => void
  onLayers: () => void
  onSave: () => void
  onDownload: () => void
  onOptimize: () => void
  onShortcuts: () => void
  onDeleteRemote: () => void
}

export function WorkspaceHeader({
  project,
  ready,
  saveState,
  cloud,
  view,
  guides,
  theme,
  onTheme,
  onToggleView,
  onClearGuides,
  onNew,
  onImport,
  onRename,
  onDuplicate,
  onProjects,
  onLayers,
  onSave,
  onDownload,
  onOptimize,
  onShortcuts,
  onDeleteRemote,
}: WorkspaceHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b bg-background px-3 py-2 md:h-14 md:flex-nowrap md:gap-4 md:px-4 md:py-0">
      <Link
        to="/projects"
        aria-label="Back to projects"
        className="flex h-8 shrink-0 items-center gap-1.5 text-xs font-medium outline-none hover:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ArrowLeftIcon className="size-3.5" />
        Projects
      </Link>
      <span className="hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden="true" />
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Show sidebar"
        onClick={onLayers}
      >
        <PanelLeftIcon />
      </Button>
      <div className="flex min-w-0 flex-1 flex-col items-start">
        {project ? (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    aria-label="Rename project"
                    title={project.name || 'Untitled'}
                    onClick={onRename}
                    className="group/title -ml-1 h-6 max-w-full shrink justify-start gap-1.5 px-1 text-sm font-semibold"
                  />
                }
              >
                <span className="truncate">{project.name || 'Untitled'}</span>
                <PencilIcon className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100 pointer-coarse:opacity-100" />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Rename project
                <CommandShortcut command="file.rename" />
              </TooltipContent>
            </Tooltip>
            <CloudControls
              cloud={cloud}
              project={project}
              localState={saveState}
              onDelete={onDeleteRemote}
            />
          </>
        ) : (
          <span className="text-sm font-semibold">Workspace</span>
        )}
      </div>

      <nav
        aria-label="Workspace actions"
        className="flex w-full shrink-0 items-center justify-end gap-1 sm:gap-2 md:w-auto"
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                aria-label="File"
                title="File"
                disabled={!ready}
                className="w-8 px-0 md:w-auto md:px-2"
              />
            }
          >
            <FileIcon className="md:hidden" />
            <span className="hidden md:inline">File</span>
            <ChevronDownIcon className="hidden size-3 text-muted-foreground md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Create & open</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onNew('blank')}>
                <FilePlusIcon />
                New project
                <Shortcut command="file.newBlank" />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onImport(true)}>
                <FileUpIcon />
                Open SVG as a project…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNew('sample')}>
                <SparklesIcon />
                New sample logo
                <Shortcut command="file.newSample" />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onProjects}>
                <FolderOpenIcon />
                Project sidebar
                <Shortcut command="navigate.projects" />
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/projects" />}>
                <FolderOpenIcon />
                All projects
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Current project</DropdownMenuLabel>
              <DropdownMenuItem disabled={!project} onClick={() => onImport(false)}>
                <UploadIcon />
                Import SVG as a layer…
                <Shortcut command="file.import" />
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!project} onClick={onRename}>
                <PencilIcon />
                Rename project…
                <Shortcut command="file.rename" />
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!project} onClick={onDuplicate}>
                <CopyIcon />
                Duplicate project
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!project} onClick={onSave}>
                <SaveIcon />
                Save now
                <Shortcut command="file.save" />
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                aria-label="View"
                title="View"
                className="w-8 px-0 md:w-auto md:px-2"
              />
            }
          >
            <Settings2Icon className="md:hidden" />
            <span className="hidden md:inline">View</span>
            <ChevronDownIcon className="hidden size-3 text-muted-foreground md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {project && (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Canvas</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={view.rulers}
                    onCheckedChange={() => onToggleView('rulers')}
                  >
                    Rulers
                    <Shortcut command="view.rulers" />
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={view.guides}
                    onCheckedChange={() => onToggleView('guides')}
                  >
                    Guides
                    <Shortcut command="view.guides" />
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={view.snap}
                    onCheckedChange={() => onToggleView('snap')}
                  >
                    Snap to guides
                    <Shortcut command="view.snap" />
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={view.lockGuides}
                    onCheckedChange={() => onToggleView('lockGuides')}
                  >
                    Lock guides
                    <Shortcut command="view.lockGuides" />
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuItem
                    disabled={!guides.x.length && !guides.y.length}
                    onClick={onClearGuides}
                  >
                    Clear guides
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuGroup>
              <DropdownMenuLabel>Appearance</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) => onTheme(value as ThemePreference)}
              >
                <DropdownMenuRadioItem value="light">
                  <SunIcon />
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <MoonIcon />
                  Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <MonitorIcon />
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onShortcuts}>
              <KeyboardIcon />
              Keyboard shortcuts
              <Shortcut command="help.shortcuts" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                disabled={!project || !ready}
                onClick={() => onImport(false)}
                className="hidden md:inline-flex"
              />
            }
          >
            <UploadIcon data-icon="inline-start" />
            Import SVG
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Add an SVG as a layer
            <CommandShortcut command="file.import" />
          </TooltipContent>
        </Tooltip>
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        <LoginButton />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                disabled={!project}
                aria-label="Export"
                className="w-8 px-0 sm:w-auto sm:px-2.5"
              />
            }
          >
            <DownloadIcon />
            <span className="hidden sm:inline">Export</span>
            <ChevronDownIcon className="hidden size-3 opacity-60 sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={onDownload}>
              <DownloadIcon />
              Download SVG
              <Shortcut command="file.download" />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOptimize}>
              <SparklesIcon />
              Optimize & download…
              <Shortcut command="file.optimize" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  )
}

function Shortcut({ command }: { command: CommandId }) {
  return (
    <DropdownMenuShortcut className="tracking-normal">
      <CommandShortcut command={command} />
    </DropdownMenuShortcut>
  )
}
