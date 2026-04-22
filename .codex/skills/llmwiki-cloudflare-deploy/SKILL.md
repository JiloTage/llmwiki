---
name: llmwiki-cloudflare-deploy
description: Use when deploying this llmwiki repository to Cloudflare Workers + D1, validating the GitHub Actions pipeline, or checking the live production worker. This skill is specific to this repo's single-user Bearer token setup, D1 schema, and Linux CI deployment flow.
---

# llmwiki Cloudflare Deploy

This skill is for this repository only.

- Frontend and API deploy from `web/`
- Runtime target is Cloudflare Workers + D1
- Auth stays `Authorization: Bearer <LOCAL_ACCESS_TOKEN>`
- Production deploys run through GitHub Actions on Linux, not local Windows OpenNext builds

## Read first

Read these files before changing deploy behavior:

- `AGENTS.md`
- `docs/cloudflare-deploy-runbook.md`
- `.github/workflows/cloudflare-deploy.yml`
- `web/wrangler.jsonc`
- `web/migrations/0001_init.sql`

Read `docs/cloudflare-d1-migration-spec.md` only when schema or architecture changes are part of the task.

## Current repo facts

- Worker name: `llmwiki`
- D1 database name: `llmwiki`
- Public URL in current production: `https://llmwiki.tettoutower.workers.dev`
- Required GitHub secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_D1_DATABASE_ID`
  - `LOCAL_ACCESS_TOKEN`
- Required GitHub variables:
  - `APP_URL`
  - `NEXT_PUBLIC_LOCAL_USER_ID`
  - `NEXT_PUBLIC_LOCAL_USER_EMAIL`

Do not remove the shared Bearer token flow unless the user explicitly asks for that breaking change.

## Standard workflow

1. Validate local code in `web/`
2. Push to `master`
3. Let `Deploy Cloudflare Worker` run in GitHub Actions
4. Verify the live site and live API

Local validation commands:

```powershell
cd web
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run test:e2e
```

Do not treat a successful local `next build` on Windows as sufficient proof that Cloudflare deploy will work. The real deploy path is the Linux CI workflow with `opennextjs-cloudflare build`.

## Deploy workflow expectations

The workflow should do this, in order:

1. `npm ci`
2. inject `CLOUDFLARE_D1_DATABASE_ID` into `web/wrangler.jsonc`
3. `npx tsc --noEmit`
4. `npx opennextjs-cloudflare build`
5. `npx wrangler d1 migrations apply llmwiki --remote`
6. `npx wrangler deploy`

If any of those steps differ, inspect `.github/workflows/cloudflare-deploy.yml` first.

## Production verification

Check these after deploy:

```powershell
curl.exe -i https://llmwiki.tettoutower.workers.dev/api/v1/knowledge-bases
curl.exe -i -H "Authorization: Bearer <LOCAL_ACCESS_TOKEN>" https://llmwiki.tettoutower.workers.dev/api/v1/knowledge-bases
```

Expected:

- without token: `200` for `GET /api/v1/knowledge-bases`
- with token: `200`
- treat `GET /api/v1/knowledge-bases` as a public read check
- still verify Bearer auth on write operations during the smoke flow

Then run one live smoke flow against production:

1. create knowledge base
2. create note
3. read note content
4. search inserted text
5. delete the knowledge base you created

Do not leave smoke-test data behind.

## Common failure points

### Cloudflare bundle too large

Cloudflare free plan rejects worker bundles above the size limit. If deploy fails with a size-limit error, trim dependencies from `web/` before trying infrastructure workarounds.

### API returns 500 in production but pages load

Check `web/src/app/api/v1/**/route.ts` first.

In this repo, route handlers using `getCloudflareContext()` should not pin `export const runtime = "edge"` unless you have verified the production behavior. That setting previously caused production API failures while page routes still worked.

### `D1 binding DB is not configured`

Check:

- `web/wrangler.jsonc` still contains the `DB` binding
- the workflow replaced `REPLACE_ME`
- `CLOUDFLARE_D1_DATABASE_ID` exists in GitHub secrets

### Local build passes but deploy fails

Trust the GitHub Actions run over the Windows local environment. OpenNext on Windows is not the source of truth for this repo.

## Useful commands

```powershell
gh run list --workflow "Deploy Cloudflare Worker" --limit 5
gh run watch <run-id> --interval 10
git push origin master
```

For Cloudflare account checks from Windows PowerShell:

```powershell
cd web
npx.cmd wrangler whoami
```

## Change discipline

- Keep deploy changes surgical
- Do not rewrite auth, MCP, or schema behavior unless the task requires it
- If a deploy issue is confined to CI or route runtime wiring, fix only that layer
- After any deploy fix, re-verify the live API, not just local build output
