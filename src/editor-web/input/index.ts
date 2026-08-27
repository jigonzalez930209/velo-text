/**
 * Input pipeline — Phase 4.1.3
 * beforeinput -> intent -> operation -> validate -> transaction -> normalize -> reconcile
 */
import type { PortableDocument } from "../../core/model/types.js";
import { createTransaction } from "../../core/operations/operations.js";

export type InputIntent =
  | { type: "insertText"; text: string }
  | { type: "deleteContentBackward" }
  | { type: "insertVariable"; path: string; format?: string; fallback?: string }
  | { type: "insertEquation"; latex: string; display?: boolean }
  | { type: "insertBlockEquation"; latex: string; label?: string }
  | { type: "toggleMark"; mark: "bold" | "italic" | "underline" | "strike" | "code" }
  | { type: "insertParagraph" }
  | { type: "insertTable"; rows: number; cols: number };

export function intentToOperation(doc: PortableDocument, intent: InputIntent, blockId: string, offset: number): PortableDocument {
  const tx = createTransaction(doc, intent.type);
  switch (intent.type) {
    case "insertText": {
      // Insert each char as a text node? Simplified: insert one text node
      const id = `tmp_${Date.now()}`;
      tx.insertInline(blockId, offset, { type: "text", id, text: intent.text });
      break;
    }
    case "insertVariable": {
      const id = `var_${Date.now()}`;
      tx.insertInline(blockId, offset, {
        type: "variable",
        id,
        path: intent.path,
        source: `{{${intent.path}${intent.format ? ` | ${intent.format}` : ""}${intent.fallback ? ` ?? "${intent.fallback}"` : ""}}}`,
        valueType: "unknown",
        format: intent.format,
        fallback: intent.fallback,
      });
      break;
    }
    case "insertEquation": {
      const id = `eq_${Date.now()}`;
      tx.insertInline(blockId, offset, { type: "equation", id, latex: intent.latex, ...(intent.display ? { display: true as const } : {}) });
      break;
    }
    case "insertBlockEquation": {
      const id = `eqb_${Date.now()}`;
      tx.insertBlock(doc.root.children.length, { type: "equation-block", id, latex: intent.latex, ...(intent.label ? { label: intent.label } : {}) });
      break;
    }
    default:
      break;
  }
  return tx.commit().document;
}
