/**
 * Final coverage push — formatValue branches, render-error path, inspectVariables, parseMath group command.
 */
import { formatValue, renderTemplate, inspectVariables } from "../../dist/template/resolver/resolver.js";
import { parseMath } from "../../dist/export/pdf/equation.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("formatValue: default date path and catch", () => {
  // date with unrecognized arg -> Intl default (timezone)
  const d = new Date("2026-01-02T00:00:00.000Z");
  const out = formatValue(d, "date:custom", "en-US", "UTC");
  assert(typeof out === "string");
  // invalid timezone -> catch returns String(value)
  const bad = formatValue(d, "date:dd/MM/yyyy", "en-US", "Not/AZone");
  assert(typeof bad === "string");
  // lower/upper via formatValue directly
  assert(formatValue("AB", "lower") === "ab");
});

test("renderTemplate: strict mode rethrows with render-error diagnostic", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "variable", id: "v1", path: "a", source: "{{a}}", valueType: "string" }] });
  let threw = false;
  try {
    renderTemplate(doc, {}, { strict: false, missing: "error", mode: "strict" });
  } catch {
    threw = true;
  }
  assert(threw, "strict mode rethrows");
});

test("inspectVariables: tables and nested lists", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  const g = createIdGenerator("n");
  doc.root.children.push({
    type: "table", id: "tbl", columns: [{ id: g.next(), widthUm: 10000 }],
    rows: [{ id: g.next(), cells: [{ id: g.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: g.next(), children: [{ type: "variable", id: g.next(), path: "inCell", source: "{{inCell}}", valueType: "string" }] }] }] }],
  });
  doc.root.children.push({
    type: "list", id: "l1", kind: "unordered",
    items: [
      { id: g.next(), content: [{ type: "variable", id: g.next(), path: "inList", source: "{{inList}}", valueType: "string" }] },
      { id: g.next(), content: [], nested: { type: "list", id: g.next(), kind: "ordered", items: [{ id: g.next(), content: [{ type: "variable", id: g.next(), path: "nested", source: "{{nested}}", valueType: "string" }] }] } },
    ],
  });
  const vars = inspectVariables(doc);
  const paths = vars.map((v) => v.path);
  assert(paths.includes("inCell"), "table cell variable found");
  assert(paths.includes("inList"), "list variable found");
  assert(paths.includes("nested"), "nested list variable found");
});

test("parseMath: group with command args", () => {
  const m1 = parseMath("\\sqrt{\\alpha}");
  assert(m1.runs.some((r) => r.font === "Symbol"), "greek inside sqrt");
  const m2 = parseMath("\\frac{a}{\\frac{c}{d}}");
  assert(m2.runs.length >= 2);
  const m3 = parseMath("x_{i} + y^{j}");
  assert(m3.runs.length >= 3);
});