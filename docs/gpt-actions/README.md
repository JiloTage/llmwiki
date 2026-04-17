# GPT Actions 設定

このディレクトリには、LLM Wiki API を GPT Actions 経由で利用する ChatGPT GPT を設定するためのファイルをまとめています。

## ファイル

- `system-prompt.md`
  `mcp/server.py` にある MCP サーバーの instructions をそのまま格納したファイルです。
- `guide-tool-response.md`
  `mcp/tools/guide.py` の `guide` ツール本文をそのまま格納したファイルです。

## GPT Builder での設定手順

1. API 側の環境変数に `LOCAL_ACCESS_TOKEN` を設定します。
   GPT は `Authorization: Bearer <LOCAL_ACCESS_TOKEN>` を送る前提です。
2. GPT Builder で Action を追加し、この API の OpenAPI スキーマを指定します。
   `https://<your-api-host>/openapi.json`
3. GPT Instructions のベースプロンプトとして `system-prompt.md` の内容を使います。
4. GPT から次のエンドポイントを呼べるようにします。
   - `POST /v1/actions/guide`
   - `POST /v1/actions/search`
   - `POST /v1/actions/read`
   - `POST /v1/actions/write`
   - `POST /v1/actions/delete`
5. GPT には最初に `guide` を呼ぶよう指示してください。
   これで MCP と同じ流れになり、Wiki の運用ルールと利用可能な knowledge base を最初に取得できます。

## 補足

- API 側の OpenAPI description は `guide`, `search`, `read`, `write`, `delete` すべて MCP のツール説明に合わせてあります。
- `guide` のレスポンス本文も MCP の `GUIDE_TEXT` に合わせてあります。
- 認証は意図的に最小構成で、`LOCAL_ACCESS_TOKEN` による単一の共有 Bearer トークンを使います。
- 今後 MCP 側のプロンプトを更新した場合は、このフォルダ内のファイルも合わせて更新してください。GPT Builder 側のプロンプトとの同期が崩れます。
