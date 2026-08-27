import { validateDocument } from "../../dist/core/schema/validator.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("validator: empty document is valid", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  const res = validateDocument(doc, { strict: true });
  assert(res.valid, `expected valid, got ${JSON.stringify(res.errors)}`);
});

test("validator: duplicate id fails", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  const dup = doc.root.id;
  doc.root.children.push({ type: "paragraph", id: dup, children: [{ type: "text", id: "x", text: "hi" }] });
  const res = validateDocument(doc);
  assert(!res.valid);
  assert(res.errors.some((e) => e.code === "duplicate-id"));
});

test("validator: equation with forbidden command fails", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({ type: "equation-block", id: "eq1", latex: "\\input{/etc/passwd}" });
  const res = validateDocument(doc);
  assert(!res.valid);
  assert(res.errors.some((e) => e.code === "forbidden-command"));
});

test("validator: equation unbalanced braces fails", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "equation", id: "e1", latex: "\\frac{a}{b" }] });
  const res = validateDocument(doc);
  assert(!res.valid);
});
