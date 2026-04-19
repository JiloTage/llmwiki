import { KBPageView } from '@/components/kb/KBPageView'
import { KnowledgeBaseStoreHydrator } from '@/components/kb/KnowledgeBaseStoreHydrator'
import { getDocumentContent, listDocuments, listKnowledgeBases } from '@/lib/server/llmwiki'

function normalizeRequestedPath(pathSegments: string[] | undefined): string {
  if (!pathSegments || pathSegments.length === 0) return '/'
  return `/${pathSegments.map((segment) => decodeURIComponent(segment)).join('/')}`
}

function buildDocumentPath(path: string, filename: string): string {
  return `${path}${filename}`.replace(/\/+/g, '/')
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

  const documents = await listDocuments(kb.id)
  const document = documents.find((item) => buildDocumentPath(item.path, item.filename) === requestedPath) ?? null
  const initialPageContent = document ? (await getDocumentContent(document.id)).content : undefined

  return (
    <>
      <KnowledgeBaseStoreHydrator knowledgeBases={knowledgeBases} />
      <KBPageView
        kbId={kb.id}
        kbSlug={kb.slug}
        kbName={kb.name}
        requestedPath={requestedPath}
        initialDocuments={documents}
        initialPageContent={initialPageContent}
        initialPageContentDocumentId={document?.id ?? null}
      />
    </>
  )
}
