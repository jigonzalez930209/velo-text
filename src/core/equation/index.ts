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

/**
 * Lightweight HTML rendering for web view.
 * For v1 we do not include a full TeX engine. Instead we:
 * - Escape HTML
 * - Replace \frac{a}{b} with a simple fraction layout
 * - Replace \sqrt{x} with sqrt styling
 * - Keep other commands as text with monospace fallback
 * This keeps zero runtime dependencies while providing a visual distinction.
 */
export function latexToHtml(latex: string): string {
  const escaped = escapeHtml(latex);
  // Simple fraction: \frac{num}{den} -> <span class="pde-frac"><span class="pde-frac-num">num</span><span class="pde-frac-den">den</span></span>
  let html = escaped
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '<span class="pde-frac"><span class="pde-frac-num">$1</span><span class="pde-frac-den">$2</span></span>')
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, '<span class="pde-sqrt">√<span class="pde-sqrt-inner">$1</span></span>')
    .replace(/\\(alpha|beta|gamma|delta|epsilon|pi|theta|lambda|mu|sigma|omega|infty)\b/g, (_m, name) => {
      const map: Record<string, string> = {
        alpha: "α",
        beta: "β",
        gamma: "γ",
        delta: "δ",
        epsilon: "ε",
        pi: "π",
        theta: "θ",
        lambda: "λ",
        mu: "μ",
        sigma: "σ",
        omega: "ω",
        infty: "∞",
      };
      return map[name] ?? _m;
    });
  // Superscript ^ and subscript _ with braces: x^{2} -> x<sup>2</sup>
  html = html.replace(/\^\{([^{}]+)\}/g, "<sup>$1</sup>").replace(/_\{([^{}]+)\}/g, "<sub>$1</sub>");
  // Simple ^x and _x without braces (single char)
  html = html.replace(/\^([a-zA-Z0-9])/g, "<sup>$1</sup>").replace(/_([a-zA-Z0-9])/g, "<sub>$1</sub>");
  return html;
}

export function latexToPlainText(latex: string): string {
  // For PDF/ODT/DOCX fallback — keep raw LaTeX wrapped for readability
  return `$${latex}$`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * CSS for equations — injected via theme or editor stylesheet.
 * Uses CSS variables for color adaptability.
 */
export const equationCss = `
.pde-equation {
  font-family: "Cambria Math", "Latin Modern Math", "STIX Two Math", serif;
  background: var(--pde-color-surface, #f7f8fa);
  border: 1px solid var(--pde-color-border, #d8dce3);
  border-radius: var(--pde-radius-sm, 4px);
  padding: 1px 6px;
  margin: 0 2px;
  white-space: nowrap;
  color: var(--pde-color-text, #17191c);
}
.pde-equation--block {
  display: block;
  text-align: center;
  margin: 12px auto;
  padding: 8px 12px;
  max-width: 90%;
}
.pde-frac { display: inline-block; vertical-align: middle; text-align: center; margin: 0 2px; }
.pde-frac-num { display: block; border-bottom: 1px solid currentColor; padding: 0 4px; }
.pde-frac-den { display: block; padding: 0 4px; }
.pde-sqrt { position: relative; }
.pde-sqrt-inner { border-top: 1px solid currentColor; margin-left: 2px; }
`;
