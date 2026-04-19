'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { TocItem } from '@/lib/types'
import { formatWikiPath } from '@/lib/wiki'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (items.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    )

    const timeout = setTimeout(() => {
      for (const item of items) {
        const element = document.getElementById(item.id)
        if (element) observer.observe(element)
      }
    }, 100)

    return () => {
      clearTimeout(timeout)
      observer.disconnect()
    }
  }, [items])

  if (items.length === 0) return null

  return (
    <nav className="border border-border bg-background p-3">
      <p className="wiki-heading border-b border-border pb-1 text-base text-foreground">
        Contents
      </p>
      <div className="mt-2 space-y-0.5">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(event) => {
              event.preventDefault()
              const element = document.getElementById(item.id)
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                setActiveId(item.id)
              }
            }}
            className={cn(
              'block py-1 text-xs leading-snug transition-colors',
              item.level === 3 && 'pl-4 text-[11px]',
              activeId === item.id ? 'font-semibold text-foreground' : 'text-accent-blue hover:underline',
            )}
          >
            {item.text}
          </a>
        ))}
      </div>
    </nav>
  )
}

function useMermaidEnhancement(containerRef: React.RefObject<HTMLDivElement | null>, renderKey: string) {
  React.useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false

    const renderMermaid = async () => {
      const container = containerRef.current
      if (!container) return

      const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-mermaid-chart]'))
      if (nodes.length === 0) return

      const mermaidModule = await import('mermaid')
      const mermaid = mermaidModule.default
      const isDark = document.documentElement.classList.contains('dark')

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: isDark ? 'dark' : 'default',
        fontFamily: 'var(--font-geist-sans), sans-serif',
      })

      for (const node of nodes) {
        if (cancelled) return
        const chart = node.dataset.mermaidChart?.trim()
        if (!chart) continue

        try {
          const renderId = `mermaid-${Math.random().toString(36).slice(2, 10)}`
          const { svg, bindFunctions } = await mermaid.render(renderId, chart)
          if (cancelled) return
          node.innerHTML = svg
          bindFunctions?.(node)
        } catch (error) {
          if (cancelled) return
          const message = error instanceof Error ? error.message : 'Unknown Mermaid render error'
          node.innerHTML = `<figure class="mermaid-diagram mermaid-diagram-error"><figcaption class="text-xs font-medium text-destructive mb-3">Mermaid diagram failed to render: ${escapeHtml(message)}</figcaption><pre class="text-[13px] leading-relaxed bg-muted/60 border border-border rounded-lg p-4 overflow-x-auto"><code>${escapeHtml(chart)}</code></pre></figure>`
        }
      }
    }

    void renderMermaid()

    const root = document.documentElement
    let previousDark = root.classList.contains('dark')
    const observer = new MutationObserver(() => {
      const nextDark = root.classList.contains('dark')
      if (nextDark !== previousDark) {
        previousDark = nextDark
        void renderMermaid()
      }
    })

    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [containerRef, renderKey])
}

type Props = {
  title: string
  path?: string | null
  kbName?: string
  tocItems: TocItem[]
  sourceCount: number
  onSourceClick?: (filename: string) => void
  children?: React.ReactNode
}

export function RenderedWikiContent({
  title,
  path,
  kbName,
  tocItems,
  sourceCount,
  onSourceClick,
  children,
}: Props) {
  const router = useRouter()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const hasToc = tocItems.length > 0
  const formattedPath = formatWikiPath(path)
  const renderKey = `${path ?? ''}:${title}:${tocItems.length}:${sourceCount}`

  useMermaidEnhancement(containerRef, renderKey)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      const sourceElement = target.closest<HTMLElement>('[data-source-link]')
      if (sourceElement) {
        event.preventDefault()
        const source = sourceElement.dataset.sourceLink
        if (source) onSourceClick?.(source)
        return
      }

      const anchor = target.closest<HTMLAnchorElement>('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      if (anchor.dataset.wikiLink === 'true') {
        event.preventDefault()
        router.push(href)
        return
      }

      if (href.startsWith('#')) {
        event.preventDefault()
        const element = document.getElementById(href.slice(1))
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [onSourceClick, router])

  return (
    <div className="h-full overflow-y-auto bg-muted/55" id="wiki-scroll-container">
      <div className={cn('mx-auto px-4 py-6 lg:px-6', hasToc ? 'max-w-[1400px]' : 'max-w-[1100px]')}>
        <div className={cn(hasToc && 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]')}>
          <article className="wiki-paper min-w-0">
            <div className="border-b border-border bg-muted/35 px-6 py-2 text-xs text-muted-foreground lg:px-8">
              <span className="text-foreground">LLM Wiki</span>
              {kbName ? <span>{` / ${kbName}`}</span> : null}
              {formattedPath ? <span>{` / ${formattedPath}`}</span> : null}
            </div>
            <header className="px-6 py-5 lg:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-1">
                <div>
                  <div className="wiki-section-label mb-2">Article</div>
                  {title ? <h1 className="wiki-heading text-[2rem] leading-none text-foreground">{title}</h1> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {formattedPath ? <span className="border border-border bg-background px-2 py-1">{formattedPath}</span> : null}
                  <span className="border border-border bg-background px-2 py-1">{tocItems.length} sections</span>
                  <span className="border border-border bg-background px-2 py-1">{sourceCount} sources</span>
                </div>
              </div>
            </header>

            <div className="px-6 pb-8 lg:px-8 lg:pb-10">
              {hasToc ? (
                <div className="mb-6 lg:hidden">
                  <TableOfContents items={tocItems} />
                </div>
              ) : null}
              <div
                ref={containerRef}
                className="wiki-content text-[15px] leading-relaxed"
              >
                {children}
              </div>
            </div>
          </article>

          {hasToc ? (
            <aside className="hidden lg:block">
              <div className="sticky top-6 space-y-4">
                <TableOfContents items={tocItems} />
                <div className="border border-border bg-background p-3 text-sm">
                  <p className="wiki-heading border-b border-border pb-1 text-base text-foreground">
                    Page Facts
                  </p>
                  <dl className="mt-3 space-y-2 text-[13px]">
                    {formattedPath ? (
                      <div>
                        <dt className="font-semibold text-foreground">Path</dt>
                        <dd className="break-all text-muted-foreground">{formattedPath}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="font-semibold text-foreground">Sections</dt>
                      <dd className="text-muted-foreground">{tocItems.length}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Sources</dt>
                      <dd className="text-muted-foreground">{sourceCount}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}
