import { canonicalStringify, contentHashHex } from "../../dist/core/schema/canonical.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("canonical: sorted keys deterministic", () => {
  const a = { b: 2, a: 1, c: { z: 3, y: 2 } };
  const b = { a: 1, c: { y: 2, z: 3 }, b: 2 };
  assert.equal(canonicalStringify(a), canonicalStringify(b));
});

test("canonical: hash deterministic with fixed clock", () => {
  const idGen = createIdGenerator("c");
  const clock = { nowIso: () => "2026-08-27T12:00:00.000Z" };
  const doc1 = createDocument({ idGenerator: idGen, clock });
  const doc2 = JSON.parse(JSON.stringify(doc1));
  assert.equal(contentHashHex(doc1), contentHashHex(doc2));
});

test("canonical: different docs have different hashes", () => {
  const doc1 = createDocument({ idGenerator: createIdGenerator("a"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  const doc2 = createDocument({ idGenerator: createIdGenerator("b"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc1.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hello" }] });
  assert(contentHashHex(doc1) !== contentHashHex(doc2));
});
