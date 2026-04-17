'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Copy, Check, Loader2, ArrowRight, ArrowLeft,
  FileText, BookOpen, PenTool, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { MCP_URL } from '@/lib/mcp'
import { useUserStore, useKBStore } from '@/stores'

type Step = 'welcome' | 'create' | 'connect' | 'done'
const STEPS: Step[] = ['welcome', 'create', 'connect', 'done']

export default function OnboardingPage() {
  const router = useRouter()
  const token = useUserStore((s) => s.accessToken)
  const user = useUserStore((s) => s.user)
  const setOnboarded = useUserStore((s) => s.setOnboarded)
  const createKB = useKBStore((s) => s.createKB)

  const [step, setStep] = React.useState<Step>('welcome')
  const [wikiName, setWikiName] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const [createdSlug, setCreatedSlug] = React.useState<string | null>(null)
  const [urlCopied, setUrlCopied] = React.useState(false)

  const stepIndex = STEPS.indexOf(step)

  React.useEffect(() => {
    if (user) {
      const name = user.email.split('@')[0]
      setWikiName(`${name.charAt(0).toUpperCase() + name.slice(1)} の Wiki`)
    }
  }, [user])

  const handleCreateWiki = async () => {
    if (!token || !wikiName.trim()) return
    setCreating(true)
    try {
      const kb = await createKB(wikiName.trim())
      setCreatedSlug(kb.slug)
      setStep('connect')
    } catch (err) {
      console.error('Failed to create wiki:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL)
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    } catch { /* */ }
  }

  const handleComplete = async () => {
    if (!token) return
    try {
      await apiFetch('/v1/onboarding/complete', token, { method: 'POST' })
    } catch { /* continue anyway */ }
    setOnboarded(true)
    router.replace(createdSlug ? `/wikis/${createdSlug}` : '/wikis')
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <div className="shrink-0 px-8 pt-8 pb-0">
        <div className="max-w-lg mx-auto flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                i <= stepIndex ? 'bg-foreground' : 'bg-border',
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          {step === 'welcome' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-foreground mb-8">
                <BookOpen size={28} className="text-background" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                LLM Wiki へようこそ
              </h1>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-sm mx-auto">
                生のソースから、LLM が構造化された Wiki を構築し、継続的に更新します。
              </p>

              <div className="grid grid-cols-3 gap-3 mt-10 text-left">
                {[
                  { icon: FileText, title: 'ソース', desc: 'PDF、ノート、文字起こし' },
                  { icon: BookOpen, title: 'Wiki', desc: '自動生成されるページ' },
                  { icon: PenTool, title: 'ツール', desc: 'MCP 経由で検索・読取・書込' },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-border p-4 bg-card">
                    <item.icon className="size-4 text-muted-foreground mb-2.5" strokeWidth={1.5} />
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep('create')}
                className="mt-10 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-8 py-3 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
              >
                はじめる
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          )}

          {step === 'create' && (
            <div>
              <button
                onClick={() => setStep('welcome')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-8"
              >
                <ArrowLeft className="size-3" />
                戻る
              </button>

              <h1 className="text-2xl font-bold tracking-tight">
                Wiki に名前を付ける
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                これはあなたの知識空間です。名前はいつでも変更できます。
              </p>

              <div className="mt-8">
                <input
                  type="text"
                  value={wikiName}
                  onChange={(e) => setWikiName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateWiki()}
                  placeholder="マイリサーチ"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-shadow"
                  autoFocus
                />
              </div>

              <button
                onClick={handleCreateWiki}
                disabled={creating || !wikiName.trim()}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-8 py-3 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
              >
                {creating ? (
                  <><Loader2 size={15} className="animate-spin" /> 作成中...</>
                ) : (
                  <>Wiki を作成 <ArrowRight className="size-3.5" /></>
                )}
              </button>
            </div>
          )}

          {step === 'connect' && (
            <div>
              <button
                onClick={() => setStep('create')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-8"
              >
                <ArrowLeft className="size-3" />
                戻る
              </button>

              <h1 className="text-2xl font-bold tracking-tight">
                Claude を接続
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                LLM Wiki をコネクタとして追加すると、Claude があなたの Wiki を読み書きできます。
              </p>

              <div className="mt-8 space-y-6">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-muted rounded-xl px-4 py-3 border border-border select-all truncate">
                    {MCP_URL}
                  </code>
                  <button
                    onClick={handleCopyUrl}
                    className={cn(
                      'shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-medium transition-colors cursor-pointer',
                      urlCopied
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-foreground text-background hover:opacity-90'
                    )}
                  >
                    {urlCopied ? <><Check size={14} /> コピー済み</> : <><Copy size={14} /> コピー</>}
                  </button>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 mb-3">
                    Claude 側の手順
                  </p>
                  <ol className="space-y-2.5">
                    {[
                      <><strong>Settings</strong> を開く</>,
                      <><strong>Connectors</strong> に移動する</>,
                      <><strong>Add custom connector</strong> をクリックする</>,
                      '上の URL を貼り付けてアクセスを許可する',
                      '案内に従ってアカウントでサインインする',
                    ].map((text, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-foreground/80">{text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep('done')}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-8 py-3 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
                >
                  続ける
                  <ArrowRight className="size-3.5" />
                </button>
              </div>

              <button
                onClick={() => setStep('done')}
                className="mt-3 w-full text-center text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
              >
                スキップして後で設定する
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-8">
                <Check size={28} className="text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                準備ができました
              </h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Wiki にソースをアップロードし、Claude に構造化されたページへまとめてもらってください。
              </p>

              <button
                onClick={handleComplete}
                className="mt-10 inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-8 py-3 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
              >
                自分の Wiki へ移動
                <ArrowRight className="size-3.5" />
              </button>

              <div className="mt-6">
                <a
                  href="https://claude.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink size={12} />
                  Claude を開く
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
