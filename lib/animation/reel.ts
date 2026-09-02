export type ReelPhase = "spin" | "lock";

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

  const decoySteps = 34;
  const steps: ReelStep[] = [];
  let previousDecoy = -1;
  for (let i = 0; i < decoySteps; i += 1) {
    const progress = i / Math.max(1, decoySteps - 1);
    const cycle = Math.floor(i / finalIndex);
    const offset = (cycle * 5) % finalIndex;
    const delayMs = Math.round(40 + 380 * progress ** 2.6);
    let index = (i + offset) % finalIndex;
    if (index === previousDecoy && finalIndex > 1) {
      index = (index + 1) % finalIndex;
    }
    steps.push({
      index: i === decoySteps - 1 ? finalIndex : index,
      delayMs,
      phase: "spin",
    });
    if (i < decoySteps - 1) previousDecoy = index;
  }

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

export function runWarmup(
  onTick: () => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    let previousTime: number | undefined;
    let elapsed = 0;
    const frame = (timestamp: number) => {
      if (signal?.aborted) {
        resolve();
        return;
      }
      if (previousTime === undefined) previousTime = timestamp;
      elapsed += timestamp - previousTime;
      previousTime = timestamp;
      if (elapsed >= 70) {
        onTick();
        elapsed = 0;
      }
      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  });
}
