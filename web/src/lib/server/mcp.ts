import {
  autolinkAction,
  ApiError,
  MCP_INSTRUCTIONS,
  createWikiAction,
  deleteAction,
  guideAction,
  readAction,
  searchAction,
  writeAction,
} from "@/lib/server/llmwiki";

const MCP_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

const MCP_SERVER_INFO = {
  name: "llmwiki",
  version: "1.0.0",
};

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

type JsonObject = Record<string, unknown>;

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  call(args: unknown): Promise<unknown>;
};

const tools: ToolDefinition[] = [
  {
    name: "guide",
    description:
      "Get started with LLM Wiki. Call this first to discover available knowledge bases and workflow rules.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
    },
    call() {
      return guideAction();
    },
  },
  {
    name: "create_wiki",
    description:
      "Create a new wiki when no existing knowledge base fits the user's request.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        description: { type: ["string", "null"] },
      },
      required: ["name"],
    },
    call(args) {
      return createWikiAction(asObject(args) as { name?: string; description?: string | null });
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "search",
    description:
      "Browse files or run keyword search across the selected knowledge base.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        knowledge_base: { type: "string" },
        mode: { type: "string", enum: ["list", "search"] },
        query: { type: "string" },
        path: { type: "string" },
        tags: {
          type: ["array", "null"],
          items: { type: "string" },
        },
        limit: { type: "number" },
      },
      required: ["knowledge_base"],
    },
    annotations: {
      readOnlyHint: true,
    },
    call(args) {
      return searchAction(
        asObject(args) as {
          knowledge_base: string;
          mode?: "list" | "search";
          query?: string;
          path?: string;
          tags?: string[] | null;
          limit?: number;
        },
      );
    },
  },
  {
    name: "read",
    description:
      "Read one document, or batch-read files with a supported glob pattern.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        knowledge_base: { type: "string" },
        path: { type: "string" },
        sections: {
          type: ["array", "null"],
          items: { type: "string" },
        },
      },
      required: ["knowledge_base", "path"],
    },
    annotations: {
      readOnlyHint: true,
    },
    call(args) {
      return readAction(
        asObject(args) as {
          knowledge_base: string;
          path: string;
          sections?: string[] | null;
        },
      );
    },
  },
  {
    name: "write",
    description:
      "Create wiki pages or edit existing documents with append or exact string replacement.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        knowledge_base: { type: "string" },
        command: {
          type: "string",
          enum: ["create", "str_replace", "append"],
        },
        path: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        tags: {
          type: ["array", "null"],
          items: { type: "string" },
        },
        date_str: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" },
      },
      required: ["knowledge_base", "command"],
    },
    call(args) {
      return writeAction(
        asObject(args) as {
          knowledge_base: string;
          command: "create" | "str_replace" | "append";
          path?: string;
          title?: string;
          content?: string;
          tags?: string[] | null;
          date_str?: string;
          old_text?: string;
          new_text?: string;
        },
      );
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "autolink",
    description:
      "Scan existing wiki pages and add missing internal links to already-existing wiki pages.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        knowledge_base: { type: "string" },
      },
      required: ["knowledge_base"],
    },
    call(args) {
      return autolinkAction(
        asObject(args) as {
          knowledge_base: string;
        },
      );
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "delete",
    description:
      "Archive documents by exact path or supported glob pattern. Protected structural wiki files cannot be deleted.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        knowledge_base: { type: "string" },
        path: { type: "string" },
      },
      required: ["knowledge_base", "path"],
    },
    annotations: {
      destructiveHint: true,
    },
    call(args) {
      return deleteAction(
        asObject(args) as {
          knowledge_base: string;
          path: string;
        },
      );
    },
  },
];

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

function negotiateProtocolVersion(requestedVersion: unknown) {
  if (
    typeof requestedVersion === "string" &&
    MCP_PROTOCOL_VERSIONS.includes(
      requestedVersion as (typeof MCP_PROTOCOL_VERSIONS)[number],
    )
  ) {
    return requestedVersion;
  }
  return MCP_PROTOCOL_VERSIONS[0];
}

function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const requestOrigin = new URL(request.url).origin;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    requestOrigin;
  const allowedOrigins = new Set([requestOrigin, new URL(appUrl).origin]);

  if (!allowedOrigins.has(origin)) {
    throw new ApiError(403, "Invalid Origin");
  }
}

function success(id: JsonRpcId, result: Record<string, unknown>, protocolVersion?: string) {
  return Response.json(
    {
      jsonrpc: "2.0",
      id,
      result,
    },
    {
      headers: protocolVersion
        ? {
            "MCP-Protocol-Version": protocolVersion,
          }
        : undefined,
    },
  );
}

function failure(id: JsonRpcId, error: JsonRpcError, protocolVersion?: string) {
  return Response.json(
    {
      jsonrpc: "2.0",
      id,
      error,
    },
    {
      status: 400,
      headers: protocolVersion
        ? {
            "MCP-Protocol-Version": protocolVersion,
          }
        : undefined,
    },
  );
}

function toolError(id: JsonRpcId, message: string, protocolVersion?: string) {
  return success(
    id,
    {
      content: [
        {
          type: "text",
          text: message,
        },
      ],
      isError: true,
    },
    protocolVersion,
  );
}

function toToolResult(data: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
    isError: false,
  };
}

function parseRequest(body: unknown): JsonRpcRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "Expected a single JSON-RPC request object");
  }
  return body as JsonRpcRequest;
}

function parseMethod(request: JsonRpcRequest) {
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    throw new ApiError(400, "Invalid JSON-RPC request");
  }
  return request.method;
}

export async function handleMcpPost(request: Request) {
  validateOrigin(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure(null, {
      code: -32700,
      message: "Parse error",
    });
  }

  let rpcRequest: JsonRpcRequest;
  try {
    rpcRequest = parseRequest(body);
  } catch (error) {
    return failure(null, {
      code: -32600,
      message:
        error instanceof Error ? error.message : "Invalid JSON-RPC request",
    });
  }

  const protocolVersion = negotiateProtocolVersion(
    asObject(rpcRequest.params).protocolVersion ??
      request.headers.get("MCP-Protocol-Version"),
  );

  let method: string;
  try {
    method = parseMethod(rpcRequest);
  } catch (error) {
    return failure(rpcRequest.id ?? null, {
      code: -32600,
      message:
        error instanceof Error ? error.message : "Invalid JSON-RPC request",
    });
  }

  if (rpcRequest.id === undefined) {
    if (method === "notifications/initialized") {
      return new Response(null, { status: 202 });
    }
    return new Response(null, { status: 202 });
  }

  try {
    if (method === "initialize") {
      return success(
        rpcRequest.id,
        {
          protocolVersion,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: MCP_SERVER_INFO,
          instructions: MCP_INSTRUCTIONS,
        },
        protocolVersion,
      );
    }

    if (method === "ping") {
      return success(rpcRequest.id, {}, protocolVersion);
    }

    if (method === "tools/list") {
      return success(
        rpcRequest.id,
        {
          tools: tools.map(({ name, description, inputSchema, annotations }) => ({
            name,
            description,
            inputSchema,
            ...(annotations ? { annotations } : {}),
          })),
        },
        protocolVersion,
      );
    }

    if (method === "tools/call") {
      const params = asObject(rpcRequest.params);
      const name = params.name;
      if (typeof name !== "string" || !name) {
        return failure(
          rpcRequest.id,
          {
            code: -32602,
            message: "tools/call requires a tool name",
          },
          protocolVersion,
        );
      }

      const tool = tools.find((entry) => entry.name === name);
      if (!tool) {
        return failure(
          rpcRequest.id,
          {
            code: -32602,
            message: `Unknown tool: ${name}`,
          },
          protocolVersion,
        );
      }

      try {
        const result = await tool.call(params.arguments);
        return success(rpcRequest.id, toToolResult(result), protocolVersion);
      } catch (error) {
        if (error instanceof ApiError) {
          return toolError(rpcRequest.id, error.message, protocolVersion);
        }
        throw error;
      }
    }

    return failure(
      rpcRequest.id,
      {
        code: -32601,
        message: `Method not found: ${method}`,
      },
      protocolVersion,
    );
  } catch (error) {
    console.error(error);
    return failure(
      rpcRequest.id ?? null,
      {
        code: -32603,
        message: "Internal server error",
      },
      protocolVersion,
    );
  }
}

export async function handleMcpGet(request: Request) {
  validateOrigin(request);

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": llmwiki mcp\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
    },
  });
}

export async function handleMcpDelete(request: Request) {
  validateOrigin(request);
  return new Response(null, { status: 204 });
}
