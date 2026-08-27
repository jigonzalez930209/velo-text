import { XmlWriter } from "../xml/writer.js";
import type { PortableDocument } from "../../core/model/types.js";

export function buildDocument(doc: PortableDocument): string {
    const w = new XmlWriter().declaration();
    w.open("w:document", {
      "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "xmlns:wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
      "xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "xmlns:pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
    });
    w.open("w:body");
    for (const block of doc.root.children) writeBlock(w, block as unknown as Record<string, unknown>, doc);
    // section props
    w.open("w:sectPr");
    w.selfClose("w:pgSz", { "w:w": "11906", "w:h": "16838" }); // A4 in twips
    w.selfClose("w:pgMar", { "w:top": "1134", "w:right": "1134", "w:bottom": "1134", "w:left": "1134" });
    w.close();
    w.close().close();
    return w.toString();
  }

function writeBlock(w: XmlWriter, block: Record<string, unknown>, doc: PortableDocument): void {
    switch (block.type as string) {
      case "paragraph": {
        w.open("w:p");
        writeParagraphProps(w, block);
        for (const inl of (block.children as Array<Record<string, unknown>>) ?? []) writeInline(w, inl, doc);
        // ensure at least one run if empty
        if (!block.children || (block.children as unknown[]).length === 0) {
          w.open("w:r").open("w:t").text("").close().close();
        }
        w.close();
        break;
      }
      case "heading": {
        const level = (block.level as number) ?? 1;
        w.open("w:p");
        w.open("w:pPr").open("w:pStyle", { "w:val": `Heading${level}` }).close().close();
        for (const inl of (block.children as Array<Record<string, unknown>>) ?? []) writeInline(w, inl, doc);
        w.close();
        break;
      }
      case "quote": {
        w.open("w:p");
        w.open("w:pPr").open("w:pStyle", { "w:val": "Quote" }).close().close();
        for (const inl of (block.children as Array<Record<string, unknown>>) ?? []) writeInline(w, inl, doc);
        w.close();
        break;
      }
      case "list": {
        for (const item of (block.items as Array<Record<string, unknown>>) ?? []) {
          w.open("w:p");
          w.open("w:pPr");
          // simple list styling via numPr placeholder
          w.open("w:numPr").selfClose("w:ilvl", { "w:val": "0" }).selfClose("w:numId", { "w:val": block.kind === "ordered" ? "1" : "2" }).close();
          w.close();
          const text = (item.content as Array<Record<string, unknown>>)?.map((c) => (c.text as string) ?? (c.source as string) ?? "").join("") ?? "";
          writeInline(w, { type: "text", id: `${item.id as string}_t`, text } as unknown as Record<string, unknown>, doc);
          w.close();
          if (item.nested) writeBlock(w, item.nested as Record<string, unknown>, doc);
        }
        break;
      }
      case "table": {
        w.open("w:tbl");
        w.open("w:tblPr").selfClose("w:tblW", { "w:w": "0", "w:type": "auto" }).close();
        // grid
        w.open("w:tblGrid");
        for (const _col of (block.columns as unknown[]) ?? []) w.selfClose("w:gridCol", { "w:w": "3000" });
        w.close();
        for (const row of (block.rows as Array<Record<string, unknown>>) ?? []) {
          w.open("w:tr");
          for (const cell of (row.cells as Array<Record<string, unknown>>) ?? []) {
            w.open("w:tc");
            w.open("w:tcPr");
            if ((cell.colSpan as number) > 1) w.selfClose("w:gridSpan", { "w:val": String(cell.colSpan) });
            if ((cell.rowSpan as number) > 1) w.selfClose("w:vMerge", { "w:val": "restart" });
            w.close();
            for (const b of (cell.blocks as Array<Record<string, unknown>>) ?? []) writeBlock(w, b, doc);
            // ensure cell has at least one paragraph
            if (!cell.blocks || (cell.blocks as unknown[]).length === 0) w.open("w:p").close();
            w.close();
          }
          w.close();
        }
        w.close();
        break;
      }
      case "columns": {
        w.open("w:tbl");
        w.open("w:tblPr").selfClose("w:tblW", { "w:w": "0", "w:type": "auto" }).close();
        w.open("w:tblGrid");
        for (const _col of (block.columns as unknown[]) ?? []) w.selfClose("w:gridCol", { "w:w": "4500" });
        w.close();
        w.open("w:tr");
        for (const col of (block.columns as Array<Record<string, unknown>>) ?? []) {
          w.open("w:tc");
          w.open("w:tcPr").close();
          for (const b of (col.blocks as Array<Record<string, unknown>>) ?? []) writeBlock(w, b, doc);
          if (!col.blocks || (col.blocks as unknown[]).length === 0) w.open("w:p").close();
          w.close();
        }
        w.close();
        w.close();
        break;
      }
      case "image": {
        const asset = doc.assets[block.assetId as string];
        if (!asset) {
          w.open("w:p").open("w:r").open("w:t").text(`[missing image ${block.assetId as string}]`).close().close().close();
          break;
        }
        w.open("w:p").open("w:r").open("w:drawing");
        // inline image — simplify EMU conversion: 1px ~ 9525 EMU
        const widthEmu = 2_000_000;
        const heightEmu = 1_200_000;
        w.open("wp:inline", { distT: "0", distB: "0", distL: "0", distR: "0" });
        w.selfClose("wp:extent", { cx: String(widthEmu), cy: String(heightEmu) });
        w.selfClose("wp:docPr", { id: "1", name: block.id as string, descr: asset.alt ?? "" });
        w.open("a:graphic").open("a:graphicData", { uri: "http://schemas.openxmlformats.org/drawingml/2006/picture" });
        w.open("pic:pic");
        w.open("pic:nvPicPr").selfClose("pic:cNvPr", { id: "0", name: asset.alt ?? "" }).selfClose("pic:cNvPicPr").close();
        w.open("pic:blipFill").selfClose("a:blip", { "r:embed": `rId_${block.assetId as string}` }).open("a:stretch").selfClose("a:fillRect").close().close();
        w.open("pic:spPr").selfClose("a:xfrm").open("a:prstGeom", { prst: "rect" }).selfClose("a:avLst").close().close();
        // close pic:pic, a:graphicData, a:graphic, wp:inline, w:drawing, w:r, w:p  = 7 closes
        w.close().close().close().close().close().close().close();
        break;
      }
      case "page-break": {
        w.open("w:p").open("w:r").selfClose("w:br", { "w:type": "page" }).close().close();
        break;
      }
      case "horizontal-rule": {
        w.open("w:p").open("w:pPr").open("w:pBdr").open("w:bottom", { "w:val": "single", "w:sz": "6", "w:space": "1", "w:color": "999999" }).close().close().close();
        w.open("w:r").open("w:t").text("").close().close().close();
        break;
      }
      case "equation-block": {
        // DOCX OfficeMath fallback: render LaTeX as italic text inside centered paragraph
        // Future: emit <m:oMath> for native equation support
        w.open("w:p");
        w.open("w:pPr").selfClose("w:jc", { "w:val": "center" }).close();
        w.open("w:r");
        w.open("w:rPr").selfClose("w:i").close();
        w.open("w:t", { "xml:space": "preserve" }).text(`$${(block as unknown as { latex: string }).latex}$`).close().close().close();
        break;
      }
      default:
        w.open("w:p").open("w:r").open("w:t").text(`[${block.type as string}]`).close().close().close();
    }
  }

function writeParagraphProps(w: XmlWriter, block: Record<string, unknown>): void {
    const align = block.align as string | undefined;
    if (align) {
      w.open("w:pPr");
      const map: Record<string, string> = { left: "left", center: "center", right: "right", justify: "both" };
      w.selfClose("w:jc", { "w:val": map[align] ?? align });
      w.close();
    }
  }

function writeInline(w: XmlWriter, inl: Record<string, unknown>, _doc: PortableDocument): void {
    if (inl.type === "text") {
      w.open("w:r");
      const marks = inl.marks as Record<string, unknown> | undefined;
      if (marks && Object.keys(marks).length) {
        w.open("w:rPr");
        if (marks.bold) w.selfClose("w:b");
        if (marks.italic) w.selfClose("w:i");
        if (marks.underline) w.selfClose("w:u", { "w:val": "single" });
        if (marks.strike) w.selfClose("w:strike");
        if (marks.code) w.selfClose("w:rStyle", { "w:val": "Code" });
        if (marks.color) w.open("w:color", { "w:val": String(marks.color).replace("#", "").slice(0, 6) }).close();
        w.close();
      }
      w.open("w:t", { "xml:space": "preserve" }).text(inl.text as string).close().close();
    } else if (inl.type === "variable") {
      w.open("w:r").open("w:t", { "xml:space": "preserve" }).text(inl.source as string).close().close();
    } else if (inl.type === "link") {
      w.open("w:hyperlink", { "r:id": `rId_link_${inl.id as string}`, "w:history": "1" });
      for (const c of (inl.children as Array<Record<string, unknown>>) ?? []) writeInline(w, c, _doc);
      w.close();
    } else if (inl.type === "hard-break") {
      w.open("w:r").selfClose("w:br").close();
    } else if (inl.type === "inline-image") {
      w.open("w:r").open("w:t").text(`[image ${inl.assetId as string}]`).close().close();
    } else if (inl.type === "equation") {
      w.open("w:r");
      w.open("w:rPr").selfClose("w:i").close();
      w.open("w:t", { "xml:space": "preserve" }).text(`$${(inl as unknown as { latex: string }).latex}$`).close().close();
    }
  }
