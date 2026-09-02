import OpenAI from "openai";
import crypto from "node:crypto";
import { buildGenerationPrompt } from "./prompt";
import { normalizeSpinResult, type SpinResult } from "./schema";

export class RateLimitError extends Error {
  readonly code = "rate_limited";
  constructor() {
    super("OpenAI rate limit reached");
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

function responseText(response: OpenAI.Chat.Completions.ChatCompletion): string {
  return (response.choices[0]?.message.content ?? "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function generateSpin(exclusions: string[] = []): Promise<SpinResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new GenerationError("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey });
  const prompt = buildGenerationPrompt({
    seed: crypto.randomUUID(),
    weirdness: crypto.randomInt(0, 101),
    exclusions: exclusions.slice(-40),
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
        max_completion_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      });
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
