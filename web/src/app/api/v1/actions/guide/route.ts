import { NextResponse } from "next/server";
import {
  guideAction,
  handleApiError,
  requireAccessToken,
} from "@/lib/server/llmwiki";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    await requireAccessToken(request);
    return NextResponse.json(await guideAction());
  } catch (error) {
    return handleApiError(error);
  }
}
