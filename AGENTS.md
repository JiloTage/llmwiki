# AGENTS.md

このファイルは、このリポジトリで作業するエージェント向けの短い運用ガイドです。

## 概要

このリポジトリは、LLM向けの個人用Wikiシステムです。主な構成は次の通りです。

- `api/`
  FastAPI ベースのHTTP API。本リポジトリの中心です。
- `mcp/`
  Claude 連携用の MCP サーバー実装です。`guide`, `search`, `read`, `write`, `delete` を持ちます。
- `web/`
  Next.js ベースのフロントエンドです。
- `converter/`
  Office/PDF 変換用サービスです。
- `tests/`
  unit / integration テストです。
- `docs/gpt-actions/`
  ChatGPT GPT Actions 用の設定メモとプロンプト置き場です。

## 現在の前提

- このプロジェクトは完全な個人利用を前提にしています。
- API 認証は最小構成です。
  `Authorization: Bearer <LOCAL_ACCESS_TOKEN>` のみを受け付けます。
- API は常に `LOCAL_USER_ID` の単一ユーザーとして動作します。
- APIキー認証やJWT認証は現在使いません。

関連ファイル:

- `api/auth.py`
- `api/config.py`
- `.env.example`

## 変更方針

- 必要最小限の差分で直してください。
- 既存のMCP文言を扱うときは、要約ではなく原文維持を優先してください。
- 個人用前提を崩す変更は勝手に入れないでください。
  例:
  - マルチユーザー化
  - 認証方式の追加
  - 権限モデルの複雑化
- `api/` と `mcp/` の挙動を揃える変更では、どちらかだけを雑に変更しないでください。

## 作業時の優先順位

1. まず `api/` の実装を確認する
2. 必要なら `mcp/` の元実装と比較する
3. 影響がある場合のみ `docs/` や `tests/` を更新する
4. 最後にテストで確認する

## よく使う確認コマンド

PowerShell 前提です。

### API テスト

```powershell
.\api\.venv\Scripts\python.exe -m pytest tests\unit tests\integration
```

### 特定テストだけ実行

```powershell
.\api\.venv\Scripts\python.exe -m pytest tests\integration\isolation\test_actions_api.py
```

### API 起動

```powershell
cd api
.\.venv\Scripts\uvicorn.exe main:app --reload --port 8000
```

### MCP 起動

```powershell
cd mcp
uvicorn server:app --reload --port 8080
```

### Web 起動

```powershell
cd web
npm run dev
```

## テスト方針

- 認証の期待値は単一共有トークン前提です。
- integration テストでは「ローカルユーザーのデータは見える / 他ユーザーのデータは見えない」を確認します。
- 新しい挙動を追加したら、可能な限り integration テストを足してください。
- 既存仕様を変えた場合は、テストの期待値も同時に更新してください。

## GPT Actions 関連

- GPT Actions 用の文面は `docs/gpt-actions/` に置いてください。
- `system-prompt.md` には MCP の instructions 相当を置きます。
- `guide-tool-response.md` には `guide` の本文相当を置きます。
- GPT Builder 向けの手順は `docs/gpt-actions/README.md` にまとめます。

## 注意点

- `README.md` は一部文字化けして見えることがあります。必要以上に触らないでください。
- ログファイルや生成物が混ざっているので、作業対象以外は編集しないでください。
- `web/node_modules/`, `web/.next/`, `api/.venv/` のような依存・生成物は基本的に触らないでください。
- 変更は、ユーザーの依頼に直接必要な範囲に限定してください。
