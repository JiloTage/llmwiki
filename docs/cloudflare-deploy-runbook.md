# Cloudflare Deploy Runbook

最終更新: 2026-04-19

この文書は `llmwiki` を Cloudflare Workers + D1 へ実際にデプロイするための運用手順である。設計上の正本は [cloudflare-d1-migration-spec.md](./cloudflare-d1-migration-spec.md) とし、この文書はその実行手順だけを扱う。

## 1. 前提

- デプロイ対象は `web/` のみ
- API は `web/src/app/api/v1/*` の Route Handlers に統合済み
- D1 スキーマは `web/migrations/0001_init.sql` を正本とする
- OpenNext の Cloudflare build は Windows ネイティブでは不安定なため、実運用デプロイは Linux CI で行う

## 2. 一度だけやる設定

### 2.1 D1 データベースを作る

Cloudflare にログイン済みの環境で実行する。

```bash
cd web
npx wrangler d1 create llmwiki
```

出力された `database_id` を控える。GitHub secret `CLOUDFLARE_D1_DATABASE_ID` に設定する。

### 2.2 Cloudflare API token を作る

Cloudflare Dashboard で API token を作成する。

- template: `Edit Cloudflare Workers`
- scope: この Worker を置く account のみに絞る

token は GitHub secret `CLOUDFLARE_API_TOKEN` に設定する。

Cloudflare account ID は GitHub secret `CLOUDFLARE_ACCOUNT_ID` に設定する。

### 2.3 公開 URL を決める

`APP_URL` は wiki 内 deep link の生成に使う。実際の公開 URL を固定で設定する。

例:

- `https://llmwiki.example.com`
- `https://llmwiki.your-subdomain.workers.dev`

この値は GitHub variable `APP_URL` に設定する。

## 3. GitHub に入れる値

### 3.1 Secrets

必須:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`

### 3.2 Variables

必須:

- `APP_URL`
- `NEXT_PUBLIC_LOCAL_USER_ID`
- `NEXT_PUBLIC_LOCAL_USER_EMAIL`

任意:

- `NEXT_PUBLIC_MCP_URL`

備考:

- `APP_URL` は deep link と MCP snippet の base URL に使う

## 4. 初回デプロイ

GitHub Actions workflow は [cloudflare-deploy.yml](../.github/workflows/cloudflare-deploy.yml) を使う。

### 4.1 推奨手順

1. GitHub の secrets / variables をすべて設定する
2. GitHub Actions の `Deploy Cloudflare Worker` を `workflow_dispatch` で手動実行する
3. 成功後、Cloudflare 側で `workers.dev` URL または custom domain を開く

### 4.2 workflow がやること

1. `npm ci`
2. `wrangler.jsonc` に D1 database id を差し込む
3. `npx tsc --noEmit`
4. `npx opennextjs-cloudflare build`
5. `npx wrangler d1 migrations apply llmwiki --remote`
6. `npx wrangler deploy`

## 5. 初回確認項目

公開 URL に対して以下を確認する。

### 5.1 UI

- `/wikis` が開く
- 新規 wiki を作成できる
- `Overview` と `Log` が自動生成されている
- note を作成できる
- wiki ページを保存できる

### 5.2 API

```bash
curl https://YOUR_APP_URL/api/v1/knowledge-bases
```

- 200 が返る

### 5.3 Actions

- `guide`
- `search`
- `read`
- `write`
- `delete`

が UI または API 経由で成功すること

## 6. よくある詰まりどころ

### 6.1 `CLOUDFLARE_D1_DATABASE_ID is required`

GitHub secret `CLOUDFLARE_D1_DATABASE_ID` が未設定。

### 6.2 `D1 binding DB is not configured`

`wrangler.jsonc` の D1 binding が壊れているか、database id の差し込みに失敗している。

### 6.3 build は通るが API が 500 になる

初回 migration が未適用。workflow の `Apply D1 migrations` を確認する。

## 7. ローカル確認

Windows では OpenNext build が不安定なので、ローカルでは次だけを確認対象にする。

```bash
cd web
npx wrangler d1 migrations apply llmwiki --local
npx tsc --noEmit
npm run test:e2e
npm run build
```

`npm run preview` や `opennextjs-cloudflare build` の最終確認は WSL2 または Linux CI を前提にする。

## 8. 参考

- [Next.js on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare Workers GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
