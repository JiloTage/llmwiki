'use client'

import * as React from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { WikiSidenav, type WikiNode } from './WikiSidenav'
import { WikiContent } from './WikiContent'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores'
import { Loader2, BookOpen, ArrowUpRight } from 'lucide-react'
import type { DocumentListItem } from '@/lib/types'

interface Props {
  kbId: string
  documents: DocumentListItem[]
}

function buildTreeFromDocs(docs: DocumentListItem[]): WikiNode[] {
  const groups = new Map<string, WikiNode[]>()
  const topLevel: WikiNode[] = []

  for (const doc of docs) {
    const relative = (doc.path + doc.filename).replace(/^\/wiki\/?/, '')
    const parts = relative.split('/')
    const title =
      doc.title ||
      parts[parts.length - 1].replace(/\.(md|txt|json)$/, '').replace(/[-_]/g, ' ')

    if (parts.length === 1) {
      topLevel.push({ title, path: relative })
    } else {
      const folder = parts.slice(0, -1).join('/')
      if (!groups.has(folder)) groups.set(folder, [])
      groups.get(folder)!.push({ title, path: relative })
    }
  }

  const tree: WikiNode[] = []

  // Add index/overview first if it exists
  const overviewIdx = topLevel.findIndex(
    (n) =>
      n.path === 'index.md' ||
      n.path === 'overview.md' ||
      n.path === 'README.md',
  )
  if (overviewIdx >= 0) {
    tree.push(topLevel.splice(overviewIdx, 1)[0])
  }

  // Add folder groups
  for (const [folder, children] of groups) {
    const folderTitle = folder
      .split('/')
      .pop()!
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    tree.push({
      title: folderTitle,
      children: children.sort((a, b) => a.title.localeCompare(b.title)),
    })
  }

  // Add remaining top-level pages
  tree.push(...topLevel.sort((a, b) => a.title.localeCompare(b.title)))

  return tree
}

function findFirstPath(nodes: WikiNode[]): string | null {
  for (const node of nodes) {
    if (node.path) return node.path
    if (node.children) {
      const found = findFirstPath(node.children)
      if (found) return found
    }
  }
  return null
}

export function WikiView({ kbId, documents }: Props) {
  const token = useUserStore((s) => s.accessToken)

  const wikiDocs = React.useMemo(
    () =>
      documents.filter(
        (d) => d.path === '/wiki/' || d.path.startsWith('/wiki/'),
      ),
    [documents],
  )

  // Try to parse index.json if it exists
  const indexDoc = wikiDocs.find(
    (d) => d.filename === 'index.json' && d.path === '/wiki/',
  )

  const [tree, setTree] = React.useState<WikiNode[]>([])
  const [activePath, setActivePath] = React.useState<string | null>(null)
  const [pageContent, setPageContent] = React.useState('')
  const [pageTitle, setPageTitle] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [indexLoaded, setIndexLoaded] = React.useState(false)

  // Load index
  React.useEffect(() => {
    if (indexDoc && token) {
      apiFetch<{ content: string }>(
        `/v1/documents/${indexDoc.id}/content`,
        token,
      )
        .then((res) => {
          try {
            const parsed = JSON.parse(res.content)
            setTree(parsed.tree || [])
          } catch {
            setTree(buildTreeFromDocs(wikiDocs.filter((d) => d.id !== indexDoc.id)))
          }
          setIndexLoaded(true)
        })
        .catch(() => {
          setTree(buildTreeFromDocs(wikiDocs.filter((d) => d.id !== indexDoc.id)))
          setIndexLoaded(true)
        })
    } else {
      setTree(buildTreeFromDocs(wikiDocs))
      setIndexLoaded(true)
    }
  }, [indexDoc?.id, token, wikiDocs.length])

  // Auto-select first page
  React.useEffect(() => {
    if (indexLoaded && !activePath && tree.length) {
      const first = findFirstPath(tree)
      if (first) setActivePath(first)
    }
  }, [indexLoaded, tree, activePath])

  // Fetch page content
  React.useEffect(() => {
    if (!activePath || !token) return

    const doc = wikiDocs.find((d) => {
      const relative = (d.path + d.filename).replace(/^\/wiki\/?/, '')
      return relative === activePath
    })

    if (!doc) {
      setPageContent(`Page not found: ${activePath}`)
      setPageTitle('')
      return
    }

    setLoading(true)
    setPageTitle(doc.title || doc.filename.replace(/\.(md|txt)$/, ''))
    apiFetch<{ content: string }>(`/v1/documents/${doc.id}/content`, token)
      .then((res) => {
        setPageContent(res.content || '')
      })
      .catch(() => {
        setPageContent('Failed to load page content.')
      })
      .finally(() => setLoading(false))
  }, [activePath, token, wikiDocs])

  const handleNavigate = React.useCallback(
    (path: string) => {
      // Resolve relative paths
      if (activePath && !path.startsWith('/')) {
        const dir = activePath.includes('/')
          ? activePath.substring(0, activePath.lastIndexOf('/'))
          : ''
        const resolved = path.startsWith('./')
          ? (dir ? dir + '/' : '') + path.slice(2)
          : path
        setActivePath(resolved)
      } else {
        setActivePath(path.replace(/^\/wiki\/?/, ''))
      }
    },
    [activePath],
  )

  if (!wikiDocs.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
        <BookOpen className="size-10 text-muted-foreground/20" />
        <div className="text-center max-w-sm">
          <h3 className="text-base font-medium mb-1.5">No wiki yet</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Add some sources, then ask Claude to compile a wiki. It will read your sources, create summaries, cross-reference concepts, and maintain the whole thing.
          </p>
        </div>
        <a
          href="https://claude.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity mt-2"
        >
          Open Claude
          <ArrowUpRight className="size-3.5 opacity-60" />
        </a>
      </div>
    )
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
        <WikiSidenav
          tree={tree}
          activePath={activePath}
          onNavigate={setActivePath}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={78}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <WikiContent
            content={pageContent}
            title={pageTitle}
            onNavigate={handleNavigate}
          />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
