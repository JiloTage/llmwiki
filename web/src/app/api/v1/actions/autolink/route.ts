import { NextResponse } from "next/server";
import {
  autolinkAction,
  handleApiError,
} from "@/lib/server/llmwiki";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      knowledge_base: string;
    };
    return NextResponse.json(await autolinkAction(body));
  } catch (error) {
    return handleApiError(error);
  }
}
