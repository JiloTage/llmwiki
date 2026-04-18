import { NextResponse } from "next/server";
import {
  handleApiError,
  requireAccessToken,
  writeAction,
} from "@/lib/server/llmwiki";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    await requireAccessToken(request);
    const body = (await request.json()) as {
      knowledge_base: string;
      command: "create" | "str_replace" | "append";
      path?: string;
      title?: string;
      content?: string;
      tags?: string[] | null;
      date_str?: string;
      old_text?: string;
      new_text?: string;
    };
    return NextResponse.json(await writeAction(body));
  } catch (error) {
    return handleApiError(error);
  }
}
