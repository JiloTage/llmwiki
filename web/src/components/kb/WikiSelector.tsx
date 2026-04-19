'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronsUpDown, Plus } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandSeparator,
} from '@/components/ui/command'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useKBStore } from '@/stores'

export function WikiSelector({ kbName }: { kbName: string }) {
  const router = useRouter()
  const knowledgeBases = useKBStore((s) => s.knowledgeBases)
  const createKB = useKBStore((s) => s.createKB)
  const [open, setOpen] = React.useState(false)
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const kb = await createKB(newName.trim())
      setCreateDialogOpen(false)
      setNewName('')
      router.push(`/wikis/${kb.slug}`)
    } catch {
      // error handled by store
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="wiki-selector-trigger"
            className="w-full border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/55 cursor-pointer"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="wiki-heading text-[1.05rem] leading-none text-foreground">LLM Wiki</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{kbName}</div>
              </div>
              <ChevronsUpDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0 border-border" align="start">
          <Command>
            <CommandInput placeholder="Search wikis..." />
            <CommandList>
              <CommandEmpty>No matching wiki.</CommandEmpty>
              {knowledgeBases.map((kb) => (
                <CommandItem
                  key={kb.id}
                  value={kb.name}
                  onSelect={() => {
                    setOpen(false)
                    router.push(`/wikis/${kb.slug}`)
                  }}
                >
                  {kb.name}
                </CommandItem>
              ))}
            </CommandList>
            <CommandSeparator />
            <CommandList>
              <CommandItem
                onSelect={() => {
                  setOpen(false)
                  setCreateDialogOpen(true)
                }}
              >
                <Plus className="size-3.5 mr-2" />
                Create wiki
              </CommandItem>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="border-border">
          <DialogHeader>
            <DialogTitle className="wiki-heading text-xl">Create Wiki</DialogTitle>
          </DialogHeader>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Wiki name"
            className="w-full border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
