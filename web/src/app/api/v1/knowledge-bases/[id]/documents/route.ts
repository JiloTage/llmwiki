import { NextResponse } from "next/server";
import {
  handleApiError,
  listDocuments,
  requireAccessToken,
} from "@/lib/server/llmwiki";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAccessToken(request);
    const { id } = await params;
    return NextResponse.json(await listDocuments(id));
  } catch (error) {
    return handleApiError(error);
  }
}
