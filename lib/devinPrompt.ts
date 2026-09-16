export const PLATFORMS = ["web", "desktop", "ios", "android"] as const;
export const MACHINES = ["ubuntu", "windows", "macos"] as const;
export type Platform = (typeof PLATFORMS)[number];
export type Machine = (typeof MACHINES)[number];
export type BuildTarget = { platform?: Platform; machine?: Machine };

export const PLATFORM_LABELS: Record<Platform, string> = {
  web: "Web app",
  desktop: "Desktop app",
  ios: "iOS app",
  android: "Android app",
};

export const MACHINE_LABELS: Record<Machine, string> = {
  ubuntu: "Ubuntu",
  windows: "Windows",
  macos: "macOS",
};

const PLATFORM_LINES: Record<Platform, string> = {
  web: "Target: a web app that runs in the browser (e.g. Next.js + TypeScript), deployed as a public preview.",
  desktop: "Target: a desktop app for Mac/Windows/Linux (e.g. Electron or Tauri with a TypeScript UI), with a runnable build I can download.",
  ios: "Target: a native iOS app (Swift + SwiftUI in Xcode), verified in the iOS Simulator; a macOS Devin machine is needed for this.",
  android: "Target: a native Android app (Kotlin + Jetpack Compose in Android Studio), verified in the Android emulator.",
};

const MACHINE_LINES: Record<Machine, string> = {
  ubuntu: "Please do the work on an Ubuntu (Linux) Devin machine.",
  windows: "Please do the work on a Windows Devin machine.",
  macos: "Please do the work on a macOS Devin machine.",
};

export function buildDevinPrompt(product: string, audience: string, target: BuildTarget = {}): string {
  const targetLines = [
    target.platform ? PLATFORM_LINES[target.platform] : undefined,
    target.machine ? MACHINE_LINES[target.machine] : undefined,
  ].filter((line): line is string => Boolean(line));
  const stackHint = target.platform ? "the stack that fits the target above" : "a simple stack you can ship fast (e.g. Next.js + TypeScript)";
  const shipLine =
    target.platform === "ios" || target.platform === "android"
      ? "run it in the simulator/emulator and send me screenshots or a short recording, plus how to install it on my own device."
      : target.platform === "desktop"
        ? "produce an installable build for my computer if you can."
        : "deploy a public preview if you can.";

  return [
    `Build ${product} for ${audience}`,
    "",
    `I want to build "${product}" — a piece of software for ${audience}. The idea came from pullthelever.build, a generator of strange-but-buildable software ideas, so take it seriously and help me turn it into something real.`,
    ...(targetLines.length ? ["", ...targetLines] : []),
    "",
    "Work in two phases.",
    "",
    "Phase 1 — Plan with me (don't write code yet):",
    `1. Briefly explain who ${audience} are and what a "${product}" would do for them day to day.`,
    "2. Ask me 3-5 short questions, one at a time, to pin down: the single most important job it must do, who the first user is, must-have vs nice-to-have features, and any constraints (budget, platform, data sources). Give me clickable options where you can — I'm not a coder, so keep everything in plain language.",
    `3. Then propose a plan: a one-paragraph product brief, ${stackHint}, the 2-4 core screens or features for the first version, and the project structure. Ask me to confirm before building.`,
    "",
    "Phase 2 — Build it:",
    "4. Create a new repo, scaffold the app, and build the working first version we agreed on. Use realistic sample data where real data isn't available.",
    "5. Keep it clean and accessible: responsive layout, keyboard-friendly, sensible empty/loading/error states.",
    `6. Add a concise README (what it is, who it's for, how to run it), make sure lint and type checks pass, and ${shipLine}`,
    "7. When you're done, tell me in plain language what you built and suggest what to do next.",
    "",
    "Make routine decisions on your own; only check with me on the big ones.",
  ].join("\n");
}
