/**
 * Pipeline de entrada — Fase 4.1.3
 * beforeinput -> intención -> operación -> validar -> transacción -> normalizar -> reconciliar
 */
import type { PortableDocument } from "../../core/model/types.js";
import { createTransaction } from "../../core/operations/operations.js";

export type InputIntent =
  | { type: "insertText"; text: string }
  | { type: "deleteContentBackward" }
  | { type: "insertVariable"; path: string; format?: string; fallback?: string }
  | { type: "toggleMark"; mark: "bold" | "italic" | "underline" | "strike" | "code" }
  | { type: "insertParagraph" }
  | { type: "insertTable"; rows: number; cols: number };

export function intentToOperation(doc: PortableDocument, intent: InputIntent, blockId: string, offset: number): PortableDocument {
  const tx = createTransaction(doc, intent.type);
  switch (intent.type) {
    case "insertText": {
      // insert each char as text node? simplified: insert one text node
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
    default:
      break;
  }
  return tx.commit().document;
}
