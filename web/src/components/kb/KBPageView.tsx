'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useKBDocuments } from '@/hooks/useKBDocuments'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores'
import { NoteEditor } from '@/components/editor/NoteEditor'
import { WikiContent } from '@/components/wiki/WikiContent'
import type { DocumentListItem } from '@/lib/types'

function buildDocumentPath(path: string, filename: string): string {
  return `${path}${filename}`.replace(/\/+/g, '/')
}

function isNoteFile(doc: DocumentListItem): boolean {
  return doc.file_type === 'md' || doc.file_type === 'txt'
}

function toWikiRoute(slug: string, fullPath: string): string {
  const segments = fullPath.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return segments ? `/wikis/${slug}/${segments}` : `/wikis/${slug}`
}

function resolveDocumentPath(currentPath: string, href: string): string {
  if (href.startsWith('/')) return href

  const baseParts = currentPath.split('/').filter(Boolean)
  baseParts.pop()

  for (const part of href.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      baseParts.pop()
    } else {
      baseParts.push(part)
    }
  }

  return `/${baseParts.join('/')}`
}

type Props = {
  kbId: string
  kbSlug: string
  kbName: string
  requestedPath: string
  initialDocuments?: DocumentListItem[]
  initialPageContent?: string
  initialPageContentDocumentId?: string | null
}

export function KBPageView({
  kbId,
  kbSlug,
  kbName,
  requestedPath,
  initialDocuments,
  initialPageContent,
  initialPageContentDocumentId,
}: Props) {
  const router = useRouter()
  const token = useUserStore((s) => s.accessToken)
  const { documents, loading } = useKBDocuments(kbId, initialDocuments)
  const [pageContent, setPageContent] = React.useState(initialPageContent ?? '')
  const [pageLoading, setPageLoading] = React.useState(false)
  const [loadedDocumentId, setLoadedDocumentId] = React.useState<string | null>(
    initialPageContentDocumentId ?? null,
  )

  const document = React.useMemo(
    () => documents.find((item) => buildDocumentPath(item.path, item.filename) === requestedPath) ?? null,
    [documents, requestedPath],
  )

  const sourceDocs = React.useMemo(
    () => documents.filter((doc) => !doc.path.startsWith('/wiki/') && !doc.archived),
    [documents],
  )

  React.useEffect(() => {
    if (!token || !document || !document.path.startsWith('/wiki/')) {
      setPageContent('')
      setLoadedDocumentId(null)
      return
    }
    if (loadedDocumentId === document.id) return

    setPageLoading(true)
    apiFetch<{ content: string }>(`/api/v1/documents/${document.id}/content`, token)
      .then((response) => {
        setPageContent(response.content || '')
        setLoadedDocumentId(document.id)
      })
      .catch(() => setPageContent('Failed to load this wiki page.'))
      .finally(() => setPageLoading(false))
  }, [document, loadedDocumentId, token])

  const handleWikiNavigate = React.useCallback((href: string) => {
    const nextPath = resolveDocumentPath(requestedPath, href)
    router.push(toWikiRoute(kbSlug, nextPath))
  }, [kbSlug, requestedPath, router])

  const handleCitationSourceClick = React.useCallback((source: string) => {
    const filename = source.replace(/,\s*p\.?\s*.+$/, '').trim().toLowerCase()
    const match = sourceDocs.find((doc) => {
      const title = (doc.title || '').toLowerCase()
      return doc.filename.toLowerCase() === filename || title === filename
    })
    if (match) {
      router.push(toWikiRoute(kbSlug, buildDocumentPath(match.path, match.filename)))
    }
  }, [kbSlug, router, sourceDocs])

  if (loading || (document?.path.startsWith('/wiki/') && pageLoading)) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/55">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/55 px-6">
        <div className="wiki-paper max-w-xl px-8 py-10 text-center">
          <h1 className="wiki-heading text-4xl">Document not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {requestedPath} does not exist in this wiki.
          </p>
          <Link
            href={`/wikis/${kbSlug}`}
            className="mt-6 inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ChevronLeft className="size-4" />
            Back to {kbName}
          </Link>
        </div>
      </div>
    )
  }

  if (isNoteFile(document) && !document.path.startsWith('/wiki/')) {
    return (
      <div className="h-full bg-muted/55">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <Link
            href={`/wikis/${kbSlug}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Back to {kbName}
          </Link>
        </div>
        <div className="h-[calc(100%-3.5rem)]">
          <NoteEditor
            documentId={document.id}
            initialContent={initialPageContentDocumentId === document.id ? initialPageContent : undefined}
            initialTitle={document.title ?? document.filename}
            initialTags={document.tags}
            initialDate={document.date}
            initialProperties={(document.metadata?.properties as Record<string, unknown> | undefined) ?? undefined}
            backLabel={kbName}
            onBack={() => router.push(`/wikis/${kbSlug}`)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-muted/55">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <Link
          href={`/wikis/${kbSlug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to {kbName}
        </Link>
      </div>
      <div className="h-[calc(100%-3.5rem)]">
        <WikiContent
          content={pageContent}
          title={document.title || document.filename.replace(/\.(md|txt)$/i, '')}
          path={requestedPath.replace(/^\/wiki\/?/, '')}
          kbName={kbName}
          onNavigate={handleWikiNavigate}
          onSourceClick={handleCitationSourceClick}
          documents={documents}
        />
      </div>
    </div>
  )
}
