export function buildDevinPrompt(product: string, audience: string): string {
  return [
    `Build ${product} for ${audience}`,
    "",
    `I want to build "${product}" — a piece of software for ${audience}. The idea came from pullthelever.build, a generator of strange-but-buildable software ideas, so take it seriously and help me turn it into something real.`,
    "",
    "Work in two phases.",
    "",
    "Phase 1 — Plan with me (don't write code yet):",
    `1. Briefly explain who ${audience} are and what a "${product}" would do for them day to day.`,
    "2. Ask me 3-5 short questions, one at a time, to pin down: the single most important job it must do, who the first user is, must-have vs nice-to-have features, and any constraints (budget, platform, data sources). Give me clickable options where you can — I'm not a coder, so keep everything in plain language.",
    "3. Then propose a plan: a one-paragraph product brief, a simple stack you can ship fast (e.g. Next.js + TypeScript), the 2-4 core screens or features for the first version, and the project structure. Ask me to confirm before building.",
    "",
    "Phase 2 — Build it:",
    "4. Create a new repo, scaffold the app, and build the working first version we agreed on. Use realistic sample data where real data isn't available.",
    "5. Keep it clean and accessible: responsive layout, keyboard-friendly, sensible empty/loading/error states.",
    "6. Add a concise README (what it is, who it's for, how to run it), make sure lint and type checks pass, and deploy a public preview if you can.",
    "7. When you're done, tell me in plain language what you built and suggest what to do next.",
    "",
    "Make routine decisions on your own; only check with me on the big ones.",
  ].join("\n");
}
