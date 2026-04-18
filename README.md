# LLM Wiki

LLM 向けの個人用 Wiki システムです。  
テキストソースと Markdown の Wiki ページを管理し、`guide` / `search` / `read` / `write` / `delete` の操作面を UI・HTTP API・MCP から使えるようにしています。

![LLM Wiki](wiki-page.png)

## 現在の構成

このリポジトリには 2 系統の実装があります。

- `web/`
  現在の主系です。Next.js 16 を Cloudflare Workers 上で動かし、D1 をデータストアとして使います。`/api/v1/*` の Route Handlers を内包しています。
- `api/`
  FastAPI ベースの API 実装です。Postgres 前提で、`/v1/*` エンドポイントを提供します。既存テストも主にこちらを対象にしています。
- `mcp/`
  FastMCP ベースの MCP サーバーです。`guide`, `search`, `read`, `write`, `delete` を公開します。
- `converter/`
  LibreOffice を使って Office 文書を PDF に変換する補助サービスです。必要な場合のみ使います。
- `tests/`
  unit / integration テストです。
- `docs/gpt-actions/`
  GPT Actions 用のメモとプロンプトです。

## 現在の前提

- 個人利用前提です。
- 認証は単一共有トークンです。
- Bearer トークンは `LOCAL_ACCESS_TOKEN` だけを使います。
- API は常に `LOCAL_USER_ID` の単一ユーザーとして動作します。
- マルチユーザー化、JWT 認証、複雑な権限モデルは現行コードの前提ではありません。

## 主な機能

- Knowledge Base の作成・更新・削除
- `/wiki/overview.md` と `/wiki/log.md` を含む Wiki の自動初期化
- `.md` / `.txt` を中心にしたノート作成と編集
- チャンク化 + 全文検索
  - `api/` では Postgres 上の `document_chunks`
  - `web/` では D1 + FTS5
- Wiki 用 action API
  - `guide`
  - `search`
  - `read`
  - `write`
  - `delete`
- MCP 経由での同等操作

## API の見方

実装ごとにパスが少し違います。

- `web/` 側: `/api/v1/*`
  - 例: `/api/v1/knowledge-bases`
  - 例: `/api/v1/actions/search`
- `api/` 側: `/v1/*`
  - 例: `/v1/knowledge-bases`
  - 例: `/v1/actions/search`

FastAPI 側で公開されている主なルート:

- `/health`
- `/v1/me`
- `/v1/onboarding/complete`
- `/v1/usage`
- `/v1/admin/stats`
- `/v1/knowledge-bases/*`
- `/v1/api-keys/*`
- `/v1/actions/*`

## MCP ツール

`mcp/` では次のツールを提供します。

- `guide`
- `search`
- `read`
- `write`
- `delete`

`guide` は Wiki の運用ルールと利用可能な Knowledge Base 一覧を返します。  
`search` / `read` / `write` / `delete` は `api/routes/actions.py` と同系統の振る舞いです。

## ローカル開発

### 1. 共通環境変数

ルートの `.env.example` をコピーして `.env` を作成します。

```powershell
Copy-Item .env.example .env
```

最低限よく使う値:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/supavault
LOCAL_USER_ID=00000000-0000-4000-8000-000000000001
LOCAL_USER_EMAIL=local@llmwiki.local
LOCAL_USER_NAME=Local User
LOCAL_ACCESS_TOKEN=local-dev-session
APP_URL=http://localhost:3000
MCP_URL=http://localhost:8080/mcp
```

### 2. Postgres を使う場合

ローカル DB を使うなら、付属の `docker-compose.yml` で起動できます。

```powershell
docker compose up -d
```

### 3. FastAPI API

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\uvicorn.exe main:app --reload --port 8000
```

### 4. MCP Server

```powershell
cd mcp
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\uvicorn.exe server:app --reload --port 8080
```

### 5. Web

`web/` は現在の主系です。Next.js 開発サーバーは次で起動します。

```powershell
cd web
npm install
npm run dev
```

必要なら `web/.env.local` に以下を設定してください。

```env
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MCP_URL=http://localhost:8080/mcp
NEXT_PUBLIC_LOCAL_USER_ID=00000000-0000-4000-8000-000000000001
NEXT_PUBLIC_LOCAL_USER_EMAIL=local@llmwiki.local
LOCAL_ACCESS_TOKEN=local-dev-session
NEXT_PUBLIC_LOCAL_ACCESS_TOKEN=local-dev-session
```

### 6. Converter

Office → PDF 変換が必要な場合だけ起動します。LibreOffice が必要です。

```powershell
cd converter
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\uvicorn.exe main:app --reload --port 8090
```

## テスト

このリポジトリの CI は現在 `api/` のテストを主に見ています。

全体テスト:

```powershell
.\api\.venv\Scripts\python.exe -m pytest tests\unit tests\integration
```

特定テスト:

```powershell
.\api\.venv\Scripts\python.exe -m pytest tests\integration\isolation\test_actions_api.py
```

テスト用 DB だけ起動する場合:

```powershell
docker compose -f docker-compose.test.yml up -d
```

## Cloudflare Workers + D1

現在のデプロイ主系は `web/` です。

- Worker 設定: `web/wrangler.jsonc`
- D1 schema: `web/migrations/0001_init.sql`
- デプロイ workflow: `.github/workflows/cloudflare-deploy.yml`

詳細は次を参照してください。

- [docs/cloudflare-d1-migration-spec.md](docs/cloudflare-d1-migration-spec.md)
- [docs/cloudflare-deploy-runbook.md](docs/cloudflare-deploy-runbook.md)

## 参考ファイル

- 認証: `api/auth.py`
- FastAPI 設定: `api/config.py`
- FastAPI action API: `api/routes/actions.py`
- MCP サーバー: `mcp/server.py`
- MCP ツール登録: `mcp/tools/__init__.py`
- Web 側 API 実装: `web/src/lib/server/llmwiki.ts`

## License

Apache 2.0
