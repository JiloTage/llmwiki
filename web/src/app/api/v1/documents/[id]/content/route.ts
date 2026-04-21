import { NextResponse } from "next/server";
import {
  getDocumentContent,
  handleApiError,
  updateDocumentContent,
} from "@/lib/server/llmwiki";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json(await getDocumentContent(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = (await request.json()) as { content?: string };
    const { id } = await params;
    return NextResponse.json(await updateDocumentContent(id, body.content ?? ""));
  } catch (error) {
    return handleApiError(error);
  }
}
