import { execFileSync } from 'node:child_process'
import process from 'node:process'

export default async function globalSetup() {
  execFileSync('cmd.exe', ['/d', '/s', '/c', 'npx wrangler d1 migrations apply llmwiki --local'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
}
