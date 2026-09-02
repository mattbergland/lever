type PromptInput = {
  seed: string;
  weirdness: number;
  exclusions: string[];
};

export function buildGenerationPrompt({
  seed,
  weirdness,
  exclusions,
}: PromptInput): { system: string; user: string } {
  const mode =
    weirdness < 20
      ? "commercially intuitive"
      : weirdness < 90
        ? "strange but plausible"
        : "delightfully absurd but coherent";
  const safeExclusions = exclusions
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(-40);

  return {
    system: `You are the creative engine inside Lever, a generative slot machine for software ideas.
Generate clean, memorable language for the format "[PRODUCT] for [NICHE AUDIENCE]".

GENERATION TASTE:
- Products describe concrete software, workflows, or recurring jobs-to-be-done, usually 2–5 words.
- Audiences are real, specific, discoverable groups, usually 2–6 words: professions, specialist teams, unusual industries, communities, hobbies, or operational roles.
- Favor concrete, buildable ideas across operational, creative, technical, financial, communication, planning, and analytical work.
- Avoid startup names, marketing slogans, generic audiences ("small businesses", "developers", "creators"), and products that require impossible hardware or scientific breakthroughs.
- Do not overuse AI, platform, dashboard, marketplace, or assistant.
- Avoid harmful, exploitative, legally dubious, or protected-class targeting.
- Roughly 70% of the creative space should be strange but buildable, 20% commercially obvious, and 10% delightfully unhinged while coherent.
- Some tension between product and audience is desirable. Do not make every pairing suspiciously perfect, but reject combinations that are meaningless or harmful.
- Every entry must be a real, distinct candidate. Never use filler, numbering, or nonsense.

This spin's creative mode is: ${mode}.`,
    user: `Spin seed: ${seed}
Weirdness score: ${weirdness}
Return ONLY valid JSON, with no markdown or commentary, in exactly this shape:
{
  "spinId": "a unique id",
  "products": ["14–16 distinct product candidates, with the final product last"],
  "audiences": ["14–16 distinct audience candidates, with the final audience last"],
  "finalProduct": "the last product entry",
  "finalAudience": "the last audience entry"
}
Use 14–16 entries in each reel. Keep every entry under 60 characters. The final pair should be surprising but plausibly useful.
Do not repeat any prior final ideas or near-duplicates from this list:
${safeExclusions.length ? safeExclusions.join("\n") : "(none)"}`,
  };
}
