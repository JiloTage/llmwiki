'use client'

import * as React from 'react'
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Landmark,
  Lightbulb,
  Loader2,
  NotepadText,
  Plus,
  Presentation,
  ScrollText,
  Search as SearchIcon,
  Sheet,
  Upload,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { SourceAreaContextMenu, SourceContextMenu } from '@/components/kb/ContextMenus'
import { SidenavUserMenu } from '@/components/kb/SidenavUserMenu'
import { WikiSelector } from '@/components/kb/WikiSelector'
import type { DocumentListItem, WikiNode, WikiSubsection } from '@/lib/types'

interface SourceNode {
  type: 'folder' | 'document'
  name: string
  doc?: DocumentListItem
  children?: SourceNode[]
}

function buildSourceTree(docs: DocumentListItem[]): SourceNode[] {
  const folders = new Map<string, SourceNode>()
  const root: SourceNode[] = []

  const getOrCreateFolder = (path: string): SourceNode[] => {
    if (path === '/') return root
    if (folders.has(path)) return folders.get(path)!.children!

    const parts = path.replace(/^\//, '').replace(/\/$/, '').split('/')
    let current = root
    let accumulated = '/'

    for (const part of parts) {
      accumulated += `${part}/`
      if (!folders.has(accumulated)) {
        const folder: SourceNode = {
          type: 'folder',
          name: part,
          children: [],
        }
        folders.set(accumulated, folder)
        current.push(folder)
      }
      current = folders.get(accumulated)!.children!
    }

    return current
  }

  for (const doc of docs) {
    const parent = getOrCreateFolder(doc.path ?? '/')
    parent.push({
      type: 'document',
      name: doc.title || doc.filename,
      doc,
    })
  }

  const sortNodes = (nodes: SourceNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    for (const node of nodes) {
      if (node.children) sortNodes(node.children)
    }
  }

  sortNodes(root)
  return root
}

interface KBSidenavProps {
  kbName: string
  wikiTree: WikiNode[]
  wikiActivePath: string | null
  onWikiNavigate: (path: string) => void
  wikiActiveSubsections?: WikiSubsection[]
  onWikiSubsectionClick?: (id: string) => void
  sourceDocs: DocumentListItem[]
  activeSourceDocId: string | null
  onSourceSelect: (doc: DocumentListItem) => void
  hasWiki: boolean
  loading: boolean
  onCreateNote: () => void
  onCreateFolder: (name: string) => void
  onUpload: () => void
  onDeleteDocument: (id: string) => void
  onRenameDocument: (id: string, newTitle: string) => void
  onMoveDocument: (docId: string, targetPath: string) => void
  selectedIds?: Set<string>
  onSelect?: (docId: string, e: React.MouseEvent) => void
}

export function KBSidenav({
  kbName,
  wikiTree,
  wikiActivePath,
  onWikiNavigate,
  sourceDocs,
  activeSourceDocId,
  onSourceSelect,
  hasWiki,
  loading,
  onCreateNote,
  onCreateFolder,
  onUpload,
  onDeleteDocument,
  onRenameDocument,
  onMoveDocument,
  selectedIds = new Set(),
  onSelect,
}: KBSidenavProps) {
  const [sourcesExpanded, setSourcesExpanded] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('llmwiki:sources-expanded') === 'true'
  })
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false)
  const [folderName, setFolderName] = React.useState('')
  const [allSourcesOpen, setAllSourcesOpen] = React.useState(false)
  const [areaContextOpen, setAreaContextOpen] = React.useState(false)
  const [areaContextPos, setAreaContextPos] = React.useState<{ x: number; y: number } | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)

  const prevSourceCount = React.useRef(sourceDocs.length)

  React.useEffect(() => {
    if (sourceDocs.length > prevSourceCount.current && !sourcesExpanded) {
      setSourcesExpanded(true)
      localStorage.setItem('llmwiki:sources-expanded', 'true')
    }
    prevSourceCount.current = sourceDocs.length
  }, [sourceDocs.length, sourcesExpanded])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggleSources = () => {
    const next = !sourcesExpanded
    setSourcesExpanded(next)
    localStorage.setItem('llmwiki:sources-expanded', String(next))
  }

  const handleCreateFolder = () => {
    if (!folderName.trim()) return
    onCreateFolder(folderName.trim())
    setFolderName('')
    setFolderDialogOpen(false)
  }

  const handleSourcesAreaContext = (event: React.MouseEvent) => {
    event.preventDefault()
    setAreaContextPos({ x: event.clientX, y: event.clientY })
    setAreaContextOpen(true)
  }

  const sourceTree = React.useMemo(() => buildSourceTree(sourceDocs), [sourceDocs])

  const allSearchableItems = React.useMemo(() => {
    const items: { type: 'wiki' | 'source'; title: string; path?: string; doc?: DocumentListItem }[] = []

    const addWikiNodes = (nodes: WikiNode[]) => {
      for (const node of nodes) {
        if (node.path) items.push({ type: 'wiki', title: node.title, path: node.path })
        if (node.children) addWikiNodes(node.children)
      }
    }

    addWikiNodes(wikiTree)
    for (const doc of sourceDocs) {
      items.push({ type: 'source', title: doc.title || doc.filename, doc })
    }

    return items
  }, [wikiTree, sourceDocs])

  return (
    <div className="h-full flex flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="shrink-0 border-b border-border px-3 py-3">
        <WikiSelector kbName={kbName} />
      </div>

      <div className="shrink-0 border-b border-border px-3 py-3">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2 border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground cursor-pointer"
        >
          <SearchIcon className="size-3" />
          <span className="flex-1 text-left">Search pages and sources</span>
          <kbd className="border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Ctrl K
          </kbd>
        </button>
        <div className="mt-2 flex gap-2">
          <button
            onClick={onUpload}
            className="flex flex-1 items-center justify-center gap-1.5 border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground cursor-pointer"
            title="Upload markdown or text files"
          >
            <Upload className="size-3" />
            Upload
          </button>
          <button
            onClick={onCreateNote}
            className="flex items-center justify-center gap-1.5 border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground cursor-pointer"
            title="Create note"
          >
            <Plus className="size-3" />
          </button>
        </div>
      </div>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search wiki pages or sources..." />
        <CommandList>
          <CommandEmpty>No matching page or source.</CommandEmpty>
          {allSearchableItems.some((item) => item.type === 'wiki') && (
            <CommandGroup heading="Wiki">
              {allSearchableItems.filter((item) => item.type === 'wiki').map((item) => (
                <CommandItem
                  key={`wiki-${item.path}`}
                  value={item.title}
                  onSelect={() => {
                    setSearchOpen(false)
                    if (item.path) onWikiNavigate(item.path)
                  }}
                >
                  <FileText className="size-3.5 mr-2 opacity-50" />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {allSearchableItems.some((item) => item.type === 'source') && (
            <CommandGroup heading="Sources">
              {allSearchableItems.filter((item) => item.type === 'source').map((item) => (
                <CommandItem
                  key={`source-${item.doc?.id}`}
                  value={item.title}
                  onSelect={() => {
                    setSearchOpen(false)
                    if (item.doc) onSourceSelect(item.doc)
                  }}
                >
                  <NotepadText className="size-3.5 mr-2 opacity-50" />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { setSearchOpen(false); onCreateNote() }}>
              <NotepadText className="size-3.5 mr-2 opacity-50" />
              Create note
            </CommandItem>
            <CommandItem onSelect={() => { setSearchOpen(false); setFolderDialogOpen(true) }}>
              <Folder className="size-3.5 mr-2 opacity-50" />
              Create folder
            </CommandItem>
            <CommandItem onSelect={() => { setSearchOpen(false); onUpload() }}>
              <Upload className="size-3.5 mr-2 opacity-50" />
              Upload files
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex flex-col min-h-0 border-b border-border px-3 py-3" style={{ maxHeight: '50%' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="wiki-section-label">Navigation</span>
            <span className="text-[10px] text-muted-foreground">{kbName}</span>
          </div>
          {loading ? (
            <SidenavSkeleton lines={3} />
          ) : hasWiki ? (
            <div className="overflow-y-auto no-scrollbar space-y-0.5 border border-border bg-card px-1 py-1">
              {wikiTree.map((node, index) => (
                <WikiTreeNode
                  key={node.path ?? node.title ?? index}
                  node={node}
                  depth={0}
                  activePath={wikiActivePath}
                  onNavigate={onWikiNavigate}
                />
              ))}
            </div>
          ) : (
            <div className="border border-border bg-card px-3 py-4 text-center">
              <BookOpen className="size-6 text-muted-foreground/35 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No wiki pages yet.</p>
              <a
                href="https://claude.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-accent-blue hover:underline"
              >
                Open Claude
                <ArrowUpRight className="size-3" />
              </a>
            </div>
          )}
        </div>

        <div
          className="flex-1 min-h-0 flex flex-col px-3 py-3"
          onContextMenu={handleSourcesAreaContext}
        >
          <div className="mb-2 flex items-center">
            <button
              onClick={toggleSources}
              className="group flex flex-1 items-center gap-1.5 text-left cursor-pointer"
            >
              <ChevronRight
                className={cn(
                  'size-3 text-muted-foreground transition-transform duration-150',
                  sourcesExpanded && 'rotate-90',
                )}
              />
              <span className="wiki-section-label group-hover:text-foreground">Source files</span>
              {sourceDocs.length > 0 && (
                <span className="text-[10px] text-muted-foreground">{sourceDocs.length}</span>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground cursor-pointer">
                  <Plus className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" className="border-border">
                <DropdownMenuItem onClick={onCreateNote}>
                  <NotepadText className="size-3.5 mr-2" />
                  Create note
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFolderDialogOpen(true)}>
                  <Folder className="size-3.5 mr-2" />
                  Create folder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onUpload}>
                  <Upload className="size-3.5 mr-2" />
                  Upload files
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {sourcesExpanded && (
            <div className="flex-1 overflow-y-auto no-scrollbar border border-border bg-card">
              <div className="space-y-0.5 px-1 py-1">
                {loading ? (
                  <SidenavSkeleton lines={6} />
                ) : sourceTree.length > 0 ? (
                  sourceTree.map((node, index) => (
                    <SourceTreeNode
                      key={node.doc?.id ?? node.name ?? index}
                      node={node}
                      depth={0}
                      activeDocId={activeSourceDocId}
                      parentPath="/"
                      onSelect={onSourceSelect}
                      onDelete={onDeleteDocument}
                      onRename={onRenameDocument}
                      onMove={onMoveDocument}
                      selectedIds={selectedIds}
                      onMultiSelect={onSelect}
                    />
                  ))
                ) : (
                  <div className="px-3 py-4 text-center">
                    <p className="text-xs text-muted-foreground">No source files yet.</p>
                    <button
                      onClick={onUpload}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent-blue hover:underline cursor-pointer"
                    >
                      <Upload className="size-3" />
                      Upload files
                    </button>
                  </div>
                )}
                {sourceDocs.length > 8 && (
                  <button
                    onClick={() => setAllSourcesOpen(true)}
                    className="w-full px-2 py-1.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground cursor-pointer text-center"
                  >
                    Show all {sourceDocs.length} sources
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SourceAreaContextMenu
        open={areaContextOpen}
        x={areaContextPos?.x ?? 0}
        y={areaContextPos?.y ?? 0}
        onNewNote={() => { setAreaContextOpen(false); onCreateNote() }}
        onNewFolder={() => {
          setAreaContextOpen(false)
          setFolderDialogOpen(true)
        }}
        onUpload={() => { setAreaContextOpen(false); onUpload() }}
        onClose={() => setAreaContextOpen(false)}
      />

      <div className="shrink-0 border-t border-border px-3 py-3">
        <SidenavUserMenu />
      </div>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="border-border">
          <DialogHeader>
            <DialogTitle className="wiki-heading text-xl">Create Folder</DialogTitle>
          </DialogHeader>
          <input
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleCreateFolder()}
            placeholder="Folder name"
            className="w-full border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={handleCreateFolder}
              disabled={!folderName.trim()}
              className="border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
            >
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={allSourcesOpen} onOpenChange={setAllSourcesOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col border-border">
          <DialogHeader>
            <DialogTitle className="wiki-heading text-xl">All Sources ({sourceDocs.length})</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <div className="grid grid-cols-1 gap-0.5">
              {sourceDocs
                .sort((a, b) => (a.title || a.filename).localeCompare(b.title || b.filename))
                .map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setAllSourcesOpen(false)
                      onSourceSelect(doc)
                    }}
                    className={cn(
                      'flex items-center gap-2.5 w-full text-left px-3 py-2 border border-transparent transition-colors cursor-pointer',
                      doc.id === activeSourceDocId
                        ? 'border-border bg-muted/70 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    {sourceDocumentIcon(doc)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{doc.title || doc.filename}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {doc.file_type.toUpperCase()}
                        {doc.page_count ? ` · ${doc.page_count} pages` : ''}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SidenavSkeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-1 px-2 py-1">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-5 border border-border bg-muted/55 animate-pulse"
          style={{ width: `${60 + Math.random() * 30}%` }}
        />
      ))}
    </div>
  )
}

function wikiNodeIcon(node: WikiNode, depth: number) {
  const slug = node.path?.replace(/\.(md|txt|json)$/, '').split('/')[0] ?? ''
  const titleLower = node.title.toLowerCase()

  if (slug === 'overview' || (depth === 0 && titleLower === 'overview')) {
    return <BookOpen className="size-3 shrink-0 text-muted-foreground" />
  }
  if (slug === 'log' || (depth === 0 && titleLower === 'log')) {
    return <ScrollText className="size-3 shrink-0 text-muted-foreground" />
  }
  if (slug === 'concepts' || (depth === 0 && titleLower === 'concepts')) {
    return <Lightbulb className="size-3 shrink-0 text-muted-foreground" />
  }
  if (slug === 'entities' || (depth === 0 && titleLower === 'entities')) {
    return <Landmark className="size-3 shrink-0 text-muted-foreground" />
  }

  if (depth > 0) {
    return <FileText className="size-3 shrink-0 opacity-50" />
  }

  return <FileText className="size-3 shrink-0 opacity-60" />
}

function WikiTreeNode({
  node,
  depth,
  activePath,
  onNavigate,
}: {
  node: WikiNode
  depth: number
  activePath: string | null
  onNavigate: (path: string) => void
}) {
  const hasChildren = node.children && node.children.length > 0
  const isActive = node.path != null && node.path === activePath
  const hasActiveChild = hasChildren && node.children!.some((child) => child.path === activePath)
  const [expanded, setExpanded] = React.useState(true)

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-0.5 w-full text-left text-xs px-2 py-1 transition-colors',
          isActive
            ? 'bg-[#eaf3ff] text-accent-blue font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded((current) => !current)}
            className="p-0.5 -ml-0.5 cursor-pointer"
          >
            <ChevronRight
              className={cn(
                'size-2.5 transition-transform duration-150',
                expanded && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <button
          onClick={() => node.path && onNavigate(node.path)}
          className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
        >
          {wikiNodeIcon(node, depth)}
          <span className="truncate">{node.title}</span>
        </button>
      </div>
      {hasChildren && (expanded || hasActiveChild) && (
        <div className="mt-0.5">
          {node.children!.map((child, index) => (
            <WikiTreeNode
              key={child.path ?? child.title ?? index}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SourceTreeNode({
  node,
  depth,
  activeDocId,
  parentPath,
  onSelect,
  onDelete,
  onRename,
  onMove,
  selectedIds = new Set(),
  onMultiSelect,
}: {
  node: SourceNode
  depth: number
  activeDocId: string | null
  parentPath: string
  onSelect: (doc: DocumentListItem) => void
  onDelete: (id: string) => void
  onRename: (id: string, newTitle: string) => void
  onMove: (docId: string, targetPath: string) => void
  selectedIds?: Set<string>
  onMultiSelect?: (docId: string, e: React.MouseEvent) => void
}) {
  const [expanded, setExpanded] = React.useState(depth === 0)
  const [renaming, setRenaming] = React.useState(false)
  const [renameValue, setRenameValue] = React.useState('')
  const [contextOpen, setContextOpen] = React.useState(false)
  const [contextPos, setContextPos] = React.useState<{ x: number; y: number } | null>(null)
  const renameInputRef = React.useRef<HTMLInputElement>(null)

  const startRename = () => {
    if (!node.doc) return
    setRenameValue(node.name)
    setRenaming(true)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== node.name && node.doc) {
      onRename(node.doc.id, trimmed)
    }
    setRenaming(false)
  }

  const folderPath = node.type === 'folder' ? `${parentPath}${node.name}/` : parentPath

  if (node.type === 'folder') {
    const [dragOver, setDragOver] = React.useState(false)

    return (
      <div>
        <div
          onClick={() => setExpanded((current) => !current)}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes('application/x-llmwiki-doc')) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setDragOver(true)
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            const docId = event.dataTransfer.getData('application/x-llmwiki-doc')
            if (docId) onMove(docId, folderPath)
          }}
          className={cn(
            'flex items-center gap-1.5 w-full text-left text-xs px-2 py-1 transition-colors cursor-pointer',
            dragOver
              ? 'bg-[#eaf3ff] text-accent-blue'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight
            className={cn(
              'size-3 shrink-0 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
          <FolderOpen className="size-3 shrink-0 opacity-60" />
          <span className="truncate">{node.name}</span>
        </div>
        {expanded && node.children && (
          <div className="mt-0.5">
            {node.children.map((child, index) => (
              <SourceTreeNode
                key={child.doc?.id ?? child.name ?? index}
                node={child}
                depth={depth + 1}
                activeDocId={activeDocId}
                parentPath={folderPath}
                onSelect={onSelect}
                onDelete={onDelete}
                onRename={onRename}
                onMove={onMove}
                selectedIds={selectedIds}
                onMultiSelect={onMultiSelect}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isActive = node.doc?.id != null && node.doc.id === activeDocId
  const isMultiSelected = node.doc?.id != null && selectedIds.has(node.doc.id)

  if (renaming) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-0.5"
        style={{ paddingLeft: `${depth * 12 + 24}px` }}
      >
        <NotepadText className="size-3 shrink-0 opacity-50" />
        <input
          ref={renameInputRef}
          type="text"
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitRename()
            if (event.key === 'Escape') setRenaming(false)
          }}
          className="flex-1 min-w-0 border border-border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
      </div>
    )
  }

  return (
    <div
      draggable
      onDragStart={(event) => {
        if (node.doc) {
          event.dataTransfer.setData('application/x-llmwiki-doc', node.doc.id)
          event.dataTransfer.effectAllowed = 'move'
        }
      }}
      className={cn(
        'flex items-center gap-1.5 w-full text-left text-xs px-2 py-1 transition-colors cursor-pointer group',
        isMultiSelected
          ? 'bg-[#eaf3ff] text-accent-blue'
          : isActive
            ? 'bg-muted/70 text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
      )}
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
      onClick={(event: React.MouseEvent) => {
        if (!node.doc) return
        if ((event.metaKey || event.ctrlKey || event.shiftKey) && onMultiSelect) {
          onMultiSelect(node.doc.id, event)
        } else {
          onSelect(node.doc)
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setContextPos({ x: event.clientX, y: event.clientY })
        setContextOpen(true)
      }}
    >
      {sourceDocumentIcon(node.doc)}
      <span className="truncate flex-1">{node.name}</span>
      <SourceContextMenu
        open={contextOpen}
        x={contextPos?.x ?? 0}
        y={contextPos?.y ?? 0}
        onRename={() => { setContextOpen(false); startRename() }}
        onDelete={() => { setContextOpen(false); node.doc && onDelete(node.doc.id) }}
        onClose={() => setContextOpen(false)}
      />
    </div>
  )
}

function sourceDocumentIcon(doc?: DocumentListItem) {
  if (doc?.status === 'pending' || doc?.status === 'processing') {
    return <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground/60" />
  }
  if (doc?.status === 'failed') {
    return <FileText className="size-3 shrink-0 text-destructive/70" />
  }

  const fileType = doc?.file_type || ''

  if (fileType === 'pdf') return <FileText className="size-3 shrink-0 text-red-500/75" />
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fileType)) {
    return <Image className="size-3 shrink-0 text-sky-500/75" />
  }
  if (['xlsx', 'xls', 'csv'].includes(fileType)) {
    return <Sheet className="size-3 shrink-0 text-emerald-500/75" />
  }
  if (['pptx', 'ppt'].includes(fileType)) {
    return <Presentation className="size-3 shrink-0 text-orange-500/75" />
  }
  if (['html', 'htm'].includes(fileType)) {
    return <FileCode className="size-3 shrink-0 text-violet-500/75" />
  }

  return <NotepadText className="size-3 shrink-0 opacity-55" />
}
