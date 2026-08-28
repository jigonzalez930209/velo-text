/**
 * PDF math layout — renders a simple LaTeX subset into positioned glyph runs
 * using Helvetica + Adobe Symbol fonts. Zero dependencies.
 *
 * Supported: text/numbers, \frac{a}{b}, \sqrt{x}, ^{sup}/_{sub} (braced or single-char),
 * Greek letters, common operators (\cdot \times \div \pm \leq \geq \neq \infty
 * \rightarrow \sum \int \partial), parentheses/brackets as text.
 *
 * Output is a MathBox with width/ascent/descent and runs expressed relative to
 * a baseline (y=0), plus optional filled rules for fraction bars and sqrt overlines.
 */

export type MathFont = "Helvetica" | "Symbol";

export interface MathRun {
  text: string;
  font: MathFont;
  sizePt: number;
  xPt: number; // from left edge of the box
  yPt: number; // baseline offset (positive = up)
}

export interface MathRule {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}

export interface MathBox {
  widthPt: number;
  ascentPt: number;
  descentPt: number;
  runs: MathRun[];
  rules: MathRule[];
}

// ── Helvetica AFM widths (per 1000 units) — standard set ──
const HW: Record<string, number> = {
  " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 191, "(": 333, ")": 333,
  "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278, ":": 278, ";": 278, "<": 584, "=": 584,
  ">": 584, "?": 556, "@": 1015,
  "A": 667, "B": 667, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778, "H": 722, "I": 278, "J": 500,
  "K": 667, "L": 556, "M": 833, "N": 722, "O": 778, "P": 667, "Q": 778, "R": 722, "S": 667, "T": 611,
  "U": 722, "V": 667, "W": 944, "X": 667, "Y": 667, "Z": 611,
  "a": 556, "b": 556, "c": 500, "d": 556, "e": 556, "f": 278, "g": 556, "h": 556, "i": 222, "j": 222,
  "k": 500, "l": 222, "m": 833, "n": 556, "o": 556, "p": 556, "q": 556, "r": 333, "s": 500, "t": 278,
  "u": 556, "v": 500, "w": 722, "x": 500, "y": 500, "z": 500,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556, "8": 556, "9": 556,
  "{": 334, "}": 334, "[": 278, "]": 278, "|": 260, "\\": 278, "`": 333, "^": 584, "_": 556,
};

export function helveticaWidthPt(text: string, sizePt: number): number {
  let w = 0;
  for (const ch of text) w += (HW[ch] ?? 500) * sizePt / 1000;
  return w;
}

// Greek letters map to lowercase ASCII glyphs in Adobe Symbol font.
const GREEK: Record<string, string> = {
  alpha: "a", beta: "b", gamma: "g", delta: "d", epsilon: "e", zeta: "z", eta: "h", theta: "q",
  iota: "i", kappa: "k", lambda: "l", mu: "m", nu: "n", xi: "x", omicron: "o", pi: "p", rho: "r",
  sigma: "s", tau: "t", upsilon: "u", phi: "f", chi: "c", psi: "y", omega: "w",
};

const OPS: Record<string, string> = {
  "\\cdot": "\u00B7", "\\times": "\u00D7", "\\div": "\u00F7", "\\pm": "\u00B1",
  "\\leq": "\u00A3", "\\geq": "\u00B3", "\\neq": "\u00B9", "\\infty": "\u00A5",
  "\\rightarrow": "\u00AE", "\\leftarrow": "\u00AC", "\\sum": "S", "\\prod": "P",
  "\\int": "\u00F2", "\\partial": "\u00B6",
};

const SYMBOL_CMD: Record<string, string> = { ...GREEK, ...OPS };

export function parseMath(latex: string, baseSizePt = 11): MathBox {
  let input = latex.replace(/\s+/g, " ").trim();
  let pos = 0;
  const runs: MathRun[] = [];
  const rules: MathRule[] = [];

  function parseGroup(): string {
    if (input[pos] === "{") {
      pos++;
      let out = "";
      while (pos < input.length && input[pos] !== "}") {
        out += input[pos];
        pos++;
      }
      pos++; // skip '}'
      return out;
    }
    if (input[pos] === "\\") {
      let cmd = "\\";
      pos++;
      while (pos < input.length && /[a-zA-Z]/.test(input[pos]!)) { cmd += input[pos]; pos++; }
      return cmd;
    }
    const ch = input[pos] ?? "";
    pos++;
    return ch;
  }

  function parseExpr(sizePt: number): MathBox {
    const localRuns: MathRun[] = [];
    const localRules: MathRule[] = [];
    let lx = 0;
    let ascent = 0;
    let descent = 0;
    let pendingBase: { text: string; font: MathFont; sizePt: number } | null = null;

    function flushBase(): void {
      if (!pendingBase) return;
      const w = pendingBase.font === "Symbol" ? pendingBase.text.length * 0.6 * pendingBase.sizePt : helveticaWidthPt(pendingBase.text, pendingBase.sizePt);
      localRuns.push({ text: pendingBase.text, font: pendingBase.font, sizePt: pendingBase.sizePt, xPt: lx, yPt: 0 });
      lx += w;
      ascent = Math.max(ascent, pendingBase.sizePt * 0.8);
      descent = Math.max(descent, pendingBase.sizePt * 0.2);
      pendingBase = null;
    }

    function parseExprFromString(str: string, sizePt: number): MathBox {
      const savedInput = input;
      const savedPos = pos;
      input = str.replace(/\s+/g, " ").trim();
      pos = 0;
      const box = parseExpr(sizePt);
      input = savedInput;
      pos = savedPos;
      return box;
    }

    while (pos < input.length) {
      const ch = input[pos]!;
      if (ch === " " || ch === "~") {
        flushBase();
        lx += 0.25 * sizePt;
        pos++;
        continue;
      }
      if (ch === "}") break;
      if (ch === "^" || ch === "_") {
        flushBase();
        const isSup = ch === "^";
        pos++;
        const inner = parseGroup();
        const subBox = parseExprFromString(inner, sizePt * 0.7);
        const yOff = isSup ? sizePt * 0.45 : -sizePt * 0.18;
        for (const r of subBox.runs) localRuns.push({ ...r, xPt: r.xPt + lx, yPt: r.yPt + yOff });
        for (const rl of subBox.rules) localRules.push({ ...rl, xPt: rl.xPt + lx, yPt: rl.yPt + yOff });
        lx += subBox.widthPt;
        ascent = Math.max(ascent, yOff + subBox.ascentPt);
        descent = Math.max(descent, -yOff + subBox.descentPt);
        continue;
      }
      if (ch === "\\") {
        pos++;
        let cmd = "\\";
        while (pos < input.length && /[a-zA-Z]/.test(input[pos]!)) { cmd += input[pos]; pos++; }
        while (pos < input.length && input[pos] === " ") pos++;
        if (cmd === "\\frac") {
          flushBase();
          const numSrc = parseGroup();
          const denSrc = parseGroup();
          const numBox = parseExprFromString(numSrc, sizePt * 0.75);
          const denBox = parseExprFromString(denSrc, sizePt * 0.75);
          const w = Math.max(numBox.widthPt, denBox.widthPt) + sizePt * 0.2;
          const gap = sizePt * 0.1;
          const ruleT = Math.max(0.5, sizePt * 0.04);
          const numAscent = gap + numBox.ascentPt + ruleT;
          const denDescent = gap + denBox.descentPt + ruleT;
          const numBaselineY = gap + ruleT + numBox.descentPt;
          const denBaselineY = -(gap + ruleT + denBox.ascentPt);
          for (const r of numBox.runs) localRuns.push({ ...r, xPt: r.xPt + lx + (w - numBox.widthPt) / 2, yPt: r.yPt + numBaselineY });
          for (const r of denBox.runs) localRuns.push({ ...r, xPt: r.xPt + lx + (w - denBox.widthPt) / 2, yPt: r.yPt + denBaselineY });
          localRules.push({ xPt: lx, yPt: -ruleT / 2, widthPt: w, heightPt: ruleT });
          lx += w;
          ascent = Math.max(ascent, numAscent);
          descent = Math.max(descent, denDescent);
          continue;
        }
        if (cmd === "\\sqrt") {
          flushBase();
          const innerSrc = parseGroup();
          const innerBox = parseExprFromString(innerSrc, sizePt * 0.95);
          const rad = sizePt * 0.8;
          const tick = Math.max(0.5, sizePt * 0.06);
          const radX = lx;
          // radical sign (Symbol \xD6) drawn slightly oversized
          localRuns.push({ text: "\u00D6", font: "Symbol", sizePt: sizePt * 1.3, xPt: radX, yPt: innerBox.descentPt - sizePt * 0.05 });
          const overlineX = radX + rad * 0.55;
          const overlineW = innerBox.widthPt + sizePt * 0.1;
          localRules.push({ xPt: overlineX, yPt: innerBox.ascentPt + sizePt * 0.04, widthPt: overlineW, heightPt: tick });
          for (const r of innerBox.runs) localRuns.push({ ...r, xPt: r.xPt + radX + rad * 0.8, yPt: r.yPt });
          lx += rad * 0.8 + innerBox.widthPt + sizePt * 0.2;
          ascent = Math.max(ascent, innerBox.ascentPt + sizePt * 0.1);
          descent = Math.max(descent, innerBox.descentPt);
          continue;
        }
        if (cmd === "\\left" || cmd === "\\right") continue;
        const mapped = SYMBOL_CMD[cmd];
        if (mapped !== undefined) {
          flushBase();
          const w = mapped.length * 0.6 * sizePt;
          localRuns.push({ text: mapped, font: "Symbol", sizePt, xPt: lx, yPt: 0 });
          lx += w;
          ascent = Math.max(ascent, sizePt * 0.85);
          descent = Math.max(descent, sizePt * 0.15);
          continue;
        }
        if (pendingBase) pendingBase.text += cmd;
        else pendingBase = { text: cmd, font: "Helvetica", sizePt };
        continue;
      }
      if (pendingBase) pendingBase.text += ch;
      else pendingBase = { text: ch, font: "Helvetica", sizePt };
      pos++;
    }
    flushBase();
    return { widthPt: lx, ascentPt: ascent, descentPt: descent, runs: localRuns, rules: localRules };
  }

  const main = parseExpr(baseSizePt);
  runs.push(...main.runs);
  rules.push(...main.rules);
  return { widthPt: main.widthPt, ascentPt: main.ascentPt, descentPt: main.descentPt, runs, rules };
}

/**
 * PDF literal string bytes from a latin-1 string (for Symbol font glyphs > 127).
 */
export function pdfLiteralString(str: string): string {
  let out = "(";
  for (const ch of str) {
    const c = ch.codePointAt(0)!;
    if (c === 40 || c === 41 || c === 92) out += "\\" + ch;
    else if (c < 128) out += ch;
    else out += `\\${c.toString(8).padStart(3, "0")}`;
  }
  return out + ")";
}