/**
 * Text metrics and line breaking — Phase 6.1.2
 * Provides font metrics, line breaking, handling of spaces/tabs/hard breaks, fallback and missing glyphs.
 * For v1 we use a deterministic monospace approximation without external font files or DOM measurement,
 * ensuring backend/frontend parity and determinism. Real font shaping is deferred.
 */

import { findUnmappedPdfChars } from "../../fonts/win-ansi.js";

export interface FontMetrics {
  family: string;
  sizePt: number;
  // Average advance in micrometers for a typical character at this size
  avgCharWidthUm: number;
  lineHeightUm: number;
  ascentUm: number;
  descentUm: number;
}

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontSizePt?: number;
  fontFamily?: string;
}

// Simple font registry — for MVP we approximate metrics derived from pt size
export function getFontMetrics(run: TextRun, defaultSizePt = 11): FontMetrics {
  const sizePt = run.fontSizePt ?? defaultSizePt;
  // Approximate: 1 pt ≈ 0.35mm width for average char; line height 1.2 * size
  const avgCharWidthUm = Math.round(sizePt * 220); // tuned for ~0.22mm per pt -> ~2.5 chars per cm at 11pt
  const lineHeightUm = Math.round(sizePt * 352.777 * 1.2);
  const ascentUm = Math.round(lineHeightUm * 0.8);
  const descentUm = lineHeightUm - ascentUm;
  return {
    family: run.fontFamily ?? "system-ui",
    sizePt,
    avgCharWidthUm,
    lineHeightUm,
    ascentUm,
    descentUm,
  };
}

export interface LineBreakOptions {
  maxWidthUm: number;
  defaultFontSizePt?: number;
}

/**
 * Greedy line breaker — splits text into lines that fit within maxWidthUm.
 * Handles spaces, tabs, hard breaks and preserves words (no hyphenation in v1).
 * Returns lines with width estimates; used for pagination and PDF text placement.
 * Deterministic: no randomness, same input always yields same lines.
 */
export function breakLines(text: string, opts: LineBreakOptions): Array<{ text: string; widthUm: number; metrics: FontMetrics }> {
  const { maxWidthUm, defaultFontSizePt = 11 } = opts;
  const metrics = getFontMetrics({ text, fontSizePt: defaultFontSizePt });
  const lines: Array<{ text: string; widthUm: number; metrics: FontMetrics }> = [];

  // Split on hard breaks first
  const paragraphs = text.split("\n");
  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p]!;
    if (para === "") {
      lines.push({ text: "", widthUm: 0, metrics });
      continue;
    }
    const words = para.split(/(\s+)/); // keep spaces
    let current = "";
    let currentWidth = 0;
    const spaceWidth = metrics.avgCharWidthUm * 0.5;
    const charWidth = metrics.avgCharWidthUm;

    const flush = () => {
      if (current) {
        lines.push({ text: current, widthUm: currentWidth, metrics });
        current = "";
        currentWidth = 0;
      }
    };

    for (const token of words) {
      if (token === "") continue;
      const isSpace = /^\s+$/.test(token);
      const tokenWidth = isSpace ? token.length * spaceWidth : token.length * charWidth;

      // Handle tabs as 4 spaces
      const normalizedWidth = token.includes("\t") ? token.replace(/\t/g, "    ").length * charWidth : tokenWidth;
      const normalizedToken = token.replace(/\t/g, "    ");

      if (normalizedWidth > maxWidthUm) {
        // Word longer than line — break inside word (fallback)
        flush();
        let remaining = normalizedToken;
        while (remaining.length > 0) {
          const charsFit = Math.max(1, Math.floor(maxWidthUm / charWidth));
          const chunk = remaining.slice(0, charsFit);
          lines.push({ text: chunk, widthUm: chunk.length * charWidth, metrics });
          remaining = remaining.slice(charsFit);
        }
        continue;
      }

      if (currentWidth + normalizedWidth > maxWidthUm && current) {
        flush();
        // Skip leading spaces on new line
        if (isSpace) continue;
      }
      current += normalizedToken;
      currentWidth += normalizedWidth;
    }
    flush();
    // Preserve paragraph break as empty line between paragraphs except last
    if (p < paragraphs.length - 1) lines.push({ text: "", widthUm: 0, metrics });
  }
  return lines;
}

/**
 * Estimate width of a run without breaking — used for inline layout.
 */
export function estimateRunWidth(run: TextRun, maxWidthUm: number): number {
  const metrics = getFontMetrics(run);
  const lines = breakLines(run.text, { maxWidthUm, defaultFontSizePt: metrics.sizePt });
  return lines.length > 0 ? Math.max(...lines.map((l) => l.widthUm)) : 0;
}

/**
 * Characters not encodable in PDF WinAnsi (will appear as "?").
 */
export function findMissingGlyphs(text: string): string[] {
  return findUnmappedPdfChars(text);
}
