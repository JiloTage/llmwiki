import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

export default async function globalTeardown() {
  const webDir = process.cwd()
  const repoRoot = path.resolve(webDir, '..')

  try {
    execFileSync('docker', ['compose', 'down', '-v'], {
      cwd: repoRoot,
      stdio: 'inherit',
    })
  } catch {
    // Best-effort cleanup.
  }
}
