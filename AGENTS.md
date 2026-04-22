# AGENTS.md

このファイルは、このリポジトリで作業するエージェント向けの短い運用ガイドです。

## 概要

現在の本番構成は `web/` に集約されています。

- `web/`
  Next.js ベースの本体です。UI と `/api/v1/*` の Route Handlers を含みます。
- `web/migrations/`
  Cloudflare D1 の schema / migration です。
- `web/e2e/`
  Playwright E2E テストです。
- `docs/cloudflare-deploy-runbook.md`
  Cloudflare デプロイ手順です。
- `docs/gpt-actions/`
  GPT Actions 用のドキュメントです。

## 現在の前提

- 完全な個人利用前提です。
- API 認証は `Authorization: Bearer <LOCAL_ACCESS_TOKEN>` のみです。
- 単一ローカルユーザー前提です。
- 本番 API は `web/src/app/api/v1/*` で提供します。
- データストアは Cloudflare D1 です。

関連ファイル:

- `web/src/lib/server/llmwiki.ts`
- `web/wrangler.jsonc`
- `.github/workflows/cloudflare-deploy.yml`
- `.env.example`

## 追加の現状メモ

- D1 schema には `web/migrations/0002_document_related_articles.sql` が追加されています。
- wiki 記事同士の関連記事は `document_related_articles` テーブルで相互管理します。
- `/wiki/` 配下の Markdown 記事は、作成・更新時に内部リンクの自動メンテナンスが走る前提です。
  - 明示的に `autolink` を呼ばなくても、不足している内部 Markdown リンクを補完する実装になっています。
  - `autolink` は残っていますが、主用途は手動再同期と idempotent な sweep です。
- 記事末尾の `Related articles` 表示は、本文中の内部リンクから同期された DB の関連記事データを使います。
- `overview.md` と `log.md` は関連記事の自動管理対象外です。

## 変更方針

- 必要最小限の差分で直してください。
- 個人用前提を崩す変更は勝手に入れないでください。
  - マルチユーザー化
  - 認証方式の追加
  - 権限モデルの複雑化
- Route Handlers と `web/src/lib/server/llmwiki.ts` の挙動を揃える変更では、片方だけを雑に変えないでください。

## 作業時の優先順位

1. まず `web/src/app/api/v1/` と `web/src/lib/server/llmwiki.ts` を確認する
2. 必要なら `web/src/components/` と `web/src/stores/` を確認する
3. 影響がある場合のみ `docs/` や `web/e2e/` を更新する
4. 最後に型チェック・build・必要なら E2E で確認する

## よく使う確認コマンド

PowerShell 前提です。

### 型チェック

```powershell
cd web
npx.cmd tsc --noEmit
```

### Next build

```powershell
cd web
npm.cmd run build
```

### Cloudflare bundle build

```powershell
cd web
npx.cmd opennextjs-cloudflare build
```

### Web 起動

```powershell
cd web
npm.cmd run dev
```

### E2E

```powershell
cd web
npm.cmd run test:e2e
```

## テスト方針

- 認証の期待値は単一共有トークン前提です。
- 変更時はまず `npx.cmd tsc --noEmit` と `npm.cmd run build` を優先してください。
- Cloudflare 互換性に影響する変更では `npx.cmd opennextjs-cloudflare build` も確認してください。
- UI や主要フローを変えたら、可能な限り `web/e2e/` を更新してください。

## GPT Actions 関連

- GPT Actions 用の文面は `docs/gpt-actions/` に置いてください。
- `system-prompt.md` には instructions 相当を置きます。
- `guide-tool-response.md` には `guide` の本文相当を置きます。
- GPT Builder 向けの手順は `docs/gpt-actions/README.md` にまとめます。

## 注意点

- `README.md` は一部文字化けして見えることがあります。必要以上に触らないでください。
- ログファイルや生成物が混ざっているので、作業対象以外は編集しないでください。
- `web/node_modules/`, `web/.next/` のような依存・生成物は基本的に触らないでください。
- 変更は、ユーザーの依頼に直接必要な範囲に限定してください。
