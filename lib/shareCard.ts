const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CARD_SCALE = 2;
const MAX_TEXT_WIDTH = 1040;

type LetterSpacedContext = CanvasRenderingContext2D & {
  letterSpacing?: string;
};

type TextLayout = {
  lines: string[];
  size: number;
};

function familyFromVariable(variable: string, fallback: string) {
  return (variable.trim() || fallback).replace(/^['"]|['"]$/g, "");
}

function fontFor(size: number, family: string) {
  return `${size}px "${family}"`;
}

function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: CanvasTextAlign = "left",
) {
  const tracked = ctx as LetterSpacedContext;
  ctx.textAlign = align;
  if ("letterSpacing" in tracked) {
    tracked.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    tracked.letterSpacing = "0px";
    return;
  }

  const characters = [...text];
  const width = characters.reduce((total, character) => total + ctx.measureText(character).width, 0) + Math.max(0, characters.length - 1) * spacing;
  let cursor = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  for (const character of characters) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + spacing;
  }
}

function wrappedLines(ctx: CanvasRenderingContext2D, text: string, size: number, family: string) {
  ctx.font = fontFor(size, family);
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text.trim()];

  let best: { lines: string[]; width: number } | undefined;
  for (let split = 1; split < words.length; split += 1) {
    const lines = [words.slice(0, split).join(" "), words.slice(split).join(" ")];
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (!best || width < best.width) best = { lines, width };
  }
  return best?.lines ?? [text.trim()];
}

function fitText(ctx: CanvasRenderingContext2D, text: string, family: string): TextLayout {
  const value = text.trim();
  for (let size = 96; size >= 56; size -= 1) {
    ctx.font = fontFor(size, family);
    if (ctx.measureText(value).width <= MAX_TEXT_WIDTH) return { lines: [value], size };
  }
  return { lines: wrappedLines(ctx, value, 56, family), size: 56 };
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  family: string,
  centerX: number,
  top: number,
) {
  const lineHeight = layout.size * 1.05;
  const baselineOffset = layout.size * 0.82;
  ctx.font = fontFor(layout.size, family);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f5f1ea";
  layout.lines.forEach((line, index) => {
    const baseline = top + baselineOffset + index * lineHeight;
    ctx.fillText(line, centerX, baseline);
    const width = ctx.measureText(line).width;
    ctx.fillStyle = "#e8ff47";
    ctx.fillRect(centerX - width / 2, baseline + 5, width, 4);
    ctx.fillStyle = "#f5f1ea";
  });
  return layout.lines.length * lineHeight + 10;
}

export async function renderShareCard(product: string, audience: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH * CARD_SCALE;
  canvas.height = CARD_HEIGHT * CARD_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  const displayFamily = familyFromVariable(getComputedStyle(document.documentElement).getPropertyValue("--font-display"), "Instrument Serif");
  const monoFamily = familyFromVariable(getComputedStyle(document.documentElement).getPropertyValue("--font-mono"), "IBM Plex Mono");
  try {
    await Promise.all([
      document.fonts.load('96px "Instrument Serif"'),
      document.fonts.load('20px "IBM Plex Mono"'),
      document.fonts.load(fontFor(96, displayFamily)),
      document.fonts.load(fontFor(20, monoFamily)),
    ]);
  } catch {
    // Canvas can still render with the declared fallback fonts.
  }

  ctx.scale(CARD_SCALE, CARD_SCALE);
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = "#88837b";
  ctx.font = fontFor(22, monoFamily);
  drawTrackedText(ctx, "PULLTHELEVER.BUILD", 56, 54, 22 * 0.16);

  const productLayout = fitText(ctx, product, displayFamily);
  const audienceLayout = fitText(ctx, audience, displayFamily);
  const productHeight = productLayout.lines.length * productLayout.size * 1.05 + 10;
  const audienceHeight = audienceLayout.lines.length * audienceLayout.size * 1.05 + 10;
  const forHeight = 26 * 1.2;
  const gap = 18;
  const totalHeight = productHeight + gap + forHeight + gap + audienceHeight;
  let top = (CARD_HEIGHT - totalHeight) / 2;

  top += drawTextBlock(ctx, productLayout, displayFamily, CARD_WIDTH / 2, top);
  top += gap;
  ctx.fillStyle = "#a9a49b";
  ctx.font = fontFor(26, monoFamily);
  drawTrackedText(ctx, "FOR", CARD_WIDTH / 2, top + 22, 26 * 0.16, "center");
  top += forHeight + gap;
  drawTextBlock(ctx, audienceLayout, displayFamily, CARD_WIDTH / 2, top);

  ctx.fillStyle = "#88837b";
  ctx.font = fontFor(20, monoFamily);
  drawTrackedText(ctx, "a small pull on the universe", 56, CARD_HEIGHT - 36, 20 * 0.08);
  drawTrackedText(ctx, "pullthelever.build", CARD_WIDTH - 56, CARD_HEIGHT - 36, 20 * 0.08, "right");

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not render share card"));
    }, "image/png");
  });
}
