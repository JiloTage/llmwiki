'use client'

import * as React from 'react'
import { ArrowLeft, Check, Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { buildMcpConfig, MCP_URL } from '@/lib/mcp'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const router = useRouter()
  const [configCopied, setConfigCopied] = React.useState(false)
  const mcpConfigJson = buildMcpConfig()

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(mcpConfigJson)
      setConfigCopied(true)
      setTimeout(() => setConfigCopied(false), 2000)
    } catch {
      console.error('Failed to copy MCP config')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.back()}
          className="p-1 rounded-md hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      </div>

      <section>
        <h2 className="text-base font-medium">MCP Config</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          MCP は今回の Cloudflare デプロイの必須対象ではないが、既存の個人用ワークフローを続けるならこの設定をそのまま使える。
        </p>
        <div className="relative mt-4">
          <pre className="rounded-lg bg-muted border border-border p-4 text-sm font-mono overflow-x-auto text-foreground">
            {mcpConfigJson}
          </pre>
          <button
            onClick={handleCopyConfig}
            className={cn(
              'absolute top-3 right-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
              configCopied
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            {configCopied ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          MCP URL:{' '}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{MCP_URL}</code>
        </p>
      </section>
    </div>
  )
}
