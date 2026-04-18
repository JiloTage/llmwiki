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
    <div className="min-h-svh bg-background text-foreground">
      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-sm text-muted-foreground mb-4">LLM Wiki</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Personal wiki for text sources and markdown knowledge pages.
          </h1>
          <p className="mt-6 text-base text-muted-foreground leading-relaxed">
            Ingest plain text notes, maintain wiki pages, and expose the result through a small API for guide,
            search, read, write, and delete operations.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/wikis"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Open wikis
              <ArrowRight className="size-3.5 opacity-60" />
            </Link>
            <Link
              href="https://github.com/JiloTage/llmwiki"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              GitHub
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          <section className="rounded-2xl border border-border bg-card p-6">
            <FileText className="size-5 text-muted-foreground mb-4" />
            <h2 className="font-semibold">Text sources</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Store markdown and text notes directly in D1 without document conversion.
            </p>
          </section>
          <section className="rounded-2xl border border-border bg-card p-6">
            <BookOpen className="size-5 text-muted-foreground mb-4" />
            <h2 className="font-semibold">Wiki pages</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Keep overview, log, and topic pages as plain markdown with simple internal links.
            </p>
          </section>
          <section className="rounded-2xl border border-border bg-card p-6">
            <Search className="size-5 text-muted-foreground mb-4" />
            <h2 className="font-semibold">Search + actions</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Query chunks with D1 FTS5 and update pages through the integrated API routes.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
