export interface KnowledgeBase {
  id: string
  name: string
  slug: string
  description: string | null
  source_count: number
  wiki_page_count: number
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  knowledge_base_id: string
  filename: string
  title: string | null
  path: string
  file_type: string
  status: string
  page_count: number | null
  content: string | null
  tags: string[]
  date: string | null
  metadata: Record<string, unknown> | null
  error_message: string | null
  url: string | null
  version: number
  sort_order: number | null
  archived: boolean
  created_at: string
  updated_at: string
}

export type DocumentListItem = Omit<Document, 'content'>

export interface DocumentSummary {
  id: string
  knowledge_base_id: string
  filename: string
  title: string | null
  path: string
  file_type: string
  status: string
  page_count: number | null
  sort_order: number | null
  archived: boolean
  updated_at: string
}

export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

export type PropertyType = 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'url'

export interface TypedProperty {
  type: PropertyType
  value: string | number | boolean | null
  options?: string[]
}

export type PropertyMap = Record<string, TypedProperty>

export interface WikiNode {
  title: string
  path?: string
  children?: WikiNode[]
}

export interface WikiSubsection {
  id: string
  title: string
}
