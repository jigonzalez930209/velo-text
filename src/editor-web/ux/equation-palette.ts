export interface EqSnippet { label: string; latex: string }

export interface EqCategory { id: string; title: string; items: EqSnippet[] }

export const EQ_CATEGORIES: EqCategory[] = [
  {
    id: "structures",
    title: "Structures",
    items: [
      { label: "a/b", latex: "\\frac{a}{b}" },
      { label: "√", latex: "\\sqrt{x}" },
      { label: "xⁿ", latex: "x^{n}" },
      { label: "xₙ", latex: "x_{n}" },
      { label: "x̂", latex: "\\hat{x}" },
      { label: "x̄", latex: "\\bar{x}" },
      { label: "x⃗", latex: "\\vec{x}" },
      { label: "x̃", latex: "\\tilde{x}" },
    ],
  },
  {
    id: "integrals",
    title: "Integrals",
    items: [
      { label: "∫", latex: "\\int" },
      { label: "∬", latex: "\\iint" },
      { label: "∭", latex: "\\iiint" },
      { label: "∮", latex: "\\oint" },
    ],
  },
  {
    id: "summations",
    title: "Summations",
    items: [
      { label: "∑", latex: "\\sum_{n=1}^{\\infty}" },
      { label: "∏", latex: "\\prod" },
      { label: "lim", latex: "\\lim_{x \\to 0}" },
    ],
  },
  {
    id: "matrices",
    title: "Matrices",
    items: [
      { label: "[ ]", latex: "\\begin{matrix} a & b \\\\ c & d \\end{matrix}" },
    ],
  },
  {
    id: "greek",
    title: "Greek",
    items: [
      { label: "α", latex: "\\alpha" }, { label: "β", latex: "\\beta" }, { label: "γ", latex: "\\gamma" },
      { label: "δ", latex: "\\delta" }, { label: "ε", latex: "\\epsilon" }, { label: "θ", latex: "\\theta" },
      { label: "λ", latex: "\\lambda" }, { label: "μ", latex: "\\mu" }, { label: "π", latex: "\\pi" },
      { label: "σ", latex: "\\sigma" }, { label: "ω", latex: "\\omega" }, { label: "∞", latex: "\\infty" },
    ],
  },
  {
    id: "operators",
    title: "Operators",
    items: [
      { label: "±", latex: "\\pm" }, { label: "×", latex: "\\times" }, { label: "÷", latex: "\\div" },
      { label: "·", latex: "\\cdot" }, { label: "≤", latex: "\\leq" }, { label: "≥", latex: "\\geq" },
      { label: "≠", latex: "\\neq" },
    ],
  },
  {
    id: "arrows",
    title: "Arrows",
    items: [
      { label: "→", latex: "\\rightarrow" }, { label: "←", latex: "\\leftarrow" },
    ],
  },
  {
    id: "functions",
    title: "Functions",
    items: [
      { label: "sin", latex: "\\sin" }, { label: "cos", latex: "\\cos" }, { label: "ln", latex: "\\ln" },
      { label: "f(x)", latex: "f(x)" },
    ],
  },
  {
    id: "delimiters",
    title: "Delimiters",
    items: [
      { label: "( )", latex: "\\left( x \\right)" }, { label: "[ ]", latex: "\\left[ x \\right]" },
    ],
  },
];
