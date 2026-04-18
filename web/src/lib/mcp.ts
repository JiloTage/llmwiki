const DEFAULT_MCP_URL = 'http://localhost:8080/mcp'

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
