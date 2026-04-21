'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import type { Components } from 'react-markdown'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FileText } from 'lucide-react'
import { loadMermaid } from '@/lib/mermaid-loader'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import type { DocumentListItem } from '@/lib/types'

export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

export function extractTocFromMarkdown(md: string): TocItem[] {
  const items: TocItem[] = []
  const lines = md.split('\n')
  for (const line of lines) {
    const m2 = line.match(/^##\s+(.+)/)
    const m3 = line.match(/^###\s+(.+)/)
    if (m2) {
      const text = m2[1].replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim()
      items.push({ id: slugify(text), text, level: 2 })
    } else if (m3) {
      const text = m3[1].replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim()
      items.push({ id: slugify(text), text, level: 3 })
    }
  }
  return items
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function stripLeadingH1(content: string, title: string): string {
  const trimmed = content.trimStart()
  const match = trimmed.match(/^#\s+(.+)\n?/)
  if (match) {
    const h1Text = match[1].replace(/\*\*/g, '').trim()
    const normalizedH1 = h1Text.toLowerCase().replace(/[^\w\s]/g, '').trim()
    const normalizedTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim()
    if (normalizedH1 === normalizedTitle) {
      return trimmed.slice(match[0].length)
    }
  }
  return content
}

function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (items.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible heading
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    )

    // Small delay to ensure headings are rendered
    const timeout = setTimeout(() => {
      for (const item of items) {
        const el = document.getElementById(item.id)
        if (el) observer.observe(el)
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
          onClick={(e) => {
            e.preventDefault()
            const el = document.getElementById(item.id)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              setActiveId(item.id)
            }
          }}
          className={cn(
            'block py-1 text-xs leading-snug transition-colors',
            item.level === 3 && 'pl-4 text-[11px]',
            activeId === item.id
              ? 'font-semibold text-foreground'
              : 'text-accent-blue hover:underline',
          )}
        >
          {item.text}
        </a>
        ))}
      </div>
    </nav>
  )
}

function parseFootnoteSources(content: string): Map<string, string> {
  const map = new Map<string, string>()
  // Match footnote definitions: [^1]: full source text until end of line
  const regex = /\[\^(\d+)\]:\s*(.+)$/gm
  let m
  while ((m = regex.exec(content)) !== null) {
    const num = m[1]
    let source = m[2].trim()
    // Strip surrounding bold markers
    source = source.replace(/^\*{1,2}/, '').replace(/\*{1,2}$/, '')
    // Clean up markdown links
    const linkMatch = source.match(/\[([^\]]+)\]\([^)]*\)/)
    if (linkMatch) source = linkMatch[1]
    map.set(num, source)
  }
  return map
}

function CitationBadge({
  num,
  source,
  onSourceClick,
}: {
  num: string
  source: string
  onSourceClick: (source: string) => void
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = React.useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => setIsOpen(true), 80)
  }, [])

  const handleMouseLeave = React.useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => setIsOpen(false), 160)
  }, [])

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

  // Parse source into filename and page reference
  const parts = source.match(/^(.+?)(?:,\s*p\.?\s*(.+))?$/)
  const filename = parts?.[1]?.trim() ?? source
  const pageRef = parts?.[2]?.trim()

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => {
            e.preventDefault()
            onSourceClick(filename)
          }}
          className="inline-flex items-center text-[11px] text-accent-blue hover:underline cursor-pointer align-super"
        >
          [{num}]
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={6}
        className="w-64 overflow-hidden border-border p-0"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          role="button"
          className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/55 transition-colors"
          onClick={() => {
            setIsOpen(false)
            onSourceClick(filename)
          }}
        >
          <span className="text-muted-foreground shrink-0 mt-0.5">
            <FileText className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium line-clamp-2 leading-snug">
              {filename}
            </div>
            {pageRef && (
              <div className="text-xs text-muted-foreground mt-0.5">
                p. {pageRef}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function WikiImage({
  src,
  alt,
  documents,
  wikiActivePath,
}: {
  src?: string
  alt?: string
  documents?: DocumentListItem[]
  wikiActivePath?: string
}) {
  const [svgContent, setSvgContent] = React.useState<string | null>(null)
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!src || !documents) return
    // Only resolve relative paths (not http:// or data: URIs)
    if (src.startsWith('http') || src.startsWith('data:')) return

    // Resolve relative path: strip leading ./ and resolve against current wiki path
    let filename = src.replace(/^\.\//, '')
    const doc = documents.find((d) => {
      return d.filename === filename || d.filename === filename.split('/').pop()
    })

    if (!doc) return

    const isSvg = doc.file_type === 'svg'
    const isTextAsset = ['svg', 'csv', 'xml', 'html'].includes(doc.file_type)
    const isImageBinary = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(doc.file_type)

    setLoading(true)

    if (isSvg || isTextAsset) {
      // Text-based assets stored in the content column — fetch via API
      apiFetch<{ content: string }>(`/api/v1/documents/${doc.id}/content`)
        .then((res) => {
          if (isSvg && res.content) {
            setSvgContent(res.content)
          } else if (res.content) {
            // For non-SVG text assets, render as data URI
            const blob = new Blob([res.content], { type: `image/${doc.file_type}+xml` })
            setImageUrl(URL.createObjectURL(blob))
          }
        })
        .catch(() => { /* silent fail — image just won't render */ })
        .finally(() => setLoading(false))
    } else if (isImageBinary) {
      // Binary images stored in S3 — use the /url endpoint
      Promise.resolve<{ url: string }>({ url: '' })
        .then((res) => setImageUrl(res.url))
        .catch(() => { /* silent fail */ })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [src, documents, wikiActivePath])

  // Inline SVG rendering — encode as data URI to avoid React DOM warnings for SVG elements like <text>
  if (svgContent) {
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dataUri}
        alt={alt || ''}
        className="my-5 block h-auto max-w-full border border-border bg-background p-2"
      />
    )
  }

  // Resolved image URL (binary or data URI)
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={alt || ''}
        className="my-5 h-auto max-w-full border border-border bg-background p-2"
      />
    )
  }

  // Still loading — use span to avoid div-inside-p hydration error
  if (loading) {
    return (
      <span className="my-5 flex justify-center">
        <span className="block h-32 w-48 animate-pulse border border-border bg-muted/60" />
      </span>
    )
  }

  // Fallback: render as a normal image tag (external URLs, unresolved paths)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || ''}
      className="my-5 h-auto max-w-full border border-border bg-background p-2"
    />
  )
}

function MermaidBlock({ chart }: { chart: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [svg, setSvg] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [themeKey, setThemeKey] = React.useState(0)

  React.useEffect(() => {
    const root = document.documentElement
    let lastIsDark = root.classList.contains('dark')

    const observer = new MutationObserver(() => {
      const nextIsDark = root.classList.contains('dark')
      if (nextIsDark !== lastIsDark) {
        lastIsDark = nextIsDark
        setThemeKey((current) => current + 1)
      }
    })

    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    let cancelled = false

    const renderDiagram = async () => {
      try {
        setError(null)
        setSvg(null)

        const mermaid = await loadMermaid()
        const isDark = document.documentElement.classList.contains('dark')

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: isDark ? 'dark' : 'default',
          fontFamily: 'var(--font-geist-sans), sans-serif',
        })

        const renderId = `mermaid-${Math.random().toString(36).slice(2, 10)}`
        const { svg: nextSvg, bindFunctions } = await mermaid.render(renderId, chart.trim())

        if (cancelled) return

        setSvg(nextSvg)
        requestAnimationFrame(() => {
          if (!cancelled && containerRef.current) {
            bindFunctions?.(containerRef.current)
          }
        })
      } catch (cause) {
        if (cancelled) return
        const message = cause instanceof Error ? cause.message : 'Unknown Mermaid render error'
        setError(message)
      }
    }

    void renderDiagram()

    return () => {
      cancelled = true
    }
  }, [chart, themeKey])

  if (error) {
    return (
      <figure className="mermaid-diagram mermaid-diagram-error">
        <figcaption className="text-xs font-medium text-destructive mb-3">
          Mermaid diagram failed to render: {error}
        </figcaption>
        <pre className="text-[13px] leading-relaxed bg-muted/60 border border-border rounded-lg p-4 overflow-x-auto">
          <code>{chart}</code>
        </pre>
      </figure>
    )
  }

  if (!svg) {
    return (
      <div
        className="mermaid-diagram flex items-center justify-center min-h-40 text-sm text-muted-foreground"
        data-testid="mermaid-diagram"
        aria-busy="true"
      >
        Rendering diagram...
      </div>
    )
  }

  return (
    <figure className="mermaid-diagram" data-testid="mermaid-diagram">
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  )
}

function extractMermaidChart(children: React.ReactNode): string | null {
  const child = React.Children.toArray(children)[0]
  if (!React.isValidElement(child)) return null

  const props = child.props as { className?: string; children?: React.ReactNode }
  if (!props.className?.split(' ').includes('language-mermaid')) return null

  return childrenToText(props.children).trim()
}

interface WikiContentProps {
  content: string
  title: string
  path?: string | null
  kbName?: string
  onNavigate: (path: string) => void
  onSourceClick?: (filename: string) => void
  documents?: DocumentListItem[]
}

function formatWikiPath(path?: string | null) {
  if (!path) return null
  return `/wiki/${path.replace(/\\/g, '/').replace(/^\/+/, '')}`
}

export function WikiContent({ content, title, path, kbName, onNavigate, onSourceClick, documents }: WikiContentProps) {
  const processedContent = React.useMemo(() => stripLeadingH1(content, title), [content, title])
  const tocItems = React.useMemo(() => extractTocFromMarkdown(processedContent), [processedContent])
  const footnoteSources = React.useMemo(() => parseFootnoteSources(processedContent), [processedContent])

  const components: Components = React.useMemo(
    () => ({
      h1({ children }) {
        const text = childrenToText(children)
        const id = slugify(text)
        return (
          <h1 id={id} className="wiki-heading mt-8 mb-3 scroll-mt-20 text-[1.7rem] leading-tight first:mt-0">
            {children}
          </h1>
        )
      },
      h2({ children }) {
        const text = childrenToText(children)
        const id = slugify(text)
        return (
          <h2 id={id} className="wiki-heading mt-8 mb-2 border-b border-border pb-1 scroll-mt-20 text-[1.45rem]">
            {children}
          </h2>
        )
      },
      h3({ children }) {
        const text = childrenToText(children)
        const id = slugify(text)
        return (
          <h3 id={id} className="wiki-heading mt-6 mb-1.5 scroll-mt-20 text-[1.15rem]">
            {children}
          </h3>
        )
      },
      h4({ children }) {
        const text = childrenToText(children)
        const id = slugify(text)
        return (
          <h4 id={id} className="mt-5 mb-1 scroll-mt-20 text-base font-semibold">
            {children}
          </h4>
        )
      },
      p({ children }) {
        return <p className="my-2 text-[0.95rem] leading-[1.72] text-foreground">{children}</p>
      },
      pre({ children, ...props }) {
        const mermaidChart = extractMermaidChart(children)
        if (mermaidChart) {
          return <MermaidBlock chart={mermaidChart} />
        }

        return (
          <pre
            className="my-4 overflow-x-auto border border-border bg-muted/55 p-4 text-[13px] leading-relaxed"
            {...props}
          >
            {children}
          </pre>
        )
      },
      code({ className, children, ...props }) {
        const isBlock = className?.startsWith('language-')
        if (isBlock) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          )
        }
        return (
          <code
            className="bg-muted/80 px-1.5 py-0.5 font-mono text-[13px] text-foreground/80"
            {...props}
          >
            {children}
          </code>
        )
      },
      a({ href, children }) {
        // Footnote back-references (↩ arrows) — hide entirely
        if (href?.includes('fnref')) {
          return null
        }
        const text = childrenToText(children)
        if (text.includes('↩') || text.includes('↵')) {
          return null
        }
        if (href?.startsWith('#fn-') || href?.startsWith('#user-content-fn-')) {
          return (
            <a
              href={href}
              className="ml-1 text-muted-foreground/60 no-underline hover:text-muted-foreground"
            >
              {children}
            </a>
          )
        }

        // Internal wiki links
        if (
          href &&
          !href.startsWith('http') &&
          !href.startsWith('#') &&
          !href.startsWith('mailto:')
        ) {
          return (
            <button
              onClick={() => onNavigate(href)}
              className="cursor-pointer text-accent-blue hover:underline"
            >
              {children}
            </button>
          )
        }

        // Anchor links (headings)
        if (href?.startsWith('#')) {
          return (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault()
                const id = href.slice(1)
                const el = document.getElementById(id)
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="text-accent-blue hover:underline"
            >
              {children}
            </a>
          )
        }

        return (
          <a
            href={href ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue hover:underline"
          >
            {children}
          </a>
        )
      },
      sup({ children, ...props }) {
        // Detect footnote references like [^1] which render as <sup> with an <a> inside
        const child = React.Children.toArray(children)[0]
        const childProps = React.isValidElement(child) ? (child.props as Record<string, unknown>) : null
        const childHref = childProps && typeof childProps.href === 'string' ? childProps.href : null
        if (childHref && childHref.includes('fn')) {
          const text = childrenToText(children)
          const num = text.replace(/[^\d]/g, '')
          const source = footnoteSources.get(num)
          if (source) {
            return (
              <sup {...props}>
                <CitationBadge
                  num={num}
                  source={source}
                  onSourceClick={(filename) => {
                    if (onSourceClick) onSourceClick(filename)
                  }}
                />
              </sup>
            )
          }
        }
        return <sup {...props}>{children}</sup>
      },
      table({ children, ...props }) {
        return (
          <div className="my-6 overflow-x-auto border border-border bg-background">
            <table className="w-full border-collapse text-sm" {...props}>
              {children}
            </table>
          </div>
        )
      },
      thead({ children, ...props }) {
        return (
          <thead className="bg-muted" {...props}>
            {children}
          </thead>
        )
      },
      th({ children, ...props }) {
        return (
          <th
            className="border-b border-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            {...props}
          >
            {children}
          </th>
        )
      },
      td({ children, ...props }) {
        return (
          <td className="border-b border-border/60 px-3 py-2 text-sm" {...props}>
            {children}
          </td>
        )
      },
      blockquote({ children, ...props }) {
        return (
          <blockquote
            className="my-4 border-l-2 border-border bg-muted/35 px-4 py-2 text-muted-foreground"
            {...props}
          >
            {children}
          </blockquote>
        )
      },
      ul({ children, ...props }) {
        return (
          <ul className="my-2.5 list-disc space-y-0.5 pl-5 marker:text-muted-foreground/60" {...props}>
            {children}
          </ul>
        )
      },
      ol({ children, ...props }) {
        return (
          <ol className="my-2.5 list-decimal space-y-0.5 pl-5 marker:text-muted-foreground/60" {...props}>
            {children}
          </ol>
        )
      },
      li({ children, ...props }) {
        // Style footnote list items (inside <section data-footnotes>)
        const id = (props as Record<string, unknown>).id
        if (typeof id === 'string' && (id.startsWith('fn-') || id.startsWith('user-content-fn-'))) {
          const text = childrenToText(children).replace(/↩.*$/, '').trim()
          return (
            <li
              id={id}
              className="my-2 scroll-mt-20 pl-1 text-sm"
            >
              <button
                onClick={() => onSourceClick?.(text)}
                className="cursor-pointer text-left text-accent-blue hover:underline"
              >
                {text}
              </button>
            </li>
          )
        }
        return (
          <li className="my-0.5 leading-[1.65]" {...props}>
            {children}
          </li>
        )
      },
      hr() {
        return <hr className="my-6 border-border" />
      },
      img({ src, alt }) {
        return (
          <WikiImage
            src={typeof src === 'string' ? src : undefined}
            alt={typeof alt === 'string' ? alt : undefined}
            documents={documents}
          />
        )
      },
      section({ children, ...props }) {
        // Replace the auto-generated footnotes section with our own clean version
        const dp = props as Record<string, unknown>
        if (dp['data-footnotes'] !== undefined || dp.dataFootnotes !== undefined || dp.className === 'footnotes') {
          // Render our own clean footnotes from parsed sources
          const entries = Array.from(footnoteSources.entries())
          if (entries.length === 0) return null
          return (
            <section className="mt-12 border-t border-border pt-6">
              <p className="wiki-heading mb-3 text-base text-foreground">
                Sources
              </p>
              <ol className="list-decimal space-y-1.5 pl-5">
                {entries.map(([num, source]) => {
                  const filename = source.replace(/,\s*p\.?\s*.+$/, '').trim()
                  return (
                    <li key={num} className="text-sm pl-1">
                      <button
                        onClick={() => onSourceClick?.(filename)}
                        className="cursor-pointer text-left text-accent-blue hover:underline"
                      >
                        {source}
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        }
        return <section {...props}>{children}</section>
      },
    }),
    [onNavigate, onSourceClick, footnoteSources, documents],
  )

  const hasToc = tocItems.length > 0
  const formattedPath = formatWikiPath(path)
  const sourceCount = footnoteSources.size

  return (
    <div className="h-full overflow-y-auto bg-muted/55" id="wiki-scroll-container">
      <div className={cn(
        'mx-auto px-4 py-6 lg:px-6',
        hasToc ? 'max-w-[1400px]' : 'max-w-[1100px]',
      )}>
        <div className={cn(hasToc && 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]')}>
          {/* Main content */}
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
                  {title && (
                    <h1 className="wiki-heading text-[2rem] leading-none text-foreground">{title}</h1>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {formattedPath ? (
                    <span className="border border-border bg-background px-2 py-1">{formattedPath}</span>
                  ) : null}
                  <span className="border border-border bg-background px-2 py-1">
                    {tocItems.length} sections
                  </span>
                  <span className="border border-border bg-background px-2 py-1">
                    {sourceCount} sources
                  </span>
                </div>
              </div>
            </header>

            <div className="px-6 pb-8 lg:px-8 lg:pb-10">
              {hasToc && (
                <div className="mb-6 lg:hidden">
                  <TableOfContents items={tocItems} />
                </div>
              )}
              <div className="wiki-content text-[15px] leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={components}
                >
                  {processedContent}
                </ReactMarkdown>
              </div>
            </div>
          </article>

          {/* Right sidebar — "On this page" ToC */}
          {hasToc && (
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
          )}
        </div>
      </div>
    </div>
  )
}

function childrenToText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  if (React.isValidElement(children) && children.props) {
    const props = children.props as Record<string, unknown>
    if (props.children) return childrenToText(props.children as React.ReactNode)
  }
  return ''
}
