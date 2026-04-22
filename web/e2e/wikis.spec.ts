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

async function readAction(
  request: APIRequestContext,
  data: { knowledge_base: string; path: string },
) {
  const response = await request.post('/api/v1/actions/read', {
    headers: {
      ...AUTH_HEADERS,
      'Content-Type': 'application/json',
    },
    data,
  })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

async function autolinkAction(
  request: APIRequestContext,
  data: { knowledge_base: string },
) {
  const response = await request.post('/api/v1/actions/autolink', {
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

test('serves MCP initialize and tools list', async ({ request }) => {
  const initialize = await request.post('/mcp', {
    headers: {
      ...AUTH_HEADERS,
      'Content-Type': 'application/json',
    },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: {
          name: 'playwright',
          version: '1.0.0',
        },
      },
    },
  })
  expect(initialize.ok()).toBeTruthy()
  const initializeJson = (await initialize.json()) as {
    result: {
      protocolVersion: string
      capabilities: { tools: { listChanged: boolean } }
      serverInfo: { name: string; version: string }
      instructions: string
    }
  }
  expect(initializeJson.result.protocolVersion).toBe('2025-11-25')
  expect(initializeJson.result.serverInfo.name).toBe('llmwiki')
  expect(initializeJson.result.capabilities.tools.listChanged).toBe(false)
  expect(initializeJson.result.instructions).toContain('Call `guide` first')
  expect(initializeJson.result.instructions).toContain('Write articles in Japanese')

  const toolList = await request.post('/mcp', {
    headers: {
      ...AUTH_HEADERS,
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-11-25',
    },
    data: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    },
  })
  expect(toolList.ok()).toBeTruthy()
  const toolListJson = (await toolList.json()) as {
    result: {
      tools: Array<{ name: string }>
    }
  }
  expect(toolListJson.result.tools.map((tool) => tool.name)).toEqual([
    'guide',
    'create_wiki',
    'search',
    'read',
    'write',
    'autolink',
    'delete',
  ])
})

test('autolink is idempotent when wiki links are already maintained', async ({ request }) => {
  const name = uniqueName('Autolink Wiki')
  const knowledgeBase = await createKnowledgeBase(request, name)

  await createDocument(request, knowledgeBase.id, {
    filename: 'Large Language Models.md',
    title: 'Large Language Models',
    path: '/wiki/concepts/',
    content: '# Large Language Models\n\nOverview page.\n',
  })

  await createDocument(request, knowledgeBase.id, {
    filename: 'Transformers.md',
    title: 'Transformers',
    path: '/wiki/entities/',
    content: '# Transformers\n\nTransformers are a major architecture used in Large Language Models.\n',
  })

  const autolink = await autolinkAction(request, { knowledge_base: knowledgeBase.slug }) as {
    updated_count: number
    links_added: number
    updated_paths: string[]
  }
  expect(autolink.updated_count).toBe(0)
  expect(autolink.links_added).toBe(0)
  expect(autolink.updated_paths).toEqual([])

  const read = await readAction(request, {
    knowledge_base: knowledgeBase.slug,
    path: '/wiki/entities/Transformers.md',
  }) as {
    documents: Array<{ content: string }>
  }

  expect(read.documents[0].content).toContain('[Large Language Models](/wiki/concepts/Large%20Language%20Models.md)')
})

test('automatically keeps wiki links up to date when new pages are created', async ({ request }) => {
  const name = uniqueName('Auto Maintain Wiki')
  const knowledgeBase = await createKnowledgeBase(request, name)

  await createDocument(request, knowledgeBase.id, {
    filename: 'Large Language Models.md',
    title: 'Large Language Models',
    path: '/wiki/concepts/',
    content: '# Large Language Models\n\nTransformers are important to this topic.\n',
  })

  await createDocument(request, knowledgeBase.id, {
    filename: 'Transformers.md',
    title: 'Transformers',
    path: '/wiki/entities/',
    content: '# Transformers\n\nLarge Language Models often rely on this architecture.\n',
  })

  const conceptRead = await readAction(request, {
    knowledge_base: knowledgeBase.slug,
    path: '/wiki/concepts/Large Language Models.md',
  }) as {
    documents: Array<{ content: string }>
  }

  const entityRead = await readAction(request, {
    knowledge_base: knowledgeBase.slug,
    path: '/wiki/entities/Transformers.md',
  }) as {
    documents: Array<{ content: string }>
  }

  expect(conceptRead.documents[0].content).toContain('[Transformers](/wiki/entities/Transformers.md)')
  expect(entityRead.documents[0].content).toContain('[Large Language Models](/wiki/concepts/Large%20Language%20Models.md)')
})

test('renders reciprocal related articles for linked wiki pages', async ({ page, request }) => {
  const name = uniqueName('Related Wiki')
  const knowledgeBase = await createKnowledgeBase(request, name)
  await waitForKnowledgeBase(request, knowledgeBase.slug)

  await createDocument(request, knowledgeBase.id, {
    filename: 'Large Language Models.md',
    title: 'Large Language Models',
    path: '/wiki/concepts/',
    content: '# Large Language Models\n\nOverview page.\n',
  })

  await createDocument(request, knowledgeBase.id, {
    filename: 'Transformers.md',
    title: 'Transformers',
    path: '/wiki/entities/',
    content: '# Transformers\n\nSee [Large Language Models](/wiki/concepts/Large%20Language%20Models.md).\n',
  })

  await page.goto(`/wikis/${knowledgeBase.slug}/wiki/entities/Transformers.md`)
  const transformersRelated = page.locator('section').filter({ hasText: 'Related articles' })
  await expect(transformersRelated).toBeVisible()
  await expect(transformersRelated.getByRole('link', { name: 'Large Language Models' })).toBeVisible()

  await page.goto(`/wikis/${knowledgeBase.slug}/wiki/concepts/Large%20Language%20Models.md`)
  const llmRelated = page.locator('section').filter({ hasText: 'Related articles' })
  await expect(llmRelated).toBeVisible()
  await expect(llmRelated.getByRole('link', { name: 'Transformers' })).toBeVisible()
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

test('preserves internal wiki fragments for Japanese headings', async ({ page, request }) => {
  const name = uniqueName('Japanese Anchor Wiki')
  const slug = slugify(name)
  await createWikiFromUi(page, name)
  await expect(page).toHaveURL(new RegExp(`/wikis/${slug}/wiki/overview\\.md$`))

  const knowledgeBase = await waitForKnowledgeBase(request, slug)
  const documents = await listDocuments(request, knowledgeBase.id)
  const overview = documents.find((doc) => doc.path === '/wiki/' && doc.filename === 'overview.md')
  expect(overview).toBeTruthy()

  const filename = '\u30da\u30fc\u30b8\u69cb\u6210\u30ac\u30a4\u30c9.md'
  const title = '\u30da\u30fc\u30b8\u69cb\u6210\u30ac\u30a4\u30c9'
  const sectionTitle = '\u95a2\u9023\u30da\u30fc\u30b8'

  await createDocument(request, knowledgeBase.id, {
    filename,
    title,
    path: '/wiki/concepts/',
    content: `# ${title}

## ${sectionTitle}

\u65e5\u672c\u8a9e\u898b\u51fa\u3057\u3078\u306e\u9077\u79fb\u78ba\u8a8d\u30da\u30fc\u30b8\u3067\u3059\u3002
`,
  })

  const updateResponse = await request.put(`/api/v1/documents/${overview!.id}/content`, {
    headers: {
      ...AUTH_HEADERS,
      'Content-Type': 'application/json',
    },
    data: {
      content: `# Overview

[${sectionTitle}](/wiki/concepts/${encodeURIComponent(filename)}#${sectionTitle})
`,
    },
  })
  expect(updateResponse.ok()).toBeTruthy()

  await page.goto(`/wikis/${slug}/wiki/overview.md`)
  await page.getByRole('link', { name: sectionTitle }).click()

  await expect(page).toHaveURL(new RegExp(`/wikis/${slug}/wiki/concepts/`))
  await expect
    .poll(async () => page.evaluate(() => decodeURIComponent(window.location.hash.slice(1))))
    .toBe(sectionTitle)
  await expect(page.getByRole('heading', { name: sectionTitle, level: 2 })).toHaveAttribute('id', sectionTitle)
})
