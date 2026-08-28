/** Recursive LaTeX → HTML for the v1 subset (nested \frac / \sqrt / ^ / _). */

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", omicron: "ο",
  pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  infty: "∞",
};

const OPS: Record<string, string> = {
  iiint: "∭", iint: "∬", oint: "∮", int: "∫", sum: "∑", prod: "∏",
  Leftrightarrow: "⇔", Rightarrow: "⇒", Leftarrow: "⇐",
  leftrightarrow: "↔", rightarrow: "→", leftarrow: "←", mapsto: "↦",
  uparrow: "↑", downarrow: "↓", to: "→",
  otimes: "⊗", oplus: "⊕", times: "×", cdot: "·", circ: "∘",
  div: "÷", pm: "±", mp: "∓", partial: "∂", nabla: "∇",
  approx: "≈", neq: "≠", leq: "≤", geq: "≥", equiv: "≡", propto: "∝",
  notin: "∉", emptyset: "∅", subset: "⊂", supset: "⊃",
  cup: "∪", cap: "∩", forall: "∀", exists: "∃", in: "∈",
  lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉",
  sin: "sin", cos: "cos", tan: "tan", log: "log", ln: "ln",
  exp: "exp", lim: "lim", max: "max", min: "min", det: "det",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function takeGroup(src: string, i: number): { inner: string; next: number } {
  while (src[i] === " ") i++;
  if (src[i] !== "{") {
    if (src[i] === "\\") {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z]/.test(src[j]!)) j++;
      if (j === i + 1 && j < src.length) j++;
      return { inner: src.slice(i, j), next: j };
    }
    return { inner: src[i] ?? "", next: i + 1 };
  }
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "\\" && (src[j + 1] === "{" || src[j + 1] === "}")) {
      j++;
      continue;
    }
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return { inner: src.slice(i + 1, j), next: j + 1 };
    }
  }
  return { inner: src.slice(i + 1), next: src.length };
}

function convert(src: string): string {
  let i = 0;
  let out = "";
  while (i < src.length) {
    const c = src[i]!;
    if (c === "{") {
      const g = takeGroup(src, i);
      out += convert(g.inner);
      i = g.next;
      continue;
    }
    if (c === "}") {
      i++;
      continue;
    }
    if (c === "^" || c === "_") {
      const tag = c === "^" ? "sup" : "sub";
      i++;
      const g = takeGroup(src, i);
      out += `<${tag}>${convert(g.inner)}</${tag}>`;
      i = g.next;
      continue;
    }
    if (c === "\\") {
      const n = src[i + 1];
      if (n && !/[a-zA-Z]/.test(n)) {
        i += 2;
        if (n === "\\") out += "<br>";
        else if (n === "{" || n === "}" || n === "_" || n === "%") out += escapeHtml(n);
        else if (n === ",") out += "\u2009";
        else out += escapeHtml(n);
        continue;
      }
      let j = i + 1;
      while (j < src.length && /[a-zA-Z]/.test(src[j]!)) j++;
      const name = src.slice(i + 1, j);
      i = j;
      while (src[i] === " ") i++;
      if (name === "frac") {
        const a = takeGroup(src, i);
        const b = takeGroup(src, a.next);
        out += `<span class="pde-frac"><span class="pde-frac-num">${convert(a.inner)}</span><span class="pde-frac-den">${convert(b.inner)}</span></span>`;
        i = b.next;
        continue;
      }
      if (name === "sqrt") {
        const a = takeGroup(src, i);
        out += `<span class="pde-sqrt"><svg class="pde-sqrt-sym" viewBox="0 0 12 18" preserveAspectRatio="none" aria-hidden="true"><path d="M1 9 L3.2 16.5 L8 1.2 H12" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" stroke-linecap="square"/></svg><span class="pde-sqrt-inner">${convert(a.inner)}</span></span>`;
        i = a.next;
        continue;
      }
      if (name === "left" || name === "right") continue;
      if (name === "begin" || name === "end") {
        const g = takeGroup(src, i);
        i = g.next;
        continue;
      }
      if (name === "hat" || name === "bar" || name === "vec" || name === "tilde") {
        const g = takeGroup(src, i);
        const mark = name === "hat" ? "̂" : name === "bar" ? "̄" : name === "vec" ? "⃗" : "̃";
        out += `${convert(g.inner)}${mark}`;
        i = g.next;
        continue;
      }
      out += GREEK[name] ?? OPS[name] ?? escapeHtml(`\\${name}`);
      continue;
    }
    out += c === " " ? " " : escapeHtml(c);
    i++;
  }
  return out;
}

export function latexToHtml(latex: string): string {
  return convert(latex);
}
