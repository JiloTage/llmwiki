'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import type { DocumentListItem } from '@/lib/types'

export function useKBDocuments(knowledgeBaseId: string, initialDocuments?: DocumentListItem[]) {
  const [documents, setDocuments] = React.useState<DocumentListItem[]>(() => initialDocuments ?? [])
  const [loading, setLoading] = React.useState(initialDocuments === undefined)

  const fetchDocuments = React.useCallback(async () => {
    if (!knowledgeBaseId) {
      setDocuments([])
      setLoading(false)
      return
    }

    try {
      const data = await apiFetch<DocumentListItem[]>(`/api/v1/knowledge-bases/${knowledgeBaseId}/documents`)
      setDocuments(data ?? [])
    } catch (error) {
      console.error('Failed to load documents:', error)
      toast.error('ドキュメントの読み込みに失敗しました')
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [knowledgeBaseId])

  React.useEffect(() => {
    if (initialDocuments !== undefined) return
    setLoading(true)
    void fetchDocuments()
  }, [fetchDocuments, initialDocuments])

  const refetchDocuments = React.useCallback(() => {
    void fetchDocuments()
  }, [fetchDocuments])

  return { documents, setDocuments, loading, refetchDocuments }
}
