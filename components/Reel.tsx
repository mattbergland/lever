"use client";

import styles from "@/app/page.module.css";

type ReelProps = {
  label: string;
  items: string[];
  index: number;
  moving: boolean;
  final: boolean;
  response?: boolean;
};

export default function Reel({
  label,
  items,
  index,
  moving,
  final,
  response = false,
}: ReelProps) {
  const text = items[index] ?? "";
  const className = [
    styles.reelText,
    moving ? styles.moving : styles.locked,
    final && !moving && label === "audience" ? styles.audienceLocked : "",
    response ? styles.response : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.reel} data-reel={label} data-state={moving ? "moving" : final ? "locked" : "idle"}>
      <span className={className} aria-live={final && !moving ? "polite" : undefined}>
        {text}
      </span>
    </div>
  );
}
