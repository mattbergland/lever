import { NextResponse } from "next/server";
import { generateSpin, GenerationError, RateLimitError } from "@/lib/generation/generate";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { MACHINES, PLATFORMS } from "@/lib/devinPrompt";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  const rateLimit = checkRateLimit(clientIp, 12, 60_000);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSec) },
      },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Treat an empty or malformed body as a spin without exclusions.
  }

  const requestFields = z.object({
    platform: z.enum(PLATFORMS).optional(),
    machine: z.enum(MACHINES).optional(),
  });
  const parsedFields = requestFields.safeParse(body);
  if (!parsedFields.success && body !== undefined && body !== null) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const rawExclusions =
    body !== null &&
    typeof body === "object" &&
    "exclusions" in body &&
    Array.isArray(body.exclusions)
      ? body.exclusions
      : [];
  const exclusions = rawExclusions
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 120))
    .filter(Boolean)
    .slice(-40);

  try {
    return NextResponse.json(await generateSpin(exclusions, parsedFields.success ? parsedFields.data : {}));
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
