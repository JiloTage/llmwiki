import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const AUTH_HEADERS = {
  Authorization: 'Bearer local-dev-session',
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'kb'
}

function uniqueName(prefix: string) {
  return `${prefix} ${Math.random().toString(36).slice(2, 8)}`
}

async function listKnowledgeBases(request: APIRequestContext) {
  const response = await request.get('/api/v1/knowledge-bases', {
    headers: AUTH_HEADERS,
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as Array<{ id: string; slug: string; name: string }>
}

async function listDocuments(request: APIRequestContext, knowledgeBaseId: string) {
  const response = await request.get(`/api/v1/knowledge-bases/${knowledgeBaseId}/documents`, {
    headers: AUTH_HEADERS,
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as Array<{ id: string; filename: string; path: string }>
}

async function createKnowledgeBase(request: APIRequestContext, name: string) {
  const response = await request.post('/api/v1/knowledge-bases', {
    headers: {
      ...AUTH_HEADERS,
      'Content-Type': 'application/json',
    },
    data: { name },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as { id: string; slug: string; name: string }
}

async function createDocument(
  request: APIRequestContext,
  knowledgeBaseId: string,
  data: { filename: string; path: string; title?: string; content: string },
) {
  const response = await request.post(`/api/v1/knowledge-bases/${knowledgeBaseId}/documents/note`, {
    headers: {
      ...AUTH_HEADERS,
      'Content-Type': 'application/json',
    },
    data,
  })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

async function createWikiFromUi(page: Page, name: string) {
  const quickCreate = page.getByTestId('quick-create-wiki')

  if (await quickCreate.isVisible().catch(() => false)) {
    await quickCreate.click()
    return { slug: 'local-wiki', name: 'Local Wiki' }
  }

  await page.getByTestId('open-create-wiki-dialog').click()
  await page.getByTestId('create-wiki-name-input').fill(name)
  await page.getByTestId('submit-create-wiki').click()
  return { slug: slugify(name), name }
}

async function waitForKnowledgeBase(request: APIRequestContext, slug: string) {
  await expect
    .poll(async () => {
      const knowledgeBases = await listKnowledgeBases(request)
      return knowledgeBases.find((kb) => kb.slug === slug)?.id ?? null
    })
    .not.toBeNull()

  const knowledgeBases = await listKnowledgeBases(request)
  const knowledgeBase = knowledgeBases.find((kb) => kb.slug === slug)
  expect(knowledgeBase).toBeTruthy()
  return knowledgeBase!
}

test.beforeEach(async ({ page }) => {
  await page.goto('/wikis')
})

test('creates the first wiki from the empty state', async ({ page, request }) => {
  const wiki = await createWikiFromUi(page, uniqueName('Local Wiki'))

  await expect(page).toHaveURL(new RegExp(`/wikis/${wiki.slug}/wiki/overview\\.md$`))
  await waitForKnowledgeBase(request, wiki.slug)
  await page.goto(`/wikis/${wiki.slug}/wiki/overview.md`)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: wiki.name }),
  ).toBeVisible()
  await expect(page.getByRole('article').getByText('/wiki/overview.md', { exact: true })).toBeVisible()
})

test('creates an additional wiki from the list page and opens settings', async ({ page, request }) => {
  await createKnowledgeBase(request, uniqueName('Seed Wiki'))
  await page.goto('/wikis')
  await expect(page).toHaveURL(/\/wikis$/)

  const name = uniqueName('Research Notes')
  const slug = slugify(name)

  await page.getByTestId('open-create-wiki-dialog').click()
  await page.getByTestId('create-wiki-name-input').fill(name)
  await page.getByTestId('submit-create-wiki').click()

  await expect(page).toHaveURL(new RegExp(`/wikis/${slug}/wiki/overview\\.md$`))
  await waitForKnowledgeBase(request, slug)

  await page.goto('/settings')

  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'MCP Config' })).toBeVisible()
  await expect(page.getByText('MCP URL:')).toBeVisible()
})

test('renders mermaid code fences inside wiki pages', async ({ page, request }) => {
  const name = uniqueName('Mermaid Wiki')
  const slug = slugify(name)
  await createWikiFromUi(page, name)
  await expect(page).toHaveURL(new RegExp(`/wikis/${slug}/wiki/overview\\.md$`))

  const knowledgeBase = await waitForKnowledgeBase(request, slug)
  const documents = await listDocuments(request, knowledgeBase.id)
  const overview = documents.find((doc) => doc.path === '/wiki/' && doc.filename === 'overview.md')
  expect(overview).toBeTruthy()

  const updateResponse = await request.put(`/api/v1/documents/${overview!.id}/content`, {
    headers: {
      ...AUTH_HEADERS,
      'Content-Type': 'application/json',
    },
    data: {
      content: `# Overview

\`\`\`mermaid
flowchart TD
  Start[Start] --> Finish[Finish]
\`\`\`
`,
    },
  })
  expect(updateResponse.ok()).toBeTruthy()

  await page.goto(`/wikis/${slug}/wiki/overview.md`)
  await expect(page.getByTestId('mermaid-diagram')).toBeVisible()
  await expect(page.locator('[data-testid="mermaid-diagram"] svg')).toBeVisible()
})

test('follows encoded internal wiki links for pages with Japanese filenames', async ({ page, request }) => {
  const name = uniqueName('Japanese Wiki')
  const slug = slugify(name)
  await createWikiFromUi(page, name)
  await expect(page).toHaveURL(new RegExp(`/wikis/${slug}/wiki/overview\\.md$`))

  const knowledgeBase = await waitForKnowledgeBase(request, slug)
  const documents = await listDocuments(request, knowledgeBase.id)
  const overview = documents.find((doc) => doc.path === '/wiki/' && doc.filename === 'overview.md')
  expect(overview).toBeTruthy()

  const filename = '\u30da\u30fc\u30b8\u69cb\u6210\u30ac\u30a4\u30c9.md'
  const title = '\u30da\u30fc\u30b8\u69cb\u6210\u30ac\u30a4\u30c9'

  await createDocument(request, knowledgeBase.id, {
    filename,
    title,
    path: '/wiki/concepts/',
    content: `# ${title}

\u65e5\u672c\u8a9e\u30ea\u30f3\u30af\u79fb\u52d5\u306e\u52d5\u4f5c\u78ba\u8a8d\u30da\u30fc\u30b8\u3067\u3059\u3002
`,
  })

  const updateResponse = await request.put(`/api/v1/documents/${overview!.id}/content`, {
    headers: {
      ...AUTH_HEADERS,
      'Content-Type': 'application/json',
    },
    data: {
      content: `# Overview

[${title}](/wiki/concepts/${encodeURIComponent(filename)})
`,
    },
  })
  expect(updateResponse.ok()).toBeTruthy()

  await page.goto(`/wikis/${slug}/wiki/overview.md`)
  await page.getByRole('link', { name: title }).click()

  await expect(page).toHaveURL(new RegExp(`/wikis/${slug}/wiki/concepts/`))
  await expect(page.getByText('/wiki/concepts/', { exact: false }).first()).toBeVisible()
})
