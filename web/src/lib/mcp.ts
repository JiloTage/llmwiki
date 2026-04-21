const DEFAULT_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const DEFAULT_MCP_URL = `${DEFAULT_APP_URL}/mcp`

export const MCP_URL =
  process.env.NEXT_PUBLIC_MCP_URL || DEFAULT_MCP_URL

export function buildMcpConfig(): string {
  return JSON.stringify(
    {
      mcpServers: {
        llmwiki: {
          url: MCP_URL,
        },
      },
    },
    null,
    2,
  )
}
