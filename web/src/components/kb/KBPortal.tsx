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
  NotepadText,
  Plus,
  Search,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { buildDocumentPath, toDocumentSummary, toWikiRoute } from '@/lib/documents'
import { useUserStore } from '@/stores'
import type { DocumentListItem, DocumentSummary } from '@/lib/types'

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

function sortDocs(docs: DocumentSummary[]): DocumentSummary[] {
  return [...docs].sort((a, b) => {
    const left = a.sort_order ?? 999
    const right = b.sort_order ?? 999
    const pathCompare = buildDocumentPath(a.path, a.filename).localeCompare(buildDocumentPath(b.path, b.filename))
    return left - right || pathCompare || (a.title || a.filename).localeCompare(b.title || b.filename)
  })
}

function sectionLabel(doc: DocumentSummary): string {
  const relative = buildDocumentPath(doc.path, doc.filename).replace(/^\/wiki\/?/, '')
  const [first] = relative.split('/')
  if (!relative.includes('/')) return 'Core'
  return first.replace(/[-_]/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase())
}

function relativeWikiPath(doc: DocumentSummary): string {
  return buildDocumentPath(doc.path, doc.filename).replace(/^\/wiki\/?/, '')
}

function sourceMeta(doc: DocumentSummary): string {
  const parts = [doc.file_type.toUpperCase()]
  if (doc.path && doc.path !== '/') parts.push(doc.path)
  return parts.join(' · ')
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

type Props = {
  kbId: string
  kbSlug: string
  kbName: string
  initialDocuments?: DocumentSummary[]
}

export function KBPortal({ kbId, kbSlug, kbName, initialDocuments }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [documents, setDocuments] = React.useState<DocumentSummary[]>(() => initialDocuments ?? [])

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
  }, [docParam, documents, kbSlug, pageParam, router])

  const featuredPages = React.useMemo(() => {
    const preferredOrder = ['overview.md', 'log.md']
      const preferred = preferredOrder
      .map((name) => wikiDocs.find((doc) => doc.filename === name && doc.path === '/wiki/'))
      .filter((doc): doc is DocumentSummary => Boolean(doc))
    const remaining = wikiDocs.filter((doc) => !preferred.includes(doc)).slice(0, 6)
    return [...preferred, ...remaining]
  }, [wikiDocs])

  const sections = React.useMemo(() => {
    const counts = new Map<string, { count: number; doc: DocumentSummary }>()
    for (const doc of wikiDocs) {
      const label = sectionLabel(doc)
      const current = counts.get(label)
      if (current) {
        current.count += 1
      } else {
        counts.set(label, { count: 1, doc })
      }
    }

    return Array.from(counts.entries())
      .map(([label, value]) => ({
        label,
        count: value.count,
        href: toWikiRoute(kbSlug, buildDocumentPath(value.doc.path, value.doc.filename)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [kbSlug, wikiDocs])

  const recentDocs = React.useMemo(
    () =>
      [...wikiDocs, ...sourceDocs]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 10),
    [sourceDocs, wikiDocs],
  )

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
      setDocuments((prev) => [toDocumentSummary(doc), ...prev])
      router.push(toWikiRoute(kbSlug, buildDocumentPath(doc.path, doc.filename)))
    } catch {
      toast.error('Failed to create note')
    }
  }

  const uploadFiles = React.useCallback(async (files: File[]) => {
    const currentToken = getToken()
    if (!currentToken) return

    const uploaded: DocumentSummary[] = []
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
        uploaded.push(toDocumentSummary(doc))
      } catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    if (uploaded.length > 0) {
      setDocuments((prev) => [...uploaded, ...prev])
      toast.success(`${uploaded.length} file(s) uploaded`)
    }
  }, [getToken, kbId])

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
          <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-2 text-xs text-muted-foreground">
            <span>Wiki Portal</span>
            <span>{wikiDocs.length + sourceDocs.length} documents indexed</span>
          </div>
          <div className="px-4 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="wiki-section-label mb-2">Top Page</p>
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                  <h1 className="wiki-heading text-4xl leading-none sm:text-5xl">{kbName}</h1>
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">/{kbSlug}</span>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Portal index for articles, notes, and uploaded source files. Use this page as the entry point instead
                  of the old sidebar.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                <button
                  onClick={handleUploadClick}
                  className="inline-flex items-center gap-2 border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted cursor-pointer"
                >
                  <Upload className="size-4" />
                  Upload sources
                </button>
                <button
                  onClick={handleCreateNote}
                  className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted cursor-pointer"
                >
                  <Plus className="size-4" />
                  Create note
                </button>
                <button
                  onClick={() => {
                    const overview = wikiDocs.find((doc) => doc.path === '/wiki/' && doc.filename === 'overview.md')
                    if (overview) router.push(toWikiRoute(kbSlug, buildDocumentPath(overview.path, overview.filename)))
                  }}
                  className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted cursor-pointer"
                >
                  <Search className="size-4" />
                  Open overview
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="border border-border bg-background px-4 py-3">
                <div className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,140px))_minmax(0,1fr)]">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Wiki pages</div>
                    <div className="mt-1 wiki-heading text-3xl">{wikiDocs.length}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Source files</div>
                    <div className="mt-1 wiki-heading text-3xl">{sourceDocs.length}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sections</div>
                    <div className="mt-1 wiki-heading text-3xl">{sections.length}</div>
                  </div>
                  <div className="border-t border-border pt-3 sm:border-t-0 sm:pt-0 xl:border-l xl:border-t-0 xl:pl-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Latest update</div>
                    <div className="mt-1 truncate text-sm font-medium text-foreground">
                      {recentDocs[0] ? recentDocs[0].title || recentDocs[0].filename : 'No documents yet'}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {recentDocs[0] ? formatUpdatedAt(recentDocs[0].updated_at) : 'Create or upload a file to begin'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-border bg-background px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Quick Index</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sections.slice(0, 8).map((section) => (
                    <Link
                      key={section.label}
                      href={section.href}
                      className="inline-flex items-center gap-2 border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted/45"
                    >
                      <span>{section.label}</span>
                      <span className="text-muted-foreground">{section.count}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_320px]">
          <div className="wiki-paper xl:col-span-2">
            <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-2">
              <h2 className="wiki-heading text-[1.45rem]">Featured Pages</h2>
              <span className="text-xs text-muted-foreground">{featuredPages.length} entries</span>
            </div>
            {featuredPages.length === 0 ? (
              <div className="px-4 py-4 text-sm text-muted-foreground">No wiki pages yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-background text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="border-b border-border px-4 py-2 font-medium">Page</th>
                      <th className="border-b border-border px-4 py-2 font-medium">Section</th>
                      <th className="border-b border-border px-4 py-2 font-medium">Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {featuredPages.map((doc) => (
                      <tr key={doc.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-3">
                          <Link
                            href={toWikiRoute(kbSlug, buildDocumentPath(doc.path, doc.filename))}
                            className="group inline-flex min-w-0 items-center gap-2 text-foreground hover:text-foreground"
                          >
                            <BookOpen className="size-4 text-muted-foreground group-hover:text-foreground" />
                            <span className="truncate font-medium">
                              {doc.title || doc.filename.replace(/\.(md|txt)$/i, '')}
                            </span>
                            <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground" />
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{sectionLabel(doc)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{relativeWikiPath(doc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="wiki-paper">
            <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-2">
              <h2 className="wiki-heading text-[1.45rem]">Sections</h2>
              <span className="text-xs text-muted-foreground">{sections.length}</span>
            </div>
            <div className="divide-y divide-border">
              {sections.map((section) => (
                <Link
                  key={section.label}
                  href={section.href}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/35"
                >
                  <span className="truncate text-sm font-medium text-foreground">{section.label}</span>
                  <span className="wiki-heading text-xl">{section.count}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="wiki-paper xl:col-span-2">
            <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-2">
              <h2 className="wiki-heading text-[1.45rem]">All Wiki Pages</h2>
              <span className="text-xs text-muted-foreground">{wikiDocs.length} pages</span>
            </div>
            {wikiDocs.length === 0 ? (
              <div className="px-4 py-4 text-sm text-muted-foreground">No wiki pages yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-background text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="border-b border-border px-4 py-2 font-medium">Title</th>
                      <th className="border-b border-border px-4 py-2 font-medium">Section</th>
                      <th className="border-b border-border px-4 py-2 font-medium">Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wikiDocs.map((doc) => (
                      <tr key={doc.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2.5">
                          <Link
                            href={toWikiRoute(kbSlug, buildDocumentPath(doc.path, doc.filename))}
                            className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground transition-colors hover:text-foreground"
                          >
                            <FileText className="size-4 text-muted-foreground" />
                            <span className="truncate">{doc.title || doc.filename.replace(/\.(md|txt)$/i, '')}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{sectionLabel(doc)}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{relativeWikiPath(doc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="wiki-paper">
              <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-2">
                <h2 className="wiki-heading text-[1.45rem]">Recent Files</h2>
                <span className="text-xs text-muted-foreground">{recentDocs.length}</span>
              </div>
              <div className="divide-y divide-border">
                {recentDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={toWikiRoute(kbSlug, buildDocumentPath(doc.path, doc.filename))}
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/35"
                  >
                    <NotepadText className="mt-0.5 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{doc.title || doc.filename}</div>
                      <div className="truncate text-xs text-muted-foreground">{formatUpdatedAt(doc.updated_at)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="wiki-paper">
              <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-2">
                <h2 className="wiki-heading text-[1.45rem]">Source Files</h2>
                <span className="text-xs text-muted-foreground">{sourceDocs.length}</span>
              </div>
              <div className="divide-y divide-border">
                {sourceDocs.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-muted-foreground">
                    No source files yet. Upload markdown or text notes to start.
                  </div>
                ) : (
                  sourceDocs.slice(0, 12).map((doc) => (
                    <Link
                      key={doc.id}
                      href={toWikiRoute(kbSlug, buildDocumentPath(doc.path, doc.filename))}
                      className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/35"
                    >
                      <FolderOpen className="mt-0.5 size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{doc.title || doc.filename}</div>
                        <div className="truncate text-xs text-muted-foreground">{sourceMeta(doc)}</div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
