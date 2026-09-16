"use client";

import { useEffect, useRef, useState } from "react";
import { renderShareCard } from "@/lib/shareCard";
import styles from "./ShareSheet.module.css";

type ShareSheetProps = {
  product: string;
  audience: string;
  url: string;
  phrase: string;
  onClose: () => void;
};

type CopiedKind = "image" | "link" | undefined;

export default function ShareSheet({ product, audience, url, phrase, onClose }: ShareSheetProps) {
  const [blob, setBlob] = useState<Blob>();
  const [objectUrl, setObjectUrl] = useState("");
  const [copied, setCopied] = useState<CopiedKind>();
  const [canCopyImage, setCanCopyImage] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let mounted = true;
    let renderedUrl = "";
    void renderShareCard(product, audience).then((nextBlob) => {
      if (!mounted) return;
      renderedUrl = URL.createObjectURL(nextBlob);
      setBlob(nextBlob);
      setObjectUrl(renderedUrl);
    });
    return () => {
      mounted = false;
      if (renderedUrl) URL.revokeObjectURL(renderedUrl);
    };
  }, [product, audience]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setCanCopyImage(typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function");
      setCanNativeShare(typeof navigator.share === "function");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function markCopied(kind: Exclude<CopiedKind, undefined>) {
    setCopied(kind);
    window.setTimeout(() => setCopied(undefined), 1600);
  }

  async function copyImage() {
    if (!blob || !canCopyImage) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      markCopied("image");
    } catch {
      setCopied(undefined);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      markCopied("link");
    } catch {
      setCopied(undefined);
    }
  }

  async function nativeShare() {
    if (!navigator.share) return;
    try {
      const file = blob ? new File([blob], "pullthelever.png", { type: "image/png" }) : undefined;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "PULLTHELEVER.BUILD", text: phrase, url, files: [file] });
      } else {
        await navigator.share({ title: "PULLTHELEVER.BUILD", text: phrase, url });
      }
    } catch {
      // User cancelled sharing.
    }
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Share this result"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.panel} onClick={(event) => event.stopPropagation()}>
        <button className={styles.close} type="button" onClick={onClose} ref={closeButton} aria-label="Close share dialog">
          ×
        </button>
        <div className={styles.card}>
          {objectUrl ? <img src={objectUrl} alt="Share card" /> : <div className={styles.placeholder}>rendering…</div>}
        </div>
        <div className={styles.actions}>
          <a
            className={`${styles.action} ${!objectUrl ? styles.actionDisabled : ""}`}
            href={objectUrl || undefined}
            download="pullthelever.png"
            aria-disabled={!objectUrl}
            tabIndex={objectUrl ? 0 : -1}
          >
            Save image
          </a>
          {canCopyImage && (
            <button className={styles.action} type="button" onClick={() => void copyImage()} disabled={!blob}>
              {copied === "image" ? "Copied" : "Copy image"}
            </button>
          )}
          <button className={styles.action} type="button" onClick={() => void copyLink()}>
            {copied === "link" ? "Copied" : "Copy link"}
          </button>
          <a
            className={styles.action}
            href={`https://x.com/intent/post?text=${encodeURIComponent(phrase)}&url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Post to X
          </a>
          {canNativeShare && (
            <button className={styles.action} type="button" onClick={() => void nativeShare()} disabled={!blob}>
              Share…
            </button>
          )}
        </div>
        <p className={styles.note}>X can&apos;t attach images from a link — copy the image and paste it into your post.</p>
      </div>
    </div>
  );
}
