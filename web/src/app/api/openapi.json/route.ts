import { NextResponse } from "next/server";

import { buildOpenApiDocument } from "@/lib/server/openapi";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildOpenApiDocument(origin));
}
