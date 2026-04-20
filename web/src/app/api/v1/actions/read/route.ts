import { NextResponse } from "next/server";
import {
  handleApiError,
  readAction,
} from "@/lib/server/llmwiki";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      knowledge_base: string;
      path: string;
      sections?: string[] | null;
    };
    return NextResponse.json(await readAction(body));
  } catch (error) {
    return handleApiError(error);
  }
}
