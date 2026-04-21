const DEFAULT_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const DEFAULT_MCP_URL = `${DEFAULT_APP_URL}/mcp`

export const MCP_URL =
  process.env.NEXT_PUBLIC_MCP_URL || DEFAULT_MCP_URL

const MCP_AUTH_TOKEN = process.env.NEXT_PUBLIC_LOCAL_ACCESS_TOKEN

export function buildMcpConfig(): string {
  const llmwikiConfig = MCP_AUTH_TOKEN
    ? {
        url: MCP_URL,
        headers: {
          Authorization: `Bearer ${MCP_AUTH_TOKEN}`,
        },
      }
    : {
        url: MCP_URL,
      }

  return JSON.stringify(
    {
      mcpServers: {
        llmwiki: llmwikiConfig,
      },
    },
    null,
    2,
  )
}
