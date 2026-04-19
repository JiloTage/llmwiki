import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { resolveDocumentPath, toWikiRoute } from '@/lib/documents'
import type { DocumentSummary, TocItem } from '@/lib/types'
import {
  extractTocFromMarkdown,
  parseFootnoteSources,
  slugifyHeading,
  stripLeadingH1,
} from '@/lib/wiki'

type RenderWikiPageInput = {
  content: string
  title: string
  currentPath: string
  kbSlug: string
  documents: DocumentSummary[]
  resolvedAssets?: Record<string, string>
}

export type RenderedWikiPage = {
  body: React.ReactNode
  tocItems: TocItem[]
  sourceCount: number
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

function extractMermaidChart(children: React.ReactNode): string | null {
  const child = React.Children.toArray(children)[0]
  if (!React.isValidElement(child)) return null

  const props = child.props as { className?: string; children?: React.ReactNode }
  if (!props.className?.split(' ').includes('language-mermaid')) return null
  return childrenToText(props.children).trim()
}

export function renderWikiPage({
  content,
  title,
  currentPath,
  kbSlug,
  documents,
  resolvedAssets = {},
}: RenderWikiPageInput): RenderedWikiPage {
  const processedContent = stripLeadingH1(content, title)
  const tocItems = extractTocFromMarkdown(processedContent)
  const footnoteSources = parseFootnoteSources(processedContent)

  const components: Components = {
    h1({ children }) {
      const id = slugifyHeading(childrenToText(children))
      return <h1 id={id} className="wiki-heading mt-8 mb-3 scroll-mt-20 text-[1.7rem] leading-tight first:mt-0">{children}</h1>
    },
    h2({ children }) {
      const id = slugifyHeading(childrenToText(children))
      return <h2 id={id} className="wiki-heading mt-8 mb-2 border-b border-border pb-1 scroll-mt-20 text-[1.45rem]">{children}</h2>
    },
    h3({ children }) {
      const id = slugifyHeading(childrenToText(children))
      return <h3 id={id} className="wiki-heading mt-6 mb-1.5 scroll-mt-20 text-[1.15rem]">{children}</h3>
    },
    h4({ children }) {
      const id = slugifyHeading(childrenToText(children))
      return <h4 id={id} className="mt-5 mb-1 scroll-mt-20 text-base font-semibold">{children}</h4>
    },
    p({ children }) {
      return <p className="my-2 text-[0.95rem] leading-[1.72] text-foreground">{children}</p>
    },
    pre({ children, ...props }) {
      const mermaidChart = extractMermaidChart(children)
      if (mermaidChart) {
        return (
          <div
            className="mermaid-diagram flex min-h-40 items-center justify-center text-sm text-muted-foreground"
            data-mermaid-chart={mermaidChart}
          >
            Rendering diagram...
          </div>
        )
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
      if (className?.startsWith('language-')) {
        return <code className={className} {...props}>{children}</code>
      }
      return (
        <code className="bg-muted/80 px-1.5 py-0.5 font-mono text-[13px] text-foreground/80" {...props}>
          {children}
        </code>
      )
    },
    a({ href, children }) {
      if (href?.includes('fnref')) return null

      const text = childrenToText(children)
      if (text.includes('竊ｩ') || text.includes('竊ｵ')) return null

      if (href?.startsWith('#fn-') || href?.startsWith('#user-content-fn-')) {
        return <a href={href} className="ml-1 text-muted-foreground/60 no-underline hover:text-muted-foreground">{children}</a>
      }

      if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
        const nextPath = resolveDocumentPath(currentPath, href)
        const nextHref = toWikiRoute(kbSlug, nextPath)
        return (
          <a href={nextHref} data-wiki-link="true" className="text-accent-blue hover:underline">
            {children}
          </a>
        )
      }

      if (href?.startsWith('#')) {
        return <a href={href} className="text-accent-blue hover:underline">{children}</a>
      }

      return (
        <a href={href ?? undefined} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">
          {children}
        </a>
      )
    },
    sup({ children, ...props }) {
      const child = React.Children.toArray(children)[0]
      const childProps = React.isValidElement(child) ? (child.props as Record<string, unknown>) : null
      const childHref = childProps && typeof childProps.href === 'string' ? childProps.href : null
      if (childHref && childHref.includes('fn')) {
        const num = childrenToText(children).replace(/[^\d]/g, '')
        const source = footnoteSources.get(num)
        if (source) {
          return (
            <sup {...props}>
              <button
                type="button"
                data-source-link={source.replace(/,\s*p\.?\s*.+$/, '').trim()}
                className="inline-flex items-center text-[11px] text-accent-blue hover:underline cursor-pointer align-super"
              >
                [{num}]
              </button>
            </sup>
          )
        }
      }
      return <sup {...props}>{children}</sup>
    },
    table({ children, ...props }) {
      return (
        <div className="my-6 overflow-x-auto border border-border bg-background">
          <table className="w-full border-collapse text-sm" {...props}>{children}</table>
        </div>
      )
    },
    thead({ children, ...props }) {
      return <thead className="bg-muted" {...props}>{children}</thead>
    },
    th({ children, ...props }) {
      return <th className="border-b border-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" {...props}>{children}</th>
    },
    td({ children, ...props }) {
      return <td className="border-b border-border/60 px-3 py-2 text-sm" {...props}>{children}</td>
    },
    blockquote({ children, ...props }) {
      return <blockquote className="my-4 border-l-2 border-border bg-muted/35 px-4 py-2 text-muted-foreground" {...props}>{children}</blockquote>
    },
    ul({ children, ...props }) {
      return <ul className="my-2.5 list-disc space-y-0.5 pl-5 marker:text-muted-foreground/60" {...props}>{children}</ul>
    },
    ol({ children, ...props }) {
      return <ol className="my-2.5 list-decimal space-y-0.5 pl-5 marker:text-muted-foreground/60" {...props}>{children}</ol>
    },
    li({ children, ...props }) {
      const id = (props as Record<string, unknown>).id
      if (typeof id === 'string' && (id.startsWith('fn-') || id.startsWith('user-content-fn-'))) {
        const text = childrenToText(children).replace(/竊ｩ.*$/, '').trim()
        return (
          <li id={id} className="my-2 scroll-mt-20 pl-1 text-sm">
            <button type="button" data-source-link={text} className="cursor-pointer text-left text-accent-blue hover:underline">
              {text}
            </button>
          </li>
        )
      }
      return <li className="my-0.5 leading-[1.65]" {...props}>{children}</li>
    },
    hr() {
      return <hr className="my-6 border-border" />
    },
    img({ src, alt }) {
      const normalizedSrc = typeof src === 'string' ? src : undefined
      const basename = normalizedSrc?.replace(/^\.\//, '').split('/').pop() ?? ''
      const resolvedSrc = normalizedSrc
        ? resolvedAssets[normalizedSrc] || resolvedAssets[basename] || normalizedSrc
        : undefined
      return <img src={resolvedSrc} alt={typeof alt === 'string' ? alt : ''} className="my-5 h-auto max-w-full border border-border bg-background p-2" />
    },
    section({ children, ...props }) {
      const sectionProps = props as Record<string, unknown>
      if (sectionProps['data-footnotes'] !== undefined || sectionProps.dataFootnotes !== undefined || sectionProps.className === 'footnotes') {
        const entries = Array.from(footnoteSources.entries())
        if (entries.length === 0) return null
        return (
          <section className="mt-12 border-t border-border pt-6">
            <p className="wiki-heading mb-3 text-base text-foreground">Sources</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              {entries.map(([num, source]) => (
                <li key={num} className="text-sm pl-1">
                  <button
                    type="button"
                    data-source-link={source.replace(/,\s*p\.?\s*.+$/, '').trim()}
                    className="cursor-pointer text-left text-accent-blue hover:underline"
                  >
                    {source}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )
      }
      return <section {...props}>{children}</section>
    },
  }

  const body = (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
      {processedContent}
    </ReactMarkdown>
  )

  return {
    body,
    tocItems,
    sourceCount: footnoteSources.size,
  }
}
