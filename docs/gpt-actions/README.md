# GPT Actions 設定

このディレクトリには、LLM Wiki の ChatGPT GPT Actions 設定に使う補助ファイルを置いています。

## ファイル

- `system-prompt.md`
  GPT Builder の Instructions に入れるベース文です。
- `guide-tool-response.md`
  `guide` action が返す本文の参照用コピーです。

## GPT Builder での設定手順

1. GPT Builder の Actions で OpenAPI schema URL を指定します。
   `https://<your-app-host>/api/openapi.json`
2. GPT Instructions のベースとして `system-prompt.md` の内容を使います。
3. OpenAPI schema から次の action が読み込まれることを確認します。
   - `POST /api/v1/actions/guide`
   - `POST /api/v1/actions/create-wiki`
   - `POST /api/v1/actions/search`
   - `POST /api/v1/actions/read`
   - `POST /api/v1/actions/write`
   - `POST /api/v1/actions/autolink`
   - `POST /api/v1/actions/delete`
4. GPT には最初に `guide` を呼ぶよう指示します。
   これで knowledge base 一覧と wiki 運用ルールを最初に取得できます。
5. 既存 knowledge base が合わない場合は `create_wiki` を呼んで新しい wiki を作るよう指示します。

## 補足

- 現在の本番 API は `web/src/app/api/v1/*` の Route Handlers で動作します。
- OpenAPI schema も同じデプロイ面から `/api/openapi.json` として公開します。
- MCP 側のプロンプトや `guide` 本文を変えた場合は、このディレクトリ内のファイルも合わせて更新してください。
