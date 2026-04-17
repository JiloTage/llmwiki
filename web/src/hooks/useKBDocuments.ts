'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores'
import type { DocumentListItem } from '@/lib/types'

export function useKBDocuments(knowledgeBaseId: string) {
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const token = useUserStore((s) => s.accessToken)

  const fetchDocuments = React.useCallback(async () => {
    if (!knowledgeBaseId || !token) {
      setDocuments([])
      setLoading(false)
      return
    }

    try {
      const data = await apiFetch<DocumentListItem[]>(
        `/v1/knowledge-bases/${knowledgeBaseId}/documents`,
        token,
      )
      setDocuments(data ?? [])
    } catch (error) {
      console.error('Failed to load documents:', error)
      toast.error('ドキュメントの読み込みに失敗しました')
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [knowledgeBaseId, token])

  React.useEffect(() => {
    setLoading(true)
    void fetchDocuments()
  }, [fetchDocuments])

  React.useEffect(() => {
    if (!knowledgeBaseId || !token) return
    const interval = window.setInterval(() => {
      void fetchDocuments()
    }, 5000)
    return () => window.clearInterval(interval)
  }, [fetchDocuments, knowledgeBaseId, token])

  const refetchDocuments = React.useCallback(() => {
    void fetchDocuments()
  }, [fetchDocuments])

  return { documents, setDocuments, loading, refetchDocuments }
}
