'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2, Moon, Plus, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { apiFetch } from '@/lib/api'
import { LOCAL_ACCESS_TOKEN } from '@/lib/local-user'
import type { KnowledgeBase } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function WikisPageClient({
  initialKnowledgeBases,
  initialUserEmail,
}: {
  initialKnowledgeBases: KnowledgeBase[]
  initialUserEmail: string
}) {
  const router = useRouter()
  const [knowledgeBases, setKnowledgeBases] = React.useState(initialKnowledgeBases)
  const [creating, setCreating] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [name, setName] = React.useState('')

  const createKB = React.useCallback(async (kbName: string) => {
    return apiFetch<KnowledgeBase>('/api/v1/knowledge-bases', LOCAL_ACCESS_TOKEN, {
      method: 'POST',
      body: JSON.stringify({ name: kbName }),
    })
  }, [])

  const handleQuickCreate = async () => {
    setCreating(true)
    try {
      const displayName = initialUserEmail.split('@')[0].charAt(0).toUpperCase() + initialUserEmail.split('@')[0].slice(1)
      const kb = await createKB(`${displayName} Wiki`)
      setKnowledgeBases((current) => [kb, ...current])
      router.push(`/wikis/${kb.slug}`)
    } catch (error) {
      console.error('Failed to create wiki:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const kb = await createKB(name.trim())
      setKnowledgeBases((current) => [kb, ...current])
      setDialogOpen(false)
      setName('')
      router.push(`/wikis/${kb.slug}`)
    } catch (error) {
      console.error('Failed to create wiki:', error)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-muted/55">
      <PageHeader initialUserEmail={initialUserEmail} onNew={() => setDialogOpen(true)} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {knowledgeBases.length === 0 ? (
            <div className="wiki-paper flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center border border-border bg-card">
                <BookOpen size={24} className="text-foreground" />
              </div>
              <h1 className="wiki-heading text-4xl">Create your first wiki</h1>
              <p className="mt-3 max-w-md text-base text-muted-foreground">
                Add a wiki, upload sources, and use the local MCP endpoint without any login flow.
              </p>
              <button
                onClick={handleQuickCreate}
                disabled={creating}
                data-testid="quick-create-wiki"
                className="mt-8 inline-flex items-center justify-center gap-2.5 border border-border bg-card px-8 py-3 text-sm font-medium hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={15} />
                    Create Wiki
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {knowledgeBases.map((kb) => {
                const stats: string[] = []
                if (kb.source_count > 0) stats.push(`${kb.source_count} source${kb.source_count !== 1 ? 's' : ''}`)
                if (kb.wiki_page_count > 0) stats.push(`${kb.wiki_page_count} page${kb.wiki_page_count !== 1 ? 's' : ''}`)

                return (
                  <button
                    key={kb.id}
                    onClick={() => router.push(`/wikis/${kb.slug}`)}
                    className="group flex cursor-pointer flex-col items-start gap-3 overflow-hidden border border-border bg-card p-5 text-left transition-colors hover:bg-muted/45"
                  >
                    <div className="flex w-full min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-border bg-background transition-colors group-hover:bg-muted">
                        <BookOpen size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="wiki-heading truncate text-[1.35rem] leading-none text-foreground">{kb.name}</h2>
                        {kb.description && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">{kb.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex w-full items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                      {stats.length > 0 ? (
                        <span>{stats.join(' ﾂｷ ')}</span>
                      ) : (
                        <span>No sources yet</span>
                      )}
                      <span className="ml-auto shrink-0 text-muted-foreground">
                        {relativeTime(kb.updated_at)}
                      </span>
                    </div>
                  </button>
                )
              })}

              <button
                onClick={() => setDialogOpen(true)}
                className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border bg-background p-5 transition-colors hover:bg-muted/35"
              >
                <Plus size={16} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">New Wiki</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <CreateWikiDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        name={name}
        onNameChange={setName}
        creating={creating}
        onCreate={handleCreate}
      />
    </div>
  )
}

function PageHeader({
  initialUserEmail,
  onNew,
}: {
  initialUserEmail: string
  onNew?: () => void
}) {
  return (
    <div className="shrink-0 flex h-12 items-center justify-between border-b border-border bg-background px-6">
      <span className="wiki-heading text-xl text-foreground">LLM Wiki</span>
      <div className="flex items-center gap-1">
        {onNew && (
          <button
            onClick={onNew}
            data-testid="open-create-wiki-dialog"
            className="flex items-center gap-1.5 border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <Plus className="size-3" />
            New
          </button>
        )}
        <HeaderUserMenu initialUserEmail={initialUserEmail} />
      </div>
    </div>
  )
}

function HeaderUserMenu({ initialUserEmail }: { initialUserEmail: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const initials = initialUserEmail.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="header-user-menu-trigger"
          className="flex h-6 w-6 items-center justify-center border border-border bg-card cursor-pointer hover:bg-muted transition-colors"
        >
          <span className="text-[9px] font-medium text-muted-foreground">{initials}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 border-border">
        <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">
          {initialUserEmail}
        </div>
        <DropdownMenuSeparator />
        {mounted && (
          <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? (
              <>
                <Sun className="mr-2 h-4 w-4" />
                Light Mode
              </>
            ) : (
              <>
                <Moon className="mr-2 h-4 w-4" />
                Dark Mode
              </>
            )}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CreateWikiDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  creating,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onNameChange: (name: string) => void
  creating: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border">
        <DialogHeader>
          <DialogTitle className="wiki-heading text-xl">Create Wiki</DialogTitle>
        </DialogHeader>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreate()}
          placeholder="Wiki name"
          data-testid="create-wiki-name-input"
          className="w-full border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
        <DialogFooter>
          <button
            onClick={onCreate}
            disabled={creating || !name.trim()}
            data-testid="submit-create-wiki"
            className="border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
