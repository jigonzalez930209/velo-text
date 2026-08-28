/**
 * Property tests — random ops then undo restores canonical hash.
 */
import { createDocument, createIdGenerator, createParagraph, createText } from "../../dist/core/model/factories.js";
import { createTransaction } from "../../dist/core/operations/operations.js";
import { normalizeDocument, isIdempotent } from "../../dist/core/normalize/normalize.js";
import { validateDocument } from "../../dist/core/schema/validator.js";

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

test("property: normalize is idempotent on random paragraphs", () => {
  const r = rng(42);
  const g = createIdGenerator("p");
  for (let i = 0; i < 40; i++) {
    const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
    const n = 1 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) {
      doc.root.children.push(createParagraph(g, [createText(g, "x".repeat(1 + Math.floor(r() * 8)))]));
    }
    assert(isIdempotent(doc));
  }
});

function kidsHash(doc) {
  return JSON.stringify(doc.root.children);
}

test("property: insert then inverse restore hash", () => {
  const r = rng(7);
  for (let i = 0; i < 30; i++) {
    const g = createIdGenerator("o");
    const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
    doc.root.children.push(createParagraph(g, [createText(g, "a")]));
    const before = kidsHash(normalizeDocument(doc));
    const tx = createTransaction(doc, "fuzz");
    const p = createParagraph(g, [createText(g, "b")]);
    tx.insertBlock(1, p);
    const mid = tx.commit();
    assert(validateDocument(mid.document).valid);
    const back = createTransaction(mid.document, "undo");
    back.deleteBlock(1);
    const restored = normalizeDocument(back.commit().document);
    assert(kidsHash(restored) === before);
    void r;
  }
});
