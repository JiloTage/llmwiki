import { NextResponse } from "next/server";
import {
  deleteAction,
  handleApiError,
  requireAccessToken,
} from "@/lib/server/llmwiki";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    await requireAccessToken(request);
    const body = (await request.json()) as {
      knowledge_base: string;
      path: string;
    };
    return NextResponse.json(await deleteAction(body));
  } catch (error) {
    return handleApiError(error);
  }
}
