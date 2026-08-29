import { helveticaWidthPt } from "./equation.js";
import { pdfEscape } from "./pdf-model.js";
import type { PdfFace } from "./fonts.js";

export function hexToPdfRgb(hex?: string): string | null {
  if (!hex) return null;
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length < 6) return null;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return null;
  return `${(((n >> 16) & 255) / 255).toFixed(3)} ${(((n >> 8) & 255) / 255).toFixed(3)} ${((n & 255) / 255).toFixed(3)}`;
}

export function paintTextRun(
  text: string,
  x: number,
  y: number,
  opts: {
    sizePt: number;
    face?: PdfFace;
    color?: string;
    background?: string;
    underline?: boolean;
    strike?: boolean;
  },
): { ops: string; width: number } {
  const sizePt = opts.sizePt;
  const w = helveticaWidthPt(text, sizePt);
  const face = opts.face ?? "F1";
  let s = "";
  const bg = hexToPdfRgb(opts.background);
  if (bg) {
    s += `${bg} rg ${x.toFixed(2)} ${(y - 2).toFixed(2)} ${w.toFixed(2)} ${(sizePt + 3).toFixed(2)} re f\n0 0 0 rg\n`;
  }
  const fg = hexToPdfRgb(opts.color);
  if (fg) s += `${fg} rg\n`;
  s += `BT /${face} ${sizePt} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(text)}) Tj ET\n`;
  if (fg) s += `0 0 0 rg\n`;
  const stroke = fg ?? "0 0 0";
  if (opts.underline) {
    s += `0.6 w ${stroke} RG ${x.toFixed(2)} ${(y - 1.4).toFixed(2)} m ${(x + w).toFixed(2)} ${(y - 1.4).toFixed(2)} l S\n0 0 0 RG\n`;
  }
  if (opts.strike) {
    const mid = y + sizePt * 0.28;
    s += `0.6 w ${stroke} RG ${x.toFixed(2)} ${mid.toFixed(2)} m ${(x + w).toFixed(2)} ${mid.toFixed(2)} l S\n0 0 0 RG\n`;
  }
  return { ops: s, width: w };
}
