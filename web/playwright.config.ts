import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const rootDir = __dirname

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  globalTeardown: './e2e/global-teardown.mjs',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node ./e2e/start-api-server.mjs',
      url: 'http://127.0.0.1:8000/health',
      reuseExistingServer: false,
      timeout: 180_000,
      cwd: rootDir,
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: false,
      timeout: 180_000,
      cwd: rootDir,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8000',
        NEXT_PUBLIC_LOCAL_USER_ID: '00000000-0000-4000-8000-000000000001',
        NEXT_PUBLIC_LOCAL_USER_EMAIL: 'local@llmwiki.local',
        NEXT_PUBLIC_LOCAL_ACCESS_TOKEN: 'local-dev-session',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  outputDir: path.join(rootDir, 'test-results'),
})
