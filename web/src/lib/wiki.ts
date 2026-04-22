import type { TocItem } from '@/lib/types'

export type HeadingAnchor = {
  id: string
  text: string
  level: 1 | 2 | 3 | 4
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim()
}

export function slugifyHeading(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'section'
}

export function extractHeadingAnchors(md: string): HeadingAnchor[] {
  const items: HeadingAnchor[] = []
  const counts = new Map<string, number>()

  for (const line of md.split('\n')) {
    const heading = line.match(/^(#{1,4})\s+(.+)/)
    if (!heading) continue

    const level = heading[1].length as HeadingAnchor['level']
    const text = stripInlineMarkdown(heading[2])
    const baseId = slugifyHeading(text)
    const nextCount = (counts.get(baseId) ?? 0) + 1
    counts.set(baseId, nextCount)

    items.push({
      id: nextCount === 1 ? baseId : `${baseId}-${nextCount}`,
      text,
      level,
    })
  }

  return items
}

export function extractTocFromMarkdown(md: string): TocItem[] {
  return extractHeadingAnchors(md)
    .flatMap((item) => (item.level === 2 || item.level === 3
      ? [{ id: item.id, text: item.text, level: item.level }]
      : []))
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
