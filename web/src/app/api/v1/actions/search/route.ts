import { NextResponse } from "next/server";
import {
  handleApiError,
  requireAccessToken,
  searchAction,
} from "@/lib/server/llmwiki";

export async function POST(request: Request) {
  try {
    await requireAccessToken(request);
    const body = (await request.json()) as {
      knowledge_base: string;
      mode?: "list" | "search";
      query?: string;
      path?: string;
      tags?: string[] | null;
      limit?: number;
    };
    return NextResponse.json(await searchAction(body));
  } catch (error) {
    return handleApiError(error);
  }
}
