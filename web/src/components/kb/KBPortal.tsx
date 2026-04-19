'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  FileText,
  FolderOpen,
  Loader2,
  NotepadText,
  Plus,
  Search,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { useKBDocuments } from '@/hooks/useKBDocuments'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores'
import type { DocumentListItem } from '@/lib/types'

function buildDocumentPath(path: string, filename: string): string {
  return `${path}${filename}`.replace(/\/+/g, '/')
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

function toWikiRoute(slug: string, fullPath: string): string {
  const segments = fullPath.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return segments ? `/wikis/${slug}/${segments}` : `/wikis/${slug}`
}

function sortDocs(docs: DocumentListItem[]): DocumentListItem[] {
  return [...docs].sort((a, b) => {
    const left = a.sort_order ?? 999
    const right = b.sort_order ?? 999
    const pathCompare = buildDocumentPath(a.path, a.filename).localeCompare(buildDocumentPath(b.path, b.filename))
    return left - right || pathCompare || (a.title || a.filename).localeCompare(b.title || b.filename)
  })
}

function sectionLabel(doc: DocumentListItem): string {
  const relative = buildDocumentPath(doc.path, doc.filename).replace(/^\/wiki\/?/, '')
  const [first] = relative.split('/')
  if (!relative.includes('/')) return 'Core'
  return first.replace(/[-_]/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase())
}

function relativeWikiPath(doc: DocumentListItem): string {
  return buildDocumentPath(doc.path, doc.filename).replace(/^\/wiki\/?/, '')
}

function sourceMeta(doc: DocumentListItem): string {
  const parts = [doc.file_type.toUpperCase()]
  if (doc.path && doc.path !== '/') parts.push(doc.path)
  return parts.join(' · ')
}

type Props = {
  kbId: string
  kbSlug: string
  kbName: string
}

export function KBPortal({ kbId, kbSlug, kbName }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = useUserStore((s) => s.accessToken)
  const { documents, setDocuments, loading, refetchDocuments } = useKBDocuments(kbId)

  const wikiDocs = React.useMemo(
    () => sortDocs(documents.filter((doc) => doc.path.startsWith('/wiki/') && !doc.archived && doc.file_type === 'md')),
    [documents],
  )
  const sourceDocs = React.useMemo(
    () => sortDocs(documents.filter((doc) => !doc.path.startsWith('/wiki/') && !doc.archived)),
    [documents],
  )

  const pageParam = searchParams.get('page')
  const docParam = searchParams.get('doc')

  React.useEffect(() => {
    if (loading) return

    if (pageParam) {
      const nextPath = `/wiki/${normalizeWikiPath(pageParam)}`
      router.replace(toWikiRoute(kbSlug, nextPath))
      return
    }

    if (docParam) {
      const match = documents.find((doc) => doc.id === docParam)
      if (match) {
        router.replace(toWikiRoute(kbSlug, buildDocumentPath(match.path, match.filename)))
      }
    }
  }, [docParam, documents, kbSlug, loading, pageParam, router])

  const featuredPages = React.useMemo(() => {
    const preferredOrder = ['overview.md', 'log.md']
    const preferred = preferredOrder
      .map((name) => wikiDocs.find((doc) => doc.filename === name && doc.path === '/wiki/'))
      .filter((doc): doc is DocumentListItem => Boolean(doc))
    const remaining = wikiDocs.filter((doc) => !preferred.includes(doc)).slice(0, 6)
    return [...preferred, ...remaining]
  }, [wikiDocs])

  const sections = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const doc of wikiDocs) {
      const label = sectionLabel(doc)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [wikiDocs])

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
      router.push(toWikiRoute(kbSlug, buildDocumentPath(doc.path, doc.filename)))
    } catch {
      toast.error('Failed to create note')
    }
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/55">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/55">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between text-sm">
          <Link
            href="/wikis"
            className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            All wikis
          </Link>
          <div className="text-muted-foreground">/{kbSlug}</div>
        </div>

        <section className="wiki-paper">
          <div className="border-b border-border bg-muted/35 px-6 py-2 text-xs text-muted-foreground">
            Wiki Portal
          </div>
          <div className="grid gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <p className="wiki-section-label mb-3">Top Page</p>
              <h1 className="wiki-heading text-5xl leading-none">{kbName}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                This portal replaces the old sidebar. Open articles and source notes from here.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={handleUploadClick}
                  className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  <Upload className="size-4" />
                  Upload sources
                </button>
                <button
                  onClick={handleCreateNote}
                  className="inline-flex items-center gap-2 border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  <Plus className="size-4" />
                  Create note
                </button>
                <button
                  onClick={() => {
                    const overview = wikiDocs.find((doc) => doc.path === '/wiki/' && doc.filename === 'overview.md')
                    if (overview) router.push(toWikiRoute(kbSlug, buildDocumentPath(overview.path, overview.filename)))
                  }}
                  className="inline-flex items-center gap-2 border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  <Search className="size-4" />
                  Open overview
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="border border-border bg-background px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Wiki pages</div>
                <div className="mt-2 wiki-heading text-3xl">{wikiDocs.length}</div>
              </div>
              <div className="border border-border bg-background px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Source files</div>
                <div className="mt-2 wiki-heading text-3xl">{sourceDocs.length}</div>
              </div>
              <div className="border border-border bg-background px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sections</div>
                <div className="mt-2 wiki-heading text-3xl">{sections.length}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="wiki-paper">
              <div className="border-b border-border bg-muted/35 px-6 py-3">
                <h2 className="wiki-heading text-[1.7rem]">Featured Pages</h2>
              </div>
              <div className="grid gap-3 px-6 py-6 sm:grid-cols-2">
                {featuredPages.map((doc) => (
                  <Link
                    key={doc.id}
                    href={toWikiRoute(kbSlug, buildDocumentPath(doc.path, doc.filename))}
                    className="group border border-border bg-background px-4 py-4 transition-colors hover:bg-muted/45"
                  >
                    <div className="flex items-start gap-3">
                      <BookOpen className="mt-0.5 size-4 text-muted-foreground group-hover:text-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="wiki-heading truncate text-[1.35rem] leading-none text-foreground">
                          {doc.title || doc.filename.replace(/\.(md|txt)$/i, '')}
                        </div>
                        <div className="mt-2 truncate text-xs text-muted-foreground">
                          {relativeWikiPath(doc)}
                        </div>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="wiki-paper">
              <div className="border-b border-border bg-muted/35 px-6 py-3">
                <h2 className="wiki-heading text-[1.7rem]">All Wiki Pages</h2>
              </div>
              <div className="divide-y divide-border">
                {wikiDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={toWikiRoute(kbSlug, buildDocumentPath(doc.path, doc.filename))}
                    className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-muted/35"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {doc.title || doc.filename.replace(/\.(md|txt)$/i, '')}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{relativeWikiPath(doc)}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">{sectionLabel(doc)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="wiki-paper">
              <div className="border-b border-border bg-muted/35 px-6 py-3">
                <h2 className="wiki-heading text-[1.7rem]">Sections</h2>
              </div>
              <div className="grid gap-3 px-6 py-6">
                {sections.map(([label, count]) => (
                  <div key={label} className="border border-border bg-background px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-medium text-foreground">{label}</div>
                      <div className="wiki-heading text-2xl">{count}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="wiki-paper">
              <div className="border-b border-border bg-muted/35 px-6 py-3">
                <h2 className="wiki-heading text-[1.7rem]">Source Files</h2>
              </div>
              <div className="divide-y divide-border">
                {sourceDocs.length === 0 ? (
                  <div className="px-6 py-6 text-sm text-muted-foreground">
                    No source files yet. Upload markdown or text notes to start.
                  </div>
                ) : (
                  sourceDocs.map((doc) => (
                    <Link
                      key={doc.id}
                      href={toWikiRoute(kbSlug, buildDocumentPath(doc.path, doc.filename))}
                      className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-muted/35"
                    >
                      <FolderOpen className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {doc.title || doc.filename}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{sourceMeta(doc)}</div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="wiki-paper">
              <div className="border-b border-border bg-muted/35 px-6 py-3">
                <h2 className="wiki-heading text-[1.7rem]">Recent Files</h2>
              </div>
              <div className="divide-y divide-border">
                {[...wikiDocs, ...sourceDocs]
                  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                  .slice(0, 8)
                  .map((doc) => (
                    <Link
                      key={doc.id}
                      href={toWikiRoute(kbSlug, buildDocumentPath(doc.path, doc.filename))}
                      className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-muted/35"
                    >
                      <NotepadText className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {doc.title || doc.filename}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {new Date(doc.updated_at).toLocaleString()}
                        </div>
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
