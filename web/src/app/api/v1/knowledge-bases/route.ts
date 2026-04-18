import { NextResponse } from "next/server";
import {
  createKnowledgeBase,
  handleApiError,
  listKnowledgeBases,
  requireAccessToken,
} from "@/lib/server/llmwiki";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    await requireAccessToken(request);
    return NextResponse.json(await listKnowledgeBases());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAccessToken(request);
    const body = (await request.json()) as { name?: string; description?: string | null };
    return NextResponse.json(await createKnowledgeBase(body), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
