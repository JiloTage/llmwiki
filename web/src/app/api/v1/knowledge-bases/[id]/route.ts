import { NextResponse } from "next/server";
import {
  deleteKnowledgeBase,
  handleApiError,
  updateKnowledgeBase,
} from "@/lib/server/llmwiki";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = (await request.json()) as { name?: string | null; description?: string | null };
    const { id } = await params;
    return NextResponse.json(await updateKnowledgeBase(id, body));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deleteKnowledgeBase(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
