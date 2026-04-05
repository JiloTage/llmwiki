'use client'

import * as React from 'react'
import { ChevronRight, FileText, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WikiNode {
  title: string
  path?: string
  children?: WikiNode[]
}

interface WikiSidenavProps {
  tree: WikiNode[]
  activePath: string | null
  onNavigate: (path: string) => void
}

export function WikiSidenav({ tree, activePath, onNavigate }: WikiSidenavProps) {
  return (
    <div className="h-full overflow-y-auto py-3 px-2">
      <div className="space-y-0.5">
        {tree.map((node, i) => (
          <TreeNode
            key={node.path ?? node.title ?? i}
            node={node}
            depth={0}
            activePath={activePath}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  )
}

function TreeNode({
  node,
  depth,
  activePath,
  onNavigate,
}: {
  node: WikiNode
  depth: number
  activePath: string | null
  onNavigate: (path: string) => void
}) {
  const hasChildren = node.children && node.children.length > 0
  const isActive = node.path != null && node.path === activePath
  const [expanded, setExpanded] = React.useState(true)

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => {
            if (node.path) onNavigate(node.path)
            else setExpanded((e) => !e)
          }}
          className={cn(
            'flex items-center gap-1.5 w-full text-left text-sm rounded-md px-2 py-1.5 transition-colors cursor-pointer',
            isActive
              ? 'bg-accent text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
          <FolderOpen className="size-3.5 shrink-0 opacity-50" />
          <span className="truncate">{node.title}</span>
        </button>
        {expanded && (
          <div className="mt-0.5">
            {node.children!.map((child, i) => (
              <TreeNode
                key={child.path ?? child.title ?? i}
                node={child}
                depth={depth + 1}
                activePath={activePath}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => node.path && onNavigate(node.path)}
      className={cn(
        'flex items-center gap-1.5 w-full text-left text-sm rounded-md px-2 py-1.5 transition-colors cursor-pointer',
        isActive
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
      )}
      style={{ paddingLeft: `${depth * 12 + 8 + 18}px` }}
    >
      <FileText className="size-3.5 shrink-0 opacity-50" />
      <span className="truncate">{node.title}</span>
    </button>
  )
}
