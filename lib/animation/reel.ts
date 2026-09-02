export type ReelPhase = "spin" | "anticipate" | "overshoot" | "recoil" | "lock";

export type ReelStep = {
  index: number;
  delayMs: number;
  phase: ReelPhase;
};

export function buildReelSchedule(count: number, reducedMotion: boolean): ReelStep[] {
  if (count < 2) return [{ index: 0, delayMs: 0, phase: "lock" }];

  const finalIndex = count - 1;
  if (reducedMotion) {
    const middle = Math.max(1, Math.floor(finalIndex / 2));
    return [
      { index: 0, delayMs: 260, phase: "spin" },
      { index: middle, delayMs: 460, phase: "spin" },
      { index: finalIndex, delayMs: 620, phase: "lock" },
    ];
  }

  const decoySteps = Math.max(15, Math.min(20, count + 4));
  const steps: ReelStep[] = [];
  for (let i = 0; i < decoySteps; i += 1) {
    const progress = i / Math.max(1, decoySteps - 1);
    const delayMs = Math.round(45 + 305 * progress ** 3);
    steps.push({
      index: i % finalIndex,
      delayMs,
      phase: "spin",
    });
  }

  steps.push({ index: finalIndex - 1, delayMs: 500, phase: "anticipate" });
  steps.push({ index: finalIndex, delayMs: 120, phase: "overshoot" });
  steps.push({ index: finalIndex, delayMs: 105, phase: "recoil" });
  steps.push({ index: finalIndex, delayMs: 0, phase: "lock" });
  return steps;
}

export function runReel(
  steps: ReelStep[],
  onStep: (step: ReelStep, stepNumber: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    if (!steps.length || signal?.aborted) {
      resolve();
      return;
    }

    let stepNumber = 0;
    let previousTime: number | undefined;
    let elapsed = 0;
    let nextDelay = steps[0].delayMs;

    const frame = (timestamp: number) => {
      if (signal?.aborted) {
        resolve();
        return;
      }
      if (previousTime === undefined) previousTime = timestamp;
      elapsed += timestamp - previousTime;
      previousTime = timestamp;

      if (elapsed >= nextDelay) {
        const step = steps[stepNumber];
        onStep(step, stepNumber);
        stepNumber += 1;
        elapsed = 0;
        if (stepNumber >= steps.length) {
          resolve();
          return;
        }
        nextDelay = steps[stepNumber].delayMs;
      }
      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  });
}
