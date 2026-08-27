import { validateLatex, latexToHtml } from "../../dist/core/equation/index.js";
import { getIconSvg } from "../../dist/assets/icons/index.js";

test("equation: valid latex passes", () => {
  const r = validateLatex("a^2 + b^2 = c^2");
  assert(r.valid);
});

test("equation: forbidden command fails", () => {
  const r = validateLatex("\\input{/etc/passwd}");
  assert(!r.valid);
  assert(r.errors.some((e) => e.code === "forbidden-command"));
});

test("equation: latexToHtml renders frac", () => {
  const html = latexToHtml("\\frac{a}{b}");
  assert(html.includes("pde-frac"));
  assert(html.includes("a") && html.includes("b"));
});

test("equation: latexToHtml handles sqrt", () => {
  const html = latexToHtml("\\sqrt{x}");
  assert(html.includes("pde-sqrt"));
});

test("icons: getIconSvg uses currentColor by default", () => {
  const svg = getIconSvg("bold");
  assert(svg.includes("currentColor"));
  assert(svg.includes('width="16"'));
});

test("icons: color override works", () => {
  const svg = getIconSvg("equation", { color: "var(--pde-color-primary)", size: 20 });
  assert(svg.includes("var(--pde-color-primary)"));
  assert(svg.includes('width="20"'));
});
