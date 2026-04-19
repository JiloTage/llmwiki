# LLM Wiki

個人利用前提の LLM 向け Wiki です。現行の本番構成は `web/` のみで、Next.js 16 の App Router と Cloudflare Workers + D1 を使います。

主な実装:

- `web/`
  UI と API Route Handlers をまとめた本体です。`/api/v1/*` もここにあります。
- `web/migrations/`
  D1 スキーマです。
- `web/e2e/`
  Playwright の E2E テストです。
- `docs/cloudflare-deploy-runbook.md`
  Cloudflare デプロイ手順です。
- `docs/cloudflare-d1-migration-spec.md`
  D1 への移行・構成メモです。
- `docs/gpt-actions/`
  GPT Actions 用の補助ドキュメントです。

## 現在の前提

- 認証は共有 Bearer token のみです。
- 単一ローカルユーザー前提です。
- 本番 API は `web/src/app/api/v1/*` の Route Handlers が提供します。
- データストアは Cloudflare D1 です。

## ローカル起動

`web/.env.local` に最低限これを設定します。

```env
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOCAL_ACCESS_TOKEN=local-dev-session
NEXT_PUBLIC_LOCAL_ACCESS_TOKEN=local-dev-session
NEXT_PUBLIC_LOCAL_USER_ID=00000000-0000-4000-8000-000000000001
NEXT_PUBLIC_LOCAL_USER_EMAIL=local@llmwiki.local
# Optional: settings page MCP snippet
NEXT_PUBLIC_MCP_URL=http://localhost:8080/mcp
```

起動:

```powershell
cd web
npm.cmd install
npm.cmd run dev
```

## 確認コマンド

型チェック:

```powershell
cd web
npx.cmd tsc --noEmit
```

Next build:

```powershell
cd web
npm.cmd run build
```

Cloudflare bundle build:

```powershell
cd web
npx.cmd opennextjs-cloudflare build
```

E2E:

```powershell
cd web
npm.cmd run test:e2e
```

## デプロイ

本番デプロイは `.github/workflows/cloudflare-deploy.yml` で行います。`web/` を OpenNext でビルドし、D1 migration を適用してから Worker を deploy します。

関連ファイル:

- `web/wrangler.jsonc`
- `web/open-next.config.ts`
- `.github/workflows/cloudflare-deploy.yml`
- `web/migrations/0001_init.sql`

## 参考

- [docs/cloudflare-deploy-runbook.md](docs/cloudflare-deploy-runbook.md)
- [docs/cloudflare-d1-migration-spec.md](docs/cloudflare-d1-migration-spec.md)
- [docs/gpt-actions/README.md](docs/gpt-actions/README.md)
