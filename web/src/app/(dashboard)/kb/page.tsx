'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useKBStore, useUserStore } from '@/stores'
import { Plus, FolderOpen, Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

export default function KnowledgeBasesPage() {
  const router = useRouter()
  const knowledgeBases = useKBStore((s) => s.knowledgeBases)
  const loading = useKBStore((s) => s.loading)
  const createKB = useKBStore((s) => s.createKB)
  const user = useUserStore((s) => s.user)
  const [creating, setCreating] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [name, setName] = React.useState('')

  const handleQuickCreate = async () => {
    setCreating(true)
    try {
      const email = user?.email || 'My'
      const displayName = email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1)
      const kb = await createKB(`${displayName}'s Knowledge Base`)
      router.push(`/kb/${kb.slug}`)
    } catch (err) {
      console.error('Failed to create KB:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const kb = await createKB(name.trim())
      setDialogOpen(false)
      setName('')
      router.push(`/kb/${kb.slug}`)
    } catch (err) {
      console.error('Failed to create KB:', err)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (knowledgeBases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-10 p-8 max-w-lg mx-auto">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Give Claude access to your knowledge.
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Upload your Obsidian vault or markdown files, then connect Claude
            so it can read, search, and build on your notes across every conversation.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleQuickCreate}
            disabled={creating}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            <Upload size={16} />
            {creating ? 'Setting up...' : 'Upload your notes'}
          </button>

          <button
            onClick={() => router.push('/settings')}
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
            </svg>
            Connect to Claude
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Supports .md files and Obsidian vaults with frontmatter.
          <br />
          Claude connects via MCP — works with Claude.ai, Desktop, and Code.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Knowledge Bases</h1>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            New
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {knowledgeBases.map((kb) => (
            <button
              key={kb.id}
              onClick={() => router.push(`/kb/${kb.slug}`)}
              className="flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer text-left group overflow-hidden"
            >
              <div className="flex items-center gap-3 min-w-0 w-full">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted group-hover:bg-accent transition-colors flex-shrink-0">
                  <FolderOpen size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-medium text-foreground truncate">{kb.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(kb.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </button>
          ))}

          <button
            onClick={() => setDialogOpen(true)}
            className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-accent/30 transition-colors cursor-pointer min-h-[88px]"
          >
            <Plus size={16} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">New Knowledge Base</span>
          </button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create knowledge base</DialogTitle>
          </DialogHeader>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="My Research"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
