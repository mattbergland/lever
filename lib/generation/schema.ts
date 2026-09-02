import { z } from "zod";

const entrySchema = z.string().trim().min(1).max(60);

export const spinResultSchema = z.object({
  spinId: z.string().trim().min(1),
  products: z.array(entrySchema).min(12).max(18),
  audiences: z.array(entrySchema).min(12).max(18),
  finalProduct: entrySchema,
  finalAudience: entrySchema,
});

export type SpinResult = z.infer<typeof spinResultSchema>;

function normalizeEntries(entries: string[], final: string): string[] {
  const cleanedFinal = final.trim();
  const output: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const cleaned = entry.trim();
    const key = cleaned.toLocaleLowerCase();
    if (!seen.has(key) && key !== cleanedFinal.toLocaleLowerCase()) {
      seen.add(key);
      output.push(cleaned);
    }
  }

  output.push(cleanedFinal);
  return output;
}

export function normalizeSpinResult(input: unknown): SpinResult {
  const parsed = spinResultSchema.parse(input);
  const products = normalizeEntries(parsed.products, parsed.finalProduct);
  const audiences = normalizeEntries(parsed.audiences, parsed.finalAudience);

  if (
    products.length < 12 ||
    products.length > 18 ||
    audiences.length < 12 ||
    audiences.length > 18
  ) {
    throw new Error("Spin reels must contain 12–18 distinct entries.");
  }

  return {
    spinId: parsed.spinId,
    products,
    audiences,
    finalProduct: products[products.length - 1],
    finalAudience: audiences[audiences.length - 1],
  };
}
