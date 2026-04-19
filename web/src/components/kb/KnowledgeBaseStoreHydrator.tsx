'use client'

import * as React from 'react'
import { useKBStore } from '@/stores'
import type { KnowledgeBase } from '@/lib/types'

export function KnowledgeBaseStoreHydrator({
  knowledgeBases,
}: {
  knowledgeBases: KnowledgeBase[]
}) {
  const hydrateKBs = useKBStore((s) => s.hydrateKBs)

  React.useEffect(() => {
    hydrateKBs(knowledgeBases)
  }, [hydrateKBs, knowledgeBases])

  return null
}
