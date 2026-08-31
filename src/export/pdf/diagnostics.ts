import type { BlockNode, InlineNode, PortableDocument } from "../../core/model/types.js";
import { resolveDocumentFont } from "../../fonts/catalog.js";
import { findUnmappedPdfChars } from "../../fonts/win-ansi.js";
import { parseMath } from "./equation.js";

export interface PdfDiag {
  code: string;
  message: string;
  severity: "warning" | "error";
  path?: string;
}

function latexGap(latex: string, path: string, out: PdfDiag[]): void {
  const box = parseMath(latex, 11);
  const raw = box.runs.map((r) => r.text).join("");
  if (raw.includes("\\")) {
    out.push({
      code: "pdf-latex-unmapped",
      message: `LaTeX command left as text in PDF: ${latex.slice(0, 80)}`,
      severity: "warning",
      path,
    });
  }
}

function walkInlines(nodes: InlineNode[] | undefined, path: string, out: PdfDiag[], marksOnce: { n: boolean }, unmappedOnce: { n: boolean }): void {
  for (const n of nodes ?? []) {
    if (n.type === "inline-image") {
      out.push({ code: "pdf-skip-inline-image", message: "Inline image is not drawn in PDF", severity: "warning", path: `${path}/${n.id}` });
    } else if (n.type === "equation") latexGap((n as { latex?: string }).latex ?? "", `${path}/${n.id}`, out);
    else if (n.type === "text") {
      const text = (n as { text?: string }).text ?? "";
      const missing = findUnmappedPdfChars(text);
      if (missing.length && !unmappedOnce.n) {
        unmappedOnce.n = true;
        const sample = missing.slice(0, 8).map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase()}`).join(", ");
        out.push({
          code: "pdf-unmapped-char",
          message: `PDF cannot encode ${missing.length} character(s) (shown as ?): ${sample}${missing.length > 8 ? "…" : ""}`,
          severity: "warning",
        });
      }
      if ((n as { marks?: { fontFamily?: string } }).marks?.fontFamily && !marksOnce.n) {
        const fam = (n as { marks?: { fontFamily?: string } }).marks?.fontFamily;
        if (!resolveDocumentFont(fam)) {
          marksOnce.n = true;
          out.push({
            code: "pdf-font-family-ignored",
            message: `fontFamily "${fam}" is not a document face; PDF uses Helvetica`,
            severity: "warning",
          });
        }
      }
    } else if (n.type === "link") walkInlines((n as { children?: InlineNode[] }).children, `${path}/${n.id}`, out, marksOnce, unmappedOnce);
  }
}

function walkBlocks(blocks: BlockNode[] | undefined, path: string, out: PdfDiag[], ctx: "root" | "cell" | "column", marksOnce: { n: boolean }, unmappedOnce: { n: boolean }): void {
  for (const b of blocks ?? []) {
    const p = `${path}/${b.id}`;
    if (b.type === "paragraph" || b.type === "heading" || b.type === "quote") {
      walkInlines((b as { children?: InlineNode[] }).children, p, out, marksOnce, unmappedOnce);
    } else if (b.type === "list") {
      for (const it of (b as { items: Array<{ id: string; content: InlineNode[]; nested?: BlockNode }> }).items) {
        walkInlines(it.content, `${p}/${it.id}`, out, marksOnce, unmappedOnce);
        if (it.nested) out.push({ code: "pdf-skip-nested-list", message: "Nested list is not laid out in PDF", severity: "warning", path: `${p}/${it.id}` });
      }
    } else if (b.type === "table") {
      for (const row of (b as { rows: Array<{ id: string; cells: Array<{ id: string; blocks: BlockNode[] }> }> }).rows) {
        for (const cell of row.cells) {
          for (const inner of cell.blocks) {
            if (inner.type !== "paragraph") {
              out.push({ code: "pdf-cell-block-skipped", message: `Table cell ${inner.type} is not drawn in PDF`, severity: "warning", path: `${p}/${cell.id}/${inner.id}` });
            }
          }
          walkBlocks(cell.blocks, `${p}/${cell.id}`, out, "cell", marksOnce, unmappedOnce);
        }
      }
    } else if (b.type === "columns") {
      for (const col of (b as { columns: Array<{ id: string; blocks: BlockNode[] }> }).columns) {
        for (const inner of col.blocks) {
          if (inner.type !== "paragraph" && inner.type !== "heading" && inner.type !== "image") {
            out.push({ code: "pdf-column-block-skipped", message: `Column ${inner.type} is not drawn in PDF`, severity: "warning", path: `${p}/${col.id}/${inner.id}` });
          }
        }
        walkBlocks(col.blocks, `${p}/${col.id}`, out, "column", marksOnce, unmappedOnce);
      }
    } else if (b.type === "equation-block") latexGap((b as { latex?: string }).latex ?? "", p, out);
    else if (b.type === "image") {
      const id = (b as { assetId: string }).assetId;
      if (!id) out.push({ code: "pdf-missing-image", message: "Image block has no assetId", severity: "error", path: p });
    }
    void ctx;
  }
}

export function collectPdfDiagnostics(
  doc: PortableDocument,
  assets: Record<string, { data?: Uint8Array }> = {},
): PdfDiag[] {
  const out: PdfDiag[] = [];
  const marksOnce = { n: false };
  const unmappedOnce = { n: false };
  walkBlocks(doc.root.children, "root", out, "root", marksOnce, unmappedOnce);
  for (const b of doc.root.children) {
    if (b.type !== "image") continue;
    const id = (b as { assetId: string }).assetId;
    if (id && !assets[id]?.data && !doc.assets[id]) {
      out.push({ code: "pdf-missing-image", message: `Image asset ${id} has no bytes for PDF`, severity: "warning", path: b.id });
    }
  }
  return out;
}
