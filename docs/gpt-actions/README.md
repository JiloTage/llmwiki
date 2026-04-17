# GPT Actions Setup

This directory contains the assets needed to configure a ChatGPT GPT that uses the LLM Wiki API through GPT Actions.

## Files

- `system-prompt.md`
  Exact instructions copied from the MCP server prompt in `mcp/server.py`.
- `guide-tool-response.md`
  Exact guide text copied from the MCP `guide` tool in `mcp/tools/guide.py`.

## GPT Builder Setup

1. Set `LOCAL_ACCESS_TOKEN` in the API environment.
   The GPT should send `Authorization: Bearer <LOCAL_ACCESS_TOKEN>`.
2. In the GPT builder, add an Action using this API's OpenAPI schema:
   `https://<your-api-host>/openapi.json`
3. Use the contents of `system-prompt.md` as the GPT Instructions base prompt.
4. Make sure the GPT is allowed to call these endpoints:
   - `POST /v1/actions/guide`
   - `POST /v1/actions/search`
   - `POST /v1/actions/read`
   - `POST /v1/actions/write`
   - `POST /v1/actions/delete`
5. Instruct the GPT to call `guide` first. That matches the MCP behavior and gives it the full wiki workflow plus available knowledge bases.

## Notes

- The API-side OpenAPI descriptions for `guide`, `search`, `read`, `write`, and `delete` were aligned with the MCP tool descriptions.
- The `guide` response text was aligned with the MCP `GUIDE_TEXT`.
- Authentication is intentionally minimal: a single shared bearer token from `LOCAL_ACCESS_TOKEN`.
- If you update the MCP prompt later, update the files in this folder as well so the GPT builder prompt stays in sync.
