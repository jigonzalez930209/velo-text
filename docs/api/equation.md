# Equation

Simple LaTeX subset — see `src/core/equation/index.ts`.

- `MAX_LATEX_LENGTH = 2000`, blocked `\\input`, `\\def`, balanced braces
- `validateLatex(latex) → {valid,errors}`
- `latexToHtml(latex)` → `<span class="pde-frac">` etc., handles `\\frac`, `\\sqrt`, `^/_`, greek
- `latexToPlainText` for PDF fallback `$latex$`
- `equationCss` for `pde-equation`, `pde-frac`, `pde-sqrt`

Nodes: `InlineEquationNode` (`type:"equation"`, `latex`, `display?`) and `EquationBlockNode` (`type:"equation-block"`), factories `createEquation`/`createEquationBlock`, validated in `validator.ts`, rendered in `editor-web/view` and `export/*`.
