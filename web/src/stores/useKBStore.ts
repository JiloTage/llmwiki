import { create } from 'zustand'
import { apiFetch } from '@/lib/api'
import type { KnowledgeBase } from '@/lib/types'

type KBState = {
  knowledgeBases: KnowledgeBase[]
  loading: boolean
  error: string | null
  hydrateKBs: (knowledgeBases: KnowledgeBase[]) => void
  fetchKBs: () => Promise<KnowledgeBase[]>
  createKB: (name: string, description?: string) => Promise<KnowledgeBase>
  deleteKB: (id: string) => Promise<void>
  renameKB: (id: string, name: string) => Promise<void>
}

export const useKBStore = create<KBState>((set, get) => ({
  knowledgeBases: [],
  loading: false,
  error: null,

  hydrateKBs: (knowledgeBases) => {
    set({ knowledgeBases, loading: false, error: null })
  },

  fetchKBs: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<KnowledgeBase[]>('/api/v1/knowledge-bases')
      set({ knowledgeBases: data, loading: false })
      return data
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
      return []
    }
  },

  createKB: async (name: string, description?: string) => {
    const kb = await apiFetch<KnowledgeBase>('/api/v1/knowledge-bases', {
      method: 'POST',
      body: JSON.stringify({ name, description: description || undefined }),
    })
    set({ knowledgeBases: [kb, ...get().knowledgeBases] })
    return kb
  },

  deleteKB: async (id: string) => {
    await apiFetch(`/api/v1/knowledge-bases/${id}`, { method: 'DELETE' })
    set({ knowledgeBases: get().knowledgeBases.filter((kb) => kb.id !== id) })
  },

  renameKB: async (id: string, name: string) => {
    const updated = await apiFetch<KnowledgeBase>(`/api/v1/knowledge-bases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
    set({
      knowledgeBases: get().knowledgeBases.map((kb) => (kb.id === id ? updated : kb)),
    })
  },
}))
