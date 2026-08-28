/**
 * Security corpus — XSS paste, prototype pollution, SVG, javascript: URLs, LaTeX.
 */
import { JSDOM } from "jsdom";
import { handlePaste, sanitizePastedHtml } from "../../dist/editor-web/clipboard/index.js";
import { safeResolve } from "../../dist/template/resolver/format.js";
import { sanitizeSvg } from "../../dist/assets/svg/index.js";
import { validateLatex } from "../../dist/core/equation/index.js";

test("security: paste strips script iframe and javascript href", () => {
  const html = `<p>ok</p><script>alert(1)</script><iframe src="https://evil"></iframe><a href="javascript:alert(1)">x</a>`;
  const out = sanitizePastedHtml(html);
  assert(!/script/i.test(out) || !out.includes("alert"), "script body gone");
  assert(!/iframe/i.test(out), "iframe stripped");
  assert(!/javascript:/i.test(out), "javascript: url stripped");
  const pasted = handlePaste({ html: `<img src=x onerror=alert(1)>`, text: "t" });
  assert(!/onerror/i.test(pasted.sanitizedHtml), "event handler stripped");
});

test("security: DOMParser allowlist unwraps unknown tags", () => {
  const dom = new JSDOM("<!doctype html>");
  globalThis.DOMParser = dom.window.DOMParser;
  const out = sanitizePastedHtml(`<p>a</p><svg onload="alert(1)"></svg><b>b</b>`);
  assert(out.includes("a") && out.includes("b"));
  assert(!/onload/i.test(out));
  delete globalThis.DOMParser;
});

test("security: safeResolve blocks __proto__ prototype constructor", () => {
  const data = JSON.parse('{"user":{"name":"Ada"}}');
  assert(safeResolve(data, "__proto__.polluted").found === false);
  assert(safeResolve(data, "constructor.prototype").found === false);
  assert(safeResolve(data, "user.__proto__").found === false);
  const ok = safeResolve(data, "user.name");
  assert(ok.found === true && ok.value === "Ada");
});

test("security: sanitizeSvg rejects script and javascript urls", () => {
  const bad = `<svg><script>alert(1)</script><a href="javascript:alert(1)"><path d="M0 0"/></a></svg>`;
  const r = sanitizeSvg(bad);
  assert(r.removed.includes("script") || r.sanitized.indexOf("<script") === -1);
  assert(r.removed.includes("javascript-url") || !/javascript:/i.test(r.sanitized));
});

test("security: validateLatex rejects \\input and oversize", () => {
  assert(validateLatex("\\input{/etc/passwd}").valid === false);
  assert(validateLatex("\\def\\x{}").valid === false);
  assert(validateLatex("a".repeat(2001)).valid === false);
  assert(validateLatex("E = mc^2").valid === true);
});
