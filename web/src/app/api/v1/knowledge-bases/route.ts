import { NextResponse } from "next/server";
import {
  createKnowledgeBase,
  handleApiError,
  listKnowledgeBases,
} from "@/lib/server/llmwiki";

export async function GET() {
  try {
    return NextResponse.json(await listKnowledgeBases());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; description?: string | null };
    return NextResponse.json(await createKnowledgeBase(body), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
