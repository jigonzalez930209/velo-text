/**
 * DocxWriter — Fase 9
 * Paquete Open XML: [Content_Types].xml, _rels/.rels, word/document.xml, word/styles.xml, word/settings.xml, word/_rels/document.xml.rels, word/media/*, docProps/*
 */
import { XmlWriter } from "../xml/writer.js";
import { ZipWriter } from "../zip/zipWriter.js";
import type { PortableDocument, BinarySink, Clock } from "../../core/model/types.js";

interface ResolvedAssetStub {
  id: string;
  mediaType: string;
  data?: Uint8Array;
}

export class DocxWriter {
  private readonly clock: Clock;
  constructor(opts: { clock?: Clock } = {}) {
    this.clock = opts.clock ?? { nowIso: () => new Date().toISOString() };
  }

  async write(document: PortableDocument, assets: Record<string, ResolvedAssetStub> | null, sink: BinarySink): Promise<{ byteLength: number }> {
    const zip = new ZipWriter();
    zip.add("[Content_Types].xml", this.buildContentTypes(document));
    zip.add("_rels/.rels", this.buildRels());
    zip.add("word/document.xml", this.buildDocument(document));
    zip.add("word/styles.xml", this.buildStyles());
    zip.add("word/settings.xml", this.buildSettings());
    zip.add("word/_rels/document.xml.rels", this.buildDocRels(document));
    zip.add("docProps/core.xml", this.buildCoreProps(document));
    zip.add("docProps/app.xml", this.buildAppProps());

    const assetMap: Record<string, ResolvedAssetStub> = assets ?? {};
    for (const [id, asset] of Object.entries(assetMap)) {
      if (asset.data) {
        const ext = asset.mediaType.split("/")[1]!.replace("jpeg", "jpg").replace("svg+xml", "svg");
        zip.add(`word/media/${id}.${ext}`, asset.data);
      }
    }

    const bytes = zip.build();
    await sink.write(bytes);
    await sink.close?.();
    return { byteLength: bytes.length };
  }

  private buildContentTypes(doc: PortableDocument): string {
    const w = new XmlWriter().declaration();
    w.open("Types", { xmlns: "http://schemas.openxmlformats.org/package/2006/content-types" });
    w.selfClose("Default", { Extension: "rels", ContentType: "application/vnd.openxmlformats-package.relationships+xml" });
    w.selfClose("Default", { Extension: "xml", ContentType: "application/xml" });
    w.selfClose("Override", { PartName: "/word/document.xml", ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" });
    w.selfClose("Override", { PartName: "/word/styles.xml", ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml" });
    w.selfClose("Override", { PartName: "/word/settings.xml", ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml" });
    w.selfClose("Override", { PartName: "/docProps/core.xml", ContentType: "application/vnd.openxmlformats-package.core-properties+xml" });
    w.selfClose("Override", { PartName: "/docProps/app.xml", ContentType: "application/vnd.openxmlformats-officedocument.extended-properties+xml" });
    const exts = new Set<string>();
    for (const a of Object.values(doc.assets ?? {})) {
      const ext = a.mediaType.split("/")[1]!.replace("jpeg", "jpg").replace("svg+xml", "svg");
      if (!exts.has(ext)) {
        exts.add(ext);
        const ct = a.mediaType === "image/svg+xml" ? "image/svg+xml" : `image/${ext}`;
        w.selfClose("Default", { Extension: ext, ContentType: ct });
      }
    }
    w.close();
    return w.toString();
  }

  private buildRels(): string {
    const w = new XmlWriter().declaration();
    w.open("Relationships", { xmlns: "http://schemas.openxmlformats.org/package/2006/relationships" });
    w.selfClose("Relationship", {
      Id: "rId1",
      Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
      Target: "word/document.xml",
    });
    w.selfClose("Relationship", { Id: "rId2", Type: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", Target: "docProps/core.xml" });
    w.selfClose("Relationship", { Id: "rId3", Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties", Target: "docProps/app.xml" });
    w.close();
    return w.toString();
  }

  private buildDocument(doc: PortableDocument): string {
    const w = new XmlWriter().declaration();
    w.open("w:document", {
      "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "xmlns:wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
      "xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "xmlns:pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
    });
    w.open("w:body");
    for (const block of doc.root.children) this.writeBlock(w, block as unknown as Record<string, unknown>, doc);
    // section props
    w.open("w:sectPr");
    w.selfClose("w:pgSz", { "w:w": "11906", "w:h": "16838" }); // A4 in twips
    w.selfClose("w:pgMar", { "w:top": "1134", "w:right": "1134", "w:bottom": "1134", "w:left": "1134" });
    w.close();
    w.close().close();
    return w.toString();
  }

  private writeBlock(w: XmlWriter, block: Record<string, unknown>, doc: PortableDocument): void {
    switch (block.type as string) {
      case "paragraph": {
        w.open("w:p");
        this.writeParagraphProps(w, block);
        for (const inl of (block.children as Array<Record<string, unknown>>) ?? []) this.writeInline(w, inl, doc);
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
        for (const inl of (block.children as Array<Record<string, unknown>>) ?? []) this.writeInline(w, inl, doc);
        w.close();
        break;
      }
      case "quote": {
        w.open("w:p");
        w.open("w:pPr").open("w:pStyle", { "w:val": "Quote" }).close().close();
        for (const inl of (block.children as Array<Record<string, unknown>>) ?? []) this.writeInline(w, inl, doc);
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
          this.writeInline(w, { type: "text", id: `${item.id as string}_t`, text } as unknown as Record<string, unknown>, doc);
          w.close();
          if (item.nested) this.writeBlock(w, item.nested as Record<string, unknown>, doc);
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
            for (const b of (cell.blocks as Array<Record<string, unknown>>) ?? []) this.writeBlock(w, b, doc);
            // ensure cell has at least one paragraph
            if (!cell.blocks || (cell.blocks as unknown[]).length === 0) w.open("w:p").close();
            w.close();
          }
          w.close();
        }
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
      default:
        w.open("w:p").open("w:r").open("w:t").text(`[${block.type as string}]`).close().close().close();
    }
  }

  private writeParagraphProps(w: XmlWriter, block: Record<string, unknown>): void {
    const align = block.align as string | undefined;
    if (align) {
      w.open("w:pPr");
      const map: Record<string, string> = { left: "left", center: "center", right: "right", justify: "both" };
      w.selfClose("w:jc", { "w:val": map[align] ?? align });
      w.close();
    }
  }

  private writeInline(w: XmlWriter, inl: Record<string, unknown>, _doc: PortableDocument): void {
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
      for (const c of (inl.children as Array<Record<string, unknown>>) ?? []) this.writeInline(w, c, _doc);
      w.close();
    } else if (inl.type === "hard-break") {
      w.open("w:r").selfClose("w:br").close();
    } else if (inl.type === "inline-image") {
      w.open("w:r").open("w:t").text(`[image ${inl.assetId as string}]`).close().close();
    }
  }

  private buildDocRels(doc: PortableDocument): string {
    const w = new XmlWriter().declaration();
    w.open("Relationships", { xmlns: "http://schemas.openxmlformats.org/package/2006/relationships" });
    let id = 1;
    for (const [assetId] of Object.entries(doc.assets ?? {})) {
      const asset = doc.assets[assetId]!;
      const ext = asset.mediaType.split("/")[1]!.replace("jpeg", "jpg").replace("svg+xml", "svg");
      w.selfClose("Relationship", {
        Id: `rId_${assetId}`,
        Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
        Target: `media/${assetId}.${ext}`,
      });
      id++;
    }
    // hyperlinks
    // collected via walk? simplified
    w.close();
    return w.toString();
  }

  private buildStyles(): string {
    const w = new XmlWriter().declaration();
    w.open("w:styles", { "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main" });
    for (const name of ["Normal", "Heading1", "Heading2", "Quote"]) {
      w.open("w:style", { "w:type": "paragraph", "w:styleId": name }).open("w:name", { "w:val": name }).close().close();
    }
    w.close();
    return w.toString();
  }

  private buildSettings(): string {
    const w = new XmlWriter().declaration();
    w.open("w:settings", { "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main" }).close();
    return w.toString();
  }

  private buildCoreProps(doc: PortableDocument): string {
    const w = new XmlWriter().declaration();
    w.open("cp:coreProperties", {
      "xmlns:cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
      "xmlns:dc": "http://purl.org/dc/elements/1.1/",
      "xmlns:dcterms": "http://purl.org/dc/terms/",
    });
    w.open("dc:title").text((doc.metadata?.title as string) ?? "Untitled").close();
    w.open("dcterms:created", { "xsi:type": "dcterms:W3CDTF" }).text(doc.createdAt).close();
    w.open("dcterms:modified", { "xsi:type": "dcterms:W3CDTF" }).text(doc.updatedAt).close();
    w.close();
    return w.toString();
  }

  private buildAppProps(): string {
    const w = new XmlWriter().declaration();
    w.open("Properties", { xmlns: "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" });
    w.open("Application").text("portable-doc-editor").close().close();
    return w.toString();
  }
}
