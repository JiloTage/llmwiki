import { NextResponse } from "next/server";
import {
  handleApiError,
  writeAction,
} from "@/lib/server/llmwiki";

export async function POST(request: Request) {
  try {
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
