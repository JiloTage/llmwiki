import { NextResponse } from "next/server";
import {
  handleApiError,
  listDocuments,
} from "@/lib/server/llmwiki";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json(await listDocuments(id));
  } catch (error) {
    return handleApiError(error);
  }
}
