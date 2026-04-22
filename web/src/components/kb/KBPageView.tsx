'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { buildDocumentPath, toPortalRoute, toWikiRoute } from '@/lib/documents'
import { NoteEditor } from '@/components/editor/NoteEditor'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { RenderedWikiContent } from '@/components/wiki/RenderedWikiContent'
import type { DocumentListItem, DocumentSummary, TocItem } from '@/lib/types'

function isNoteFile(doc: DocumentListItem): boolean {
  return doc.file_type === 'md' || doc.file_type === 'txt'
}

type Props = {
  kbSlug: string
  kbName: string
  requestedPath: string
  currentDocument: DocumentListItem | null
  documentSummaries: DocumentSummary[]
  relatedDocuments?: DocumentSummary[]
  initialDocumentContent?: string
  tocItems?: TocItem[]
  sourceCount?: number
  children?: React.ReactNode
}

export function KBPageView({
  kbSlug,
  kbName,
  requestedPath,
  currentDocument,
  documentSummaries,
  relatedDocuments = [],
  initialDocumentContent,
  tocItems = [],
  sourceCount = 0,
  children,
}: Props) {
  const router = useRouter()

  const sourceDocs = React.useMemo(
    () => documentSummaries.filter((doc) => !doc.path.startsWith('/wiki/') && !doc.archived),
    [documentSummaries],
  )

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

  if (!currentDocument) {
    return (
      <div className="h-full overflow-y-auto bg-muted/55 px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <Breadcrumbs
            className="mb-6"
            items={[
              { label: 'All wikis', href: '/wikis' },
              { label: kbName, href: toPortalRoute(kbSlug) },
              { label: 'Not found' },
            ]}
          />
          <div className="wiki-paper max-w-xl px-8 py-10 text-center">
            <h1 className="wiki-heading text-4xl">Document not found</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {requestedPath} does not exist in this wiki.
            </p>
            <Link
              href={toPortalRoute(kbSlug)}
              className="mt-6 inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <ChevronLeft className="size-4" />
              Back to {kbName}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (isNoteFile(currentDocument) && !currentDocument.path.startsWith('/wiki/')) {
    return (
      <div className="flex h-full flex-col bg-muted/55">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
          <Breadcrumbs
            items={[
              { label: 'All wikis', href: '/wikis' },
              { label: kbName, href: toPortalRoute(kbSlug) },
              { label: currentDocument.title ?? currentDocument.filename },
            ]}
          />
        </div>
        <div className="min-h-0 flex-1">
          <NoteEditor
            documentId={currentDocument.id}
            initialContent={initialDocumentContent}
            initialTitle={currentDocument.title ?? currentDocument.filename}
            initialTags={currentDocument.tags}
            initialDate={currentDocument.date}
            initialProperties={(currentDocument.metadata?.properties as Record<string, unknown> | undefined) ?? undefined}
            backLabel={kbName}
            onBack={() => router.push(toPortalRoute(kbSlug))}
          />
        </div>
      </div>
    )
  }

  return (
    <RenderedWikiContent
      title={currentDocument.title || currentDocument.filename.replace(/\.(md|txt)$/i, '')}
      path={requestedPath.replace(/^\/wiki\/?/, '')}
      kbName={kbName}
      kbSlug={kbSlug}
      tocItems={tocItems}
      sourceCount={sourceCount}
      onSourceClick={handleCitationSourceClick}
    >
      <>
        {children}
        {relatedDocuments.length > 0 ? (
          <section className="mt-12 border-t border-border pt-6">
            <p className="wiki-heading mb-3 text-base text-foreground">Related articles</p>
            <div className="flex flex-wrap gap-2">
              {relatedDocuments.map((doc) => (
                <Link
                  key={doc.id}
                  href={toWikiRoute(kbSlug, buildDocumentPath(doc.path, doc.filename))}
                  className="border border-border bg-background px-3 py-1.5 text-sm text-accent-blue transition-colors hover:bg-muted hover:underline"
                >
                  {doc.title || doc.filename.replace(/\.(md|txt)$/i, '')}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </>
    </RenderedWikiContent>
  )
}
