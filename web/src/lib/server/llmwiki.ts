import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type Row = Record<string, unknown>;

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  all<T = Row>(): Promise<{ results?: T[] }>;
  first<T = Row>(column?: string): Promise<T | null>;
  run(): Promise<unknown>;
};

type D1DatabaseLike = {
  prepare(sql: string): D1Statement;
  batch?(statements: D1Statement[]): Promise<unknown[]>;
};

type KnowledgeBaseRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  source_count?: number;
  wiki_page_count?: number;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: number;
  knowledge_base_id: number;
  filename: string;
  title: string | null;
  path: string;
  file_type: string;
  content?: string;
  tags_json: string;
  metadata_json: string;
  date: string | null;
  version: number;
  sort_order: number;
  archived: number;
  created_at: string;
  updated_at: string;
};

type ChunkRow = {
  content: string;
  header_breadcrumb: string;
};

const LOCAL_ACCESS_TOKEN =
  process.env.LOCAL_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_LOCAL_ACCESS_TOKEN ||
  "local-dev-session";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "http://localhost:3000";

const GUIDE_TEXT = `# LLM Wiki - How It Works

You are connected to an **LLM Wiki** - a personal knowledge workspace where you compile and maintain a structured wiki from raw source documents.

## Architecture

1. **Raw Sources** (path: \`/\`) - uploaded documents (PDFs, notes, images, spreadsheets). Source of truth. Read-only.
2. **Compiled Wiki** (path: \`/wiki/\`) - markdown pages YOU create and maintain. You own this layer.
3. **Tools** - \`search\`, \`read\`, \`write\`, \`delete\` - your interface to both layers.

## Wiki Structure

Every wiki follows this structure. These categories are not suggestions - they are the backbone of the wiki.

### Overview (\`/wiki/overview.md\`) - THE HUB PAGE
Always exists. This is the front page of the wiki. It must contain:
- A summary of what this wiki covers and its scope
- **Source count** and page count (update on every ingest)
- **Key Findings** - the most important insights across all sources
- **Recent Updates** - last 5-10 actions (ingests, new pages, revisions)

Update the Overview after EVERY ingest or major edit. If you only update one page, it should be this one.

### Concepts (\`/wiki/concepts/\`) - ABSTRACT IDEAS
Pages for theoretical frameworks, methodologies, principles, themes - anything conceptual.
- \`/wiki/concepts/scaling-laws.md\`
- \`/wiki/concepts/attention-mechanisms.md\`
- \`/wiki/concepts/self-supervised-learning.md\`

Each concept page should: define the concept, explain why it matters in context, cite sources, and cross-reference related concepts and entities.

### Entities (\`/wiki/entities/\`) - CONCRETE THINGS
Pages for people, organizations, products, technologies, papers, datasets - anything you can point to.
- \`/wiki/entities/transformer.md\`
- \`/wiki/entities/openai.md\`
- \`/wiki/entities/attention-is-all-you-need.md\`

Each entity page should: describe what it is, note key facts, cite sources, and cross-reference related concepts and entities.

### Log (\`/wiki/log.md\`) - CHRONOLOGICAL RECORD
Always exists. Append-only. Records every ingest, major edit, and lint pass. Never delete entries.

Format - each entry starts with a parseable header:
\`\`\`
## [YYYY-MM-DD] ingest | Source Title
- Created concept page: [Page Title](concepts/page.md)
- Updated entity page: [Page Title](entities/page.md)
- Updated overview with new findings
- Key takeaway: one sentence summary

## [YYYY-MM-DD] query | Question Asked
- Created new page: [Page Title](concepts/page.md)
- Finding: one sentence answer

## [YYYY-MM-DD] lint | Health Check
- Fixed contradiction between X and Y
- Added missing cross-reference in Z
\`\`\`

### Additional Pages
You can create pages outside of concepts/ and entities/ when needed:
- \`/wiki/comparisons/x-vs-y.md\` - for deep comparisons
- \`/wiki/timeline.md\` - for chronological narratives

But concepts/ and entities/ are the primary categories. When in doubt, file there.

## Page Hierarchy

Wiki pages use a parent/child hierarchy via paths:
- \`/wiki/concepts.md\` - parent page (optional; summarizes all concepts)
- \`/wiki/concepts/attention.md\` - child page

Parent pages summarize; child pages go deep. The UI renders this as an expandable tree.

## Writing Standards

**Wiki pages must be substantially richer than a chat response.** They are persistent, curated artifacts.

### Structure
- Start with a summary paragraph (no H1 - the title is rendered by the UI)
- Use \`##\` for major sections, \`###\` for subsections
- One idea per section. Bullet points for facts, prose for synthesis.

### Visual Elements - MANDATORY

**Every wiki page MUST include at least one visual element.** A page with only prose is incomplete.

**Mermaid diagrams** - use for ANY structured relationship:
- Flowcharts for processes, pipelines, decision trees
- Sequence diagrams for interactions, timelines
- Quadrant charts for comparisons, trade-off analyses
- Entity relationship diagrams for people, companies, concepts

\`\`\`\`
\`\`\`mermaid
graph LR
    A[Input] --> B[Process] --> C[Output]
\`\`\`
\`\`\`\`

**Tables** - use for ANY structured comparison:
- Feature matrices, pros/cons, timelines, metrics
- If you're listing 3+ items with attributes, it should be a table

**SVG assets** - for custom visuals Mermaid can't express:
- Create: \`write(command="create", path="/wiki/", title="diagram.svg", content="<svg>...</svg>", tags=["diagram"])\`
- Embed in wiki pages: \`![Description](diagram.svg)\`

### Citations - REQUIRED

Every factual claim MUST cite its source via markdown footnotes:
\`\`\`
Transformers use self-attention[^1] that scales quadratically[^2].

[^1]: attention-paper.pdf, p.3
[^2]: scaling-laws.pdf, p.12-14
\`\`\`

Rules:
- Use the FULL source filename - never truncate
- Add page numbers for PDFs: \`paper.pdf, p.3\`
- One citation per claim - don't batch unrelated claims
- Citations render as hoverable popover badges in the UI

### Cross-References
Link between wiki pages using standard markdown links to other wiki paths.

## Core Workflows

### Ingest a New Source
1. Read it: \`read(path="source.pdf", pages="1-10")\`
2. Discuss key takeaways with the user
3. Create or update **concept** pages under \`/wiki/concepts/\`
4. Create or update **entity** pages under \`/wiki/entities/\`
5. Update \`/wiki/overview.md\` - source count, key findings, recent updates
6. Append an entry to \`/wiki/log.md\`
7. A single source typically touches 5-15 wiki pages - that's expected

### Answer a Question
1. \`search(mode="search", query="term")\` to find relevant content
2. Read relevant wiki pages and sources
3. Synthesize with citations
4. If the answer is valuable, file it as a new wiki page - explorations should compound
5. Append a query entry to \`/wiki/log.md\`

### Maintain the Wiki (Lint)
Check for: contradictions, orphan pages, missing cross-references, stale claims, concepts mentioned but lacking their own page. Append a lint entry to \`/wiki/log.md\`.

## Available Knowledge Bases
`;

const PROTECTED_FILES = new Set(["/wiki/overview.md", "/wiki/log.md"]);
const CREATEABLE_TEXT_EXTENSIONS = new Set(["md", "txt", "svg", "csv", "json", "xml", "html"]);
const MAX_LIST = 50;
const MAX_SEARCH = 20;
const MAX_BATCH_CHARS = 120_000;
const MAX_CHUNK_LENGTH = 1800;
const MAX_CHUNK_WITH_OVERLAP = 2400;
const CHUNK_OVERLAP = 200;
const SNIPPET_CONTEXT = 120;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ detail: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
}

export async function requireAccessToken(request: Request) {
  const header = request.headers.get("Authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new ApiError(401, "Unauthorized");
  }
  if (token.trim() !== LOCAL_ACCESS_TOKEN) {
    throw new ApiError(401, "Invalid token");
  }
}

async function getDb(): Promise<D1DatabaseLike> {
  const context = await getCloudflareContext({ async: true });
  const db = (context.env as { DB?: D1DatabaseLike }).DB;
  if (!db) {
    throw new ApiError(500, "D1 binding DB is not configured");
  }
  return db;
}

function ensureId(value: string): number {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Invalid id");
  }
  return id;
}

function toIsoNow() {
  return new Date().toISOString();
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function slugify(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "kb";
}

function humanizeFilename(filename: string) {
  const stem = filename.includes(".") ? filename.slice(0, filename.lastIndexOf(".")) : filename;
  return stem.replace(/[-_]+/g, " ").trim().replace(/\b\w/g, (char) => char.toUpperCase()) || "Untitled";
}

function normalizePath(path: string | null | undefined) {
  const raw = (path ?? "/").trim();
  if (!raw || raw === "/") return "/";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  const clean = withLeading.replace(/\/+/g, "/");
  return clean.endsWith("/") ? clean : `${clean}/`;
}

function relativeWikiPath(path: string, filename: string) {
  return `${path}${filename}`.replace(/^\/wiki\/?/, "");
}

function deepLink(kbSlug: string, doc: { id: number; path: string; filename: string }) {
  if (doc.path.startsWith("/wiki/")) {
    return `${APP_URL}/wikis/${kbSlug}?page=${encodeURIComponent(relativeWikiPath(doc.path, doc.filename))}`;
  }
  return `${APP_URL}/wikis/${kbSlug}?doc=${doc.id}`;
}

function extractTitleFromCreate(title: string) {
  return title.replace(/\.(md|txt|svg|csv|json|xml|html)$/i, "").trim() || title;
}

function toKnowledgeBase(row: KnowledgeBaseRow) {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    source_count: Number(row.source_count ?? 0),
    wiki_page_count: Number(row.wiki_page_count ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toDocument(row: DocumentRow) {
  const metadata = safeJsonParse<Record<string, JsonValue>>(row.metadata_json, {});
  const tags = safeJsonParse<string[]>(row.tags_json, []);

  return {
    id: String(row.id),
    knowledge_base_id: String(row.knowledge_base_id),
    filename: row.filename,
    title: row.title,
    path: row.path,
    file_type: row.file_type,
    content: row.content ?? null,
    tags,
    date: row.date,
    metadata,
    version: Number(row.version),
    sort_order: Number(row.sort_order ?? 0),
    archived: Boolean(row.archived),
    status: "ready",
    page_count: null,
    error_message: null,
    url: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function all<T = Row>(db: D1DatabaseLike, sql: string, values: unknown[] = []) {
  const result = await db.prepare(sql).bind(...values).all<T>();
  return result.results ?? [];
}

async function first<T = Row>(db: D1DatabaseLike, sql: string, values: unknown[] = []) {
  return db.prepare(sql).bind(...values).first<T>();
}

async function run(db: D1DatabaseLike, sql: string, values: unknown[] = []) {
  await db.prepare(sql).bind(...values).run();
}

async function batchRun(db: D1DatabaseLike, statements: Array<{ sql: string; values?: unknown[] }>) {
  if (!statements.length) return;
  if (db.batch) {
    await db.batch(
      statements.map(({ sql, values = [] }) => db.prepare(sql).bind(...values)),
    );
    return;
  }

  for (const statement of statements) {
    await run(db, statement.sql, statement.values ?? []);
  }
}

async function touchKnowledgeBase(db: D1DatabaseLike, knowledgeBaseId: number) {
  await run(
    db,
    "UPDATE knowledge_bases SET updated_at = ? WHERE id = ?",
    [toIsoNow(), knowledgeBaseId],
  );
}

async function ensureUniqueSlug(db: D1DatabaseLike, name: string, ignoreId?: number) {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const row = await first<{ id: number }>(
      db,
      ignoreId
        ? "SELECT id FROM knowledge_bases WHERE slug = ? AND id != ?"
        : "SELECT id FROM knowledge_bases WHERE slug = ?",
      ignoreId ? [candidate, ignoreId] : [candidate],
    );
    if (!row) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

function splitFilename(filename: string) {
  const normalized = filename.trim() || "Untitled.md";
  const index = normalized.lastIndexOf(".");
  if (index <= 0) return { base: normalized, extension: "" };
  return {
    base: normalized.slice(0, index),
    extension: normalized.slice(index),
  };
}

async function ensureUniqueFilename(
  db: D1DatabaseLike,
  knowledgeBaseId: number,
  path: string,
  filename: string,
  ignoreId?: number,
) {
  const { base, extension } = splitFilename(filename);
  let candidate = filename;
  let suffix = 2;

  while (true) {
    const row = await first<{ id: number }>(
      db,
      ignoreId
        ? "SELECT id FROM documents WHERE knowledge_base_id = ? AND path = ? AND filename = ? AND archived = 0 AND id != ?"
        : "SELECT id FROM documents WHERE knowledge_base_id = ? AND path = ? AND filename = ? AND archived = 0",
      ignoreId
        ? [knowledgeBaseId, path, candidate, ignoreId]
        : [knowledgeBaseId, path, candidate],
    );
    if (!row) return candidate;
    candidate = `${base} ${suffix}${extension}`;
    suffix += 1;
  }
}

function scaffoldOverview(name: string) {
  return `This wiki tracks research on ${name}. No sources have been ingested yet.

## Key Findings

No sources ingested yet. Add your first source to get started.

## Recent Updates

No activity yet.
`;
}

function scaffoldLog(name: string) {
  const today = new Date().toISOString().slice(0, 10);
  return `Chronological record of ingests, queries, and maintenance passes.

## [${today}] created | Wiki Created
- Initialized wiki: ${name}
`;
}

type HeadingStack = Array<{ level: number; text: string }>;

function breadcrumbFromStack(stack: HeadingStack) {
  return stack.map((item) => item.text).join(" > ");
}

function chunkText(content: string): ChunkRow[] {
  if (!content.trim()) return [];

  const chunks: ChunkRow[] = [];
  const lines = content.split("\n");
  const stack: HeadingStack = [];
  let buffer = "";
  let bufferHeader = "";

  const pushBuffer = () => {
    const trimmed = buffer.trim();
    if (!trimmed) {
      buffer = "";
      return;
    }

    let remaining = trimmed;
    while (remaining.length > MAX_CHUNK_WITH_OVERLAP) {
      chunks.push({
        content: remaining.slice(0, MAX_CHUNK_LENGTH).trim(),
        header_breadcrumb: bufferHeader,
      });
      remaining = remaining.slice(MAX_CHUNK_LENGTH - CHUNK_OVERLAP).trim();
    }

    if (remaining) {
      chunks.push({
        content: remaining,
        header_breadcrumb: bufferHeader,
      });
    }

    buffer = "";
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)\s*$/);
    if (heading) {
      pushBuffer();
      const level = heading[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      stack.push({ level, text: heading[2].trim() });
      bufferHeader = breadcrumbFromStack(stack);
      buffer = `${line}\n`;
      continue;
    }

    const next = buffer ? `${buffer}\n${line}` : line;
    if (next.length > MAX_CHUNK_LENGTH && buffer.trim()) {
      pushBuffer();
      bufferHeader = breadcrumbFromStack(stack);
      buffer = line;
      continue;
    }
    buffer = next;
  }

  pushBuffer();
  return chunks;
}

async function replaceDocumentChunks(
  db: D1DatabaseLike,
  documentId: number,
  content: string,
  title: string | null,
  filename: string,
  path: string,
) {
  await batchRun(db, [
    {
      sql: "DELETE FROM document_chunks_fts WHERE document_id = ?",
      values: [documentId],
    },
    {
      sql: "DELETE FROM document_chunks WHERE document_id = ?",
      values: [documentId],
    },
  ]);

  const chunks = chunkText(content);
  if (!chunks.length) return;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    await run(
      db,
      "INSERT INTO document_chunks (document_id, chunk_index, content, header_breadcrumb) VALUES (?, ?, ?, ?)",
      [documentId, index, chunk.content, chunk.header_breadcrumb],
    );

    const inserted = await first<{ id: number }>(db, "SELECT last_insert_rowid() AS id");
    const chunkId = inserted?.id;
    if (!chunkId) continue;

    await run(
      db,
      "INSERT INTO document_chunks_fts (document_chunk_id, document_id, content, title, filename, path, header_breadcrumb) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [chunkId, documentId, chunk.content, title ?? "", filename, path, chunk.header_breadcrumb],
    );
  }
}

function ensureCreateableFileType(filename: string) {
  const extension = filename.includes(".")
    ? filename.slice(filename.lastIndexOf(".") + 1).toLowerCase()
    : "md";
  if (!CREATEABLE_TEXT_EXTENSIONS.has(extension)) {
    throw new ApiError(400, `Unsupported file type: ${extension}`);
  }
  return extension;
}

function validateGlob(pattern: string) {
  const supported = new Set([
    "*",
    "**",
    "**/*",
    "*.md",
    "*.txt",
    "**/*.md",
    "**/*.txt",
    "/wiki/**",
    "/wiki/**/*.md",
  ]);

  if (!supported.has(pattern)) {
    throw new ApiError(400, `Unsupported glob pattern: ${pattern}`);
  }
}

function globToRegExp(pattern: string) {
  const normalized =
    pattern === "*" || pattern === "**" || pattern === "**/*"
      ? "/**"
      : pattern.startsWith("/")
        ? pattern
        : `/${pattern}`;

  const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regexSource = escaped
    .replace(/\/\*\*/g, "/::DOUBLESTAR::")
    .replace(/\*\*/g, "::DOUBLESTAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLESTAR::/g, ".*");
  return new RegExp(`^${regexSource}$`);
}

function matchesPattern(filepath: string, pattern: string) {
  if (pattern === "*" || pattern === "**" || pattern === "**/*") {
    return true;
  }

  validateGlob(pattern);
  return globToRegExp(pattern).test(filepath);
}

function extractSnippet(content: string, query: string) {
  if (!content) return "";
  const index = content.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) {
    return content.slice(0, SNIPPET_CONTEXT * 2).trim();
  }

  const start = Math.max(0, index - SNIPPET_CONTEXT);
  const end = Math.min(content.length, index + query.length + SNIPPET_CONTEXT);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}

async function getKnowledgeBaseRowBySlug(db: D1DatabaseLike, slug: string) {
  const row = await first<KnowledgeBaseRow>(
    db,
    `SELECT
      kb.id,
      kb.name,
      kb.slug,
      kb.description,
      kb.created_at,
      kb.updated_at,
      (
        SELECT COUNT(*)
        FROM documents d
        WHERE d.knowledge_base_id = kb.id
          AND d.archived = 0
          AND d.path NOT LIKE '/wiki/%'
      ) AS source_count,
      (
        SELECT COUNT(*)
        FROM documents d
        WHERE d.knowledge_base_id = kb.id
          AND d.archived = 0
          AND d.path LIKE '/wiki/%'
      ) AS wiki_page_count
    FROM knowledge_bases kb
    WHERE kb.slug = ?`,
    [slug],
  );
  if (!row) {
    throw new ApiError(404, `Knowledge base '${slug}' not found`);
  }
  return row;
}

async function getKnowledgeBaseRowById(db: D1DatabaseLike, id: number) {
  const row = await first<KnowledgeBaseRow>(
    db,
    `SELECT
      kb.id,
      kb.name,
      kb.slug,
      kb.description,
      kb.created_at,
      kb.updated_at,
      (
        SELECT COUNT(*)
        FROM documents d
        WHERE d.knowledge_base_id = kb.id
          AND d.archived = 0
          AND d.path NOT LIKE '/wiki/%'
      ) AS source_count,
      (
        SELECT COUNT(*)
        FROM documents d
        WHERE d.knowledge_base_id = kb.id
          AND d.archived = 0
          AND d.path LIKE '/wiki/%'
      ) AS wiki_page_count
    FROM knowledge_bases kb
    WHERE kb.id = ?`,
    [id],
  );
  if (!row) {
    throw new ApiError(404, "Knowledge base not found");
  }
  return row;
}

async function getDocumentRow(db: D1DatabaseLike, id: number) {
  const row = await first<DocumentRow>(
    db,
    `SELECT
      id,
      knowledge_base_id,
      filename,
      title,
      path,
      file_type,
      content,
      tags_json,
      metadata_json,
      date,
      version,
      sort_order,
      archived,
      created_at,
      updated_at
    FROM documents
    WHERE id = ?`,
    [id],
  );
  if (!row) {
    throw new ApiError(404, "Document not found");
  }
  return row;
}

async function getLiveDocumentRow(
  db: D1DatabaseLike,
  knowledgeBaseId: number,
  fullPath: string,
) {
  const normalized = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  const clean = normalized.replace(/\/+/g, "/");
  const lastSlash = clean.lastIndexOf("/");
  const path = clean.slice(0, lastSlash + 1) || "/";
  const filename = clean.slice(lastSlash + 1);
  if (!filename) return null;

  return first<DocumentRow>(
    db,
    `SELECT
      id,
      knowledge_base_id,
      filename,
      title,
      path,
      file_type,
      content,
      tags_json,
      metadata_json,
      date,
      version,
      sort_order,
      archived,
      created_at,
      updated_at
    FROM documents
    WHERE knowledge_base_id = ?
      AND path = ?
      AND filename = ?
      AND archived = 0`,
    [knowledgeBaseId, path, filename],
  );
}

function filenameToFileType(filename: string) {
  if (!filename.includes(".")) return "md";
  return filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
}

function extractSections(content: string, sectionNames: string[]) {
  const wanted = new Set(sectionNames.map((name) => name.toLowerCase()));
  const lines = content.split("\n");
  const sections: Array<{ heading: string; body: string[] }> = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (current) sections.push(current);
      current = { heading: heading[1].trim(), body: [line] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) sections.push(current);

  const matches = sections
    .filter((section) => wanted.has(section.heading.toLowerCase()))
    .map((section) => section.body.join("\n"));
  return matches.length ? matches.join("\n\n") : `No sections matching ${sectionNames.join(", ")} found.`;
}

export async function listKnowledgeBases() {
  const db = await getDb();
  const rows = await all<KnowledgeBaseRow>(
    db,
    `SELECT
      kb.id,
      kb.name,
      kb.slug,
      kb.description,
      kb.created_at,
      kb.updated_at,
      (
        SELECT COUNT(*)
        FROM documents d
        WHERE d.knowledge_base_id = kb.id
          AND d.archived = 0
          AND d.path NOT LIKE '/wiki/%'
      ) AS source_count,
      (
        SELECT COUNT(*)
        FROM documents d
        WHERE d.knowledge_base_id = kb.id
          AND d.archived = 0
          AND d.path LIKE '/wiki/%'
      ) AS wiki_page_count
    FROM knowledge_bases kb
    ORDER BY kb.updated_at DESC`,
  );
  return rows.map(toKnowledgeBase);
}

export async function createKnowledgeBase(input: {
  name?: string;
  description?: string | null;
}) {
  const name = input.name?.trim();
  if (!name) {
    throw new ApiError(400, "name is required");
  }

  const db = await getDb();
  const slug = await ensureUniqueSlug(db, name);
  const now = toIsoNow();

  await run(
    db,
    "INSERT INTO knowledge_bases (name, slug, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [name, slug, input.description?.trim() || null, now, now],
  );

  const created = await first<{ id: number }>(db, "SELECT last_insert_rowid() AS id");
  const knowledgeBaseId = created?.id;
  if (!knowledgeBaseId) {
    throw new ApiError(500, "Failed to create knowledge base");
  }

  const overviewContent = scaffoldOverview(name);
  const logContent = scaffoldLog(name);

  await run(
    db,
    `INSERT INTO documents (
      knowledge_base_id,
      filename,
      title,
      path,
      file_type,
      content,
      tags_json,
      metadata_json,
      sort_order,
      created_at,
      updated_at
    ) VALUES (?, 'overview.md', 'Overview', '/wiki/', 'md', ?, '["overview"]', '{}', -100, ?, ?)`,
    [knowledgeBaseId, overviewContent, now, now],
  );
  const overviewDoc = await first<{ id: number }>(db, "SELECT last_insert_rowid() AS id");
  if (overviewDoc?.id) {
    await replaceDocumentChunks(db, overviewDoc.id, overviewContent, "Overview", "overview.md", "/wiki/");
  }

  await run(
    db,
    `INSERT INTO documents (
      knowledge_base_id,
      filename,
      title,
      path,
      file_type,
      content,
      tags_json,
      metadata_json,
      sort_order,
      created_at,
      updated_at
    ) VALUES (?, 'log.md', 'Log', '/wiki/', 'md', ?, '["log"]', '{}', 100, ?, ?)`,
    [knowledgeBaseId, logContent, now, now],
  );
  const logDoc = await first<{ id: number }>(db, "SELECT last_insert_rowid() AS id");
  if (logDoc?.id) {
    await replaceDocumentChunks(db, logDoc.id, logContent, "Log", "log.md", "/wiki/");
  }

  return toKnowledgeBase(await getKnowledgeBaseRowById(db, knowledgeBaseId));
}

export async function updateKnowledgeBase(id: string, input: {
  name?: string | null;
  description?: string | null;
}) {
  const knowledgeBaseId = ensureId(id);
  const db = await getDb();
  const current = await getKnowledgeBaseRowById(db, knowledgeBaseId);

  const nextName = input.name?.trim() || current.name;
  const nextDescription =
    input.description === undefined ? current.description : input.description?.trim() || null;
  const nextSlug =
    input.name && input.name.trim() !== current.name
      ? await ensureUniqueSlug(db, input.name.trim(), knowledgeBaseId)
      : current.slug;

  await run(
    db,
    "UPDATE knowledge_bases SET name = ?, slug = ?, description = ?, updated_at = ? WHERE id = ?",
    [nextName, nextSlug, nextDescription, toIsoNow(), knowledgeBaseId],
  );

  return toKnowledgeBase(await getKnowledgeBaseRowById(db, knowledgeBaseId));
}

export async function deleteKnowledgeBase(id: string) {
  const knowledgeBaseId = ensureId(id);
  const db = await getDb();
  await getKnowledgeBaseRowById(db, knowledgeBaseId);
  await run(db, "DELETE FROM knowledge_bases WHERE id = ?", [knowledgeBaseId]);
}

export async function listDocuments(knowledgeBaseId: string) {
  const db = await getDb();
  const kbId = ensureId(knowledgeBaseId);
  await getKnowledgeBaseRowById(db, kbId);
  const rows = await all<DocumentRow>(
    db,
    `SELECT
      id,
      knowledge_base_id,
      filename,
      title,
      path,
      file_type,
      tags_json,
      metadata_json,
      date,
      version,
      sort_order,
      archived,
      created_at,
      updated_at
    FROM documents
    WHERE knowledge_base_id = ?
      AND archived = 0
    ORDER BY path, sort_order, filename`,
    [kbId],
  );
  return rows.map(toDocument);
}

export async function createNote(
  knowledgeBaseId: string,
  input: { filename?: string; path?: string; content?: string; title?: string | null },
) {
  const db = await getDb();
  const kbId = ensureId(knowledgeBaseId);
  await getKnowledgeBaseRowById(db, kbId);

  const requestedPath = normalizePath(input.path);
  const requestedFilename = input.filename?.trim() || "Untitled.md";
  const fileType = ensureCreateableFileType(requestedFilename);
  const filename = await ensureUniqueFilename(db, kbId, requestedPath, requestedFilename);
  const title = input.title?.trim() || humanizeFilename(filename);
  const content = input.content ?? "";
  const now = toIsoNow();

  await run(
    db,
    `INSERT INTO documents (
      knowledge_base_id,
      filename,
      title,
      path,
      file_type,
      content,
      tags_json,
      metadata_json,
      version,
      sort_order,
      archived,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, '[]', '{}', 0, 0, 0, ?, ?)`,
    [kbId, filename, title, requestedPath, fileType, content, now, now],
  );

  const created = await first<{ id: number }>(db, "SELECT last_insert_rowid() AS id");
  if (!created?.id) {
    throw new ApiError(500, "Failed to create document");
  }

  await replaceDocumentChunks(db, created.id, content, title, filename, requestedPath);
  await touchKnowledgeBase(db, kbId);

  return toDocument(await getDocumentRow(db, created.id));
}

export async function getDocumentContent(id: string) {
  const db = await getDb();
  const row = await getDocumentRow(db, ensureId(id));
  return {
    id: String(row.id),
    content: row.content ?? "",
    version: Number(row.version),
  };
}

export async function updateDocumentContent(id: string, content: string) {
  const db = await getDb();
  const documentId = ensureId(id);
  const row = await getDocumentRow(db, documentId);
  const nextVersion = Number(row.version) + 1;

  await run(
    db,
    "UPDATE documents SET content = ?, version = ?, updated_at = ? WHERE id = ?",
    [content, nextVersion, toIsoNow(), documentId],
  );
  await replaceDocumentChunks(
    db,
    documentId,
    content,
    row.title,
    row.filename,
    row.path,
  );
  await touchKnowledgeBase(db, row.knowledge_base_id);

  return {
    id: String(documentId),
    content,
    version: nextVersion,
  };
}

export async function updateDocument(
  id: string,
  patch: {
    filename?: string | null;
    path?: string | null;
    title?: string | null;
    tags?: string[] | null;
    date?: string | null;
    metadata?: Record<string, unknown> | null;
    sort_order?: number | null;
  },
) {
  const db = await getDb();
  const documentId = ensureId(id);
  const current = await getDocumentRow(db, documentId);

  const nextPath = patch.path !== undefined ? normalizePath(patch.path) : current.path;
  const nextFilename = patch.filename
    ? await ensureUniqueFilename(
        db,
        current.knowledge_base_id,
        nextPath,
        patch.filename.trim(),
        documentId,
      )
    : current.filename;
  const nextTitle = patch.title === undefined ? current.title : patch.title?.trim() || null;
  const nextTags = patch.tags === undefined
    ? safeJsonParse<string[]>(current.tags_json, [])
    : patch.tags ?? [];
  const nextDate = patch.date === undefined ? current.date : patch.date || null;
  const nextMetadata = patch.metadata === undefined
    ? safeJsonParse<Record<string, JsonValue>>(current.metadata_json, {})
    : patch.metadata ?? {};
  const nextSortOrder = patch.sort_order === undefined
    ? Number(current.sort_order ?? 0)
    : Number(patch.sort_order ?? 0);

  await run(
    db,
    `UPDATE documents
      SET filename = ?, path = ?, title = ?, tags_json = ?, metadata_json = ?, date = ?, sort_order = ?, updated_at = ?
      WHERE id = ?`,
    [
      nextFilename,
      nextPath,
      nextTitle,
      JSON.stringify(nextTags),
      JSON.stringify(nextMetadata),
      nextDate,
      nextSortOrder,
      toIsoNow(),
      documentId,
    ],
  );

  await replaceDocumentChunks(
    db,
    documentId,
    current.content ?? "",
    nextTitle,
    nextFilename,
    nextPath,
  );
  await touchKnowledgeBase(db, current.knowledge_base_id);

  return toDocument(await getDocumentRow(db, documentId));
}

export async function deleteDocument(id: string) {
  const db = await getDb();
  const documentId = ensureId(id);
  const current = await getDocumentRow(db, documentId);
  await run(
    db,
    "UPDATE documents SET archived = 1, updated_at = ? WHERE id = ?",
    [toIsoNow(), documentId],
  );
  await touchKnowledgeBase(db, current.knowledge_base_id);
}

export async function guideAction() {
  return {
    instructions: GUIDE_TEXT,
    knowledge_bases: await listKnowledgeBases(),
  };
}

export async function searchAction(input: {
  knowledge_base: string;
  mode?: "list" | "search";
  query?: string;
  path?: string;
  tags?: string[] | null;
  limit?: number;
}) {
  const db = await getDb();
  const kb = await getKnowledgeBaseRowBySlug(db, input.knowledge_base);
  const pathPattern = input.path?.trim() || "*";
  const wantedTags = new Set((input.tags ?? []).map((tag) => tag.toLowerCase()));

  if ((input.mode ?? "list") === "list") {
    const documents = await listDocuments(String(kb.id));
    const items = documents
      .filter((doc) => matchesPattern(`${doc.path}${doc.filename}`, pathPattern))
      .filter((doc) =>
        wantedTags.size === 0 ||
        [...wantedTags].every((tag) => doc.tags.some((value) => value.toLowerCase() === tag)),
      )
      .slice(0, MAX_LIST)
      .map((doc) => ({
        path: doc.path,
        filename: doc.filename,
        title: doc.title,
        file_type: doc.file_type,
        tags: doc.tags,
        page_count: null,
        updated_at: doc.updated_at,
        kind: doc.path.startsWith("/wiki/") ? "wiki" : "source",
        deep_link: deepLink(kb.slug, {
          id: Number(doc.id),
          path: doc.path,
          filename: doc.filename,
        }),
      }));

    return {
      mode: "list" as const,
      knowledge_base: kb.slug,
      knowledge_base_name: kb.name,
      items,
      matches: [],
      total: items.length,
    };
  }

  const query = input.query?.trim();
  if (!query) {
    throw new ApiError(400, "query is required for search mode");
  }

  const limit = Math.min(Math.max(input.limit ?? 10, 1), MAX_SEARCH);
  const matches = await all<{
    document_id: number;
    content: string;
    title: string;
    filename: string;
    path: string;
    header_breadcrumb: string;
  }>(
    db,
    `SELECT
      document_id,
      content,
      title,
      filename,
      path,
      header_breadcrumb
    FROM document_chunks_fts
    WHERE document_chunks_fts MATCH ?
    LIMIT ?`,
    [query, limit * 4],
  );

  const filtered = matches
    .filter((row) => matchesPattern(`${row.path}${row.filename}`, pathPattern))
    .slice(0, limit);

  return {
    mode: "search" as const,
    knowledge_base: kb.slug,
    knowledge_base_name: kb.name,
    items: [],
    matches: filtered.map((row) => ({
      path: row.path,
      filename: row.filename,
      title: row.title || null,
      file_type: filenameToFileType(row.filename),
      tags: [],
      page: null,
      header_breadcrumb: row.header_breadcrumb ?? "",
      snippet: extractSnippet(row.content, query),
      deep_link: deepLink(kb.slug, {
        id: row.document_id,
        path: row.path,
        filename: row.filename,
      }),
    })),
    total: filtered.length,
  };
}

export async function readAction(input: {
  knowledge_base: string;
  path: string;
  sections?: string[] | null;
}) {
  const db = await getDb();
  const kb = await getKnowledgeBaseRowBySlug(db, input.knowledge_base);
  const requestedPath = input.path.trim();

  if (!requestedPath) {
    throw new ApiError(400, "path is required");
  }

  if (requestedPath.includes("*")) {
    validateGlob(requestedPath);
    const documents = (await all<DocumentRow>(
      db,
      `SELECT
        id,
        knowledge_base_id,
        filename,
        title,
        path,
        file_type,
        content,
        tags_json,
        metadata_json,
        date,
        version,
        sort_order,
        archived,
        created_at,
        updated_at
      FROM documents
      WHERE knowledge_base_id = ?
        AND archived = 0
      ORDER BY path, filename`,
      [kb.id],
    ))
      .map(toDocument)
      .filter((doc) => matchesPattern(`${doc.path}${doc.filename}`, requestedPath));

    let chars = 0;
    const docs = documents.map((doc) => {
      let content = doc.content ?? "";
      let truncated = false;
      if (chars + content.length > MAX_BATCH_CHARS) {
        const remaining = Math.max(0, MAX_BATCH_CHARS - chars);
        content = content.slice(0, remaining);
        truncated = true;
      }
      chars += content.length;
      return {
        path: doc.path,
        filename: doc.filename,
        title: doc.title,
        file_type: doc.file_type,
        tags: doc.tags,
        version: doc.version,
        page_count: null,
        updated_at: doc.updated_at,
        deep_link: deepLink(kb.slug, {
          id: Number(doc.id),
          path: doc.path,
          filename: doc.filename,
        }),
        content,
        truncated,
      };
    });

    if (!docs.length) {
      throw new ApiError(404, `No documents matching '${requestedPath}'`);
    }

    return {
      knowledge_base: kb.slug,
      knowledge_base_name: kb.name,
      documents: docs,
      total: docs.length,
    };
  }

  const document = await getLiveDocumentRow(db, kb.id, requestedPath);
  if (!document) {
    throw new ApiError(404, `Document '${requestedPath}' not found`);
  }

  let content = document.content ?? "";
  if (input.sections?.length) {
    content = extractSections(content, input.sections);
  }

  return {
    knowledge_base: kb.slug,
    knowledge_base_name: kb.name,
    documents: [
      {
        path: document.path,
        filename: document.filename,
        title: document.title,
        file_type: document.file_type,
        tags: safeJsonParse<string[]>(document.tags_json, []),
        version: Number(document.version),
        page_count: null,
        updated_at: document.updated_at,
        deep_link: deepLink(kb.slug, {
          id: document.id,
          path: document.path,
          filename: document.filename,
        }),
        content,
        truncated: false,
      },
    ],
    total: 1,
  };
}

export async function writeAction(input: {
  knowledge_base: string;
  command: "create" | "str_replace" | "append";
  path?: string;
  title?: string;
  content?: string;
  tags?: string[] | null;
  date_str?: string;
  old_text?: string;
  new_text?: string;
}) {
  const db = await getDb();
  const kb = await getKnowledgeBaseRowBySlug(db, input.knowledge_base);

  if (input.command === "create") {
    const title = input.title?.trim();
    if (!title) {
      throw new ApiError(400, "title is required");
    }

    const filename = title.includes(".") ? title : `${title}.md`;
    ensureCreateableFileType(filename);
    const dirPath = normalizePath(input.path || "/wiki/");
    const uniqueFilename = await ensureUniqueFilename(db, kb.id, dirPath, filename);
    const cleanTitle = extractTitleFromCreate(title);
    const tags = input.tags ?? [];
    const content = input.content ?? "";
    const now = toIsoNow();

    await run(
      db,
      `INSERT INTO documents (
        knowledge_base_id,
        filename,
        title,
        path,
        file_type,
        content,
        tags_json,
        metadata_json,
        date,
        version,
        sort_order,
        archived,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, 0, 0, 0, ?, ?)`,
      [
        kb.id,
        uniqueFilename,
        cleanTitle,
        dirPath,
        filenameToFileType(uniqueFilename),
        content,
        JSON.stringify(tags),
        input.date_str || null,
        now,
        now,
      ],
    );
    const created = await first<{ id: number }>(db, "SELECT last_insert_rowid() AS id");
    if (!created?.id) {
      throw new ApiError(500, "Failed to create document");
    }
    await replaceDocumentChunks(db, created.id, content, cleanTitle, uniqueFilename, dirPath);
    await touchKnowledgeBase(db, kb.id);

    return {
      command: "create" as const,
      knowledge_base: kb.slug,
      path: dirPath,
      filename: uniqueFilename,
      title: cleanTitle,
      version: 0,
      message: `Created ${dirPath}${uniqueFilename}`,
      deep_link: deepLink(kb.slug, { id: created.id, path: dirPath, filename: uniqueFilename }),
    };
  }

  const path = input.path?.trim();
  if (!path) {
    throw new ApiError(400, "path is required");
  }

  const document = await getLiveDocumentRow(db, kb.id, path);
  if (!document) {
    throw new ApiError(404, `Document '${path}' not found`);
  }

  const currentContent = document.content ?? "";
  let nextContent = currentContent;

  if (input.command === "str_replace") {
    const oldText = input.old_text ?? "";
    if (!oldText) {
      throw new ApiError(400, "old_text is required");
    }
    const matches = currentContent.split(oldText).length - 1;
    if (matches === 0) {
      throw new ApiError(400, "No match found for old_text");
    }
    if (matches > 1) {
      throw new ApiError(400, "old_text matched multiple times");
    }
    nextContent = currentContent.replace(oldText, input.new_text ?? "");
  } else if (input.command === "append") {
    nextContent = `${currentContent}${currentContent && input.content ? "\n\n" : ""}${input.content ?? ""}`;
  }

  const nextVersion = Number(document.version) + 1;
  await run(
    db,
    "UPDATE documents SET content = ?, version = ?, updated_at = ? WHERE id = ?",
    [nextContent, nextVersion, toIsoNow(), document.id],
  );
  await replaceDocumentChunks(db, document.id, nextContent, document.title, document.filename, document.path);
  await touchKnowledgeBase(db, kb.id);

  return {
    command: input.command,
    knowledge_base: kb.slug,
    path: document.path,
    filename: document.filename,
    title: document.title ?? document.filename,
    version: nextVersion,
    message: `Updated ${document.path}${document.filename}`,
    deep_link: deepLink(kb.slug, {
      id: document.id,
      path: document.path,
      filename: document.filename,
    }),
  };
}

export async function deleteAction(input: {
  knowledge_base: string;
  path: string;
}) {
  const db = await getDb();
  const kb = await getKnowledgeBaseRowBySlug(db, input.knowledge_base);
  const requestedPath = input.path.trim();

  if (!requestedPath || requestedPath === "*" || requestedPath === "**" || requestedPath === "**/*") {
    throw new ApiError(400, "Refusing to delete everything");
  }

  let matched: DocumentRow[] = [];

  if (requestedPath.includes("*")) {
    validateGlob(requestedPath);
    const documents = await all<DocumentRow>(
      db,
      `SELECT
        id,
        knowledge_base_id,
        filename,
        title,
        path,
        file_type,
        content,
        tags_json,
        metadata_json,
        date,
        version,
        sort_order,
        archived,
        created_at,
        updated_at
      FROM documents
      WHERE knowledge_base_id = ?
        AND archived = 0
      ORDER BY path, filename`,
      [kb.id],
    );
    matched = documents.filter((doc) => matchesPattern(`${doc.path}${doc.filename}`, requestedPath));
  } else {
    const document = await getLiveDocumentRow(db, kb.id, requestedPath);
    if (document) matched = [document];
  }

  if (!matched.length) {
    throw new ApiError(404, `No documents matching '${requestedPath}'`);
  }

  const deletable = matched.filter((doc) => !PROTECTED_FILES.has(`${doc.path}${doc.filename}`));
  const skipped = matched
    .filter((doc) => PROTECTED_FILES.has(`${doc.path}${doc.filename}`))
    .map((doc) => `${doc.path}${doc.filename}`);

  if (!deletable.length) {
    throw new ApiError(400, "Only protected files matched");
  }

  await batchRun(
    db,
    deletable.map((doc) => ({
      sql: "UPDATE documents SET archived = 1, updated_at = ? WHERE id = ?",
      values: [toIsoNow(), doc.id],
    })),
  );
  await touchKnowledgeBase(db, kb.id);

  return {
    knowledge_base: kb.slug,
    deleted_paths: deletable.map((doc) => `${doc.path}${doc.filename}`),
    skipped_paths: skipped,
  };
}
