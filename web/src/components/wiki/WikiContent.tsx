'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import type { Components } from 'react-markdown'

function MermaidBlock({ chart }: { chart: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const idRef = React.useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`)

  React.useEffect(() => {
    let cancelled = false
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral' })
      mermaid
        .render(idRef.current, chart)
        .then(({ svg }) => {
          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML = svg
          }
        })
        .catch(() => {
          if (!cancelled && containerRef.current) {
            containerRef.current.textContent = chart
          }
        })
    })
    return () => {
      cancelled = true
    }
  }, [chart])

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center [&_svg]:max-w-full"
    />
  )
}

interface WikiContentProps {
  content: string
  title: string
  onNavigate: (path: string) => void
}

export function WikiContent({ content, title, onNavigate }: WikiContentProps) {
  const components: Components = React.useMemo(
    () => ({
      pre({ children, ...props }) {
        const child = React.Children.toArray(children)[0]
        if (
          React.isValidElement(child) &&
          typeof child.props === 'object' &&
          child.props !== null &&
          'className' in child.props &&
          typeof child.props.className === 'string' &&
          child.props.className.includes('language-mermaid')
        ) {
          const text =
            'children' in child.props
              ? String(child.props.children).replace(/\n$/, '')
              : ''
          return <MermaidBlock chart={text} />
        }
        return (
          <pre
            className="text-xs leading-relaxed my-3 bg-muted border border-border rounded-lg p-4 overflow-x-auto"
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
            className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono"
            {...props}
          >
            {children}
          </code>
        )
      },
      a({ href, children }) {
        if (
          href &&
          !href.startsWith('http') &&
          !href.startsWith('#') &&
          !href.startsWith('mailto:')
        ) {
          return (
            <button
              onClick={() => onNavigate(href)}
              className="text-foreground underline underline-offset-2 decoration-foreground/30 hover:decoration-foreground transition-colors cursor-pointer"
            >
              {children}
            </button>
          )
        }
        return (
          <a
            href={href ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2 decoration-foreground/30 hover:decoration-foreground transition-colors"
          >
            {children}
          </a>
        )
      },
      table({ children, ...props }) {
        return (
          <div className="overflow-x-auto my-3">
            <table className="w-full border-collapse" {...props}>
              {children}
            </table>
          </div>
        )
      },
      th({ children, ...props }) {
        return (
          <th
            className="bg-muted text-left text-sm font-medium px-2.5 py-1 border border-border"
            {...props}
          >
            {children}
          </th>
        )
      },
      td({ children, ...props }) {
        return (
          <td className="text-sm px-2.5 py-1 border border-border" {...props}>
            {children}
          </td>
        )
      },
      blockquote({ children, ...props }) {
        return (
          <blockquote
            className="border-l-3 border-muted-foreground/30 pl-4 my-4 text-muted-foreground italic"
            {...props}
          >
            {children}
          </blockquote>
        )
      },
      img({ src, alt, ...props }) {
        return (
          <img
            src={src}
            alt={alt}
            className="max-w-full h-auto rounded-md my-3"
            {...props}
          />
        )
      },
    }),
    [onNavigate],
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-10">
        {title && (
          <h1 className="text-2xl font-bold tracking-tight mb-6">{title}</h1>
        )}
        <div className="wiki-content text-[15px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={components}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
