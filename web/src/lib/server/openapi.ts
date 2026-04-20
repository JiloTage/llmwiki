type JsonSchema = Record<string, unknown>;

function actionOperation(
  summary: string,
  description: string,
  responseSchemaRef: string,
  requestSchemaRef?: string,
) {
  const operation: Record<string, unknown> = {
    operationId: summary,
    summary,
    description,
    responses: {
      "200": {
        description: "Successful response",
        content: {
          "application/json": {
            schema: { $ref: responseSchemaRef },
          },
        },
      },
    },
  };

  if (requestSchemaRef) {
    operation.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: requestSchemaRef },
        },
      },
    };
  }

  return operation;
}

export function buildOpenApiDocument(origin: string) {
  const timestampSchema = {
    type: "string",
    format: "date-time",
  } satisfies JsonSchema;

  const nullableStringSchema = {
    anyOf: [{ type: "string" }, { type: "null" }],
  } satisfies JsonSchema;

  const documentBaseSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string" },
      filename: { type: "string" },
      title: nullableStringSchema,
      file_type: { type: "string" },
      tags: {
        type: "array",
        items: { type: "string" },
      },
      updated_at: {
        anyOf: [timestampSchema, { type: "null" }],
      },
      deep_link: { type: "string", format: "uri" },
    },
    required: ["path", "filename", "title", "file_type", "tags", "updated_at", "deep_link"],
  } satisfies JsonSchema;

  return {
    openapi: "3.1.0",
    info: {
      title: "LLM Wiki Actions API",
      version: "1.0.0",
      description:
        "OpenAPI schema for the deployed LLM Wiki GPT Actions endpoints. " +
        "GPT Actions endpoints do not require authentication.",
    },
    servers: [{ url: origin }],
    components: {
      schemas: {
        ErrorResponse: {
          type: "object",
          additionalProperties: false,
          properties: {
            detail: { type: "string" },
          },
          required: ["detail"],
        },
        GuideKnowledgeBase: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            description: nullableStringSchema,
            source_count: { type: "integer" },
            wiki_page_count: { type: "integer" },
            created_at: timestampSchema,
            updated_at: timestampSchema,
          },
          required: [
            "id",
            "name",
            "slug",
            "description",
            "source_count",
            "wiki_page_count",
            "created_at",
            "updated_at",
          ],
        },
        CreateWikiRequest: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            description: nullableStringSchema,
          },
          required: ["name"],
        },
        GuideResponse: {
          type: "object",
          additionalProperties: false,
          properties: {
            instructions: { type: "string" },
            knowledge_bases: {
              type: "array",
              items: { $ref: "#/components/schemas/GuideKnowledgeBase" },
            },
          },
          required: ["instructions", "knowledge_bases"],
        },
        SearchRequest: {
          type: "object",
          additionalProperties: false,
          properties: {
            knowledge_base: { type: "string" },
            mode: {
              type: "string",
              enum: ["list", "search"],
              default: "list",
            },
            query: { type: "string" },
            path: { type: "string", default: "*" },
            tags: {
              anyOf: [
                {
                  type: "array",
                  items: { type: "string" },
                },
                { type: "null" },
              ],
            },
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          },
          required: ["knowledge_base"],
        },
        SearchListItem: {
          allOf: [
            documentBaseSchema,
            {
              type: "object",
              additionalProperties: false,
              properties: {
                page_count: {
                  anyOf: [{ type: "integer" }, { type: "null" }],
                },
                kind: {
                  type: "string",
                  enum: ["source", "wiki"],
                },
              },
              required: ["page_count", "kind"],
            },
          ],
        },
        SearchMatch: {
          allOf: [
            documentBaseSchema,
            {
              type: "object",
              additionalProperties: false,
              properties: {
                page: {
                  anyOf: [{ type: "integer" }, { type: "null" }],
                },
                header_breadcrumb: { type: "string" },
                snippet: { type: "string" },
              },
              required: ["page", "header_breadcrumb", "snippet"],
            },
          ],
        },
        SearchResponse: {
          type: "object",
          additionalProperties: false,
          properties: {
            mode: {
              type: "string",
              enum: ["list", "search"],
            },
            knowledge_base: { type: "string" },
            knowledge_base_name: { type: "string" },
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/SearchListItem" },
            },
            matches: {
              type: "array",
              items: { $ref: "#/components/schemas/SearchMatch" },
            },
            total: { type: "integer" },
          },
          required: ["mode", "knowledge_base", "knowledge_base_name", "items", "matches", "total"],
        },
        ReadRequest: {
          type: "object",
          additionalProperties: false,
          properties: {
            knowledge_base: { type: "string" },
            path: { type: "string" },
            sections: {
              anyOf: [
                {
                  type: "array",
                  items: { type: "string" },
                },
                { type: "null" },
              ],
            },
          },
          required: ["knowledge_base", "path"],
        },
        ReadDocument: {
          allOf: [
            documentBaseSchema,
            {
              type: "object",
              additionalProperties: false,
              properties: {
                version: { type: "integer" },
                page_count: {
                  anyOf: [{ type: "integer" }, { type: "null" }],
                },
                content: { type: "string" },
                truncated: { type: "boolean" },
              },
              required: ["version", "page_count", "content", "truncated"],
            },
          ],
        },
        ReadResponse: {
          type: "object",
          additionalProperties: false,
          properties: {
            knowledge_base: { type: "string" },
            knowledge_base_name: { type: "string" },
            documents: {
              type: "array",
              items: { $ref: "#/components/schemas/ReadDocument" },
            },
            total: { type: "integer" },
          },
          required: ["knowledge_base", "knowledge_base_name", "documents", "total"],
        },
        WriteRequest: {
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
              anyOf: [
                {
                  type: "array",
                  items: { type: "string" },
                },
                { type: "null" },
              ],
            },
            date_str: { type: "string" },
            old_text: { type: "string" },
            new_text: { type: "string" },
          },
          required: ["knowledge_base", "command"],
        },
        WriteResponse: {
          type: "object",
          additionalProperties: false,
          properties: {
            command: {
              type: "string",
              enum: ["create", "str_replace", "append"],
            },
            knowledge_base: { type: "string" },
            path: { type: "string" },
            filename: { type: "string" },
            title: { type: "string" },
            version: { type: "integer" },
            message: { type: "string" },
            deep_link: { type: "string", format: "uri" },
          },
          required: ["command", "knowledge_base", "path", "filename", "title", "version", "message", "deep_link"],
        },
        DeleteRequest: {
          type: "object",
          additionalProperties: false,
          properties: {
            knowledge_base: { type: "string" },
            path: { type: "string" },
          },
          required: ["knowledge_base", "path"],
        },
        DeleteResponse: {
          type: "object",
          additionalProperties: false,
          properties: {
            knowledge_base: { type: "string" },
            deleted_paths: {
              type: "array",
              items: { type: "string" },
            },
            skipped_paths: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["knowledge_base", "deleted_paths", "skipped_paths"],
        },
      },
    },
    paths: {
      "/api/v1/actions/guide": {
        post: actionOperation(
          "guide",
          "Get started with LLM Wiki. Call this first to discover available knowledge bases and workflow rules.",
          "#/components/schemas/GuideResponse",
        ),
      },
      "/api/v1/actions/create-wiki": {
        post: actionOperation(
          "create_wiki",
          "Create a new wiki when no existing knowledge base fits the user's request.",
          "#/components/schemas/GuideKnowledgeBase",
          "#/components/schemas/CreateWikiRequest",
        ),
      },
      "/api/v1/actions/search": {
        post: actionOperation(
          "search",
          "Browse files or run keyword search across the selected knowledge base.",
          "#/components/schemas/SearchResponse",
          "#/components/schemas/SearchRequest",
        ),
      },
      "/api/v1/actions/read": {
        post: actionOperation(
          "read",
          "Read one document, or batch-read files with a supported glob pattern.",
          "#/components/schemas/ReadResponse",
          "#/components/schemas/ReadRequest",
        ),
      },
      "/api/v1/actions/write": {
        post: actionOperation(
          "write",
          "Create wiki pages or edit existing documents with append or exact string replacement.",
          "#/components/schemas/WriteResponse",
          "#/components/schemas/WriteRequest",
        ),
      },
      "/api/v1/actions/delete": {
        post: actionOperation(
          "delete",
          "Archive documents by exact path or supported glob pattern. Protected structural wiki files cannot be deleted.",
          "#/components/schemas/DeleteResponse",
          "#/components/schemas/DeleteRequest",
        ),
      },
    },
  };
}
