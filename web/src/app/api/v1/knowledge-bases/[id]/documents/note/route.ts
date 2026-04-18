import { NextResponse } from "next/server";
import {
  createNote,
  handleApiError,
  requireAccessToken,
} from "@/lib/server/llmwiki";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAccessToken(request);
    const body = (await request.json()) as {
      filename?: string;
      path?: string;
      content?: string;
      title?: string | null;
    };
    const { id } = await params;
    return NextResponse.json(await createNote(id, body), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
