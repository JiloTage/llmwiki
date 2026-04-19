import { KBPageView } from '@/components/kb/KBPageView'
import { KnowledgeBaseStoreHydrator } from '@/components/kb/KnowledgeBaseStoreHydrator'
import { listKnowledgeBases, listDocumentSummaries, getDocumentByPath, getDocumentContent } from '@/lib/server/llmwiki'
import { renderWikiPage } from '@/lib/server/wiki-render'
import type { DocumentSummary } from '@/lib/types'
import { extractImageSources } from '@/lib/wiki'

function normalizeRequestedPath(pathSegments: string[] | undefined): string {
  if (!pathSegments || pathSegments.length === 0) return '/'
  return `/${pathSegments.map((segment) => decodeURIComponent(segment)).join('/')}`
}

function findAssetDocument(documents: DocumentSummary[], source: string) {
  const normalized = source.replace(/^\.\//, '')
  const basename = normalized.split('/').pop()?.toLowerCase() ?? normalized.toLowerCase()
  return documents.find((doc) => (
    doc.filename.toLowerCase() === normalized.toLowerCase() ||
    doc.filename.toLowerCase() === basename
  ))
}

function assetMimeType(fileType: string) {
  switch (fileType) {
    case 'svg':
      return 'image/svg+xml'
    case 'csv':
      return 'text/csv'
    case 'xml':
      return 'application/xml'
    case 'html':
      return 'text/html'
    default:
      return 'text/plain'
  }
}

async function buildResolvedAssets(content: string, documents: DocumentSummary[]) {
  const resolvedAssets: Record<string, string> = {}

  for (const source of extractImageSources(content)) {
    if (source.startsWith('http') || source.startsWith('data:')) continue

    const doc = findAssetDocument(documents, source)
    if (!doc) continue
    if (!['svg', 'csv', 'xml', 'html'].includes(doc.file_type)) continue

    const asset = await getDocumentContent(doc.id)
    resolvedAssets[source] = `data:${assetMimeType(doc.file_type)};charset=utf-8,${encodeURIComponent(asset.content)}`
  }

  return resolvedAssets
}

export default async function FilePage({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>
}) {
  const { slug, path } = await params
  const requestedPath = normalizeRequestedPath(path)
  const knowledgeBases = await listKnowledgeBases()
  const kb = knowledgeBases.find((item) => item.slug === slug)

  if (!kb) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-background">
        <h1 className="text-lg font-medium">Wiki not found</h1>
      </div>
    )
  }

  const documentSummaries = await listDocumentSummaries(kb.id)
  const currentDocument = await getDocumentByPath(kb.id, requestedPath)
  const initialDocumentContent = currentDocument?.content ?? undefined

  const renderedWiki = currentDocument && currentDocument.path.startsWith('/wiki/') && initialDocumentContent !== undefined
    ? renderWikiPage({
        content: initialDocumentContent,
        title: currentDocument.title || currentDocument.filename.replace(/\.(md|txt)$/i, ''),
        currentPath: requestedPath,
        kbSlug: kb.slug,
        documents: documentSummaries,
        resolvedAssets: await buildResolvedAssets(initialDocumentContent, documentSummaries),
      })
    : null

  return (
    <>
      <KnowledgeBaseStoreHydrator knowledgeBases={knowledgeBases} />
      <KBPageView
        kbSlug={kb.slug}
        kbName={kb.name}
        requestedPath={requestedPath}
        currentDocument={currentDocument}
        documentSummaries={documentSummaries}
        initialDocumentContent={initialDocumentContent}
        tocItems={renderedWiki?.tocItems}
        sourceCount={renderedWiki?.sourceCount}
      >
        {renderedWiki?.body}
      </KBPageView>
    </>
  )
}
