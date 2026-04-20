import { NextResponse } from "next/server";
import {
  guideAction,
  handleApiError,
} from "@/lib/server/llmwiki";

export async function POST() {
  try {
    return NextResponse.json(await guideAction());
  } catch (error) {
    return handleApiError(error);
  }
}
