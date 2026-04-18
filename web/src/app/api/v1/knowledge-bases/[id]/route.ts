import { NextResponse } from "next/server";
import {
  deleteKnowledgeBase,
  handleApiError,
  requireAccessToken,
  updateKnowledgeBase,
} from "@/lib/server/llmwiki";

export const runtime = "edge";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAccessToken(request);
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
    await requireAccessToken(request);
    const { id } = await params;
    await deleteKnowledgeBase(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
