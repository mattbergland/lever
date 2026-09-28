import { normalizeSpinResult, type SpinResult } from "./schema";

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const HARM_THRESHOLD = 0.5;

type ScoreAnswer = { type: "score"; score: number };
type NoulAnswer = { type: "noul"; noul: number };

function isScoreAnswer(value: unknown): value is ScoreAnswer {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "score" &&
    typeof (value as { score?: unknown }).score === "number"
  );
}

function isNoulAnswer(value: unknown): value is NoulAnswer {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "noul" &&
    typeof (value as { noul?: unknown }).noul === "number"
  );
}

function extractAnswers(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) return {};
  const record = body as Record<string, unknown>;
  if (typeof record.answers === "object" && record.answers !== null) {
    if (Array.isArray(record.answers)) {
      const mapped: Record<string, unknown> = {};
      for (const entry of record.answers) {
        if (typeof entry === "object" && entry !== null) {
          const item = entry as Record<string, unknown>;
          const id = item.id ?? item.question;
          if (typeof id === "string") mapped[id] = item.answer ?? item;
        }
      }
      return mapped;
    }
    return record.answers as Record<string, unknown>;
  }
  return record;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export async function judgeSpin(spin: SpinResult): Promise<SpinResult> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return spin;

  try {
    const state = { audience: spin.finalAudience, products: spin.products };
    const questions: Record<string, unknown> = {};
    for (let i = 0; i < spin.products.length; i += 1) {
      Object.assign(questions, {
        [`p${i}_build`]: {
          type: "score",
          instructions: `How buildable and useful is \`products[${i}]\` as software for \`audience\`?`,
          criteria: [
            "Meaningless or unusable pairing",
            "Weak fit; hard to see real use",
            "Plausible; a small team could ship something useful",
            "Strong fit; clearly useful, concrete daily job",
          ],
        },
        [`p${i}_novel`]: {
          type: "score",
          instructions: `How surprising is the pairing of \`products[${i}]\` with \`audience\`?`,
          criteria: [
            "Obvious, already common",
            "Somewhat expected",
            "Fresh and unexpected",
            "Delightfully strange yet coherent",
          ],
        },
        [`p${i}_harm`]: {
          type: "noul",
          instructions: `Would software \`products[${i}]\` for \`audience\` be harmful, exploitative, legally dubious, or target a protected class?`,
        },
      });
    }

    const response = await fetch(TYPESAFE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "jev-latest", state, questions }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      console.warn(`Jev judging failed with status ${response.status}; keeping OpenAI result.`);
      return spin;
    }

    const answers = extractAnswers(await response.json());

    let winnerIndex = -1;
    let winnerScore = -1;
    let winnerBuild = 0;
    let winnerNovel = 0;
    let winnerHarm = 0;

    for (let i = 0; i < spin.products.length; i += 1) {
      const build = answers[`p${i}_build`];
      const novel = answers[`p${i}_novel`];
      const harm = answers[`p${i}_harm`];
      if (!isScoreAnswer(build) || !isScoreAnswer(novel) || !isNoulAnswer(harm)) {
        console.warn(`Jev judging returned an unexpected answer shape for product ${i}; keeping OpenAI result.`);
        return spin;
      }
      if (harm.noul > HARM_THRESHOLD) continue;
      const buildNorm = build.score / 3;
      const novelNorm = novel.score / 3;
      const composite = buildNorm * 0.6 + novelNorm * 0.4;
      if (composite > winnerScore) {
        winnerScore = composite;
        winnerIndex = i;
        winnerBuild = buildNorm;
        winnerNovel = novelNorm;
        winnerHarm = harm.noul;
      }
    }

    if (winnerIndex < 0) return spin;

    const winner = spin.products[winnerIndex];
    return normalizeSpinResult({
      spinId: spin.spinId,
      products: spin.products,
      audiences: spin.audiences,
      finalProduct: winner,
      finalAudience: spin.finalAudience,
      verdict: {
        buildable: round2(winnerBuild),
        weird: round2(winnerNovel),
        harm: round2(winnerHarm),
      },
    });
  } catch (error) {
    console.warn("Jev judging failed; keeping OpenAI result.", error);
    return spin;
  }
}
