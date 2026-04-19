import type { TocItem } from '@/lib/types'

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function extractTocFromMarkdown(md: string): TocItem[] {
  const items: TocItem[] = []
  const lines = md.split('\n')
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/)
    const h3 = line.match(/^###\s+(.+)/)
    if (h2) {
      const text = h2[1].replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim()
      items.push({ id: slugifyHeading(text), text, level: 2 })
    } else if (h3) {
      const text = h3[1].replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim()
      items.push({ id: slugifyHeading(text), text, level: 3 })
    }
  }
  return items
}

export function stripLeadingH1(content: string, title: string): string {
  const trimmed = content.trimStart()
  const match = trimmed.match(/^#\s+(.+)\n?/)
  if (!match) return content

  const normalizedH1 = match[1].replace(/\*\*/g, '').toLowerCase().replace(/[^\w\s]/g, '').trim()
  const normalizedTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim()
  if (normalizedH1 !== normalizedTitle) return content

  return trimmed.slice(match[0].length)
}

export function parseFootnoteSources(content: string): Map<string, string> {
  const map = new Map<string, string>()
  const regex = /\[\^(\d+)\]:\s*(.+)$/gm
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    let source = match[2].trim()
    source = source.replace(/^\*{1,2}/, '').replace(/\*{1,2}$/, '')
    const linkMatch = source.match(/\[([^\]]+)\]\([^)]*\)/)
    if (linkMatch) source = linkMatch[1]
    map.set(match[1], source)
  }

  return map
}

export function formatWikiPath(path?: string | null): string | null {
  if (!path) return null
  return `/wiki/${path.replace(/\\/g, '/').replace(/^\/+/, '')}`
}

export function extractImageSources(content: string): string[] {
  const sources = new Set<string>()
  const regex = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    sources.add(match[1])
  }

  return [...sources]
}
