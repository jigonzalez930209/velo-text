export interface EqSnippet { label: string; latex: string }
export interface EqCategory { id: string; title: string; items: EqSnippet[] }

const GREEK: EqSnippet[] = [
  ["α", "\\alpha"], ["β", "\\beta"], ["γ", "\\gamma"], ["δ", "\\delta"], ["ε", "\\epsilon"],
  ["ζ", "\\zeta"], ["η", "\\eta"], ["θ", "\\theta"], ["ι", "\\iota"], ["κ", "\\kappa"],
  ["λ", "\\lambda"], ["μ", "\\mu"], ["ν", "\\nu"], ["ξ", "\\xi"], ["ο", "\\omicron"],
  ["π", "\\pi"], ["ρ", "\\rho"], ["σ", "\\sigma"], ["τ", "\\tau"], ["υ", "\\upsilon"],
  ["φ", "\\phi"], ["χ", "\\chi"], ["ψ", "\\psi"], ["ω", "\\omega"],
  ["Γ", "\\Gamma"], ["Δ", "\\Delta"], ["Θ", "\\Theta"], ["Λ", "\\Lambda"], ["Ξ", "\\Xi"],
  ["Π", "\\Pi"], ["Σ", "\\Sigma"], ["Φ", "\\Phi"], ["Ψ", "\\Psi"], ["Ω", "\\Omega"],
].map(([label, latex]) => ({ label, latex }));

const OPS: EqSnippet[] = [
  ["±", "\\pm"], ["∓", "\\mp"], ["×", "\\times"], ["÷", "\\div"], ["·", "\\cdot"], ["∘", "\\circ"],
  ["⊗", "\\otimes"], ["⊕", "\\oplus"], ["∂", "\\partial"], ["∇", "\\nabla"], ["∞", "\\infty"],
  ["≈", "\\approx"], ["≠", "\\neq"], ["≤", "\\leq"], ["≥", "\\geq"], ["≡", "\\equiv"], ["∝", "\\propto"],
  ["∈", "\\in"], ["∉", "\\notin"], ["⊂", "\\subset"], ["⊃", "\\supset"],
  ["∪", "\\cup"], ["∩", "\\cap"], ["∅", "\\emptyset"], ["∀", "\\forall"], ["∃", "\\exists"],
].map(([label, latex]) => ({ label, latex }));

export const EQ_CATEGORIES: EqCategory[] = [
  {
    id: "structures",
    title: "Structures",
    items: [
      { label: "a/b", latex: "\\frac{a}{b}" }, { label: "√", latex: "\\sqrt{x}" },
      { label: "xⁿ", latex: "x^{n}" }, { label: "xₙ", latex: "x_{n}" },
      { label: "x̂", latex: "\\hat{x}" }, { label: "x̄", latex: "\\bar{x}" },
      { label: "x⃗", latex: "\\vec{x}" }, { label: "x̃", latex: "\\tilde{x}" },
    ],
  },
  {
    id: "integrals",
    title: "Integrals",
    items: [
      { label: "∫", latex: "\\int" }, { label: "∬", latex: "\\iint" },
      { label: "∭", latex: "\\iiint" }, { label: "∮", latex: "\\oint" },
    ],
  },
  {
    id: "summations",
    title: "Summations",
    items: [
      { label: "∑", latex: "\\sum_{n=1}^{\\infty}" }, { label: "∏", latex: "\\prod" },
      { label: "lim", latex: "\\lim_{x \\to 0}" },
    ],
  },
  {
    id: "matrices",
    title: "Matrices",
    items: [
      { label: "matrix", latex: "\\begin{matrix} a & b \\\\ c & d \\end{matrix}" },
      { label: "( )", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
      { label: "[ ]", latex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}" },
      { label: "{ }", latex: "\\begin{Bmatrix} a & b \\\\ c & d \\end{Bmatrix}" },
      { label: "| |", latex: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}" },
    ],
  },
  { id: "greek", title: "Greek", items: GREEK },
  { id: "operators", title: "Operators", items: OPS },
  {
    id: "arrows",
    title: "Arrows",
    items: [
      { label: "→", latex: "\\rightarrow" }, { label: "←", latex: "\\leftarrow" },
      { label: "↔", latex: "\\leftrightarrow" }, { label: "⇒", latex: "\\Rightarrow" },
      { label: "⇐", latex: "\\Leftarrow" }, { label: "⇔", latex: "\\Leftrightarrow" },
      { label: "↦", latex: "\\mapsto" }, { label: "↑", latex: "\\uparrow" },
      { label: "↓", latex: "\\downarrow" },
    ],
  },
  {
    id: "functions",
    title: "Functions",
    items: [
      { label: "sin", latex: "\\sin" }, { label: "cos", latex: "\\cos" },
      { label: "tan", latex: "\\tan" }, { label: "log", latex: "\\log" },
      { label: "ln", latex: "\\ln" }, { label: "exp", latex: "\\exp" },
      { label: "lim", latex: "\\lim" }, { label: "max", latex: "\\max" },
      { label: "min", latex: "\\min" }, { label: "det", latex: "\\det" },
    ],
  },
  {
    id: "delimiters",
    title: "Delimiters",
    items: [
      { label: "(…)", latex: "\\left( x \\right)" }, { label: "[…]", latex: "\\left[ x \\right]" },
      { label: "{…}", latex: "\\left\\{ x \\right\\}" }, { label: "|…|", latex: "\\left| x \\right|" },
      { label: "‖…‖", latex: "\\left\\| x \\right\\|" },
      { label: "⌊…⌋", latex: "\\lfloor x \\rfloor" }, { label: "⌈…⌉", latex: "\\lceil x \\rceil" },
    ],
  },
];
