# LLM Wiki

個人利用前提の LLM 向け Wiki です。現行の本番構成は `web/` のみで、Next.js 16 の App Router と Cloudflare Workers + D1 を使います。

主な実装:

- `web/`
  UI と API Route Handlers をまとめた本体です。`/api/v1/*` と `/mcp` もここにあります。
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

- 単一ローカルユーザー前提です。
- 本番 API は `web/src/app/api/v1/*` の Route Handlers が提供します。
- MCP endpoint は `web/src/app/mcp/route.ts` が提供します。
- データストアは Cloudflare D1 です。

## 公開 surface

- GPT Actions:
  `POST /api/v1/actions/guide`, `create-wiki`, `search`, `read`, `write`, `delete`
- MCP:
  `POST /mcp` で `initialize`, `ping`, `tools/list`, `tools/call` を受けます。
  `guide`, `create_wiki`, `search`, `read`, `write`, `delete` を MCP tool として公開します。

GPT Actions と MCP はどちらも同じ server 実装を呼び、実体は `web/src/lib/server/llmwiki.ts` に集約されています。

## ローカル起動

`web/.env.local` に最低限これを設定します。

```env
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_LOCAL_USER_ID=00000000-0000-4000-8000-000000000001
NEXT_PUBLIC_LOCAL_USER_EMAIL=local@llmwiki.local
# Optional: settings page MCP snippet
NEXT_PUBLIC_MCP_URL=http://localhost:3000/mcp
```

起動:

```powershell
cd web
npm.cmd install
npm.cmd run dev
```

MCP を手動で叩く最小例:

```bash
curl -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"example","version":"1.0.0"}}}'
```

Settings 画面の MCP snippet は `NEXT_PUBLIC_MCP_URL` から組み立てます。未指定なら `http://localhost:3000/mcp` を使います。

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
