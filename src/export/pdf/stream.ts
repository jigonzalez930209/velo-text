import { helveticaWidthPt, MATH_CHIP_PAD_X, mathVisualExtents, pdfLiteralString, type MathBox } from "./equation.js";
import { pdfEscape, type PdfLine, type PdfPage, type TextSegment } from "./pdf-model.js";
import type { PortableDocument } from "../../core/model/types.js";
import { pdfImageDisplayPt } from "./layout-pages.js";
import { cssColorToPdfRgb, paintTextRun, segmentWidthPt } from "./paint.js";

function tableCellFillToken(parts: string[]): string | null {
  const tagged = parts.find((p) => p.startsWith("F#") || p === "F-");
  if (tagged) return tagged === "F-" ? null : tagged.slice(1);
  const fill = parts[7];
  if (!fill || fill === "-") return null;
  return fill.startsWith("#") || fill.includes("rgb") ? fill : `#${fill.replace("#", "")}`;
}

export function pageContentStream(
  page: PdfPage,
  doc: PortableDocument,
  imageObjects: Map<string, number>,
): { stream: string } {
  void doc;
  let s = "";
  const marginPt = page.marginPt;
  let cursorX = marginPt;
  let tableState: { colW: number[]; row: number; x: number; y: number } | null = null;
  const pageWidthPt = page.widthPt;

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
    if (line.style.startsWith("table-cell") || line.style.startsWith("flow-cell")) {
      const parts = line.style.split(" ");
      const ri = Number(parts[3]);
      const cw = Number(parts[4]);
      const rowH = Number(parts[5]) || 28;
      const isTable = line.style.startsWith("table-cell");
      if (tableState === null || tableState.row !== ri) {
        tableState = { colW: [], row: ri, x: marginPt, y };
      }
      const fill = isTable ? tableCellFillToken(parts) : undefined;
      const rgb = fill ? cssColorToPdfRgb(fill) : null;
      const whiteFg = parts.includes("fgW") || (parts.includes("white") && (fill ?? "").toLowerCase() === "#3659e3");
      if (rgb) {
        s += `${rgb} rg ${tableState.x.toFixed(2)} ${(y - rowH).toFixed(2)} ${cw.toFixed(2)} ${rowH.toFixed(2)} re f\n0 0 0 rg\n`;
      }
      if (isTable) {
        s += `0.3 w 0.45 0.45 0.45 RG\n`;
        s += `${tableState.x.toFixed(2)} ${(y - rowH).toFixed(2)} ${cw.toFixed(2)} ${rowH.toFixed(2)} re S\n`;
      }
      const rows = splitCellRows(line.segments);
      const fontSize = 11;
      const advances = rows.map((rowSegs) => cellRowAdvance(rowSegs, isTable ? 12 : 14));
      const blockH = advances.reduce((n, a) => n + a, 0) || (isTable ? 12 : 14);
      const pad = isTable ? 8 : 12;
      const vAlign = parts.includes("va-bottom") ? "bottom" : parts.includes("va-middle") ? "middle" : "top";
      let ty = y - (rowH - blockH) / 2 - pad;
      if (vAlign === "top") ty = y - pad;
      else if (vAlign === "bottom") ty = y - rowH + blockH - 4;
      const cellAlign = (isTable && (parts[6] === "center" || parts[6] === "right"))
        ? parts[6]
        : (line.align === "center" || line.align === "right" ? line.align : "left");
      let rowI = 0;
      for (const rowSegs of rows) {
        let textW = 0;
        for (const seg of rowSegs) {
          textW += seg.kind === "text" ? segmentWidthPt(seg.text, seg.sizePt || fontSize, seg.face) : seg.kind === "math" ? seg.math.widthPt + 8 : 0;
        }
        let sx = tableState.x + 4;
        if (cellAlign === "center") sx = tableState.x + Math.max(4, (cw - textW) / 2);
        else if (cellAlign === "right") sx = tableState.x + Math.max(4, cw - 4 - textW);
        for (const seg of rowSegs) {
          if (seg.kind === "text") {
            const painted = paintTextRun(seg.text, sx, ty, paintOpts(seg, fontSize, whiteFg));
            s += painted.ops;
            sx += painted.width;
          } else if (seg.kind === "math") {
            s += mathOps(seg.math, sx + 4, ty, "F3", "F2");
            sx += seg.math.widthPt + 8;
          }
        }
        ty -= advances[rowI++] ?? 14;
      }
      const imgTok = isTable ? parts[8] : parts[7];
      const imgId = imgTok && imgTok !== "-" && !imgTok.startsWith("va-") ? imgTok : undefined;
      const objNum = imgId ? imageObjects.get(imgId) : undefined;
      if (objNum && imgId) {
        const wUm = Number(isTable ? parts[9] : parts[8]) || 150000;
        const hUm = Number(isTable ? parts[10] : parts[9]) || 90000;
        const wPt = Math.min(cw - 8, (wUm / 25400) * 72);
        const hPt = Math.min(rowH - 12, Math.max(16, (hUm / 25400) * 72));
        const name = `Im${imgId.replace(/[^A-Za-z0-9]/g, "_")}`;
        s += `q ${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} ${(tableState.x + 4).toFixed(2)} ${(y - 8 - hPt).toFixed(2)} cm /${name} Do Q\n`;
      }
      const gap = isTable ? 0 : Number(parts[6]) || 0;
      tableState.x += cw + gap;
      cursorX = tableState.x;
      continue;
    }
    if (line.style.startsWith("image ")) {
      const parts = line.style.split(" ");
      const assetId = parts[1];
      const wUm = Number(parts[2]) || 150000;
      const hUm = Number(parts[3]) || 90000;
      const objNum = imageObjects.get(assetId);
      const maxW = pageWidthPt - marginPt * 2;
      const maxH = Math.max(24, y - marginPt);
      const { wPt, hPt } = pdfImageDisplayPt(wUm, hUm, maxW, maxH);
      if (!objNum) {
        s += `BT /F1 9 Tf 1 0 0 1 ${marginPt} ${y} Tm (${pdfEscape(`[missing image ${assetId}]`)}) Tj ET\n`;
        continue;
      }
      const x = line.align === "center"
        ? (pageWidthPt - wPt) / 2
        : line.align === "right"
          ? pageWidthPt - marginPt - wPt
          : marginPt;
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
        s += mathOps(mathSeg.math, x, y, "F3", "F2");
      }
      cursorX = marginPt;
      continue;
    }

    const segs = line.segments;
    let x = marginPt;
    if (line.align === "center" || line.align === "right") {
      let w = 0;
      for (const seg of segs) {
        w += seg.kind === "text" ? segmentWidthPt(seg.text, seg.sizePt, seg.face) : seg.kind === "math" ? seg.math.widthPt : 0;
      }
      x = line.align === "center" ? (pageWidthPt - w) / 2 : pageWidthPt - marginPt - w;
    }
    cursorX = x;
    const firstText = segs.find((seg) => seg.kind === "text" && seg.text.length > 0);
    const sizePt = line.sizePt || (firstText && firstText.kind === "text" ? firstText.sizePt : 11);
    let inText = false;
    for (const seg of segs) {
      if (seg.kind === "text" && seg.text.length === 0) continue;
      if (seg.kind === "text") {
        const painted = paintTextRun(seg.text, cursorX, y, paintOpts(seg, sizePt, false));
        s += painted.ops;
        cursorX += painted.width;
        inText = true;
      } else if (seg.kind === "math") {
        s += mathOps(seg.math, cursorX + 4, y, "F3", "F2");
        cursorX += seg.math.widthPt + 8;
        inText = true;
      }
    }
    void inText;
  }
  return { stream: s };
}

function paintOpts(seg: TextSegment, fallbackSize: number, whiteFg: boolean) {
  return {
    sizePt: seg.sizePt || fallbackSize,
    face: seg.face,
    color: seg.color || (whiteFg ? "#ffffff" : undefined),
    background: seg.background,
    underline: seg.underline,
    strike: seg.strike,
  };
}

function splitCellRows(segs: PdfLine["segments"]): PdfLine["segments"][] {
  const rows: PdfLine["segments"][] = [[]];
  for (const seg of segs) {
    if (seg.kind === "rule") rows.push([]);
    else rows[rows.length - 1]!.push(seg);
  }
  return rows.filter((r) => r.length);
}

function cellRowAdvance(rowSegs: PdfLine["segments"], fallback: number): number {
  let h = fallback;
  for (const seg of rowSegs) {
    if (seg.kind === "math") {
      const e = mathVisualExtents(seg.math);
      h = Math.max(h, e.abovePt + e.belowPt);
    } else if (seg.kind === "text") h = Math.max(h, seg.sizePt + 3);
  }
  return h;
}

function mathOps(math: MathBox, x: number, y: number, f1: string, f2: string): string {
  const ext = mathVisualExtents(math);
  const boxX = x - MATH_CHIP_PAD_X;
  const boxY = y - ext.belowPt;
  const boxW = math.widthPt + MATH_CHIP_PAD_X * 2;
  const boxH = ext.abovePt + ext.belowPt;
  let s = `0.4 w 0.97 0.97 0.98 rg 0.72 0.74 0.78 RG ${boxX.toFixed(2)} ${boxY.toFixed(2)} ${boxW.toFixed(2)} ${boxH.toFixed(2)} re B\n0 0 0 rg 0 0 0 RG\n`;
  const ox = x;
  for (const r of math.runs) {
    const fn = r.font === "Symbol" ? f2 : f1;
    s += `BT /${fn} ${r.sizePt.toFixed(2)} Tf 1 0 0 1 ${(ox + r.xPt).toFixed(2)} ${(y + r.yPt).toFixed(2)} Tm ${pdfLiteralString(r.text)} Tj ET\n`;
  }
  for (const rl of math.rules) {
    s += `0.6 w 0 0 0 RG 0 0 0 rg ${(x + rl.xPt).toFixed(2)} ${(y + rl.yPt - rl.heightPt / 2).toFixed(2)} ${rl.widthPt.toFixed(2)} ${rl.heightPt.toFixed(2)} re f S\n`;
  }
  for (const path of math.paths ?? []) {
    if (path.points.length < 2) continue;
    const p0 = path.points[0]!;
    s += `1 J 1 j ${path.widthPt.toFixed(2)} w 0 0 0 RG ${(x + p0.xPt).toFixed(2)} ${(y + p0.yPt).toFixed(2)} m`;
    for (let i = 1; i < path.points.length; i++) {
      const p = path.points[i]!;
      s += ` ${(x + p.xPt).toFixed(2)} ${(y + p.yPt).toFixed(2)} l`;
    }
    s += ` S\n0 J 0 j\n`;
  }
  return s;
}
