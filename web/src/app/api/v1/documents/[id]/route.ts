import { NextResponse } from "next/server";
import {
  deleteDocument,
  handleApiError,
  updateDocument,
} from "@/lib/server/llmwiki";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = (await request.json()) as {
      filename?: string | null;
      path?: string | null;
      title?: string | null;
      tags?: string[] | null;
      date?: string | null;
      metadata?: Record<string, unknown> | null;
      sort_order?: number | null;
    };
    const { id } = await params;
    return NextResponse.json(await updateDocument(id, body));
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
    await deleteDocument(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
