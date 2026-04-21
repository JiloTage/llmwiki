import { handleApiError } from "@/lib/server/llmwiki";
import {
  handleMcpDelete,
  handleMcpGet,
  handleMcpPost,
} from "@/lib/server/mcp";

export async function GET(request: Request) {
  try {
    return await handleMcpGet(request);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    return await handleMcpPost(request);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    return await handleMcpDelete(request);
  } catch (error) {
    return handleApiError(error);
  }
}
