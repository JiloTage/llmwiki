import { NextResponse } from "next/server";
import {
  handleApiError,
  readAction,
  requireAccessToken,
} from "@/lib/server/llmwiki";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    await requireAccessToken(request);
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
