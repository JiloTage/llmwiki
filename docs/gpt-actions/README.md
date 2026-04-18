# GPT Actions 設定

このディレクトリには、LLM Wiki の ChatGPT GPT Actions 設定に使う補助ファイルを置いています。

## ファイル

- `system-prompt.md`
  GPT Builder の Instructions に入れるベース文です。
- `guide-tool-response.md`
  `guide` action が返す本文の参照用コピーです。

## GPT Builder での設定手順

1. API 側の `LOCAL_ACCESS_TOKEN` を確認します。
   GPT は `Authorization: Bearer <LOCAL_ACCESS_TOKEN>` を送る前提です。
2. GPT Builder の Actions で OpenAPI schema URL を指定します。
   `https://<your-app-host>/api/openapi.json`
3. GPT Instructions のベースとして `system-prompt.md` の内容を使います。
4. OpenAPI schema から次の action が読み込まれることを確認します。
   - `POST /api/v1/actions/guide`
   - `POST /api/v1/actions/search`
   - `POST /api/v1/actions/read`
   - `POST /api/v1/actions/write`
   - `POST /api/v1/actions/delete`
5. GPT には最初に `guide` を呼ぶよう指示します。
   これで knowledge base 一覧と wiki 運用ルールを最初に取得できます。

## 補足

- 現在の本番 API は `web/src/app/api/v1/*` の Route Handlers で動作します。
- OpenAPI schema も同じデプロイ面から `/api/openapi.json` として公開します。
- 認証は単一の共有 Bearer token です。
- MCP 側のプロンプトや `guide` 本文を変えた場合は、このディレクトリ内のファイルも合わせて更新してください。
