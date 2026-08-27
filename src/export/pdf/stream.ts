import { helveticaWidthPt, pdfLiteralString, type MathBox } from "./equation.js";
import { pdfEscape, type PdfPage } from "./pdf-model.js";
import type { PortableDocument } from "../../core/model/types.js";

export function pageContentStream(
  page: PdfPage,
  doc: PortableDocument,
  imageObjects: Map<string, number>,
): { stream: string } {
  void doc;
  let s = "";
  const marginPt = 57;
  let cursorX = marginPt;
  let tableState: { colW: number[]; row: number; x: number; y: number } | null = null;
  const pageWidthPt = 595;

  for (const { line, yPt } of page.lines) {
    const y = yPt;
    if (line.style === "page-break") continue;
    if (line.style === "hr") {
      s += `0.4 w 0.6 0.6 0.6 RG ${marginPt} ${y} m ${pageWidthPt - marginPt} ${y} l S\n`;
      continue;
    }
    if (line.style === "table-top" || line.style === "table-bottom" || line.style.startsWith("table-row-end")) {
      continue;
    }
    if (line.style.startsWith("table-cell")) {
      const parts = line.style.split(" ");
      const rowId = parts[2];
      const ri = Number(parts[3]);
      const cw = Number(parts[4]);
      void rowId;
      if (tableState === null || tableState.row !== ri) {
        tableState = { colW: [], row: ri, x: marginPt, y };
      }
      const rowH = 28;
      s += `0.3 w 0.45 0.45 0.45 RG\n`;
      s += `${tableState.x.toFixed(2)} ${(y - rowH).toFixed(2)} ${cw.toFixed(2)} ${rowH.toFixed(2)} re S\n`;
      const cellX = tableState.x + 4;
      const segs = line.segments;
      let sx = cellX;
      s += `BT /F1 9 Tf\n`;
      for (const seg of segs) {
        if (seg.kind === "text") {
          s += `1 0 0 1 ${sx} ${y - 10} Tm (${pdfEscape(seg.text)}) Tj\n`;
          sx += helveticaWidthPt(seg.text, 9);
        } else if (seg.kind === "math") {
          for (const r of seg.math.runs) {
            const fn = r.font === "Symbol" ? "F2" : "F1";
            s += `1 0 0 1 ${(sx + r.xPt).toFixed(2)} ${(y - 10 + r.yPt).toFixed(2)} Tm /${fn} ${r.sizePt} Tf (${pdfLiteralString(r.text)}) Tj\n`;
          }
          sx += seg.math.widthPt;
        }
      }
      s += `ET\n`;
      tableState.x += cw;
      cursorX = tableState.x;
      continue;
    }
    if (line.style.startsWith("image ")) {
      const parts = line.style.split(" ");
      const assetId = parts[1];
      const wUm = Number(parts[2]) || 150000;
      const hUm = Number(parts[3]) || 90000;
      const objNum = imageObjects.get(assetId);
      const wPt = Math.min(pageWidthPt - marginPt * 2, (wUm / 25400) * 72);
      const hPt = Math.min(360, Math.max(24, (hUm / 25400) * 72));
      if (!objNum) {
        s += `BT /F1 9 Tf 1 0 0 1 ${marginPt} ${y} Tm (${pdfEscape(`[missing image ${assetId}]`)}) Tj ET\n`;
        continue;
      }
      const x = marginPt;
      const yy = y - hPt;
      const name = `Im${assetId.replace(/[^A-Za-z0-9]/g, "_")}`;
      s += `q ${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} ${x.toFixed(2)} ${yy.toFixed(2)} cm /${name} Do Q\n`;
      cursorX = marginPt;
      continue;
    }
    if (line.style === "equation-block") {
      const mathSeg = line.segments.find((x): x is { kind: "math"; math: MathBox; sizePt: number } => x.kind === "math");
      if (mathSeg) {
        const x = (pageWidthPt - mathSeg.math.widthPt) / 2;
        s += mathOps(mathSeg.math, x, y, "F1", "F2");
      }
      cursorX = marginPt;
      continue;
    }

    const segs = line.segments;
    let x = marginPt;
    if (line.align === "center" || line.align === "right") {
      let w = 0;
      for (const seg of segs) {
        w += seg.kind === "text" ? helveticaWidthPt(seg.text, seg.sizePt) : seg.kind === "math" ? seg.math.widthPt : 0;
      }
      x = line.align === "center" ? (pageWidthPt - w) / 2 : pageWidthPt - marginPt - w;
    }
    cursorX = x;
    const firstText = segs.find((seg) => seg.kind === "text" && seg.text.length > 0);
    const sizePt = line.sizePt || (firstText ? 11 : 11);
    let inText = false;
    for (const seg of segs) {
      if (seg.kind === "text" && seg.text.length === 0) continue;
      if (seg.kind === "text") {
        s += `BT /F1 ${sizePt} Tf 1 0 0 1 ${cursorX.toFixed(2)} ${y} Tm (${pdfEscape(seg.text)}) Tj ET\n`;
        cursorX += helveticaWidthPt(seg.text, seg.sizePt || sizePt);
        inText = true;
      } else if (seg.kind === "math") {
        s += mathOps(seg.math, cursorX, y, "F1", "F2");
        cursorX += seg.math.widthPt;
        inText = true;
      }
    }
    void inText;
  }
  return { stream: s };
}

function mathOps(math: MathBox, x: number, y: number, f1: string, f2: string): string {
  let s = "";
  for (const r of math.runs) {
    const fn = r.font === "Symbol" ? f2 : f1;
    s += `BT /${fn} ${r.sizePt.toFixed(2)} Tf 1 0 0 1 ${(x + r.xPt).toFixed(2)} ${(y + r.yPt).toFixed(2)} Tm ${pdfLiteralString(r.text)} Tj ET\n`;
  }
  for (const rl of math.rules) {
    s += `0.6 w 0 0 0 RG 0 0 0 rg ${(x + rl.xPt).toFixed(2)} ${(y + rl.yPt - rl.heightPt / 2).toFixed(2)} ${rl.widthPt.toFixed(2)} ${rl.heightPt.toFixed(2)} re f S\n`;
  }
  return s;
}
