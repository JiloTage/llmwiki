import re
from datetime import date, datetime
from fnmatch import fnmatch
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from config import settings
from deps import get_user_id
from services.chunker import chunk_text, store_chunks

router = APIRouter(prefix="/v1/actions", tags=["actions"])

GUIDE_DESCRIPTION = (
    "Get started with LLM Wiki. Call this to understand how the knowledge vault works "
    "and see your available knowledge bases."
)

SEARCH_DESCRIPTION = (
    "Browse or search the knowledge vault.\n\n"
    "Sources (raw documents) live at `/`. Wiki pages (LLM-compiled) live at `/wiki/`.\n\n"
    "Modes:\n"
    "- list: browse files and folders\n"
    "- search: keyword search across document content (searches chunks for precise results with page numbers)\n\n"
    "Use `path` to scope: `*` for root, `/wiki/**` for wiki only, `*.pdf` for PDFs, etc.\n"
    "Use `tags` to filter by document tags."
)

READ_DESCRIPTION = (
    "Read document content from the knowledge vault.\n\n"
    "Accepts a single file path OR a glob pattern to batch-read multiple files:\n"
    "- `path=\"notes.md\"` - read one file\n"
    "- `path=\"*.md\"` - read all markdown files in root\n"
    "- `path=\"/wiki/**\"` - read all wiki pages\n"
    "- `path=\"**/*.md\"` - read all markdown files everywhere\n\n"
    "Batch reads are the PREFERRED way to read multiple documents at once - use them generously.\n"
    "Glob reads sample the first few pages from each document (including PDFs) up to a 120k char budget. "
    "This gives you a broad overview of an entire folder in one call. Read individual files for full content.\n\n"
    "For PDFs and office docs, use `pages` to read specific page ranges (e.g. '1-50', '3', '10-30').\n"
    "You can read up to 50+ pages in a single call - use wide ranges to avoid unnecessary round trips.\n"
    "For spreadsheets, each sheet is a page (call without pages first to see sheet names).\n"
    "When reading sources to compile wiki pages, note the filename and page ranges for citation."
)

WRITE_DESCRIPTION = (
    "Create or edit notes and wiki pages in the knowledge vault.\n\n"
    "Wiki pages should be created under `/wiki/` and should cite their sources using "
    "markdown footnotes (e.g. `[^1]: paper.pdf, p.3`).\n\n"
    "You can also create SVG diagrams and CSV data files as wiki assets:\n"
    "- `write(command=\"create\", path=\"/wiki/\", title=\"architecture-diagram.svg\", content=\"<svg>...</svg>\", tags=[\"diagram\"])`\n"
    "- `write(command=\"create\", path=\"/wiki/\", title=\"data-table.csv\", content=\"col1,col2\\nval1,val2\", tags=[\"data\"])`\n"
    "SVGs and other assets can be embedded in wiki pages via `![Architecture](architecture-diagram.svg)`\n\n"
    "Commands:\n"
    "- create: create a new page (title and tags are REQUIRED)\n"
    "- str_replace: replace exact text in an existing page (read first)\n"
    "- append: add content to the end of an existing page"
)

DELETE_DESCRIPTION = (
    "Delete documents or wiki pages from the knowledge vault.\n\n"
    "Provide a path to delete a single file, or a glob pattern to delete multiple.\n"
    "Examples:\n"
    "- `path=\"old-notes.md\"` - delete a single file\n"
    "- `path=\"/wiki/drafts/*\"` - delete all files in a folder\n"
    "- `path=\"/wiki/**\"` - delete the entire wiki\n\n"
    "Note: overview.md and log.md are structural pages and cannot be deleted.\n"
    "Returns a list of deleted files. This action cannot be undone."
)

GUIDE_TEXT = """# LLM Wiki - How It Works

You are connected to an **LLM Wiki** - a personal knowledge workspace where you compile and maintain a structured wiki from raw source documents.

## Architecture

1. **Raw Sources** (path: `/`) - uploaded documents (PDFs, notes, images, spreadsheets). Source of truth. Read-only.
2. **Compiled Wiki** (path: `/wiki/`) - markdown pages YOU create and maintain. You own this layer.
3. **Tools** - `search`, `read`, `write`, `delete` - your interface to both layers.

## Wiki Structure

Every wiki follows this structure. These categories are not suggestions - they are the backbone of the wiki.

### Overview (`/wiki/overview.md`) - THE HUB PAGE
Always exists. This is the front page of the wiki. It must contain:
- A summary of what this wiki covers and its scope
- **Source count** and page count (update on every ingest)
- **Key Findings** - the most important insights across all sources
- **Recent Updates** - last 5-10 actions (ingests, new pages, revisions)

Update the Overview after EVERY ingest or major edit. If you only update one page, it should be this one.

### Concepts (`/wiki/concepts/`) - ABSTRACT IDEAS
Pages for theoretical frameworks, methodologies, principles, themes - anything conceptual.
- `/wiki/concepts/scaling-laws.md`
- `/wiki/concepts/attention-mechanisms.md`
- `/wiki/concepts/self-supervised-learning.md`

Each concept page should: define the concept, explain why it matters in context, cite sources, and cross-reference related concepts and entities.

### Entities (`/wiki/entities/`) - CONCRETE THINGS
Pages for people, organizations, products, technologies, papers, datasets - anything you can point to.
- `/wiki/entities/transformer.md`
- `/wiki/entities/openai.md`
- `/wiki/entities/attention-is-all-you-need.md`

Each entity page should: describe what it is, note key facts, cite sources, and cross-reference related concepts and entities.

### Log (`/wiki/log.md`) - CHRONOLOGICAL RECORD
Always exists. Append-only. Records every ingest, major edit, and lint pass. Never delete entries.

Format - each entry starts with a parseable header:
```
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
```

### Additional Pages
You can create pages outside of concepts/ and entities/ when needed:
- `/wiki/comparisons/x-vs-y.md` - for deep comparisons
- `/wiki/timeline.md` - for chronological narratives

But concepts/ and entities/ are the primary categories. When in doubt, file there.

## Page Hierarchy

Wiki pages use a parent/child hierarchy via paths:
- `/wiki/concepts.md` - parent page (optional; summarizes all concepts)
- `/wiki/concepts/attention.md` - child page

Parent pages summarize; child pages go deep. The UI renders this as an expandable tree.

## Writing Standards

**Wiki pages must be substantially richer than a chat response.** They are persistent, curated artifacts.

### Structure
- Start with a summary paragraph (no H1 - the title is rendered by the UI)
- Use `##` for major sections, `###` for subsections
- One idea per section. Bullet points for facts, prose for synthesis.

### Visual Elements - MANDATORY

**Every wiki page MUST include at least one visual element.** A page with only prose is incomplete.

**Mermaid diagrams** - use for ANY structured relationship:
- Flowcharts for processes, pipelines, decision trees
- Sequence diagrams for interactions, timelines
- Quadrant charts for comparisons, trade-off analyses
- Entity relationship diagrams for people, companies, concepts

````
```mermaid
graph LR
    A[Input] --> B[Process] --> C[Output]
```
````

**Tables** - use for ANY structured comparison:
- Feature matrices, pros/cons, timelines, metrics
- If you're listing 3+ items with attributes, it should be a table

**SVG assets** - for custom visuals Mermaid can't express:
- Create: `write(command="create", path="/wiki/", title="diagram.svg", content="<svg>...</svg>", tags=["diagram"])`
- Embed in wiki pages: `![Description](diagram.svg)`

### Citations - REQUIRED

Every factual claim MUST cite its source via markdown footnotes:
```
Transformers use self-attention[^1] that scales quadratically[^2].

[^1]: attention-paper.pdf, p.3
[^2]: scaling-laws.pdf, p.12-14
```

Rules:
- Use the FULL source filename - never truncate
- Add page numbers for PDFs: `paper.pdf, p.3`
- One citation per claim - don't batch unrelated claims
- Citations render as hoverable popover badges in the UI

### Cross-References
Link between wiki pages using standard markdown links to other wiki paths.

## Core Workflows

### Ingest a New Source
1. Read it: `read(path="source.pdf", pages="1-10")`
2. Discuss key takeaways with the user
3. Create or update **concept** pages under `/wiki/concepts/`
4. Create or update **entity** pages under `/wiki/entities/`
5. Update `/wiki/overview.md` - source count, key findings, recent updates
6. Append an entry to `/wiki/log.md`
7. A single source typically touches 5-15 wiki pages - that's expected

### Answer a Question
1. `search(mode="search", query="term")` to find relevant content
2. Read relevant wiki pages and sources
3. Synthesize with citations
4. If the answer is valuable, file it as a new wiki page - explorations should compound
5. Append a query entry to `/wiki/log.md`

### Maintain the Wiki (Lint)
Check for: contradictions, orphan pages, missing cross-references, stale claims, concepts mentioned but lacking their own page. Append a lint entry to `/wiki/log.md`.

## Available Knowledge Bases

"""

MAX_LIST = 50
MAX_SEARCH = 20
MAX_BATCH_CHARS = 120_000
CONTEXT_CHARS = 120
TEXT_TYPES = {"md", "txt", "csv", "html", "svg", "json", "xml"}
SPREADSHEET_TYPES = {"xlsx", "xls", "csv"}
PAGED_TYPES = {"pdf", "pptx", "ppt", "docx", "doc", "xlsx", "xls", "csv"}
ASSET_EXTENSIONS = {".svg", ".csv", ".json", ".xml", ".html"}
PROTECTED_FILES = {("/wiki/", "overview.md"), ("/wiki/", "log.md")}


class GuideKnowledgeBase(BaseModel):
    name: str
    slug: str
    source_count: int
    wiki_page_count: int


class GuideResponse(BaseModel):
    instructions: str
    knowledge_bases: list[GuideKnowledgeBase]


class SearchRequest(BaseModel):
    knowledge_base: str = Field(description="Knowledge base slug")
    mode: Literal["list", "search"] = "list"
    query: str = ""
    path: str = "*"
    tags: list[str] | None = None
    limit: int = 10


class SearchListItem(BaseModel):
    path: str
    filename: str
    title: str | None
    file_type: str
    tags: list[str]
    page_count: int | None
    updated_at: datetime | None
    kind: Literal["source", "wiki"]
    deep_link: str


class SearchMatch(BaseModel):
    path: str
    filename: str
    title: str | None
    file_type: str
    tags: list[str]
    page: int | None
    header_breadcrumb: str
    snippet: str
    deep_link: str


class SearchResponse(BaseModel):
    mode: Literal["list", "search"]
    knowledge_base: str
    knowledge_base_name: str
    items: list[SearchListItem] = []
    matches: list[SearchMatch] = []
    total: int


class ReadRequest(BaseModel):
    knowledge_base: str
    path: str
    pages: str = ""
    sections: list[str] | None = None


class ReadDocument(BaseModel):
    path: str
    filename: str
    title: str | None
    file_type: str
    tags: list[str]
    version: int
    page_count: int | None
    updated_at: datetime | None
    deep_link: str
    content: str
    truncated: bool = False


class ReadResponse(BaseModel):
    knowledge_base: str
    knowledge_base_name: str
    documents: list[ReadDocument]
    total: int


class WriteRequest(BaseModel):
    knowledge_base: str
    command: Literal["create", "str_replace", "append"]
    path: str = "/"
    title: str = ""
    content: str = ""
    tags: list[str] | None = None
    date_str: str = ""
    old_text: str = ""
    new_text: str = ""


class WriteResponse(BaseModel):
    command: Literal["create", "str_replace", "append"]
    knowledge_base: str
    path: str
    filename: str
    title: str
    version: int
    message: str
    deep_link: str


class DeleteRequest(BaseModel):
    knowledge_base: str
    path: str


class DeleteResponse(BaseModel):
    knowledge_base: str
    deleted_paths: list[str]
    skipped_paths: list[str] = []


def _deep_link(kb_slug: str, path: str, filename: str) -> str:
    full = (path.rstrip("/") + "/" + filename).lstrip("/")
    return f"{settings.APP_URL}/wikis/{kb_slug}/{full}"


def _resolve_path(path: str) -> tuple[str, str]:
    clean = path.lstrip("/")
    if "/" in clean:
        dir_path, filename = clean.rsplit("/", 1)
        return f"/{dir_path}/", filename
    return "/", clean


def _glob_match(filepath: str, pattern: str) -> bool:
    return fnmatch(filepath, pattern)


def _extract_snippet(content: str, query: str) -> str:
    if not content:
        return ""
    idx = content.lower().find(query.lower())
    if idx < 0:
        return content[: CONTEXT_CHARS * 2].strip()
    start = max(0, idx - CONTEXT_CHARS)
    end = min(len(content), idx + len(query) + CONTEXT_CHARS)
    snippet = content[start:end].strip()
    if start > 0:
        snippet = "..." + snippet
    if end < len(content):
        snippet = snippet + "..."
    return snippet


def _parse_page_range(pages_str: str, max_page: int) -> list[int]:
    result: set[int] = set()
    for part in pages_str.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            if not start.strip().isdigit() or not end.strip().isdigit():
                continue
            start_num = int(start.strip())
            end_num = int(end.strip())
            for page in range(max(1, start_num), min(max_page, end_num) + 1):
                result.add(page)
        elif part.isdigit():
            page = int(part)
            if 1 <= page <= max_page:
                result.add(page)
    return sorted(result)


def _extract_sections(content: str, section_names: list[str]) -> str:
    lines = content.splitlines()
    sections: list[tuple[str, str]] = []
    current_name = None
    current_lines: list[str] = []

    for line in lines:
        if line.startswith("#"):
            if current_name and current_lines:
                sections.append((current_name, "\n".join(current_lines)))
            current_name = line.lstrip("#").strip()
            current_lines = [line]
            continue
        if current_name:
            current_lines.append(line)

    if current_name and current_lines:
        sections.append((current_name, "\n".join(current_lines)))

    wanted = {name.lower() for name in section_names}
    matched = [text for name, text in sections if name.lower() in wanted]
    if not matched:
        return f"No sections matching {section_names} found."
    return "\n\n".join(matched)


async def _resolve_kb(pool, user_id: str, slug: str) -> dict:
    kb = await pool.fetchrow(
        "SELECT id, name, slug FROM knowledge_bases WHERE slug = $1 AND user_id = $2",
        slug,
        user_id,
    )
    if not kb:
        raise HTTPException(status_code=404, detail=f"Knowledge base '{slug}' not found")
    return dict(kb)


async def _get_document(pool, user_id: str, kb_id, path: str) -> dict | None:
    dir_path, filename = _resolve_path(path)
    doc = await pool.fetchrow(
        "SELECT id, user_id, filename, title, path, content, tags, version, file_type, "
        "page_count, created_at, updated_at "
        "FROM documents "
        "WHERE knowledge_base_id = $1 AND user_id = $2 AND filename = $3 AND path = $4 AND NOT archived",
        kb_id,
        user_id,
        filename,
        dir_path,
    )
    if doc:
        return dict(doc)

    fallback_name = path.lstrip("/").split("/")[-1]
    doc = await pool.fetchrow(
        "SELECT id, user_id, filename, title, path, content, tags, version, file_type, "
        "page_count, created_at, updated_at "
        "FROM documents "
        "WHERE knowledge_base_id = $1 AND user_id = $2 AND (filename = $3 OR title = $3) AND NOT archived",
        kb_id,
        user_id,
        fallback_name,
    )
    return dict(doc) if doc else None


async def _store_document_chunks(conn, document_id: str, user_id: str, kb_id: str, file_type: str, content: str) -> None:
    chunks = chunk_text(content) if file_type in TEXT_TYPES and content else []
    await store_chunks(conn, document_id, user_id, kb_id, chunks)


def _document_kind(path: str) -> Literal["source", "wiki"]:
    return "wiki" if path.startswith("/wiki/") else "source"


@router.post(
    "/guide",
    response_model=GuideResponse,
    summary="guide",
    description=GUIDE_DESCRIPTION,
)
async def guide_action(
    user_id: Annotated[str, Depends(get_user_id)],
    request: Request,
):
    pool = request.app.state.pool
    rows = await pool.fetch(
        "SELECT kb.name, kb.slug, "
        "  (SELECT COUNT(*) FROM documents d "
        "   WHERE d.knowledge_base_id = kb.id AND d.path NOT LIKE '/wiki/%' AND NOT d.archived) AS source_count, "
        "  (SELECT COUNT(*) FROM documents d "
        "   WHERE d.knowledge_base_id = kb.id AND d.path LIKE '/wiki/%' AND NOT d.archived) AS wiki_page_count "
        "FROM knowledge_bases kb "
        "WHERE kb.user_id = $1 "
        "ORDER BY kb.created_at DESC",
        user_id,
    )
    return GuideResponse(
        instructions=GUIDE_TEXT,
        knowledge_bases=[GuideKnowledgeBase(**dict(row)) for row in rows],
    )


@router.post(
    "/search",
    response_model=SearchResponse,
    summary="search",
    description=SEARCH_DESCRIPTION,
)
async def search_action(
    body: SearchRequest,
    user_id: Annotated[str, Depends(get_user_id)],
    request: Request,
):
    pool = request.app.state.pool
    kb = await _resolve_kb(pool, user_id, body.knowledge_base)

    if body.mode == "list":
        docs = await pool.fetch(
            "SELECT filename, title, path, file_type, tags, page_count, updated_at "
            "FROM documents "
            "WHERE knowledge_base_id = $1 AND user_id = $2 AND NOT archived "
            "ORDER BY path, filename",
            kb["id"],
            user_id,
        )
        glob_pat = body.path if body.path.startswith("/") else "/" + body.path.lstrip("/")
        if body.path in ("*", "**", "**/*"):
            filtered = list(docs)
        else:
            filtered = [doc for doc in docs if _glob_match(doc["path"] + doc["filename"], glob_pat)]
        if body.tags:
            wanted = {tag.lower() for tag in body.tags}
            filtered = [
                doc for doc in filtered
                if wanted.issubset({tag.lower() for tag in (doc["tags"] or [])})
            ]
        items = [
            SearchListItem(
                path=doc["path"],
                filename=doc["filename"],
                title=doc["title"],
                file_type=doc["file_type"],
                tags=doc["tags"] or [],
                page_count=doc["page_count"],
                updated_at=doc["updated_at"],
                kind=_document_kind(doc["path"]),
                deep_link=_deep_link(kb["slug"], doc["path"], doc["filename"]),
            )
            for doc in filtered[:MAX_LIST]
        ]
        return SearchResponse(
            mode="list",
            knowledge_base=kb["slug"],
            knowledge_base_name=kb["name"],
            items=items,
            total=len(filtered),
        )

    if not body.query:
        raise HTTPException(status_code=400, detail="query is required for search mode")

    limit = min(body.limit, MAX_SEARCH)
    rows = await pool.fetch(
        "SELECT dc.content, dc.page, COALESCE(dc.header_breadcrumb, '') AS header_breadcrumb, "
        "  d.filename, d.title, d.path, d.file_type, d.tags "
        "FROM document_chunks dc "
        "JOIN documents d ON d.id = dc.document_id "
        "WHERE dc.knowledge_base_id = $1 "
        "  AND d.user_id = $2 "
        "  AND NOT d.archived "
        "  AND dc.content ILIKE $3 "
        "ORDER BY d.updated_at DESC, dc.chunk_index "
        "LIMIT $4",
        kb["id"],
        user_id,
        f"%{body.query}%",
        limit,
    )
    matches = list(rows)
    if body.path not in ("*", "**", "**/*"):
        glob_pat = body.path if body.path.startswith("/") else "/" + body.path.lstrip("/")
        matches = [row for row in matches if _glob_match(row["path"] + row["filename"], glob_pat)]
    if body.tags:
        wanted = {tag.lower() for tag in body.tags}
        matches = [
            row for row in matches
            if wanted.issubset({tag.lower() for tag in (row["tags"] or [])})
        ]

    return SearchResponse(
        mode="search",
        knowledge_base=kb["slug"],
        knowledge_base_name=kb["name"],
        matches=[
            SearchMatch(
                path=row["path"],
                filename=row["filename"],
                title=row["title"],
                file_type=row["file_type"],
                tags=row["tags"] or [],
                page=row["page"],
                header_breadcrumb=row["header_breadcrumb"],
                snippet=_extract_snippet(row["content"], body.query),
                deep_link=_deep_link(kb["slug"], row["path"], row["filename"]),
            )
            for row in matches
        ],
        total=len(matches),
    )


@router.post(
    "/read",
    response_model=ReadResponse,
    summary="read",
    description=READ_DESCRIPTION,
)
async def read_action(
    body: ReadRequest,
    user_id: Annotated[str, Depends(get_user_id)],
    request: Request,
):
    pool = request.app.state.pool
    kb = await _resolve_kb(pool, user_id, body.knowledge_base)

    if "*" in body.path or "?" in body.path:
        docs = await pool.fetch(
            "SELECT id, filename, title, path, content, tags, version, file_type, page_count, updated_at "
            "FROM documents "
            "WHERE knowledge_base_id = $1 AND user_id = $2 AND NOT archived "
            "ORDER BY path, filename",
            kb["id"],
            user_id,
        )
        glob_pat = body.path if body.path.startswith("/") else "/" + body.path.lstrip("/")
        matched = [doc for doc in docs if _glob_match(doc["path"] + doc["filename"], glob_pat)]
        if not matched:
            raise HTTPException(status_code=404, detail=f"No documents matching '{body.path}'")

        documents: list[ReadDocument] = []
        chars_used = 0
        for doc in matched:
            if chars_used >= MAX_BATCH_CHARS:
                break
            content = doc["content"] or ""
            truncated = False
            remaining = MAX_BATCH_CHARS - chars_used
            if doc["file_type"] in TEXT_TYPES:
                if len(content) > remaining:
                    content = content[:remaining]
                    truncated = True
                chars_used += len(content)
            elif (doc["page_count"] or 0) > 0:
                page_rows = await pool.fetch(
                    "SELECT page, content FROM document_pages WHERE document_id = $1 ORDER BY page",
                    doc["id"],
                )
                parts: list[str] = []
                for row in page_rows:
                    page_text = f"Page {row['page']}\n\n{row['content']}"
                    if chars_used + len(page_text) > MAX_BATCH_CHARS:
                        remaining = MAX_BATCH_CHARS - chars_used
                        if remaining > 0:
                            parts.append(page_text[:remaining])
                            chars_used = MAX_BATCH_CHARS
                            truncated = True
                        break
                    parts.append(page_text)
                    chars_used += len(page_text)
                content = "\n\n".join(parts)
            else:
                content = ""
            documents.append(
                ReadDocument(
                    path=doc["path"],
                    filename=doc["filename"],
                    title=doc["title"],
                    file_type=doc["file_type"],
                    tags=doc["tags"] or [],
                    version=doc["version"],
                    page_count=doc["page_count"],
                    updated_at=doc["updated_at"],
                    deep_link=_deep_link(kb["slug"], doc["path"], doc["filename"]),
                    content=content,
                    truncated=truncated,
                )
            )

        return ReadResponse(
            knowledge_base=kb["slug"],
            knowledge_base_name=kb["name"],
            documents=documents,
            total=len(documents),
        )

    doc = await _get_document(pool, user_id, kb["id"], body.path)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{body.path}' not found")

    content = doc["content"] or ""
    if doc["file_type"] in PAGED_TYPES and body.pages:
        page_numbers = _parse_page_range(body.pages, doc["page_count"] or 1)
        if not page_numbers:
            raise HTTPException(status_code=400, detail="Invalid page range")
        page_rows = await pool.fetch(
            "SELECT page, content, elements FROM document_pages "
            "WHERE document_id = $1 AND page = ANY($2) ORDER BY page",
            doc["id"],
            page_numbers,
        )
        if not page_rows:
            raise HTTPException(status_code=404, detail="No page data found")
        content = "\n\n".join(f"Page {row['page']}\n\n{row['content']}" for row in page_rows)
    elif doc["file_type"] in SPREADSHEET_TYPES and not body.pages:
        page_rows = await pool.fetch(
            "SELECT page, content, elements FROM document_pages WHERE document_id = $1 ORDER BY page",
            doc["id"],
        )
        if page_rows:
            lines = ["Sheets:"]
            for row in page_rows:
                elements = row["elements"] or {}
                sheet_name = elements.get("sheet_name", f"Sheet {row['page']}")
                lines.append(f"- Page {row['page']}: {sheet_name}")
            content = "\n".join(lines)
    elif body.sections:
        content = _extract_sections(content, body.sections)

    return ReadResponse(
        knowledge_base=kb["slug"],
        knowledge_base_name=kb["name"],
        documents=[
            ReadDocument(
                path=doc["path"],
                filename=doc["filename"],
                title=doc["title"],
                file_type=doc["file_type"],
                tags=doc["tags"] or [],
                version=doc["version"],
                page_count=doc["page_count"],
                updated_at=doc["updated_at"],
                deep_link=_deep_link(kb["slug"], doc["path"], doc["filename"]),
                content=content,
            )
        ],
        total=1,
    )


@router.post(
    "/write",
    response_model=WriteResponse,
    summary="write",
    description=WRITE_DESCRIPTION,
)
async def write_action(
    body: WriteRequest,
    user_id: Annotated[str, Depends(get_user_id)],
    request: Request,
):
    pool = request.app.state.pool
    kb = await _resolve_kb(pool, user_id, body.knowledge_base)

    if body.command == "create":
        if not body.title:
            raise HTTPException(status_code=400, detail="title is required")
        if not body.tags:
            raise HTTPException(status_code=400, detail="at least one tag is required")

        dir_path = body.path if body.path.endswith("/") else body.path + "/"
        if not dir_path.startswith("/"):
            dir_path = "/" + dir_path

        title_lower = body.title.lower()
        asset_ext = next((ext for ext in ASSET_EXTENSIONS if title_lower.endswith(ext)), None)
        if asset_ext:
            filename = re.sub(r"[^\w\s\-.]", "", title_lower.replace(" ", "-"))
            file_type = asset_ext.lstrip(".")
        else:
            slug = re.sub(r"\.(md|txt)$", "", title_lower)
            filename = re.sub(r"[^\w\s\-.]", "", slug.replace(" ", "-"))
            if not filename.endswith(".md"):
                filename += ".md"
            file_type = "md"

        clean_title = re.sub(r"\.(md|txt|svg|csv|json|xml|html)$", "", body.title)
        if clean_title == clean_title.lower() and "-" in clean_title:
            clean_title = clean_title.replace("-", " ").replace("_", " ").strip().title()

        note_date = body.date_str or date.today().isoformat()
        conn = await pool.acquire()
        try:
            async with conn.transaction():
                row = await conn.fetchrow(
                    "INSERT INTO documents (knowledge_base_id, user_id, filename, title, path, "
                    "file_type, status, content, tags, version, date) "
                    "VALUES ($1, $2, $3, $4, $5, $6, 'ready', $7, $8, 0, $9) "
                    "RETURNING id, filename, title, path, version",
                    kb["id"],
                    user_id,
                    filename,
                    clean_title,
                    dir_path,
                    file_type,
                    body.content,
                    body.tags,
                    note_date,
                )
                await _store_document_chunks(conn, str(row["id"]), user_id, str(kb["id"]), file_type, body.content)
        finally:
            await pool.release(conn)

        return WriteResponse(
            command="create",
            knowledge_base=kb["slug"],
            path=row["path"],
            filename=row["filename"],
            title=row["title"],
            version=row["version"],
            message=f"Created {row['path']}{row['filename']}",
            deep_link=_deep_link(kb["slug"], row["path"], row["filename"]),
        )

    doc = await _get_document(pool, user_id, kb["id"], body.path)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{body.path}' not found")

    if body.command == "str_replace":
        if not body.old_text:
            raise HTTPException(status_code=400, detail="old_text is required")
        content = doc["content"] or ""
        count = content.count(body.old_text)
        if count == 0:
            raise HTTPException(status_code=400, detail="No match found for old_text")
        if count > 1:
            raise HTTPException(status_code=400, detail="old_text matched multiple times")
        new_content = content.replace(body.old_text, body.new_text, 1)
    elif body.command == "append":
        base = doc["content"] or ""
        separator = "\n\n" if base and body.content else ""
        new_content = f"{base}{separator}{body.content}"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown command '{body.command}'")

    conn = await pool.acquire()
    try:
        async with conn.transaction():
            row = await conn.fetchrow(
                "UPDATE documents SET content = $1, version = version + 1, updated_at = now() "
                "WHERE id = $2 AND user_id = $3 "
                "RETURNING id, filename, title, path, version, file_type",
                new_content,
                doc["id"],
                user_id,
            )
            await _store_document_chunks(
                conn,
                str(row["id"]),
                user_id,
                str(kb["id"]),
                row["file_type"],
                new_content,
            )
    finally:
        await pool.release(conn)

    return WriteResponse(
        command=body.command,
        knowledge_base=kb["slug"],
        path=row["path"],
        filename=row["filename"],
        title=row["title"] or row["filename"],
        version=row["version"],
        message=f"Updated {row['path']}{row['filename']}",
        deep_link=_deep_link(kb["slug"], row["path"], row["filename"]),
    )


@router.post(
    "/delete",
    response_model=DeleteResponse,
    summary="delete",
    description=DELETE_DESCRIPTION,
)
async def delete_action(
    body: DeleteRequest,
    user_id: Annotated[str, Depends(get_user_id)],
    request: Request,
):
    pool = request.app.state.pool
    kb = await _resolve_kb(pool, user_id, body.knowledge_base)

    if body.path in ("", "*", "**", "**/*"):
        raise HTTPException(status_code=400, detail="Refusing to delete everything")

    if "*" in body.path or "?" in body.path:
        docs = await pool.fetch(
            "SELECT id, filename, path FROM documents "
            "WHERE knowledge_base_id = $1 AND user_id = $2 AND NOT archived "
            "ORDER BY path, filename",
            kb["id"],
            user_id,
        )
        glob_pat = body.path if body.path.startswith("/") else "/" + body.path.lstrip("/")
        matched = [dict(doc) for doc in docs if _glob_match(doc["path"] + doc["filename"], glob_pat)]
    else:
        doc = await _get_document(pool, user_id, kb["id"], body.path)
        matched = [doc] if doc else []

    if not matched:
        raise HTTPException(status_code=404, detail=f"No documents matching '{body.path}'")

    deletable = [doc for doc in matched if (doc["path"], doc["filename"]) not in PROTECTED_FILES]
    skipped = [f"{doc['path']}{doc['filename']}" for doc in matched if doc not in deletable]

    if not deletable:
        raise HTTPException(status_code=400, detail="Only protected files matched")

    await pool.execute(
        "UPDATE documents SET archived = true, updated_at = now() "
        "WHERE id = ANY($1::uuid[]) AND user_id = $2",
        [str(doc["id"]) for doc in deletable],
        user_id,
    )
    return DeleteResponse(
        knowledge_base=kb["slug"],
        deleted_paths=[f"{doc['path']}{doc['filename']}" for doc in deletable],
        skipped_paths=skipped,
    )
