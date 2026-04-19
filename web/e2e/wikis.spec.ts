import { expect, test, type APIRequestContext } from '@playwright/test'

const AUTH_HEADERS = {
  Authorization: 'Bearer local-dev-session',
}

async function resetKnowledgeBases(request: APIRequestContext) {
  const response = await request.get('/api/v1/knowledge-bases', {
    headers: AUTH_HEADERS,
  })
  expect(response.ok()).toBeTruthy()

  const knowledgeBases = (await response.json()) as Array<{ id: string }>
  for (const kb of knowledgeBases) {
    const deleteResponse = await request.delete(`/api/v1/knowledge-bases/${kb.id}`, {
      headers: AUTH_HEADERS,
    })
    expect(deleteResponse.ok()).toBeTruthy()
  }
}

async function listKnowledgeBases(request: APIRequestContext) {
  const response = await request.get('/api/v1/knowledge-bases', {
    headers: AUTH_HEADERS,
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as Array<{ id: string; slug: string }>
}

async function listDocuments(request: APIRequestContext, knowledgeBaseId: string) {
  const response = await request.get(`/api/v1/knowledge-bases/${knowledgeBaseId}/documents`, {
    headers: AUTH_HEADERS,
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as Array<{ id: string; filename: string; path: string }>
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

test.beforeEach(async ({ request, page }) => {
  await resetKnowledgeBases(request)
  await page.goto('/wikis')
})

test('creates the first wiki from the empty state', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Create your first wiki' })).toBeVisible()

  await page.getByTestId('quick-create-wiki').click()

  await expect(page).toHaveURL(/\/wikis\/local-wiki(?:\?.*)?$/)
  await expect(page.getByRole('heading', { name: 'Local Wiki' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Featured Pages' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Overview' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Log' }).first()).toBeVisible()

  await page.getByRole('link', { name: 'Overview' }).first().click()

  await expect(page).toHaveURL(/\/wikis\/local-wiki\/wiki\/overview\.md$/)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page.getByRole('article').getByText('/wiki/overview.md', { exact: true })).toBeVisible()
})

test('creates an additional wiki from the list page and opens settings', async ({ page }) => {
  await page.getByTestId('quick-create-wiki').click()
  await expect(page).toHaveURL(/\/wikis\/local-wiki(?:\?.*)?$/)

  await page.goto('/wikis')
  await expect(page).toHaveURL(/\/wikis$/)

  await page.getByTestId('open-create-wiki-dialog').click()
  await page.getByTestId('create-wiki-name-input').fill('Research Notes')
  await page.getByTestId('submit-create-wiki').click()

  await expect(page).toHaveURL(/\/wikis\/research-notes(?:\?.*)?$/)

  await page.goto('/settings')

  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'MCP Config' })).toBeVisible()
  await expect(page.getByText('MCP URL:')).toBeVisible()
})

test('renders mermaid code fences inside wiki pages', async ({ page, request }) => {
  await page.getByTestId('quick-create-wiki').click()
  await expect(page).toHaveURL(/\/wikis\/local-wiki(?:\?.*)?$/)

  const knowledgeBases = await listKnowledgeBases(request)
  const knowledgeBase = knowledgeBases.find((kb) => kb.slug === 'local-wiki')
  expect(knowledgeBase).toBeTruthy()

  const documents = await listDocuments(request, knowledgeBase!.id)
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

  await page.goto('/wikis/local-wiki/wiki/overview.md')
  await expect(page.getByTestId('mermaid-diagram')).toBeVisible()
  await expect(page.locator('[data-testid="mermaid-diagram"] svg')).toBeVisible()
})

test('follows encoded internal wiki links for pages with Japanese filenames', async ({ page, request }) => {
  await page.getByTestId('quick-create-wiki').click()
  await expect(page).toHaveURL(/\/wikis\/local-wiki(?:\?.*)?$/)

  const knowledgeBases = await listKnowledgeBases(request)
  const knowledgeBase = knowledgeBases.find((kb) => kb.slug === 'local-wiki')
  expect(knowledgeBase).toBeTruthy()

  const documents = await listDocuments(request, knowledgeBase!.id)
  const overview = documents.find((doc) => doc.path === '/wiki/' && doc.filename === 'overview.md')
  expect(overview).toBeTruthy()

  await createDocument(request, knowledgeBase!.id, {
    filename: 'ページ構成ガイド.md',
    title: 'ページ構成ガイド',
    path: '/wiki/concepts/',
    content: '# ページ構成ガイド\n\n日本語リンク遷移の確認ページです。\n',
  })

  const encodedFilename = encodeURIComponent('ページ構成ガイド.md')
  const updateResponse = await request.put(`/api/v1/documents/${overview!.id}/content`, {
    headers: {
      ...AUTH_HEADERS,
      'Content-Type': 'application/json',
    },
    data: {
      content: `# Overview

[ページ構成ガイド](/wiki/concepts/${encodedFilename})
`,
    },
  })
  expect(updateResponse.ok()).toBeTruthy()

  await page.goto('/wikis/local-wiki/wiki/overview.md')
  await page.getByRole('button', { name: 'ページ構成ガイド' }).click()

  await expect(page).toHaveURL(/\/wikis\/local-wiki\/wiki\/concepts\//)
  await expect(page.getByText('/wiki/concepts/', { exact: false }).first()).toBeVisible()
})
