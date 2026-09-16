"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Reel from "./Reel";
import { audio } from "@/lib/audio/engine";
import { buildReelSchedule, runReel, runWarmup, type ReelStep } from "@/lib/animation/reel";
import type { SpinResult } from "@/lib/generation/schema";
import styles from "@/app/page.module.css";
import {
  buildDevinPrompt,
  MACHINE_LABELS,
  MACHINES,
  PLATFORM_LABELS,
  PLATFORMS,
  type BuildTarget,
  type Machine as DevinMachine,
  type Platform,
} from "@/lib/devinPrompt";

type SharedResult = { product: string; audience: string };
type MachineProps = { sharedResult?: SharedResult };
type Phase = "idle" | "loading" | "warming" | "spinningProduct" | "pause" | "spinningAudience" | "landed" | "error";
type ErrorKind = "rate" | "offline" | "generation";
const HISTORY_KEY = "lever:history";
const TARGET_KEY = "lever:target";

function readHistory() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string").slice(-40) : [];
  } catch {
    return [];
  }
}

function readTarget(): BuildTarget {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(TARGET_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const candidate = parsed as { platform?: unknown; machine?: unknown };
    const platform =
      typeof candidate.platform === "string" && PLATFORMS.includes(candidate.platform as Platform)
        ? (candidate.platform as Platform)
        : undefined;
    const machine =
      typeof candidate.machine === "string" && MACHINES.includes(candidate.machine as DevinMachine)
        ? (candidate.machine as DevinMachine)
        : undefined;
    return { platform, machine };
  } catch {
    return {};
  }
}

async function fetchSpin(exclusions: string[]): Promise<SpinResult> {
  const response = await fetch("/api/spin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ exclusions: exclusions.slice(-40) }),
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("generation");
  }
  if (!response.ok) {
    const error = data as { error?: string };
    throw new Error(error.error ?? "generation");
  }
  return data as SpinResult;
}

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Machine({ sharedResult }: MachineProps) {
  const [phase, setPhase] = useState<Phase>(sharedResult ? "landed" : "idle");
  const [active, setActive] = useState<SpinResult | undefined>(
    sharedResult
      ? {
          spinId: "shared",
          products: [sharedResult.product],
          audiences: [sharedResult.audience],
          finalProduct: sharedResult.product,
          finalAudience: sharedResult.audience,
        }
      : undefined,
  );
  const [productIndex, setProductIndex] = useState(0);
  const [audienceIndex, setAudienceIndex] = useState(0);
  const [errorKind, setErrorKind] = useState<ErrorKind>();
  const [copied, setCopied] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [response, setResponse] = useState(false);
  const [muted, setMuted] = useState(false);
  const [target, setTarget] = useState<BuildTarget>({});
  const [targetLoaded, setTargetLoaded] = useState(false);
  const [warmupText, setWarmupText] = useState("___ ____ __");
  const [warmupAudienceText, setWarmupAudienceText] = useState("___ ____ __");
  const [warmupTick, setWarmupTick] = useState(0);
  const [warmupActive, setWarmupActive] = useState(false);
  const heldSpin = useRef<SpinResult | undefined>(undefined);
  const revealAbort = useRef<AbortController | undefined>(undefined);
  const warmupAbort = useRef<AbortController | undefined>(undefined);
  const prefetchStarted = useRef(false);
  const targetRead = useRef(false);

  const phrase = active ? `${active.finalProduct} for ${active.finalAudience}` : "";
  const busy = phase === "loading" || phase === "warming" || phase === "spinningProduct" || phase === "pause" || phase === "spinningAudience";

  useEffect(() => {
    const timeout = window.setTimeout(() => setMuted(audio.isMuted()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setTarget(readTarget());
      targetRead.current = true;
      setTargetLoaded(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!targetRead.current || !targetLoaded) return;
    window.localStorage.setItem(TARGET_KEY, JSON.stringify(target));
  }, [target, targetLoaded]);

  const prefetch = useCallback(async (exclusions: string[]) => {
    try {
      heldSpin.current = await fetchSpin(exclusions);
    } catch {
      // Prefetch is opportunistic; the next explicit pull can retry.
    }
  }, []);

  useEffect(() => {
    if (sharedResult || prefetchStarted.current) return;
    prefetchStarted.current = true;
    void prefetch(readHistory());
  }, [prefetch, sharedResult]);

  const startReveal = useCallback(
    async (spin: SpinResult) => {
      revealAbort.current?.abort();
      const controller = new AbortController();
      revealAbort.current = controller;
      const motionReduced = reducedMotion();
      setActive(spin);
      setProductIndex(0);
      setAudienceIndex(0);
      setErrorKind(undefined);
      setResponse(false);
      setPhase("spinningProduct");

      const productSteps = buildReelSchedule(spin.products.length, motionReduced);
      await runReel(
        productSteps,
        (step: ReelStep, number: number) => {
          setProductIndex(step.index);
          if (step.phase !== "lock") audio.tick(number / Math.max(1, productSteps.length - 1));
          else audio.lock();
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;

      setPhase("pause");
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      if (controller.signal.aborted) return;

      setPhase("spinningAudience");
      warmupAbort.current?.abort();
      warmupAbort.current = undefined;
      setWarmupActive(false);
      const audienceSteps = buildReelSchedule(spin.audiences.length, motionReduced);
      await runReel(
        audienceSteps,
        (step: ReelStep, number: number) => {
          setAudienceIndex(step.index);
          if (step.phase !== "lock") audio.tick(number / Math.max(1, audienceSteps.length - 1));
          else audio.finalLock();
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;

      setPhase("landed");
      setResponse(!motionReduced);
      const history = [...readHistory(), phraseFor(spin)].slice(-40);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      void prefetch(history);
    },
    [prefetch],
  );

  const spin = useCallback(async () => {
    if (busy) return;
    setCopied(false);
    const history = readHistory();
    const next = heldSpin.current;
    heldSpin.current = undefined;
    if (next) {
      void startReveal(next);
      return;
    }

    setErrorKind(undefined);
    const warmupEnabled = !reducedMotion();
    const controller = new AbortController();
    warmupAbort.current?.abort();
    warmupAbort.current = controller;
    setWarmupActive(warmupEnabled);
    setPhase(warmupEnabled ? "warming" : "loading");
    const warmupPromise = warmupEnabled
      ? runWarmup(() => {
          setWarmupText(makeWarmupGlyphs());
          setWarmupAudienceText(makeWarmupGlyphs());
          setWarmupTick((tick) => tick + 1);
          audio.tick(0.2);
        }, controller.signal)
      : Promise.resolve();
    try {
      const result = await fetchSpin(history);
      await startReveal(result);
      await warmupPromise;
    } catch (error) {
      controller.abort();
      await warmupPromise;
      setWarmupActive(false);
      const message = error instanceof Error ? error.message : "";
      if (typeof navigator !== "undefined" && !navigator.onLine) setErrorKind("offline");
      else if (message === "rate_limited") setErrorKind("rate");
      else if (error instanceof TypeError) setErrorKind("offline");
      else setErrorKind("generation");
      setPhase("error");
    }
  }, [busy, startReveal]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.code === "Space" && !isTextField) {
        event.preventDefault();
        void spin();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [spin]);

  function toggleMute() {
    const next = !muted;
    audio.setMuted(next);
    setMuted(next);
  }

  function toggleTarget<K extends keyof BuildTarget>(key: K, value: NonNullable<BuildTarget[K]>) {
    setTarget((current) => ({
      ...current,
      [key]: current[key] === value ? undefined : value,
    }));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildDevinPrompt(active?.finalProduct ?? "", active?.finalAudience ?? "", target));
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1600);
    } catch {
      setPromptCopied(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/?p=${encodeURIComponent(active?.finalProduct ?? "")}&a=${encodeURIComponent(active?.finalAudience ?? "")}`;
    if (navigator.share) {
      await navigator.share({ title: "PULLTHELEVER.BUILD", text: phrase, url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  const productItems = phase === "warming" ? [warmupText] : active?.products ?? ["_____"];
  const landed = phase === "landed";
  const audienceWarming = warmupActive;
  const audienceVisible = phase === "spinningAudience" || landed;
  const audienceItems = audienceWarming
    ? [warmupAudienceText]
    : audienceVisible
      ? active?.audiences ?? ["_____"]
      : ["_____"];
  const visibleAudienceIndex = audienceWarming || audienceVisible ? audienceIndex : 0;
  const loading = phase === "loading" || phase === "warming";
  const productMoving = phase === "spinningProduct";
  const audienceMoving = phase === "spinningAudience";
  const devinUrl =
    landed && active
      ? `https://app.devin.ai/?prompt=${encodeURIComponent(buildDevinPrompt(active.finalProduct, active.finalAudience, target))}`
      : undefined;
  const errorMessage =
    errorKind === "rate"
      ? "The machine is catching its breath. Try again shortly."
      : errorKind === "offline"
        ? "You're offline."
        : errorKind === "generation"
          ? "The machine jammed. Pull again."
          : "";

  return (
    <div className={styles.page}>
      <div className={styles.grain} aria-hidden="true" />
      <header className={styles.header}>
        <span className={styles.mark}>Pullthelever.build</span>
        <button className={styles.mute} type="button" onClick={toggleMute} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
          {muted ? "Sound off" : "Sound on"}
        </button>
      </header>
      <main className={styles.main}>
        <p className={styles.eyebrow}>A small pull on the universe</p>
        <section className={styles.machine} aria-label="Generative software idea machine">
          <div className={styles.phrase}>
            <Reel label="product" items={productItems} index={phase === "warming" ? 0 : productIndex} moving={productMoving || phase === "warming"} final={phase === "pause" || phase === "spinningAudience" || landed} revision={phase === "warming" ? warmupTick : undefined} />
            <span className={styles.for}>for</span>
            <Reel label="audience" items={audienceItems} index={audienceWarming ? 0 : visibleAudienceIndex} moving={audienceMoving || audienceWarming} final={landed} response={response} revision={audienceWarming ? warmupTick : undefined} />
          </div>
          <p className={styles.caption}>
            {loading && <span className={styles.loading}>consulting the void…</span>}
            {!loading && errorMessage && <span className={styles.error} role="alert">{errorMessage}</span>}
          </p>
          <div className={styles.controls}>
            <div className={styles.primaryRow}>
              <button className={styles.primary} type="button" onClick={() => void spin()} disabled={busy}>
                {landed ? "Pull again" : "Generate a product"}
              </button>
              <a
                className={`${styles.build} ${!devinUrl ? styles.buildHidden : ""}`}
                href={devinUrl ?? "https://app.devin.ai/"}
                target="_blank"
                rel="noopener noreferrer"
                aria-hidden={!devinUrl}
                tabIndex={devinUrl ? 0 : -1}
                title="Open Devin in a new tab with the build prompt filled in"
              >
                Build with Devin
              </a>
            </div>
            <div className={`${styles.actions} ${!landed ? styles.actionsHidden : ""}`} aria-hidden={!landed}>
              <button className={styles.action} type="button" onClick={() => void copy()} disabled={!landed} tabIndex={landed ? 0 : -1}>{copied ? "Copied" : "Copy"}</button>
              <button className={styles.action} type="button" onClick={() => void copyPrompt()} disabled={!landed} tabIndex={landed ? 0 : -1} title="Copy a ready-to-paste prompt asking Devin to build this idea">{promptCopied ? "Prompt copied" : "Devin prompt"}</button>
              <button className={styles.action} type="button" onClick={() => void share()} disabled={!landed} tabIndex={landed ? 0 : -1}>Share</button>
            </div>
            <div className={`${styles.targets} ${!landed ? styles.targetsHidden : ""}`} aria-hidden={!landed}>
              <div className={styles.targetRow} role="group" aria-label="App type">
                <span className={styles.targetLabel}>App</span>
                {PLATFORMS.map((platform) => (
                  <button
                    className={`${styles.target} ${target.platform === platform ? styles.targetSelected : ""}`}
                    key={platform}
                    type="button"
                    aria-pressed={target.platform === platform}
                    onClick={() => toggleTarget("platform", platform)}
                    disabled={!landed}
                    tabIndex={landed ? 0 : -1}
                  >
                    {PLATFORM_LABELS[platform]}
                  </button>
                ))}
              </div>
              <div className={styles.targetRow} role="group" aria-label="Devin machine">
                <span className={styles.targetLabel}>Machine</span>
                {MACHINES.map((machine) => (
                  <button
                    className={`${styles.target} ${target.machine === machine ? styles.targetSelected : ""}`}
                    key={machine}
                    type="button"
                    aria-pressed={target.machine === machine}
                    onClick={() => toggleTarget("machine", machine)}
                    disabled={!landed}
                    tabIndex={landed ? 0 : -1}
                  >
                    {MACHINE_LABELS[machine]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className={`${styles.hint} ${landed || busy || errorMessage ? styles.hintHidden : ""}`}>Space to pull</p>
        </section>
      </main>
    </div>
  );
}

function phraseFor(spin: SpinResult) {
  return `${spin.finalProduct} for ${spin.finalAudience}`;
}

function makeWarmupGlyphs() {
  const glyphs = "▁▂▃─═░▒_—";
  const words = 3 + Math.floor(Math.random() * 3);
  return Array.from({ length: words }, () => {
    const length = 1 + Math.floor(Math.random() * 5);
    return Array.from({ length }, () => glyphs[Math.floor(Math.random() * glyphs.length)]).join("");
  }).join(" ");
}
