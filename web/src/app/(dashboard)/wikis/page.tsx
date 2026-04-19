import { LOCAL_USER_EMAIL } from '@/lib/local-user'
import { listKnowledgeBases } from '@/lib/server/llmwiki'
import { KnowledgeBaseStoreHydrator } from '@/components/kb/KnowledgeBaseStoreHydrator'
import { WikisPageClient } from '@/components/kb/WikisPageClient'

export const dynamic = 'force-dynamic'

export default async function WikisPage() {
  const knowledgeBases = await listKnowledgeBases()

  return (
    <>
      <KnowledgeBaseStoreHydrator knowledgeBases={knowledgeBases} />
      <WikisPageClient
        initialKnowledgeBases={knowledgeBases}
        initialUserEmail={LOCAL_USER_EMAIL}
      />
    </>
  )
}
