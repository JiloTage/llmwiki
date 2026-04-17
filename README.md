# LLM Wiki

[![Live Demo](https://img.shields.io/badge/demo-llmwiki.app-blue)](https://llmwiki.app)
[![License](https://img.shields.io/badge/license-Apache%202.0-green)](https://opensource.org/licenses/Apache-2.0)

[Karpathy's LLM Wiki](https://x.com/karpathy/status/2039805659525644595)（[仕様](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)）を実装した、無料のオープンソースプロジェクトです。公開版は [llmwiki.app](https://llmwiki.app) で利用できます。

1. **ソースをアップロード**: PDF、記事、ノート、Office 文書を追加し、フル機能のドキュメントビューアで確認できます。
2. **Claude と接続**: MCP 経由で Claude を接続すると、ソースを読み込み、Wiki ページを生成し、相互参照や引用を保守します。
3. **Wiki が蓄積される**: 追加するソースや投げる質問ごとに Wiki が豊かになり、知識が再利用可能な形で積み上がります。

![LLM Wiki の画面例](wiki-page.png)

### 3 つのレイヤー

| レイヤー | 説明 |
|-------|-------------|
| **生のソース** | PDF、記事、ノート、文字起こしなど。変更されない一次情報であり、LLM は読むだけで書き換えません。 |
| **Wiki** | 要約、エンティティページ、相互参照、Mermaid 図、表などを含む LLM 生成の Markdown ページ群です。 |
| **ツール群** | 検索、読み取り、書き込みを担います。Claude は MCP 経由で接続し、全体をオーケストレーションします。 |

### 主要な操作

LLM Wiki には Claude.ai が直接接続できる **MCP サーバー** が含まれています。接続後、Claude はナレッジボルト全体に対して検索、読み取り、書き込み、削除を行えます。以下の操作はすべて Claude 経由で進みます。

**取り込み**: ソースを追加すると、Claude が読み込み、要約を書き、Wiki 全体のエンティティや概念ページを更新し、既存知識と矛盾する点を指摘します。1 つのソースが 10〜15 ページに影響することもあります。

**問い合わせ**: すでに統合済みの Wiki に対して複雑な質問を投げられます。知識は毎回生データから再導出されるのではなく整理済みで、良い回答は新規ページとして蓄積されます。

**点検**: 健全性チェックを実行し、一貫しないデータ、古い主張、孤立ページ、欠落した相互参照を検出します。Claude は次に調べるべき問いや追加すべきソースも提案します。

---

## アーキテクチャ

| コンポーネント | スタック | 役割 |
|-----------|-------|------------------|
| **Web** (`web/`) | Next.js 16, React 19, Tailwind, Radix UI | ダッシュボード、PDF/HTML ビューア、Wiki レンダラ、オンボーディング |
| **API** (`api/`) | FastAPI, asyncpg, aioboto3 | 認証、アップロード（TUS）、ドキュメント処理、OCR（Mistral） |
| **Converter** (`converter/`) | FastAPI, LibreOffice | 分離された Office→PDF 変換サービス |
| **MCP** (`mcp/`) | MCP SDK, Supabase OAuth | Claude 向けツール: `guide`, `search`, `read`, `write`, `delete` |
| **Database** | Supabase (Postgres + RLS + PGroonga) | ドキュメント、チャンク、ナレッジベース、ユーザー管理 |
| **Storage** | S3 互換ストレージ | 生ファイル、タグ付き HTML、抽出画像の保存 |

---

## MCP ツール

接続後、Claude はナレッジボルト全体にアクセスできます。

| ツール | 説明 |
|------|-------------|
| `guide` | Wiki の仕組みと利用可能なナレッジベースを説明します |
| `search` | ファイル一覧の参照や、PGroonga ランキングを使ったキーワード検索を行います |
| `read` | PDF のページ範囲指定、画像付きの読み取り、glob での一括読み取りに対応します |
| `write` | Wiki ページの作成、`str_replace` による編集、追記を行います。SVG と CSV アセットにも対応します |
| `delete` | パスまたは glob パターンでドキュメントをアーカイブします |

---

## はじめ方

LLM Wiki を最速で試す手順:

1. [llmwiki.app](https://llmwiki.app) で **サインアップ** し、ナレッジベースを作成する
2. **ソースをアップロード** する
3. **Claude と接続** する: 設定画面で MCP 設定をコピーし、Claude.ai にコネクタとして追加する
4. **構築を開始** する: Claude にソースを読ませ、Wiki を構築するよう依頼する

ローカルセットアップは不要です。

### セルフホスト

#### 前提条件

- Python 3.11+
- Node.js 20+
- [Supabase](https://supabase.com) プロジェクト、またはローカル Docker 環境
- S3 互換バケット（ファイルアップロード用）

#### 1. Database

```bash
psql $DATABASE_URL -f supabase/migrations/001_initial.sql
```

またはローカル Docker を使う場合:

```bash
docker compose up -d
```

#### 2. API

```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn main:app --reload --port 8000
```

#### 3. MCP Server

```bash
cd mcp
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8080
```

#### 4. Web

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

#### 5. Claude を接続

1. Claude の **Settings** > **Connectors** を開く
2. `http://localhost:8080/mcp` を向き先にしたカスタムコネクタを追加する
3. 案内に従って Supabase アカウントでサインインする

#### 環境変数

**API** (`api/.env`)

```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-ref.supabase.co
SUPABASE_JWT_SECRET=
MISTRAL_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET=your-bucket
APP_URL=http://localhost:3000
CONVERTER_URL=
```

**Web** (`web/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MCP_URL=http://localhost:8080/mcp
```

---

## この構成が機能する理由

ナレッジベース運用で面倒なのは、読むことや考えることそのものではなく、保守の細かい帳尻合わせです。相互参照の更新、要約の鮮度維持、新しいデータが古い主張と矛盾したときの検出、複数ページ間の整合性維持などが負担になります。

個人 Wiki が放棄されがちなのは、保守コストの増え方が価値の増え方を上回るからです。LLM は退屈せず、相互参照の更新も忘れず、1 回で多数のファイルに手を入れられます。保守コストがほぼゼロに近づくことで、Wiki を維持し続けられます。

人間の役割はソースを集め、分析の方向を決め、良い問いを立て、意味を考えることです。それ以外の大半を LLM が担います。

## ライセンス

Apache 2.0
