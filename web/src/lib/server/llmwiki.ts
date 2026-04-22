import { NextResponse } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { resolveDocumentPath } from "@/lib/documents";
import type { DocumentSummary } from "@/lib/types";

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

type DocumentSummaryRow = {
  id: number;
  knowledge_base_id: number;
  filename: string;
  title: string | null;
  path: string;
  file_type: string;
  sort_order: number;
  archived: number;
  updated_at: string;
};

type ChunkRow = {
  content: string;
  header_breadcrumb: string;
};

type RelatedArticlePairRow = {
  document_id_a: number;
  document_id_b: number;
};

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "http://localhost:3000";

export const MCP_INSTRUCTIONS = `You are connected to an LLM Wiki workspace. Call \`guide\` first to discover available knowledge bases and learn the workflow rules before using other tools. Use \`search\` and \`read\` to inspect existing content before editing. If no existing knowledge base fits the user's request, call \`create_wiki\` before continuing. Treat raw sources under \`/\` as read-only source material and pages under \`/wiki/\` as the compiled wiki that you maintain with \`write\` and, only when explicitly needed, \`delete\`. Write articles in Japanese. Prefer a concise, encyclopedia-like style similar to Wikipedia, with clear subjects and natural sentence structure. Keep each sentence reasonably short. Articles must still be substantial enough to read as full articles; prioritize completeness and adequate depth over compactness. When a concept first appears in an article, briefly explain it in context. If a technical term or complex concept needs more than a brief explanation, create or expand a dedicated page for it and link to that page from the article. Add markdown hyperlinks in article text where helpful so readers can jump to related articles from the body text.`;

const GUIDE_TEXT = `# LLM Wiki - How It Works

You are connected to an **LLM Wiki** - a personal knowledge workspace where you compile and maintain a structured wiki from raw source documents.

## Architecture

1. **Raw Sources** (path: \`/\`) - uploaded documents (PDFs, notes, images, spreadsheets). Source of truth. Read-only.
2. **Compiled Wiki** (path: \`/wiki/\`) - markdown pages YOU create and maintain. You own this layer.
3. **Tools** - \`guide\`, \`create_wiki\`, \`search\`, \`read\`, \`write\`, \`autolink\`, \`delete\` - your interface to both layers.

If the user needs a new wiki and no suitable knowledge base exists yet, create it first with \`create_wiki\`.

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

### Internal Links and First Mentions - REQUIRED

- When an important concept, entity, method, technology, organization, person, paper, or dataset first appears in an article, briefly explain it in context.
- If that topic already has a dedicated wiki page, link the first natural mention in the article body using a standard markdown link.
- If a technical term or complex concept needs more than a short in-context explanation, create or expand a dedicated page for it and link to that page from the article body.
- Prefer links embedded in natural prose. Do not push important links into a trailing dump of related pages.
- Use \`autolink\` when you want to sweep existing wiki pages and add missing internal links to already-existing pages.

## Core Workflows

### Start a New Wiki
1. Call \`guide()\` to inspect the current knowledge bases
2. If none fit the user's request, call \`create_wiki(name="...", description="...")\`
3. Read \`/wiki/overview.md\` and \`/wiki/log.md\` in the new wiki before adding pages or sources
4. Continue with normal source ingestion or wiki authoring

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

### Sweep Internal Links
Run \`autolink(knowledge_base="...")\` to scan existing wiki pages and add missing internal links where a page already exists for the referenced topic.

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
const KB_LIST_TAG = "knowledge-bases";

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

function toWikiHref(path: string, filename: string) {
  const relativePath = relativeWikiPath(path, filename)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/wiki/${relativePath}`;
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAsciiWordChar(char: string | undefined) {
  return Boolean(char && /[A-Za-z0-9]/.test(char));
}

function isProtectedWikiPath(path: string, filename: string) {
  return PROTECTED_FILES.has(`${path}${filename}`);
}

function isRelatableWikiDocument(path: string, filename: string, fileType: string) {
  return path.startsWith("/wiki/") &&
    (fileType === "md" || fileType === "txt") &&
    !isProtectedWikiPath(path, filename);
}

function safeDecodeUriComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeDocumentPath(path: string) {
  return path
    .split("/")
    .map((segment) => safeDecodeUriComponent(segment))
    .join("/") || "/";
}

function extractInternalWikiLinks(content: string, currentFullPath: string) {
  const relatedPaths = new Set<string>();
  let inFence = false;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || /^\[\^[^\]]+\]:/.test(line)) {
      continue;
    }

    const working = rawLine.replace(/`[^`]+`/g, "");
    const linkRegex = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let match: RegExpExecArray | null = null;
    while ((match = linkRegex.exec(working)) !== null) {
      if (match[0].startsWith("![")) continue;

      const href = match[1]?.trim();
      if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
        continue;
      }

      const withoutHash = href.split("#")[0]?.split("?")[0] ?? "";
      if (!withoutHash) continue;

      const resolved = decodeDocumentPath(resolveDocumentPath(currentFullPath, withoutHash));
      if (!resolved.startsWith("/wiki/")) continue;
      relatedPaths.add(resolved);
    }
  }

  return [...relatedPaths];
}

function canonicalRelatedArticlePair(left: number, right: number): [number, number] {
  return left < right ? [left, right] : [right, left];
}

function relatedArticlePairKey(left: number, right: number) {
  const [a, b] = canonicalRelatedArticlePair(left, right);
  return `${a}:${b}`;
}

function buildAutolinkCandidates(documents: Array<ReturnType<typeof toDocument>>) {
  const candidates = new Map<string, { href: string; targetPath: string }>();
  const docs = documents;
  for (const doc of docs) {
    if (!doc.path.startsWith("/wiki/") || doc.file_type !== "md" || isProtectedWikiPath(doc.path, doc.filename)) {
      continue;
    }

    const href = toWikiHref(doc.path, doc.filename);
    const targetPath = `${doc.path}${doc.filename}`;
    const names = new Set<string>();
    const title = doc.title?.trim();
    const filenameStem = extractTitleFromCreate(doc.filename).trim();
    if (title) names.add(title);
    if (filenameStem) names.add(filenameStem);

    for (const name of names) {
      const normalized = name.trim();
      if (normalized.length < 2) continue;
      candidates.set(normalized, { href, targetPath });
    }
  }

  return [...candidates.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([label, value]) => ({ label, ...value }));
}

function findLinkableIndex(text: string, term: string) {
  if (!term) return -1;

  const needsAsciiBoundary = /[A-Za-z0-9]/.test(term);
  let start = 0;
  while (start < text.length) {
    const index = text.indexOf(term, start);
    if (index === -1) return -1;
    if (!needsAsciiBoundary) return index;

    const prev = index > 0 ? text[index - 1] : undefined;
    const next = index + term.length < text.length ? text[index + term.length] : undefined;
    if (!isAsciiWordChar(prev) && !isAsciiWordChar(next)) {
      return index;
    }
    start = index + term.length;
  }

  return -1;
}

function autolinkMarkdown(
  content: string,
  currentPath: string,
  candidates: Array<{ label: string; href: string; targetPath: string }>,
) {
  const linkedTargets = new Set<string>();
  let linksAdded = 0;
  let inFence = false;

  const nextContent = content
    .split("\n")
    .map((line) => {
      if (/^```/.test(line.trim())) {
        inFence = !inFence;
        return line;
      }
      if (inFence || /^#/.test(line) || /^\[\^[^\]]+\]:/.test(line.trim())) {
        return line;
      }

      const placeholders: string[] = [];
      let working = line.replace(/!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|`[^`]+`/g, (match) => {
        const token = `@@PLACEHOLDER_${placeholders.length}@@`;
        placeholders.push(match);
        return token;
      });

      for (const candidate of candidates) {
        if (candidate.targetPath === currentPath || linkedTargets.has(candidate.targetPath)) {
          continue;
        }
        if (!working.includes(candidate.label)) {
          continue;
        }

        const index = findLinkableIndex(working, candidate.label);
        if (index === -1) {
          continue;
        }

        const replacement = `[${candidate.label}](${candidate.href})`;
        working =
          `${working.slice(0, index)}${replacement}${working.slice(index + candidate.label.length)}`;
        linkedTargets.add(candidate.targetPath);
        linksAdded += 1;
      }

      return working.replace(/@@PLACEHOLDER_(\d+)@@/g, (_, rawIndex: string) => {
        const placeholder = placeholders[Number(rawIndex)];
        return placeholder ?? "";
      });
    })
    .join("\n");

  return { content: nextContent, linksAdded };
}

function buildAutolinkLogEntry(updatedPaths: string[], linksAdded: number) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    `## [${today}] lint | Autolink Sweep`,
    `- Scanned wiki pages for missing internal links`,
    `- Added ${linksAdded} internal link${linksAdded === 1 ? "" : "s"} across ${updatedPaths.length} page${updatedPaths.length === 1 ? "" : "s"}`,
  ];

  for (const path of updatedPaths.slice(0, 10)) {
    lines.push(`- Updated page: [${path.replace(/^\/wiki\//, "")}](${path})`);
  }

  return `${lines.join("\n")}\n`;
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

function toDocumentSummary(row: DocumentSummaryRow): DocumentSummary {
  return {
    id: String(row.id),
    knowledge_base_id: String(row.knowledge_base_id),
    filename: row.filename,
    title: row.title,
    path: row.path,
    file_type: row.file_type,
    status: "ready",
    page_count: null,
    sort_order: Number(row.sort_order ?? 0),
    archived: Boolean(row.archived),
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

function kbDocumentsTag(knowledgeBaseId: number) {
  return `knowledge-base:${knowledgeBaseId}:documents`;
}

function docContentTag(documentId: number) {
  return `document:${documentId}:content`;
}

function invalidateKnowledgeBases() {
  revalidateTag(KB_LIST_TAG, "max");
}

function invalidateKnowledgeBaseDocuments(knowledgeBaseId: number) {
  revalidateTag(kbDocumentsTag(knowledgeBaseId), "max");
}

function invalidateDocumentContent(documentId: number) {
  revalidateTag(docContentTag(documentId), "max");
}

function invalidateDocumentContents(documentIds: Iterable<number>) {
  for (const documentId of new Set(documentIds)) {
    invalidateDocumentContent(documentId);
  }
}

async function listRelatedArticlePairsForDocument(db: D1DatabaseLike, documentId: number) {
  return all<RelatedArticlePairRow>(
    db,
    `SELECT document_id_a, document_id_b
     FROM document_related_articles
     WHERE document_id_a = ?
        OR document_id_b = ?`,
    [documentId, documentId],
  );
}

async function clearRelatedArticlesForDocument(db: D1DatabaseLike, documentId: number) {
  const existingPairs = await listRelatedArticlePairsForDocument(db, documentId);
  if (!existingPairs.length) {
    return [];
  }

  await run(
    db,
    "DELETE FROM document_related_articles WHERE document_id_a = ? OR document_id_b = ?",
    [documentId, documentId],
  );

  return existingPairs.map((pair) =>
    pair.document_id_a === documentId ? pair.document_id_b : pair.document_id_a
  );
}

async function syncRelatedArticlesForDocument(
  db: D1DatabaseLike,
  document: Pick<DocumentRow, "id" | "knowledge_base_id" | "filename" | "path" | "file_type" | "archived">,
  content: string,
) {
  if (!isRelatableWikiDocument(document.path, document.filename, document.file_type) || document.archived) {
    const clearedIds = await clearRelatedArticlesForDocument(db, document.id);
    return [document.id, ...clearedIds];
  }

  const wikiDocuments = await all<Pick<DocumentRow, "id" | "filename" | "path" | "file_type" | "archived">>(
    db,
    `SELECT id, filename, path, file_type, archived
     FROM documents
     WHERE knowledge_base_id = ?
       AND archived = 0
       AND path LIKE '/wiki/%'`,
    [document.knowledge_base_id],
  );

  const documentsByPath = new Map<string, number>();
  for (const row of wikiDocuments) {
    if (!isRelatableWikiDocument(row.path, row.filename, row.file_type)) {
      continue;
    }
    documentsByPath.set(`${row.path}${row.filename}`, Number(row.id));
  }

  const currentFullPath = `${document.path}${document.filename}`;
  const desiredTargetIds = new Set<number>();
  for (const relatedPath of extractInternalWikiLinks(content, currentFullPath)) {
    const relatedId = documentsByPath.get(relatedPath);
    if (!relatedId || relatedId === document.id) continue;
    desiredTargetIds.add(relatedId);
  }

  const existingPairs = await listRelatedArticlePairsForDocument(db, document.id);
  const existingPairKeys = new Set(
    existingPairs.map((pair) => relatedArticlePairKey(pair.document_id_a, pair.document_id_b)),
  );
  const desiredPairs = [...desiredTargetIds].map((relatedId) => canonicalRelatedArticlePair(document.id, relatedId));
  const desiredPairKeys = new Set(
    desiredPairs.map(([left, right]) => relatedArticlePairKey(left, right)),
  );

  const statements: Array<{ sql: string; values?: unknown[] }> = [];

  for (const pair of existingPairs) {
    if (desiredPairKeys.has(relatedArticlePairKey(pair.document_id_a, pair.document_id_b))) {
      continue;
    }
    statements.push({
      sql: "DELETE FROM document_related_articles WHERE document_id_a = ? AND document_id_b = ?",
      values: [pair.document_id_a, pair.document_id_b],
    });
  }

  for (const [left, right] of desiredPairs) {
    if (existingPairKeys.has(relatedArticlePairKey(left, right))) {
      continue;
    }
    statements.push({
      sql: "INSERT INTO document_related_articles (document_id_a, document_id_b) VALUES (?, ?)",
      values: [left, right],
    });
  }

  await batchRun(db, statements);

  const invalidationTargets = new Set<number>([document.id]);
  for (const pair of existingPairs) {
    invalidationTargets.add(pair.document_id_a);
    invalidationTargets.add(pair.document_id_b);
  }
  for (const targetId of desiredTargetIds) {
    invalidationTargets.add(targetId);
  }

  return [...invalidationTargets];
}

async function listKnowledgeBasesRaw() {
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

async function listDocumentsRaw(knowledgeBaseId: string) {
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

async function listDocumentSummariesRaw(knowledgeBaseId: string) {
  const db = await getDb();
  const kbId = ensureId(knowledgeBaseId);
  await getKnowledgeBaseRowById(db, kbId);
  const rows = await all<DocumentSummaryRow>(
    db,
    `SELECT
      id,
      knowledge_base_id,
      filename,
      title,
      path,
      file_type,
      sort_order,
      archived,
      updated_at
    FROM documents
    WHERE knowledge_base_id = ?
      AND archived = 0
    ORDER BY path, sort_order, filename`,
    [kbId],
  );
  return rows.map(toDocumentSummary);
}

async function listRelatedDocumentSummariesRaw(documentId: string) {
  const db = await getDb();
  const docId = ensureId(documentId);
  await getDocumentRow(db, docId);
  const rows = await all<DocumentSummaryRow>(
    db,
    `WITH related_ids AS (
      SELECT document_id_b AS id
      FROM document_related_articles
      WHERE document_id_a = ?
      UNION
      SELECT document_id_a AS id
      FROM document_related_articles
      WHERE document_id_b = ?
    )
    SELECT
      d.id,
      d.knowledge_base_id,
      d.filename,
      d.title,
      d.path,
      d.file_type,
      d.sort_order,
      d.archived,
      d.updated_at
    FROM related_ids r
    JOIN documents d
      ON d.id = r.id
    WHERE d.archived = 0
    ORDER BY d.updated_at DESC, d.path, d.sort_order, d.filename`,
    [docId, docId],
  );
  return rows.map(toDocumentSummary);
}

async function getDocumentContentRaw(id: string) {
  const db = await getDb();
  const row = await getDocumentRow(db, ensureId(id));
  return {
    id: String(row.id),
    content: row.content ?? "",
    version: Number(row.version),
  };
}

async function getDocumentByPathRaw(knowledgeBaseId: string, fullPath: string) {
  const db = await getDb();
  const kbId = ensureId(knowledgeBaseId);
  await getKnowledgeBaseRowById(db, kbId);
  const row = await getLiveDocumentRow(db, kbId, fullPath);
  return row ? toDocument(row) : null;
}

export async function listKnowledgeBases() {
  const read = unstable_cache(listKnowledgeBasesRaw, ["knowledge-bases"], {
    tags: [KB_LIST_TAG],
    revalidate: 60,
  });
  return read();
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

  invalidateKnowledgeBases();
  invalidateKnowledgeBaseDocuments(knowledgeBaseId);
  if (overviewDoc?.id) invalidateDocumentContent(overviewDoc.id);
  if (logDoc?.id) invalidateDocumentContent(logDoc.id);

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

  invalidateKnowledgeBases();
  return toKnowledgeBase(await getKnowledgeBaseRowById(db, knowledgeBaseId));
}

export async function deleteKnowledgeBase(id: string) {
  const knowledgeBaseId = ensureId(id);
  const db = await getDb();
  await getKnowledgeBaseRowById(db, knowledgeBaseId);
  await run(db, "DELETE FROM knowledge_bases WHERE id = ?", [knowledgeBaseId]);
  invalidateKnowledgeBases();
  invalidateKnowledgeBaseDocuments(knowledgeBaseId);
}

export async function listDocuments(knowledgeBaseId: string) {
  const kbId = ensureId(knowledgeBaseId);
  const read = unstable_cache(
    async () => listDocumentsRaw(String(kbId)),
    [`knowledge-base:${kbId}:documents:full`],
    {
      tags: [kbDocumentsTag(kbId)],
      revalidate: 60,
    },
  );
  return read();
}

export async function listDocumentSummaries(knowledgeBaseId: string) {
  const kbId = ensureId(knowledgeBaseId);
  const read = unstable_cache(
    async () => listDocumentSummariesRaw(String(kbId)),
    [`knowledge-base:${kbId}:documents:summaries`],
    {
      tags: [kbDocumentsTag(kbId)],
      revalidate: 60,
    },
  );
  return read();
}

export async function listRelatedDocumentSummaries(documentId: string) {
  const docId = ensureId(documentId);
  const read = unstable_cache(
    async () => listRelatedDocumentSummariesRaw(String(docId)),
    [`document:${docId}:related`],
    {
      tags: [docContentTag(docId)],
      revalidate: 60,
    },
  );
  return read();
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
  const relatedInvalidationIds = await syncRelatedArticlesForDocument(
    db,
    {
      id: created.id,
      knowledge_base_id: kbId,
      filename,
      path: requestedPath,
      file_type: fileType,
      archived: 0,
    },
    content,
  );
  await touchKnowledgeBase(db, kbId);
  invalidateKnowledgeBases();
  invalidateKnowledgeBaseDocuments(kbId);
  invalidateDocumentContents(relatedInvalidationIds);

  return toDocument(await getDocumentRow(db, created.id));
}

export async function getDocumentContent(id: string) {
  const documentId = ensureId(id);
  const read = unstable_cache(
    async () => getDocumentContentRaw(String(documentId)),
    [`document:${documentId}:content`],
    {
      tags: [docContentTag(documentId)],
      revalidate: 60,
    },
  );
  return read();
}

export async function getDocumentByPath(knowledgeBaseId: string, fullPath: string) {
  const kbId = ensureId(knowledgeBaseId);
  const read = unstable_cache(
    async () => getDocumentByPathRaw(String(kbId), fullPath),
    [`knowledge-base:${kbId}:document:${fullPath}`],
    {
      tags: [kbDocumentsTag(kbId)],
      revalidate: 60,
    },
  );
  return read();
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
  const relatedInvalidationIds = await syncRelatedArticlesForDocument(
    db,
    row,
    content,
  );
  await touchKnowledgeBase(db, row.knowledge_base_id);
  invalidateKnowledgeBases();
  invalidateKnowledgeBaseDocuments(row.knowledge_base_id);
  invalidateDocumentContents(relatedInvalidationIds);

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
  const relatedInvalidationIds = await syncRelatedArticlesForDocument(
    db,
    {
      id: documentId,
      knowledge_base_id: current.knowledge_base_id,
      filename: nextFilename,
      path: nextPath,
      file_type: current.file_type,
      archived: current.archived,
    },
    current.content ?? "",
  );
  await touchKnowledgeBase(db, current.knowledge_base_id);
  invalidateKnowledgeBases();
  invalidateKnowledgeBaseDocuments(current.knowledge_base_id);
  invalidateDocumentContents(relatedInvalidationIds);

  return toDocument(await getDocumentRow(db, documentId));
}

export async function deleteDocument(id: string) {
  const db = await getDb();
  const documentId = ensureId(id);
  const current = await getDocumentRow(db, documentId);
  const relatedInvalidationIds = [documentId, ...(await clearRelatedArticlesForDocument(db, documentId))];
  await run(
    db,
    "UPDATE documents SET archived = 1, updated_at = ? WHERE id = ?",
    [toIsoNow(), documentId],
  );
  await touchKnowledgeBase(db, current.knowledge_base_id);
  invalidateKnowledgeBases();
  invalidateKnowledgeBaseDocuments(current.knowledge_base_id);
  invalidateDocumentContents(relatedInvalidationIds);
}

export async function guideAction() {
  return {
    instructions: GUIDE_TEXT,
    knowledge_bases: await listKnowledgeBases(),
  };
}

export async function createWikiAction(input: {
  name?: string;
  description?: string | null;
}) {
  return createKnowledgeBase(input);
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
    const relatedInvalidationIds = await syncRelatedArticlesForDocument(
      db,
      {
        id: created.id,
        knowledge_base_id: kb.id,
        filename: uniqueFilename,
        path: dirPath,
        file_type: filenameToFileType(uniqueFilename),
        archived: 0,
      },
      content,
    );
    await touchKnowledgeBase(db, kb.id);
    invalidateKnowledgeBases();
    invalidateKnowledgeBaseDocuments(kb.id);
    invalidateDocumentContents(relatedInvalidationIds);

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
  const relatedInvalidationIds = await syncRelatedArticlesForDocument(
    db,
    document,
    nextContent,
  );
  await touchKnowledgeBase(db, kb.id);
  invalidateKnowledgeBases();
  invalidateKnowledgeBaseDocuments(kb.id);
  invalidateDocumentContents(relatedInvalidationIds);

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

export async function autolinkAction(input: {
  knowledge_base: string;
}) {
  const db = await getDb();
  const kb = await getKnowledgeBaseRowBySlug(db, input.knowledge_base);
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
    ORDER BY path, sort_order, filename`,
    [kb.id],
  )).map(toDocument);
  const wikiDocs = documents.filter((doc) =>
    doc.path.startsWith("/wiki/") &&
    doc.file_type === "md" &&
    !doc.archived &&
    `${doc.path}${doc.filename}` !== "/wiki/log.md"
  );
  const candidates = buildAutolinkCandidates(wikiDocs);

  const updatedPaths: string[] = [];
  let linksAdded = 0;

  for (const doc of wikiDocs) {
    const currentPath = `${doc.path}${doc.filename}`;
    const { content, linksAdded: added } = autolinkMarkdown(doc.content ?? "", currentPath, candidates);
    if (!added || content === (doc.content ?? "")) {
      continue;
    }

    await updateDocumentContent(doc.id, content);
    updatedPaths.push(currentPath);
    linksAdded += added;
  }

  const logEntry = buildAutolinkLogEntry(updatedPaths, linksAdded);
  const logDocument = await getLiveDocumentRow(db, kb.id, "/wiki/log.md");
  if (logDocument) {
    const nextLogContent = `${logDocument.content ?? ""}${(logDocument.content ?? "").trim() ? "\n\n" : ""}${logEntry}`;
    await updateDocumentContent(String(logDocument.id), nextLogContent);
  }

  return {
    knowledge_base: kb.slug,
    updated_paths: updatedPaths,
    updated_count: updatedPaths.length,
    links_added: linksAdded,
    log_updated: Boolean(logDocument),
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
  invalidateKnowledgeBases();
  invalidateKnowledgeBaseDocuments(kb.id);
  for (const doc of deletable) {
    invalidateDocumentContent(doc.id);
  }

  return {
    knowledge_base: kb.slug,
    deleted_paths: deletable.map((doc) => `${doc.path}${doc.filename}`),
    skipped_paths: skipped,
  };
}
