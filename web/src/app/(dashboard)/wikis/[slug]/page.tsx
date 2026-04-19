import { KBPortal } from '@/components/kb/KBPortal'
import { KnowledgeBaseStoreHydrator } from '@/components/kb/KnowledgeBaseStoreHydrator'
import { listDocuments, listKnowledgeBases } from '@/lib/server/llmwiki'

export default async function KBPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const knowledgeBases = await listKnowledgeBases()
  const kb = knowledgeBases.find((item) => item.slug === slug)

  if (!kb) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 bg-background">
        <h1 className="text-lg font-medium">Wiki not found</h1>
        <p className="text-sm text-muted-foreground">
          The wiki &ldquo;{slug}&rdquo; does not exist or you don&apos;t have access.
        </p>
      </div>
    )
  }

  const documents = await listDocuments(kb.id)

  return (
    <>
      <KnowledgeBaseStoreHydrator knowledgeBases={knowledgeBases} />
      <KBPortal
        kbId={kb.id}
        kbSlug={kb.slug}
        kbName={kb.name}
        initialDocuments={documents}
      />
    </>
  )
}
