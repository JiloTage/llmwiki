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

test.beforeEach(async ({ request, page }) => {
  await resetKnowledgeBases(request)
  await page.goto('/wikis')
})

test('creates the first wiki from the empty state', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Create your first wiki' })).toBeVisible()

  await page.getByTestId('quick-create-wiki').click()

  await expect(page).toHaveURL(/\/wikis\/local-wiki(?:\?.*)?$/)
  await expect(page.getByTestId('wiki-selector-trigger')).toContainText('Local Wiki')
  await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page.getByText('No sources have been ingested yet.')).toBeVisible()
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
  await expect(page.getByTestId('wiki-selector-trigger')).toContainText('Research Notes')
  await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

  await page.getByTestId('sidenav-user-menu-trigger').click()
  await page.getByTestId('open-settings').click()

  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'MCP Config' })).toBeVisible()
  await expect(page.getByText('MCP URL:')).toBeVisible()
})
