---
name: llmwiki-production-smoke-test
description: Use when testing the live llmwiki deployment on Cloudflare Workers. This skill covers production UI and API smoke checks against the deployed URL, including cleanup before and after the run so no test data remains.
---

# llmwiki Production Smoke Test

This skill is for this repository's live Cloudflare deployment.

- Production URL: `https://llmwiki.tettoutower.workers.dev`
- Auth model: shared Bearer token
- Frontend and API both live under the same origin
- Smoke tests must clean up any created knowledge bases

## Read first

- `AGENTS.md`
- `.codex/skills/llmwiki-cloudflare-deploy/SKILL.md`
- `docs/cloudflare-deploy-runbook.md`
- `web/e2e/wikis.spec.ts`

## When to use

Use this when the user asks to:

- verify the deployed site
- test the production link
- confirm a Cloudflare deploy worked
- run a live smoke test after an app or workflow change

## Preconditions

Before running the smoke test, confirm:

- the latest `Deploy Cloudflare Worker` GitHub Actions run succeeded
- `LOCAL_ACCESS_TOKEN` is available
- you can call the live API with that token

Quick auth check:

```powershell
curl.exe -i https://llmwiki.tettoutower.workers.dev/api/v1/knowledge-bases
curl.exe -i -H "Authorization: Bearer <LOCAL_ACCESS_TOKEN>" https://llmwiki.tettoutower.workers.dev/api/v1/knowledge-bases
```

Expected:

- without token: `401`
- with token: `200`

## Standard production smoke flow

Always start and end with cleanup.

1. delete all existing knowledge bases through the live API
2. open `/wikis` in a browser
3. create the first wiki from the empty state
4. confirm `Overview` and `Log` are visible
5. create one note through the live API or UI
6. open that note in the live UI
7. edit title and body, then verify autosave
8. verify saved content again through the live API
9. create a second wiki from the list page
10. open `Settings`
11. delete every test knowledge base you created
12. verify `GET /api/v1/knowledge-bases` returns `[]`

The smoke run is not complete if cleanup is missing.

## Preferred execution method

Run a one-off Playwright script from the `web/` directory so `@playwright/test` resolves correctly.

- Use `node -` from `web/`
- Drive the production UI with Playwright
- Use `fetch()` against the same production origin for cleanup and API verification
- Do not commit the smoke script

If Playwright MCP cannot launch because of local browser permission issues, this inline `node -` approach is the fallback.

## Minimum assertions

The smoke test should prove all of these:

- empty-state wiki creation works
- the app routes to `/wikis/local-wiki`
- `Overview` renders
- `Log` renders
- note editor opens for a source note
- title edit persists
- body edit persists
- autosave reaches `Saved`
- second wiki creation works
- settings page opens
- cleanup succeeds

## API checks during the run

Use the production API to confirm persistence, not just the rendered UI.

At minimum verify:

- created knowledge base exists
- created note exists
- `GET /api/v1/documents/:id/content` contains the edited body
- `GET /api/v1/knowledge-bases/:id/documents` reflects the edited title

## Cleanup rule

The repo is personal-use, so leaving smoke data in production is avoidable noise.

Always:

- delete test knowledge bases in `finally`
- re-check the knowledge base list after cleanup

If cleanup fails, report that explicitly as a production issue.

## Known pitfalls

### `@playwright/test` cannot be resolved

You are probably running the script outside `web/`. Run it from `web/`.

### Playwright MCP cannot launch a browser

Use a direct `node -` script with `require('@playwright/test')` instead of the MCP browser tools.

### API returns `500` while pages load

Check `web/src/app/api/v1/**/route.ts` and confirm route handlers are not pinned to a runtime setting that breaks Cloudflare production behavior.

### Smoke run passes in UI but data is missing

Re-check persistence via API. UI-only confirmation is not enough for this repo.
