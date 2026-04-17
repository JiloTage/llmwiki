'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useUserStore } from '@/stores'
import { ArrowRight, BookOpen, FileText, PenTool, Search, GitBranch } from 'lucide-react'

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1]

const WIKI_TREE = [
  { label: '概要', active: true, depth: 0 },
  { label: '概念', depth: 0, folder: true },
  { label: 'アテンション機構', depth: 1 },
  { label: 'スケーリング則', depth: 1 },
  { label: 'エンティティ', depth: 0, folder: true },
  { label: 'Transformer アーキテクチャ', depth: 1 },
  { label: 'ソース', depth: 0, folder: true },
  { label: 'ログ', depth: 0 },
]

export default function LandingPage() {
  const user = useUserStore((s) => s.user)
  const router = useRouter()

  React.useEffect(() => {
    if (user) router.replace('/wikis')
  }, [user, router])

  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 lg:px-10 h-14 bg-background/80 backdrop-blur-sm">
        <span className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="currentColor" className="text-foreground" />
            <polyline points="11,8 21,16 11,24" fill="none" stroke="currentColor" className="text-background" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          LLM Wiki
        </span>
        <div className="flex items-center gap-5">
          <Link
            href="https://github.com/lucasastorian/llmwiki"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ログイン
          </Link>
          <Link
            href="/signup"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            はじめる
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 lg:px-10">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
          >
            <p className="text-sm text-muted-foreground mb-4">
              オープンソース実装版の{' '}
              <Link
                href="https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f"
                className="text-foreground underline underline-offset-2 decoration-foreground/30 hover:decoration-foreground transition-colors"
              >
                Karpathy&apos;s LLM&nbsp;Wiki
              </Link>
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              LLM Wiki
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease }}
            className="mt-6 text-base sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed"
          >
            生のソースから、LLM が構造化された Wiki を自動で構築し、更新し続けます。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease }}
            className="mt-9 flex items-center justify-center gap-3"
          >
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              はじめる
              <ArrowRight className="size-3.5 opacity-60" />
            </Link>
            <Link
              href="https://github.com/lucasastorian/llmwiki"
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              GitHub
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Product Preview */}
      <section className="px-6 lg:px-10 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease }}
          className="max-w-5xl mx-auto"
        >
          <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex gap-1.5">
                <div className="size-2.5 rounded-full bg-border" />
                <div className="size-2.5 rounded-full bg-border" />
                <div className="size-2.5 rounded-full bg-border" />
              </div>
              <div className="flex-1 flex justify-center">
                <span className="text-xs text-muted-foreground/50 font-mono">
                  llmwiki.app
                </span>
              </div>
              <div className="w-14" />
            </div>

            <div className="flex min-h-[400px]">
              {/* Sidebar */}
              <div className="w-52 shrink-0 border-r border-border p-3 hidden sm:block">
                <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
                  <Search className="size-3 text-muted-foreground/30" />
                  <span className="text-xs text-muted-foreground/30">Wiki を検索...</span>
                </div>
                <div className="space-y-0.5">
                  {WIKI_TREE.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                        item.active
                          ? 'bg-accent font-medium text-foreground'
                          : 'text-muted-foreground'
                      }`}
                      style={{ paddingLeft: `${item.depth * 14 + 8}px` }}
                    >
                      {item.folder ? (
                        <GitBranch className="size-3 opacity-40" />
                      ) : (
                        <FileText className="size-3 opacity-40" />
                      )}
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-8 sm:p-10">
                <div className="max-w-lg">
                  <h2 className="text-xl font-semibold tracking-tight mb-1">概要</h2>
                  <p className="text-xs text-muted-foreground mb-6">
                    12 ソース &middot; 2 時間前に更新
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    この Wiki は Transformer アーキテクチャとそのスケーリング特性に関する研究を追跡しています。
                    <span className="font-medium text-foreground">12 件のソース</span>からの知見を 47 ページに整理しています。
                  </p>
                  <h3 className="text-sm font-semibold mt-5 mb-2">主要な発見</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    モデルサイズと性能の関係は予測可能な
                    <span className="font-medium text-foreground">スケーリング則</span>
                    に従い、損失は計算量・データセットサイズ・パラメータ数に対するべき乗則で減少します。
                  </p>
                  <h3 className="text-sm font-semibold mt-5 mb-2">最近の更新</h3>
                  <ul className="space-y-1 ml-4">
                    <li className="text-sm text-muted-foreground list-disc">疎な attention 変種の分析を追加</li>
                    <li className="text-sm text-muted-foreground list-disc">新しいベンチマークでスケーリング則を更新</li>
                    <li className="text-sm text-muted-foreground list-disc">Chen らと Wei らの矛盾を指摘</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto border-t border-border" />

      {/* Three Layers */}
      <section className="px-6 lg:px-10 py-24">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">3 つのレイヤー</h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Wiki を人が直接書く場面はほとんどありません。Wiki は LLM が担う領域です。
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: FileText,
                title: '生のソース',
                body: '記事、論文、ノート、文字起こし。変更されない一次情報です。LLM はこれを読みますが、書き換えはしません。',
              },
              {
                icon: BookOpen,
                title: 'Wiki',
                body: '要約、エンティティページ、相互参照を含む LLM 生成の Markdown ページ群です。このレイヤーは LLM が管理します。',
              },
              {
                icon: PenTool,
                title: 'スキーマ',
                body: 'Wiki の構造、従うべき規約、取り込み時のワークフローを LLM に伝える設定ファイルです。',
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card rounded-xl border border-border p-6"
              >
                <item.icon className="size-5 text-muted-foreground mb-4" strokeWidth={1.5} />
                <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto border-t border-border" />

      {/* How It Works */}
      <section className="px-6 lg:px-10 py-24">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">仕組み</h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-10 sm:gap-8">
            {[
              {
                step: '01',
                title: 'Ingest',
                body: 'Drop a source into raw/. The LLM reads it, writes a summary, updates entity and concept pages across the wiki, and flags anything that contradicts existing knowledge. A single source might touch 10–15 wiki pages.',
              },
              {
                step: '02',
                title: 'Query',
                body: '統合済みの Wiki に対して複雑な質問を投げられます。知識は毎回生データから再導出されるのではなく、すでに整理済みです。良い答えは新しいページとして蓄積され、探索が資産になります。',
              },
              {
                step: '03',
                title: 'Lint',
                body: 'Wiki 全体に健全性チェックをかけ、一貫しないデータ、古い主張、孤立ページ、欠けた相互参照を見つけます。LLM は次に調べるべき問いや追加すべきソースも提案します。',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <span className="text-xs font-mono text-muted-foreground/40 mb-3 block">{item.step}</span>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto border-t border-border" />

      {/* Quote */}
      <section className="px-6 lg:px-10 py-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl mx-auto text-center"
        >
          <blockquote className="text-lg sm:text-xl leading-relaxed text-foreground/80 italic">
            &ldquo;The tedious part of maintaining a knowledge base is not the reading or the thinking &mdash; it&apos;s the bookkeeping. LLMs don&apos;t get bored, don&apos;t forget to update a cross-reference, and can touch 15 files in one pass.&rdquo;
          </blockquote>
          <p className="mt-5 text-sm text-muted-foreground">
            Andrej Karpathy
          </p>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto border-t border-border" />

      {/* CTA */}
      <section className="px-6 lg:px-10 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="max-w-md mx-auto text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Wiki を作り始める</h2>
          <p className="text-muted-foreground mb-8">
            寄せ集めのスクリプトではなく、実用的なプロダクトとして使えます。
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-7 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            無料ではじめる
            <ArrowRight className="size-3.5 opacity-60" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 lg:px-10 py-6 flex items-center justify-between text-xs text-muted-foreground/50">
        <span>LLM Wiki</span>
        <span>無料・オープンソース &middot; Apache 2.0</span>
      </footer>
    </div>
  )
}
