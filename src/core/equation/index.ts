/**
 * LaTeX equation helper — simple subset for v1
 * Roadmap 2.1: "Ecuacciones latex sencillas" (corrected to "Ecuaciones LaTeX sencillas").
 * Provides validation, sanitization and lightweight HTML rendering without external dependencies.
 * Complex macros (\def, \input, etc.) are rejected by the validator.
 */

export const MAX_LATEX_LENGTH = 2000;

const FORBIDDEN_COMMANDS = new Set(["\\input", "\\write", "\\def", "\\include", "\\catcode", "\\openout", "\\immediate", "\\loop", "\\repeat"]);

const ALLOWED_SIMPLE_COMMANDS = new Set([
  "\\frac",
  "\\sqrt",
  "\\sum",
  "\\int",
  "\\alpha",
  "\\beta",
  "\\gamma",
  "\\delta",
  "\\epsilon",
  "\\pi",
  "\\theta",
  "\\lambda",
  "\\mu",
  "\\sigma",
  "\\omega",
  "\\cdot",
  "\\times",
  "\\div",
  "\\pm",
  "\\leq",
  "\\geq",
  "\\neq",
  "\\infty",
  "\\rightarrow",
  "\\left",
  "\\right",
]);

export interface LatexValidationResult {
  valid: boolean;
  errors: Array<{ code: string; message: string }>;
}

export function validateLatex(latex: string): LatexValidationResult {
  const errors: LatexValidationResult["errors"] = [];
  if (!latex || !latex.trim()) errors.push({ code: "required", message: "latex required" });
  if (latex.length > MAX_LATEX_LENGTH) errors.push({ code: "too-long", message: `max ${MAX_LATEX_LENGTH} chars` });
  for (const forb of FORBIDDEN_COMMANDS) {
    if (latex.includes(forb)) errors.push({ code: "forbidden-command", message: `forbidden ${forb}` });
  }
  // Balanced braces check
  let depth = 0;
  for (const ch of latex) {
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth < 0) {
        errors.push({ code: "unbalanced-braces", message: "unbalanced braces" });
        break;
      }
    }
  }
  if (depth !== 0 && !errors.some((e) => e.code === "unbalanced-braces")) {
    errors.push({ code: "unbalanced-braces", message: "unbalanced braces" });
  }
  return { valid: errors.length === 0, errors };
}

export { latexToHtml } from "./html.js";

export function latexToPlainText(latex: string): string {
  return `$${latex}$`;
}

export const equationCss = `
.pde-equation {
  font-family: "Cambria Math", "Latin Modern Math", "STIX Two Math", serif;
  display: inline-block;
  vertical-align: middle;
  background: var(--pde-color-surface, #f7f8fa);
  border: 1px solid var(--pde-color-border, #d8dce3);
  border-radius: var(--pde-radius-sm, 4px);
  padding: 1px 6px;
  margin: 4px;
  white-space: nowrap;
  color: var(--pde-color-text, #17191c);
}
.pde-equation sup {
  font-size: 0.72em;
  vertical-align: super;
  line-height: 0;
}
.pde-equation sub {
  font-size: 0.72em;
  vertical-align: sub;
  line-height: 0;
}
.pde-equation--block {
  display: block;
  text-align: center;
  margin: 12px auto;
  padding: 8px 12px;
  max-width: 90%;
  white-space: normal;
}
.pde-frac { display: inline-block; vertical-align: middle; text-align: center; margin: 0 2px; line-height: 1.15; }
.pde-frac-num { display: block; border-bottom: 1.5px solid currentColor; padding: 0 5px 1px; }
.pde-frac-den { display: block; padding: 1px 5px 0; }
.pde-sqrt { display: inline-flex; align-items: stretch; vertical-align: middle; }
.pde-sqrt-sym { width: 0.62em; min-height: 1.05em; flex-shrink: 0; display: block; overflow: visible; }
.pde-sqrt-inner { border-top: 1.35px solid currentColor; padding: 0.08em 0.28em 0.06em 0.04em; margin-left: -1px; line-height: 1.2; }
`;
