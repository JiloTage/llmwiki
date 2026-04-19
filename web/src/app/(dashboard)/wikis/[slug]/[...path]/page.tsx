'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useKBStore, useUserStore } from '@/stores'
import { KBPageView } from '@/components/kb/KBPageView'

function normalizeRequestedPath(pathSegments: string[] | undefined): string {
  if (!pathSegments || pathSegments.length === 0) return '/'
  return `/${pathSegments.map((segment) => decodeURIComponent(segment)).join('/')}`
}

export default function FilePage() {
  const params = useParams<{ slug: string; path: string[] }>()
  const knowledgeBases = useKBStore((s) => s.knowledgeBases)
  const loading = useKBStore((s) => s.loading)
  const user = useUserStore((s) => s.user)
  const requestedPath = React.useMemo(() => normalizeRequestedPath(params.path), [params.path])

  const kb = React.useMemo(
    () => knowledgeBases.find((item) => item.slug === params.slug),
    [knowledgeBases, params.slug],
  )

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!kb) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-background">
        <h1 className="text-lg font-medium">Wiki not found</h1>
      </div>
    )
  }

  return (
    <KBPageView
      kbId={kb.id}
      kbSlug={kb.slug}
      kbName={kb.name}
      requestedPath={requestedPath}
    />
  )
}
