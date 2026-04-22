CREATE TABLE IF NOT EXISTS document_related_articles (
  document_id_a INTEGER NOT NULL,
  document_id_b INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id_a, document_id_b),
  FOREIGN KEY (document_id_a) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id_b) REFERENCES documents(id) ON DELETE CASCADE,
  CHECK (document_id_a < document_id_b)
);

CREATE INDEX IF NOT EXISTS idx_document_related_articles_a
  ON document_related_articles(document_id_a);

CREATE INDEX IF NOT EXISTS idx_document_related_articles_b
  ON document_related_articles(document_id_b);
