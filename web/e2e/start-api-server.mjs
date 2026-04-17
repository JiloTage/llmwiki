import { execFileSync, spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const webDir = process.cwd()
const repoRoot = path.resolve(webDir, '..')
const apiDir = path.join(repoRoot, 'api')

let serverProcess = null
let shuttingDown = false

function runDocker(...args) {
  return execFileSync('docker', ['compose', ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
}

function tryDocker(...args) {
  try {
    runDocker(...args)
  } catch {
    // Best-effort cleanup and startup.
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForDatabase() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      execFileSync('docker', ['compose', 'exec', '-T', 'db', 'pg_isready', '-U', 'postgres', '-d', 'supavault'], {
        cwd: repoRoot,
        stdio: 'ignore',
      })
      return
    } catch {
      await wait(1_000)
    }
  }

  throw new Error('Database did not become ready in time')
}

async function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true

  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM')
    await new Promise((resolve) => {
      serverProcess.once('exit', () => resolve())
      setTimeout(() => resolve(), 5_000)
    })
  }

  tryDocker('down', '-v')
  process.exit(code)
}

process.on('SIGINT', () => {
  void shutdown(0)
})

process.on('SIGTERM', () => {
  void shutdown(0)
})

process.on('exit', () => {
  if (!shuttingDown) {
    tryDocker('down', '-v')
  }
})

async function main() {
  tryDocker('down', '-v')
  runDocker('up', '-d')
  await waitForDatabase()

  serverProcess = spawn(
    path.join(apiDir, '.venv', 'Scripts', 'python.exe'),
    ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'],
    {
      cwd: apiDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/supavault',
        APP_URL: 'http://127.0.0.1:3000',
        LOCAL_USER_ID: '00000000-0000-4000-8000-000000000001',
        LOCAL_USER_EMAIL: 'local@llmwiki.local',
        LOCAL_USER_NAME: 'Local User',
      },
    },
  )

  serverProcess.on('exit', (code) => {
    if (!shuttingDown) {
      void shutdown(code ?? 1)
    }
  })
}

void main()
