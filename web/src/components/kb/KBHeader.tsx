'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Search,
  NotepadText, Folder, Upload, X,
  MoreHorizontal, ArrowUpDown, List, LayoutGrid,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { UserMenu } from '@/components/layout/UserMenu'

type Props = {
  kbName: string
  breadcrumbs: { label: string; path: string }[]
  onNavigate: (path: string) => void
  onGoBack: () => void
  onGoForward: () => void
  canGoBack: boolean
  canGoForward: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  viewMode: 'list' | 'grid'
  onViewModeChange: (mode: 'list' | 'grid') => void
  sortField: 'name' | 'date'
  sortDir: 'asc' | 'desc'
  onSortChange: (field: 'name' | 'date') => void
  onCreateNote: () => void
  onCreateFolder: () => void
  onUpload: () => void
  activeTab?: 'wiki' | 'sources'
  onTabChange?: (tab: 'wiki' | 'sources') => void
}

export function KBHeader({
  kbName,
  breadcrumbs,
  onNavigate,
  onGoBack,
  onGoForward,
  canGoBack,
  canGoForward,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortField,
  sortDir,
  onSortChange,
  onCreateNote,
  onCreateFolder,
  onUpload,
  activeTab,
  onTabChange,
}: Props) {
  const router = useRouter()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [searchOpen])

  const handleSearchClose = () => {
    onSearchChange('')
    setSearchOpen(false)
  }

  return (
    <div className="flex items-center gap-1.5 mb-4 flex-shrink-0">
      <button
        onClick={onGoBack}
        disabled={!canGoBack}
        className={cn(
          'p-1 rounded transition-colors',
          canGoBack ? 'hover:bg-accent cursor-pointer text-foreground' : 'text-muted-foreground/30 cursor-default',
        )}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        onClick={onGoForward}
        disabled={!canGoForward}
        className={cn(
          'p-1 rounded transition-colors',
          canGoForward ? 'hover:bg-accent cursor-pointer text-foreground' : 'text-muted-foreground/30 cursor-default',
        )}
      >
        <ChevronRight className="size-4" />
      </button>

      <nav className="flex items-center gap-1 text-sm min-w-0 mr-auto overflow-hidden">
        <button
          onClick={() => router.push('/kb')}
          className={cn(
            'px-1.5 py-0.5 rounded transition-colors cursor-pointer truncate',
            breadcrumbs.length > 1
              ? 'text-muted-foreground hover:text-foreground hover:bg-accent'
              : 'text-foreground font-medium',
          )}
        >
          {kbName}
        </button>
        {breadcrumbs.slice(1).map((crumb, i) => (
          <React.Fragment key={crumb.path}>
            <span className="text-muted-foreground/40">/</span>
            <button
              onClick={() => onNavigate(crumb.path)}
              className={cn(
                'px-1.5 py-0.5 rounded transition-colors cursor-pointer truncate',
                i === breadcrumbs.length - 2
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              {crumb.label}
            </button>
          </React.Fragment>
        ))}
      </nav>

      {activeTab && onTabChange && (
        <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
          <button
            onClick={() => onTabChange('wiki')}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer',
              activeTab === 'wiki' ? 'bg-card shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Wiki
          </button>
          <button
            onClick={() => onTabChange('sources')}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer',
              activeTab === 'sources' ? 'bg-card shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Sources
          </button>
        </div>
      )}

      {activeTab !== 'wiki' && (
        <>
          <div
            className={cn(
              'relative flex items-center rounded-md transition-all duration-200 ease-in-out overflow-hidden',
              searchOpen ? 'w-48 bg-muted/50 border border-border' : 'w-7',
            )}
          >
            <button
              onClick={() => !searchOpen && setSearchOpen(true)}
              className={cn(
                'flex-shrink-0 p-1.5 text-muted-foreground transition-colors cursor-pointer',
                !searchOpen && 'hover:text-foreground hover:bg-accent rounded-md',
              )}
            >
              <Search className="size-3.5" />
            </button>
            {searchOpen && (
              <>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') handleSearchClose() }}
                  onBlur={() => { if (!searchQuery) handleSearchClose() }}
                  className="flex-1 min-w-0 pr-6 py-1 text-sm bg-transparent placeholder:text-muted-foreground/60 focus:outline-none"
                />
                <button
                  onClick={handleSearchClose}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors cursor-pointer">
                New
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCreateNote}>
                <NotepadText className="size-3.5 mr-2" />
                Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCreateFolder}>
                <Folder className="size-3.5 mr-2" />
                Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onUpload}>
                <Upload className="size-3.5 mr-2" />
                Upload Files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors cursor-pointer">
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSortChange('name')}>
                <ArrowUpDown className="size-3.5 mr-2" />
                Sort by name {sortField === 'name' ? (sortDir === 'asc' ? '(A-Z)' : '(Z-A)') : ''}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange('date')}>
                <ArrowUpDown className="size-3.5 mr-2" />
                Sort by date {sortField === 'date' ? (sortDir === 'asc' ? '(oldest)' : '(newest)') : ''}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onViewModeChange('list')}>
                <List className="size-3.5 mr-2" />
                List view {viewMode === 'list' ? '(active)' : ''}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewModeChange('grid')}>
                <LayoutGrid className="size-3.5 mr-2" />
                Grid view {viewMode === 'grid' ? '(active)' : ''}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      <UserMenu />
    </div>
  )
}
