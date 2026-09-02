import { NextResponse } from "next/server";
import { generateSpin, GenerationError, RateLimitError } from "@/lib/generation/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  let body: { exclusions?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Treat an empty or malformed body as a spin without exclusions.
  }

  const exclusions = Array.isArray(body.exclusions)
    ? body.exclusions.filter((item): item is string => typeof item === "string").slice(-40)
    : [];

  try {
    return NextResponse.json(await generateSpin(exclusions));
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: "generation_failed" }, { status: 502 });
    }
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }
}
