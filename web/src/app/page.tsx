'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpen, FileText, Search } from 'lucide-react'
import { useUserStore } from '@/stores'

export default function LandingPage() {
  const user = useUserStore((state) => state.user)
  const router = useRouter()

  React.useEffect(() => {
    if (user) router.replace('/wikis')
  }, [user, router])

  return (
    <div className="min-h-svh bg-muted/55 text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="wiki-paper">
          <div className="border-b border-border bg-muted/35 px-6 py-2 text-xs text-muted-foreground">
            Main Page
          </div>
          <div className="px-6 py-10">
            <p className="wiki-section-label mb-4">LLM Wiki</p>
            <h1 className="wiki-heading text-5xl leading-none sm:text-6xl">
              Personal wiki for text sources and curated knowledge pages.
            </h1>
            <p className="mt-6 max-w-3xl text-base text-muted-foreground leading-relaxed">
            Ingest plain text notes, maintain wiki pages, and expose the result through a small API for guide,
            search, read, write, and delete operations.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/wikis"
                className="inline-flex items-center gap-2 border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Open wikis
                <ArrowRight className="size-3.5 opacity-60" />
              </Link>
              <Link
                href="https://github.com/JiloTage/llmwiki"
                className="inline-flex items-center gap-2 border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                GitHub
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="wiki-paper p-6">
            <FileText className="mb-4 size-5 text-muted-foreground" />
            <h2 className="wiki-heading text-[1.55rem]">Text sources</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Store markdown and text notes directly in D1 without document conversion.
            </p>
          </section>
          <section className="wiki-paper p-6">
            <BookOpen className="mb-4 size-5 text-muted-foreground" />
            <h2 className="wiki-heading text-[1.55rem]">Wiki pages</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Keep overview, log, and topic pages as plain markdown with simple internal links.
            </p>
          </section>
          <section className="wiki-paper p-6">
            <Search className="mb-4 size-5 text-muted-foreground" />
            <h2 className="wiki-heading text-[1.55rem]">Search and actions</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Query chunks with D1 FTS5 and update pages through the integrated API routes.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
