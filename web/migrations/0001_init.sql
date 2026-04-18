PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  knowledge_base_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  title TEXT,
  path TEXT NOT NULL DEFAULT '/',
  file_type TEXT NOT NULL DEFAULT 'md',
  content TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  date TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_kb_path_filename
  ON documents(knowledge_base_id, path, filename);

CREATE INDEX IF NOT EXISTS idx_documents_kb_archived_path
  ON documents(knowledge_base_id, archived, path, sort_order, filename);

CREATE INDEX IF NOT EXISTS idx_documents_kb_updated
  ON documents(knowledge_base_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  header_breadcrumb TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document
  ON document_chunks(document_id, chunk_index);

CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts USING fts5(
  document_chunk_id UNINDEXED,
  document_id UNINDEXED,
  content,
  title,
  filename,
  path,
  header_breadcrumb,
  tokenize = 'unicode61'
);
