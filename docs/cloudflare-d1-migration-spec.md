# Cloudflare Workers + D1 移行仕様

状態: 確定
更新日: 2026-04-18

この文書は `llmwiki` を Cloudflare Workers + D1 に移行するための確定仕様である。以後の実装はこの文書に従う。新しい判断が必要になった場合は、先にこの文書を更新してから実装する。

実際のデプロイ手順は [cloudflare-deploy-runbook.md](./cloudflare-deploy-runbook.md) を参照する。

## 1. 前提

- 用途は完全個人用とする。
- 入力対象はテキストファイルのみとする。
- 配置先は Cloudflare 無料枠を前提とする。
- データベースは D1 を使う。
- 初回移行の完了条件に MCP は含めないが、既存の `mcp/` 実装と関連 docs は削除しない。

## 2. 最終判断

### 2.1 採用するもの

- `web/` を Cloudflare Workers 上の Next.js として維持する。
- API は FastAPI をやめ、Next.js Route Handlers に統合する。
- 保存対象は wiki とテキスト文書のみとし、本文は D1 に保存する。
- 検索は D1 の FTS5 を使う。
- URL は同一オリジンの `/api/v1/*` に統一する。
- フロントエンドは単一ユーザー前提の個人用 UI にする。
- `mcp/` は今回の Cloudflare デプロイ対象外とする。

### 2.2 採用しないもの

- `api/` の FastAPI 維持
- `converter/`
- Supabase Postgres
- RLS
- PGroonga
- S3 互換ストレージ
- PDF / Office / 画像 / HTML / OCR / TUS upload
- マルチユーザー対応

## 3. 目的

- Cloudflare 無料枠で維持できる最小構成にする。
- 既存 UI の wiki 作成、閲覧、編集、検索体験を維持する。
- 実装対象を `web/` に集約し、運用対象を減らす。

## 4. 非目標

- 既存 `api/` の互換維持
- Supabase スキーマとの互換維持
- PDF / 画像 / OCR ワークフローの維持
- 今回の Cloudflare デプロイに `mcp/` を含めること
- 公開 SaaS としてのセキュリティ要件充足

## 5. 対象範囲

この移行で残す機能は次のみ。

- wiki 一覧の表示
- wiki の作成、名前変更、削除
- ドキュメント一覧の表示
- テキストファイルの取り込み
- ノートの作成
- ドキュメント本文の取得と更新
- タイトル、タグ、日付、メタデータの更新
- wiki ページの `guide` / `search` / `read` / `write` / `delete`

この移行で削除する機能は次。

- `/v1/uploads`
- `/v1/documents/:id/url`
- PDF viewer / image viewer / HTML viewer / processing viewer
- OCR page usage
- onboarding
- quota / usage 制御
- `users`, `api_keys` を前提にした処理

## 6. 目標アーキテクチャ

```text
Browser
  -> Next.js app on Cloudflare Workers
     -> Route Handlers (/api/v1/*)
        -> D1
```

補足:

- フロントエンドと API は同一デプロイに統合する。
- 外部 API URL へ向ける構成は廃止する。
- 初回移行では `mcp/` を Cloudflare へ載せない。
- 既存の `mcp/` コードと GPT Actions 用 docs は repo に残す。

## 7. D1 制約を前提にした設計ルール

2026-04-18 時点の Cloudflare 公式情報では D1 Free に以下の制約がある。

- 5 million rows read / day
- 100,000 rows written / day
- 500 MB / database
- 2,000,000 bytes max string/BLOB/row

そのため、以下を設計ルールとする。

- 文書一覧の 5 秒ポーリングは廃止する。
- 長文は検索用に chunk 化して保存する。
- `content` 1 行に巨大データを詰め続けない。
- FTS5 の検索対象は `document_chunks` を正本にする。
- 文書更新時は対象文書の chunk と FTS 行を全再生成する。

参考:

- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/sql-api/sql-statements/

## 8. リポジトリの最終形

初回移行完了時点で正として扱う実装は `web/` のみとする。

- `web/`: 採用
- `api/`: 削除対象
- `converter/`: 削除対象
- `mcp/`: repo に残すが、今回のデプロイ対象外

README や docs はこの前提で整理する。

## 9. D1 データモデル

### 9.1 方針

- 主キーは `INTEGER PRIMARY KEY AUTOINCREMENT`。
- 配列は JSON 文字列で持つ。
- `jsonb` は `TEXT` に JSON 文字列で持つ。
- `updated_at` はアプリ側で更新する。
- `document_number` は廃止する。
- user ownership は廃止する。

### 9.2 スキーマ

```sql
CREATE TABLE knowledge_bases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  knowledge_base_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  title TEXT,
  path TEXT NOT NULL DEFAULT '/',
  file_type TEXT NOT NULL DEFAULT 'md',
  content TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  date TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_documents_kb_path_filename
  ON documents(knowledge_base_id, path, filename);

CREATE INDEX idx_documents_kb_archived_path
  ON documents(knowledge_base_id, archived, path, sort_order, filename);

CREATE TABLE document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  header_breadcrumb TEXT,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(document_id, chunk_index)
);

CREATE VIRTUAL TABLE document_chunks_fts USING fts5(
  document_chunk_id UNINDEXED,
  content,
  title,
  filename,
  path,
  tokenize='unicode61'
);
```

### 9.3 削除するテーブル

以下の概念は D1 版では持たない。

- `users`
- `api_keys`
- `document_pages`
- usage / quota 関連テーブル

### 9.4 scaffold 文書

wiki 作成時に次を必ず生成する。

- `/wiki/overview.md`
- `/wiki/log.md`

`index.json` は生成しない。サイドバー tree は `documents` から生成する。

## 10. chunking と検索の確定仕様

### 10.1 chunking

chunking は次のルールで固定する。

- 改行は `\n` に正規化する。
- 空文書は chunk を 0 件にする。
- Markdown 見出しがある場合は見出し境界を優先して切る。
- 目標サイズは 1,800 文字、最大 2,400 文字とする。
- overlap は 200 文字とする。
- chunk は作成順に `chunk_index` を採番する。
- `header_breadcrumb` には見出し階層を ` > ` で保存する。

### 10.2 FTS 更新

文書作成または本文更新時は以下を 1 フローで実行する。

1. 対象 document の既存 chunk を削除する
2. 対象 document の既存 FTS 行を削除する
3. 新しい chunk を生成する
4. `document_chunks` に insert する
5. `document_chunks_fts` に insert する

削除時は対象 document の chunk と FTS 行も削除する。

### 10.3 検索対象

検索の正本は `document_chunks_fts` とする。`documents.content` に対する全文検索は行わない。

## 11. URL と画面遷移の確定仕様

### 11.1 API パス

API パスは `/api/v1/*` で固定する。

例:

- `/api/v1/knowledge-bases`
- `/api/v1/documents/123/content`
- `/api/v1/actions/search`

`/v1/*` は使わない。フロントエンド呼び出しもすべて `/api/v1/*` に揃える。

### 11.2 フロントの query param

URL の query param は次で固定する。

- wiki ページ選択: `?page=<wiki-relative-path>`
- ソース文書選択: `?doc=<document-id>`

既存の `document_number` ベース URL との互換は持たない。URL 仕様はこの移行で切り替える。

## 12. API 仕様

API は Next.js Route Handlers で実装する。

### 12.1 knowledge base

- `GET /api/v1/knowledge-bases`
- `POST /api/v1/knowledge-bases`
- `PATCH /api/v1/knowledge-bases/:id`
- `DELETE /api/v1/knowledge-bases/:id`

返却 shape は次で固定する。

- `id`
- `name`
- `slug`
- `description`
- `source_count`
- `wiki_page_count`
- `created_at`
- `updated_at`

### 12.2 documents

- `GET /api/v1/knowledge-bases/:id/documents`
- `POST /api/v1/knowledge-bases/:id/documents/note`
- `GET /api/v1/documents/:id/content`
- `PUT /api/v1/documents/:id/content`
- `PATCH /api/v1/documents/:id`
- `DELETE /api/v1/documents/:id`

制約:

- `file_type` は `md` または `txt` のみ許可する。
- `POST .../note` は `filename`, `path`, `content` を受け付ける。
- `PATCH /documents/:id` は `title`, `path`, `tags`, `date`, `metadata`, `sort_order` のみ更新可能とする。
- `DELETE` は `archived = 1` の論理削除とする。

### 12.3 actions

- `POST /api/v1/actions/guide`
- `POST /api/v1/actions/search`
- `POST /api/v1/actions/read`
- `POST /api/v1/actions/write`
- `POST /api/v1/actions/delete`

方針:

- Route 名と request/response の表面は現行に近づける。
- 内部実装は D1 + FTS5 に置き換える。
- `guide` は wiki 一覧と利用方法のみ返す。
- `search` は `document_chunks_fts MATCH ?` を使う。
- `read` は単一文書読み取りと glob 読み取りを提供する。
- `write` は `create`, `str_replace`, `append` のみ提供する。
- `delete` は path 指定または glob 指定で論理削除する。

## 13. glob 対応の確定仕様

初回移行で対応する pattern は次に限定する。

- 完全一致 path
- `*`
- `**`
- `**/*`
- `*.md`
- `*.txt`
- `**/*.md`
- `**/*.txt`
- `/wiki/**`
- `/wiki/**/*.md`

これ以外の pattern は未対応とし、`400 Bad Request` を返す。

`?`、文字クラス、複雑な拡張 glob は対応しない。

## 14. フロントエンド変更仕様

### 14.1 認証周り

認証 UI は持たず、単一ユーザー前提の固定ユーザー情報だけを初期化する。

確定事項:

- `LOCAL_ACCESS_TOKEN` は廃止する
- `NEXT_PUBLIC_LOCAL_ACCESS_TOKEN` は廃止する
- `AuthProvider` は固定ユーザー情報のみ初期化する
- API 呼び出しに `Authorization` header は付けない
- `onboarding` と実ユーザー認証フローは削除対象のままとする

### 14.2 `apiFetch`

`apiFetch()` は相対パスのみを扱う。

ルール:

- ベース URL は持たない
- `path` は必ず `/api/v1/...` を受ける
- `Content-Type: application/json` は維持する

### 14.3 ドキュメント一覧

- `useKBDocuments.ts` の 5 秒ポーリングは削除する
- 更新は作成、保存、削除完了後に必要な state のみ更新する
- 自動再取得が必要な場合のみ明示的に `refetchDocuments()` を呼ぶ

### 14.4 viewer

残す viewer はテキスト系のみ。

- `NoteEditor`: 維持
- text 表示用 viewer: 必要なら維持

削除する viewer:

- `PdfDocViewer`
- `ImageViewer`
- `HtmlDocViewer`
- `ProcessingViewer`
- `FailedViewer`
- `UnsupportedViewer` の非テキスト向け分岐

### 14.5 ファイル取り込み

ファイル取り込みは `.md`, `.txt` のみ受け付ける。

ルール:

- ブラウザでファイル内容を読み込む
- `POST /api/v1/knowledge-bases/:id/documents/note` に送る
- `filename` は元ファイル名を使う
- `title` は server 側で filename から決める

### 14.6 settings

`settings` 画面は削除しない。初回移行では次のどちらかで扱う。

1. MCP config 表示中心の簡略画面として残す
2. 一時的に usage 表示を縮小して残す

ただし OCR pages や storage quota など、廃止済みの概念は画面から削除する。

## 15. 型の確定方針

初回移行で型から削除する項目:

- `user_id`
- `file_size`
- `status`
- `page_count`
- `error_message`
- `url`
- `document_number`

## 16. 実装配置

新規実装は `web/` 配下に置く。

想定配置:

- `web/src/app/api/v1/knowledge-bases/route.ts`
- `web/src/app/api/v1/knowledge-bases/[id]/route.ts`
- `web/src/app/api/v1/knowledge-bases/[id]/documents/route.ts`
- `web/src/app/api/v1/knowledge-bases/[id]/documents/note/route.ts`
- `web/src/app/api/v1/documents/[id]/route.ts`
- `web/src/app/api/v1/documents/[id]/content/route.ts`
- `web/src/app/api/v1/actions/guide/route.ts`
- `web/src/app/api/v1/actions/search/route.ts`
- `web/src/app/api/v1/actions/read/route.ts`
- `web/src/app/api/v1/actions/write/route.ts`
- `web/src/app/api/v1/actions/delete/route.ts`
- `web/src/lib/server/db.ts`
- `web/src/lib/server/repositories/*`
- `web/migrations/*`

## 17. 段階的移行手順

### Phase 1: 基盤

- Cloudflare OpenNext 構成を `web/` に導入する
- `wrangler.jsonc` を追加する
- D1 binding を追加する
- D1 migration を追加する

完了条件:

- `wrangler dev` で起動する
- D1 に対して Route Handler から疎通できる

### Phase 2: CRUD

- knowledge base CRUD を Route Handlers に移す
- documents CRUD を Route Handlers に移す
- `apiFetch()` を `/api/v1/*` の相対パスに統一する
- auth 関連 store と provider を外す
- file upload を text-only にする

完了条件:

- wiki 作成
- wiki 名変更
- wiki 削除
- ノート作成
- ノート編集
- ノート削除

が UI 上で動く。

### Phase 3: 検索と wiki 操作

- `guide`, `search`, `read`, `write`, `delete` を D1 実装へ移す
- chunk 更新と FTS5 更新を実装する
- glob 対応をこの仕様の範囲で実装する

完了条件:

- wiki の読取
- wiki の検索
- wiki の `str_replace`
- wiki の `append`
- wiki の path 指定削除

が API と UI で成立する。

### Phase 4: 削除と整理

- `api/`, `converter/` を削除する
- 不要 env を削除する
- README と docs を新構成に合わせる
- settings 画面を新構成に合わせて整理する

完了条件:

- 開発と本番に Supabase / FastAPI / converter 依存が残らない
- `mcp/` は repo に残っていてよいが、Cloudflare デプロイ必須ではない

## 18. 受け入れ基準

最低限の受け入れ基準は次で固定する。

1. 新規 wiki を作れる
2. `/wiki/overview.md` と `/wiki/log.md` が自動生成される
3. `.md` と `.txt` を取り込める
4. 取り込んだ文書を編集できる
5. wiki ページを作成、追記、文字列置換できる
6. FTS5 検索でヒットと snippet が返る
7. `/wiki/**` の glob 読み取りが動く
8. source 文書と wiki ページの URL がリロード後も復元される
9. ポーリングなしで通常操作が成立する
10. `wrangler deploy` でデプロイできる

## 19. デプロイ仕様

### 19.1 `wrangler.jsonc`

最小構成は次。

```json
{
  "name": "llmwiki",
  "main": ".open-next/worker.js",
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "compatibility_date": "2026-04-18",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "llmwiki",
      "database_id": "REPLACE_ME"
    }
  ]
}
```

### 19.2 コマンド

```bash
npx wrangler d1 create llmwiki
npx wrangler d1 execute llmwiki --file=./web/migrations/0001_init.sql
npx wrangler deploy
```

Windows 補足:
- OpenNext の Cloudflare build は Windows ネイティブ環境で `copyfile` / `symlink` エラーになることがある
- `opennextjs-cloudflare build` / `deploy` は WSL か Linux CI 上で実行する前提にする

## 20. 実装時の禁止事項

- `/v1/*` と `/api/v1/*` を混在させない
- polling を再導入しない
- PDF/画像/OCR 系のコードを温存しない
- D1 版で `document_number` を新規正本 ID に戻さない
- 新規機能のために `api/` を復活させない

## 21. 未決事項

未決事項はない。新しい判断が必要になった場合は、この文書を更新してから実装する。
