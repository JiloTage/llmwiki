import type { DocumentListItem, DocumentSummary } from '@/lib/types'

export function buildDocumentPath(path: string, filename: string): string {
  return `${path}${filename}`.replace(/\/+/g, '/')
}

export function toWikiRoute(slug: string, fullPath: string): string {
  const segments = fullPath.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return segments ? `/wikis/${slug}/${segments}` : `/wikis/${slug}`
}

export function toPortalRoute(slug: string): string {
  return `/wikis/${slug}?portal=1`
}

export function resolveDocumentPath(currentPath: string, href: string): string {
  if (href.startsWith('/')) return href

  const baseParts = currentPath.split('/').filter(Boolean)
  baseParts.pop()

  for (const part of href.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      baseParts.pop()
    } else {
      baseParts.push(part)
    }
  }

  return `/${baseParts.join('/')}`
}

export function toDocumentSummary(doc: DocumentListItem | DocumentSummary): DocumentSummary {
  return {
    id: doc.id,
    knowledge_base_id: doc.knowledge_base_id,
    filename: doc.filename,
    title: doc.title,
    path: doc.path,
    file_type: doc.file_type,
    status: 'status' in doc ? doc.status : 'ready',
    page_count: 'page_count' in doc ? doc.page_count : null,
    sort_order: doc.sort_order,
    archived: doc.archived,
    updated_at: doc.updated_at,
  }
}
