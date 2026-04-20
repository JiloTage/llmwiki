import { NextResponse } from "next/server";
import {
  deleteAction,
  handleApiError,
} from "@/lib/server/llmwiki";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      knowledge_base: string;
      path: string;
    };
    return NextResponse.json(await deleteAction(body));
  } catch (error) {
    return handleApiError(error);
  }
}
