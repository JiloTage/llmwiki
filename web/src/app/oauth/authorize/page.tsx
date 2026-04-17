'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Shield, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function OAuthConsentContent() {
  const searchParams = useSearchParams()
  const authorizationId = searchParams.get('authorization_id')

  const [details, setDetails] = React.useState<{
    client?: { name?: string }
    scopes?: string[]
  } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [success, setSuccess] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!authorizationId) {
      setError('authorization_id がありません')
      setLoading(false)
      return
    }

    const supabase = createClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        const returnUrl = `/oauth/authorize?authorization_id=${authorizationId}`
        window.location.href = `/login?returnTo=${encodeURIComponent(returnUrl)}`
        return
      }

      try {
        const { data, error: fetchError } = await (supabase.auth as any).oauth.getAuthorizationDetails(authorizationId)
        if (fetchError) throw fetchError
        setDetails(data)
      } catch (err: any) {
        console.error('Failed to get authorization details:', err)
      } finally {
        setLoading(false)
      }
    })
  }, [authorizationId])

  const handleApprove = async () => {
    if (!authorizationId || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const supabase = createClient()
      const result = await (supabase.auth as any).oauth.approveAuthorization(authorizationId)
      if (result.error) throw result.error
      const redirectUrl = result.data?.redirect_to || result.data?.redirect_uri || result.data?.url
      if (redirectUrl) {
        window.location.href = redirectUrl
      } else {
        setSuccess('アクセスを許可しました。')
      }
    } catch (err: any) {
      setError(err?.message || '認可の許可に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeny = async () => {
    if (!authorizationId || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const supabase = createClient()
      const result = await (supabase.auth as any).oauth.denyAuthorization(authorizationId)
      if (result.error) throw result.error
      const redirectUrl = result.data?.redirect_to || result.data?.redirect_uri || result.data?.url
      if (redirectUrl) {
        window.location.href = redirectUrl
      } else {
        setSuccess('アクセスを拒否しました。')
      }
    } catch (err: any) {
      setError(err?.message || '認可の拒否に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background p-8">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/10 mb-4">
            <Check className="size-5 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-lg font-semibold mb-2">{success}</h1>
          <p className="text-sm text-muted-foreground">このウィンドウを閉じて構いません。</p>
        </div>
      </div>
    )
  }

  if (error && !details) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background p-8">
        <div className="text-center max-w-sm">
          <X className="size-10 text-destructive mx-auto mb-4" />
          <h1 className="text-lg font-semibold mb-2">認可エラー</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  const rawName = details?.client?.name || ''
  const isClaude = rawName.toLowerCase().includes('claude') || rawName.toLowerCase().includes('anthropic')
  const clientName = isClaude ? 'Claude' : rawName || 'MCP クライアント'

  return (
    <div className="min-h-svh flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <Shield className="size-5 text-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{clientName} を接続</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{clientName}</span> が
            MCP サーバーとしてあなたの LLM Wiki に接続しようとしています。
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 mb-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="rounded-lg border border-border p-4 mb-6">
          <p className="text-sm font-medium mb-2">{clientName} に許可される操作:</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">&#10003;</span>
              アップロード済みのドキュメントとソースを読む
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">&#10003;</span>
              ナレッジベース全体を検索する
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">&#10003;</span>
              Wiki ページを作成・編集・保守する
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">&#10003;</span>
              ドキュメントと Wiki ページを削除する
            </li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDeny}
            disabled={submitting}
            className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
          >
            拒否
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-foreground text-background px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            許可
          </button>
        </div>

        <p className="mt-4 text-[11px] text-center text-muted-foreground/50">
          アクセス権は設定画面からいつでも取り消せます。
        </p>
      </div>
    </div>
  )
}

export default function OAuthConsentPage() {
  return (
    <Suspense>
      <OAuthConsentContent />
    </Suspense>
  )
}
