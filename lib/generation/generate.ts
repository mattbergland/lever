import Anthropic from "@anthropic-ai/sdk";
import crypto from "node:crypto";
import { buildGenerationPrompt } from "./prompt";
import { normalizeSpinResult, type SpinResult } from "./schema";

export class RateLimitError extends Error {
  readonly code = "rate_limited";
  constructor() {
    super("Anthropic rate limit reached");
    this.name = "RateLimitError";
  }
}

export class GenerationError extends Error {
  readonly code = "generation_failed";
  constructor(message = "Unable to generate a valid spin") {
    super(message);
    this.name = "GenerationError";
  }
}

function responseText(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function generateSpin(exclusions: string[] = []): Promise<SpinResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new GenerationError("ANTHROPIC_API_KEY is not configured");
  }

  const anthropic = new Anthropic({ apiKey });
  const prompt = buildGenerationPrompt({
    seed: crypto.randomUUID(),
    weirdness: crypto.randomInt(0, 101),
    exclusions: exclusions.slice(-40),
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const request = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        temperature: 1,
        system: prompt.system,
        messages: [{ role: "user" as const, content: prompt.user }],
      };
      let response: Anthropic.Messages.Message;
      try {
        response = await anthropic.messages.create(request);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "status" in error &&
          (error as { status?: number }).status === 404
        ) {
          response = await anthropic.messages.create({
            ...request,
            model: "claude-sonnet-4-5-20250929",
          });
        } else {
          throw error;
        }
      }
      try {
        return normalizeSpinResult(JSON.parse(responseText(response)));
      } catch (error) {
        lastError = error;
        if (attempt === 0) continue;
        throw new GenerationError("The model returned invalid spin data");
      }
    } catch (error) {
      if (error instanceof RateLimitError || error instanceof GenerationError) {
        throw error;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        (error as { status?: number }).status === 429
      ) {
        throw new RateLimitError();
      }
      lastError = error;
      throw new GenerationError(
        error instanceof Error ? error.message : String(lastError),
      );
    }
  }

  throw new GenerationError(
    lastError instanceof Error ? lastError.message : "Invalid spin data",
  );
}
