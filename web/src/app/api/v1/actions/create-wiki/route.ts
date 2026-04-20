import { NextResponse } from "next/server";
import {
  createWikiAction,
  handleApiError,
} from "@/lib/server/llmwiki";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
    };
    return NextResponse.json(await createWikiAction(body));
  } catch (error) {
    return handleApiError(error);
  }
}
