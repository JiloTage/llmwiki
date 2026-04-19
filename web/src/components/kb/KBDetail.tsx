'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Upload as UploadIcon, BookOpen, ArrowUpRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useUserStore } from '@/stores'
import { useKBDocuments } from '@/hooks/useKBDocuments'
import { apiFetch } from '@/lib/api'
import { KBSidenav } from '@/components/kb/KBSidenav'
import { SelectionActionBar } from '@/components/kb/SelectionActionBar'
import { WikiContent, extractTocFromMarkdown } from '@/components/wiki/WikiContent'
import { NoteEditor } from '@/components/editor/NoteEditor'
import type { DocumentListItem, WikiNode, WikiSubsection } from '@/lib/types'

function getWikiPathStorageKey(kbId: string): string {
  return `llmwiki:active-wiki-path:${kbId}`
}

function normalizeWikiPath(path: string): string {
  let normalized = path.trim().replace(/^\/wiki\/?/, '').replace(/^\/+/, '')

  for (let index = 0; index < 2; index += 1) {
    try {
      const decoded = decodeURIComponent(normalized)
      if (decoded === normalized) break
      normalized = decoded
    } catch {
      break
    }
  }

  return normalized
}

function isNoteFile(doc: DocumentListItem): boolean {
  return doc.file_type === 'md' || doc.file_type === 'txt'
}

function buildTreeFromDocs(docs: DocumentListItem[]): WikiNode[] {
  const sorted = [...docs].sort((a, b) => {
    const left = a.sort_order ?? 999
    const right = b.sort_order ?? 999
    return left - right || (a.title || a.filename).localeCompare(b.title || b.filename)
  })

  const topLevel: Array<{ title: string; path: string; slug: string }> = []
  const childPages = new Map<string, Array<{ title: string; path: string }>>()

  for (const doc of sorted) {
    const relative = (doc.path + doc.filename).replace(/^\/wiki\/?/, '')
    const parts = relative.split('/')
    const title =
      doc.title ||
      parts[parts.length - 1].replace(/\.(md|txt|json)$/, '').replace(/[-_]/g, ' ')

    if (parts.length === 1) {
      const slug = parts[0].replace(/\.(md|txt|json)$/, '')
      topLevel.push({ title, path: relative, slug })
    } else {
      const folder = parts[0]
      if (!childPages.has(folder)) childPages.set(folder, [])
      childPages.get(folder)!.push({ title, path: relative })
    }
  }

  const tree: WikiNode[] = []
  const usedFolders = new Set<string>()

  for (const parent of topLevel) {
    const children = childPages.get(parent.slug)
    if (children && children.length > 0) {
      usedFolders.add(parent.slug)
      tree.push({
        title: parent.title,
        path: parent.path,
        children: children.map((child) => ({ title: child.title, path: child.path })),
      })
    } else {
      tree.push({ title: parent.title, path: parent.path })
    }
  }

  for (const [folder, children] of childPages) {
    if (usedFolders.has(folder)) continue
    const folderTitle = folder.replace(/[-_]/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase())
    tree.push({
      title: folderTitle,
      children: children.map((child) => ({ title: child.title, path: child.path })),
    })
  }

  tree.sort((a, b) => {
    const sa = a.path?.replace(/\.(md|txt|json)$/, '').split('/')[0] ?? ''
    const sb = b.path?.replace(/\.(md|txt|json)$/, '').split('/')[0] ?? ''
    if (sa === 'overview') return -1
    if (sb === 'overview') return 1
    if (sa === 'log') return 1
    if (sb === 'log') return -1
    return a.title.localeCompare(b.title)
  })

  return tree
}

function findFirstPath(nodes: WikiNode[]): string | null {
  for (const node of nodes) {
    if (node.path) return node.path
    if (node.children) {
      const child = findFirstPath(node.children)
      if (child) return child
    }
  }
  return null
}

type Props = {
  kbId: string
  kbSlug?: string
  kbName: string
}

export function KBDetail({ kbId, kbName }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = useUserStore((s) => s.accessToken)
  const { documents, setDocuments, loading, refetchDocuments } = useKBDocuments(kbId)

  const wikiDocs = React.useMemo(
    () => documents.filter((doc) => doc.path.startsWith('/wiki/') && !doc.archived && doc.file_type === 'md'),
    [documents],
  )
  const sourceDocs = React.useMemo(
    () => documents.filter((doc) => !doc.path.startsWith('/wiki/') && !doc.archived),
    [documents],
  )
  const wikiTree = React.useMemo(() => buildTreeFromDocs(wikiDocs), [wikiDocs])
  const hasWiki = wikiTree.length > 0

  const [wikiActivePath, setWikiActivePath] = React.useState<string | null>(null)
  const [activeSourceDocId, setActiveSourceDocId] = React.useState<string | null>(null)
  const [pageContent, setPageContent] = React.useState('')
  const [pageTitle, setPageTitle] = React.useState('')
  const [pageLoading, setPageLoading] = React.useState(false)
  const [selectionHydrated, setSelectionHydrated] = React.useState(false)

  const pageParam = searchParams.get('page')
  const docParam = searchParams.get('doc')

  const activeSourceDoc = React.useMemo(
    () => activeSourceDocId ? sourceDocs.find((doc) => doc.id === activeSourceDocId) ?? null : null,
    [activeSourceDocId, sourceDocs],
  )
  const activeWikiDoc = React.useMemo(() => {
    if (!wikiActivePath) return null
    const normalizedActivePath = normalizeWikiPath(wikiActivePath)
    return wikiDocs.find((doc) => normalizeWikiPath(doc.path + doc.filename) === normalizedActivePath) ?? null
  }, [wikiActivePath, wikiDocs])

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const lastSelectedIdRef = React.useRef<string | null>(null)
  const sourceDocIds = React.useMemo(() => sourceDocs.map((doc) => doc.id), [sourceDocs])

  const updateUrl = React.useCallback((selection: { docId?: string | null; pagePath?: string | null }) => {
    const url = new URL(window.location.href)
    if (selection.docId) {
      url.searchParams.set('doc', selection.docId)
    } else {
      url.searchParams.delete('doc')
    }
    if (selection.pagePath) {
      url.searchParams.set('page', selection.pagePath)
    } else {
      url.searchParams.delete('page')
    }
    router.replace(url.pathname + url.search, { scroll: false })
  }, [router])

  React.useEffect(() => {
    if (selectionHydrated || loading) return

    if (docParam && sourceDocs.some((doc) => doc.id === docParam)) {
      setActiveSourceDocId(docParam)
      setWikiActivePath(null)
      setSelectionHydrated(true)
      return
    }

    if (pageParam) {
      setWikiActivePath(normalizeWikiPath(pageParam))
      setActiveSourceDocId(null)
      setSelectionHydrated(true)
      return
    }

    const cached = window.sessionStorage.getItem(getWikiPathStorageKey(kbId))
    if (cached) {
      setWikiActivePath(cached)
    } else {
      setWikiActivePath(findFirstPath(wikiTree))
    }
    setSelectionHydrated(true)
  }, [selectionHydrated, loading, docParam, pageParam, sourceDocs, kbId, wikiTree])

  React.useEffect(() => {
    if (!selectionHydrated) return
    if (wikiActivePath) {
      window.sessionStorage.setItem(getWikiPathStorageKey(kbId), wikiActivePath)
    } else {
      window.sessionStorage.removeItem(getWikiPathStorageKey(kbId))
    }
  }, [selectionHydrated, kbId, wikiActivePath])

  React.useEffect(() => {
    if (!selectionHydrated || activeSourceDocId || wikiActivePath || !hasWiki) return
    const firstPath = findFirstPath(wikiTree)
    if (firstPath) {
      setWikiActivePath(firstPath)
      updateUrl({ pagePath: firstPath, docId: null })
    }
  }, [selectionHydrated, activeSourceDocId, wikiActivePath, hasWiki, wikiTree, updateUrl])

  React.useEffect(() => {
    if (!token || !activeWikiDoc) {
      setPageContent('')
      setPageTitle('')
      return
    }

    setPageLoading(true)
    setPageTitle(activeWikiDoc.title || activeWikiDoc.filename.replace(/\.(md|txt)$/, ''))

    apiFetch<{ content: string }>(`/api/v1/documents/${activeWikiDoc.id}/content`, token)
      .then((response) => setPageContent(response.content || ''))
      .catch(() => setPageContent('Failed to load this wiki page.'))
      .finally(() => setPageLoading(false))
  }, [activeWikiDoc, token])

  const handleWikiSelect = React.useCallback((path: string) => {
    setWikiActivePath(path)
    setActiveSourceDocId(null)
    updateUrl({ pagePath: path, docId: null })
  }, [updateUrl])

  const handleSourceSelect = React.useCallback((doc: DocumentListItem) => {
    setActiveSourceDocId(doc.id)
    setWikiActivePath(null)
    setSelectedIds(new Set())
    updateUrl({ docId: doc.id, pagePath: null })
  }, [updateUrl])

  const handleCitationSourceClick = React.useCallback((source: string) => {
    const filename = source.replace(/,\s*p\.?\s*.+$/, '').trim().toLowerCase()
    const match = sourceDocs.find((doc) => {
      const title = (doc.title || '').toLowerCase()
      return doc.filename.toLowerCase() === filename || title === filename
    })
    if (match) handleSourceSelect(match)
  }, [sourceDocs, handleSourceSelect])

  const handleWikiNavigate = React.useCallback((path: string) => {
    let nextPath = path
    if (path.startsWith('./') && wikiActivePath) {
      const dir = wikiActivePath.includes('/') ? wikiActivePath.slice(0, wikiActivePath.lastIndexOf('/') + 1) : ''
      nextPath = `${dir}${path.slice(2)}`.replace(/\/+/g, '/')
    }
    handleWikiSelect(normalizeWikiPath(nextPath))
  }, [handleWikiSelect, wikiActivePath])

  const handleSelect = React.useCallback((docId: string, e: React.MouseEvent) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)

      if (e.shiftKey && lastSelectedIdRef.current) {
        const lastIdx = sourceDocIds.indexOf(lastSelectedIdRef.current)
        const currIdx = sourceDocIds.indexOf(docId)
        if (lastIdx !== -1 && currIdx !== -1) {
          const [start, end] = lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx]
          for (let index = start; index <= end; index += 1) {
            next.add(sourceDocIds[index])
          }
        } else {
          next.add(docId)
        }
      } else if (e.metaKey || e.ctrlKey) {
        if (next.has(docId)) {
          next.delete(docId)
        } else {
          next.add(docId)
        }
      } else {
        next.clear()
        next.add(docId)
      }

      lastSelectedIdRef.current = docId
      return next
    })
  }, [sourceDocIds])

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set())
    lastSelectedIdRef.current = null
  }, [])

  React.useEffect(() => {
    if (selectedIds.size === 0) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearSelection()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds.size, clearSelection])

  const getToken = React.useCallback(() => {
    const currentToken = useUserStore.getState().accessToken
    if (!currentToken) {
      toast.error('Missing access token')
      return null
    }
    return currentToken
  }, [])

  const handleCreateNote = async () => {
    const currentToken = getToken()
    if (!currentToken) return

    try {
      const doc = await apiFetch<DocumentListItem>(`/api/v1/knowledge-bases/${kbId}/documents/note`, currentToken, {
        method: 'POST',
        body: JSON.stringify({ filename: 'Untitled.md', path: '/', content: '' }),
      })
      setDocuments((prev) => [doc, ...prev])
      handleSourceSelect(doc)
    } catch {
      toast.error('Failed to create note')
    }
  }

  const handleCreateFolder = (folderName: string) => {
    const currentToken = getToken()
    if (!currentToken) return
    apiFetch<DocumentListItem>(`/api/v1/knowledge-bases/${kbId}/documents/note`, currentToken, {
      method: 'POST',
      body: JSON.stringify({ filename: 'Untitled.md', path: `/${folderName}/`, content: '' }),
    })
      .then((doc) => {
        setDocuments((prev) => [doc, ...prev])
        handleSourceSelect(doc)
      })
      .catch(() => toast.error('Failed to create folder'))
  }

  const handleMoveDocument = async (docId: string, targetPath: string) => {
    const currentToken = getToken()
    if (!currentToken) return
    try {
      await apiFetch(`/api/v1/documents/${docId}`, currentToken, {
        method: 'PATCH',
        body: JSON.stringify({ path: targetPath }),
      })
      setDocuments((prev) => prev.map((doc) => (doc.id === docId ? { ...doc, path: targetPath } : doc)))
    } catch {
      toast.error('Failed to move document')
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    const currentToken = getToken()
    if (!currentToken) return
    try {
      await apiFetch(`/api/v1/documents/${docId}`, currentToken, { method: 'DELETE' })
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId))
      if (activeSourceDocId === docId) {
        setActiveSourceDocId(null)
        setWikiActivePath(findFirstPath(wikiTree))
      }
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const handleRenameDocument = async (docId: string, newTitle: string) => {
    const currentToken = getToken()
    if (!currentToken) return
    try {
      const updated = await apiFetch<DocumentListItem>(`/api/v1/documents/${docId}`, currentToken, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle }),
      })
      setDocuments((prev) => prev.map((doc) => (doc.id === docId ? updated : doc)))
    } catch {
      toast.error('Failed to rename document')
    }
  }

  const handleDeleteSelected = async () => {
    const currentToken = getToken()
    if (!currentToken || selectedIds.size === 0) return

    const ids = Array.from(selectedIds)
    const results = await Promise.allSettled(
      ids.map((id) => apiFetch(`/api/v1/documents/${id}`, currentToken, { method: 'DELETE' })),
    )
    const succeeded = ids.filter((_, index) => results[index].status === 'fulfilled')

    if (succeeded.length > 0) {
      setDocuments((prev) => prev.filter((doc) => !succeeded.includes(doc.id)))
      if (activeSourceDocId && succeeded.includes(activeSourceDocId)) {
        setActiveSourceDocId(null)
      }
    }

    if (succeeded.length !== ids.length) {
      toast.error('Some documents could not be deleted')
    }
    clearSelection()
  }

  const uploadFiles = React.useCallback(async (files: File[]) => {
    const currentToken = getToken()
    if (!currentToken) return

    const uploaded: DocumentListItem[] = []
    for (const file of files) {
      if (!/\.(md|txt)$/i.test(file.name)) {
        toast.error(`${file.name}: only .md and .txt files are supported`)
        continue
      }

      try {
        const content = await file.text()
        const doc = await apiFetch<DocumentListItem>(`/api/v1/knowledge-bases/${kbId}/documents/note`, currentToken, {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            title: file.name.replace(/\.(md|txt)$/i, ''),
            content,
            path: '/',
          }),
        })
        uploaded.push(doc)
      } catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    if (uploaded.length > 0) {
      setDocuments((prev) => [...uploaded, ...prev])
      toast.success(`${uploaded.length} file(s) uploaded`)
      void refetchDocuments()
    }
  }, [getToken, kbId, refetchDocuments, setDocuments])

  const handleUploadClick = React.useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.txt'
    input.multiple = true
    input.onchange = () => {
      if (input.files) {
        void uploadFiles(Array.from(input.files))
      }
    }
    input.click()
  }, [uploadFiles])

  const wikiActiveSubsections: WikiSubsection[] = React.useMemo(() => {
    if (!pageContent || !wikiActivePath) return []
    return extractTocFromMarkdown(pageContent)
      .filter((item) => item.level === 2)
      .map((item) => ({ id: item.id, title: item.text }))
  }, [pageContent, wikiActivePath])

  const handleSubsectionClick = React.useCallback((id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const [fileDragOver, setFileDragOver] = React.useState(false)
  const dragCounterRef = React.useRef(0)

  const handleFileDragEnter = (event: React.DragEvent) => {
    if (event.dataTransfer.types.includes('application/x-llmwiki-item')) return
    event.preventDefault()
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) setFileDragOver(true)
  }
  const handleFileDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) setFileDragOver(false)
  }
  const handleFileDragOver = (event: React.DragEvent) => {
    if (event.dataTransfer.types.includes('application/x-llmwiki-item')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }
  const handleFileDrop = (event: React.DragEvent) => {
    if (event.dataTransfer.types.includes('application/x-llmwiki-item')) return
    event.preventDefault()
    dragCounterRef.current = 0
    setFileDragOver(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      void uploadFiles(files)
    }
  }

  const showMainLoading =
    loading ||
    !selectionHydrated ||
    (!activeSourceDocId && hasWiki && !wikiActivePath) ||
    (!activeSourceDocId && pageLoading)

  return (
    <div
      className="relative flex h-full flex-col bg-muted/55"
      onDragEnter={handleFileDragEnter}
      onDragLeave={handleFileDragLeave}
      onDragOver={handleFileDragOver}
      onDrop={handleFileDrop}
    >
      {fileDragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 border-2 border-dashed border-accent-blue bg-card px-12 py-10">
            <UploadIcon className="size-8 text-primary" />
            <p className="text-sm font-medium text-primary">Drop markdown or text files to upload</p>
            <p className="text-xs text-muted-foreground">Supported: .md, .txt</p>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[18rem] shrink-0">
          <KBSidenav
            kbName={kbName}
            wikiTree={wikiTree}
            wikiActivePath={wikiActivePath}
            onWikiNavigate={handleWikiSelect}
            wikiActiveSubsections={wikiActiveSubsections}
            onWikiSubsectionClick={handleSubsectionClick}
            sourceDocs={sourceDocs}
            activeSourceDocId={activeSourceDocId}
            onSourceSelect={handleSourceSelect}
            hasWiki={hasWiki}
            loading={loading}
            onCreateNote={handleCreateNote}
            onCreateFolder={handleCreateFolder}
            onUpload={handleUploadClick}
            onDeleteDocument={handleDeleteDocument}
            onRenameDocument={handleRenameDocument}
            onMoveDocument={handleMoveDocument}
            selectedIds={selectedIds}
            onSelect={handleSelect}
          />
        </div>

        <div className="min-w-0 flex-1 border-l border-border/80 bg-background">
          {showMainLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeSourceDoc && isNoteFile(activeSourceDoc) ? (
            <NoteEditor
              key={activeSourceDoc.id}
              documentId={activeSourceDoc.id}
              initialTitle={activeSourceDoc.title ?? activeSourceDoc.filename}
              initialTags={activeSourceDoc.tags}
              initialDate={activeSourceDoc.date}
              initialProperties={(activeSourceDoc.metadata?.properties as Record<string, unknown> | undefined) ?? undefined}
              embedded
            />
          ) : hasWiki && wikiActivePath ? (
            <WikiContent
              content={pageContent}
              title={pageTitle}
              path={wikiActivePath}
              kbName={kbName}
              onNavigate={handleWikiNavigate}
              onSourceClick={handleCitationSourceClick}
              documents={documents}
            />
          ) : (
            <div data-testid="empty-wiki-state" className="flex h-full flex-col items-center justify-center gap-4 px-6">
              <BookOpen className="size-10 text-muted-foreground/20" />
              <div className="max-w-sm border border-border bg-card px-8 py-8 text-center">
                <p className="wiki-section-label mb-3">Empty encyclopedia</p>
                <h3 className="wiki-heading text-[1.8rem] leading-none mb-3">No wiki pages yet</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Upload source notes and start drafting markdown pages under <code>/wiki/</code>.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={handleUploadClick}
                    data-testid="empty-wiki-upload"
                    className="inline-flex items-center gap-2 border border-border bg-card px-5 py-2 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                  >
                    <UploadIcon className="size-3.5 opacity-60" />
                    Upload Sources
                  </button>
                  <a
                    href="https://claude.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-border bg-background px-5 py-2 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Open Claude
                    <ArrowUpRight className="size-3.5 opacity-60" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <SelectionActionBar
        count={selectedIds.size}
        onDelete={handleDeleteSelected}
        onClear={clearSelection}
      />
    </div>
  )
}
