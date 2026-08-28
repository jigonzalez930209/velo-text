/**
 * OdtWriter — Phase 8
 * ODF 1.3: mimetype STORE first, META-INF/manifest.xml, content.xml, styles.xml, meta.xml, settings.xml
 */
import { XmlWriter } from "../xml/writer.js";
import { ZipWriter } from "../zip/zipWriter.js";
import type { PortableDocument, BinarySink, Clock } from "../../core/model/types.js";
import { prepareExportImages } from "../images/prepare.js";

interface ResolvedAssetStub {
  id: string;
  mediaType: string;
  data?: Uint8Array;
}

export class OdtWriter {
  private readonly clock: Clock;
  constructor(opts: { clock?: Clock } = {}) {
    this.clock = opts.clock ?? { nowIso: () => new Date().toISOString() };
  }

  async write(document: PortableDocument, assets: Record<string, ResolvedAssetStub> | null, sink: BinarySink): Promise<{ byteLength: number }> {
    const zip = new ZipWriter();
    zip.add("mimetype", "application/vnd.oasis.opendocument.text", { method: 0 });
    zip.add("META-INF/manifest.xml", this.buildManifest(document));
    zip.add("content.xml", this.buildContent(document));
    zip.add("styles.xml", this.buildStyles(document));
    zip.add("meta.xml", this.buildMeta(document));
    zip.add("settings.xml", this.buildSettings());

    const input: Record<string, { id: string; mediaType: string; data: Uint8Array }> = {};
    for (const [id, asset] of Object.entries(assets ?? {})) {
      if (asset.data) input[id] = { id, mediaType: asset.mediaType, data: asset.data };
    }
    const prepared = await prepareExportImages(document, input);
    for (const [id, asset] of Object.entries(prepared)) {
      const ext = asset.mediaType.split("/")[1]!.replace("svg+xml", "svg");
      zip.add(`Pictures/${id}.${ext}`, asset.data);
    }

    const bytes = zip.build();
    await sink.write(bytes);
    await sink.close?.();
    return { byteLength: bytes.length };
  }

  private buildManifest(doc: PortableDocument): string {
    const w = new XmlWriter().declaration();
    w.open("manifest:manifest", { "xmlns:manifest": "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" });
    w.selfClose("manifest:file-entry", { "manifest:full-path": "/", "manifest:media-type": "application/vnd.oasis.opendocument.text" });
    w.selfClose("manifest:file-entry", { "manifest:full-path": "content.xml", "manifest:media-type": "text/xml" });
    w.selfClose("manifest:file-entry", { "manifest:full-path": "styles.xml", "manifest:media-type": "text/xml" });
    w.selfClose("manifest:file-entry", { "manifest:full-path": "meta.xml", "manifest:media-type": "text/xml" });
    w.selfClose("manifest:file-entry", { "manifest:full-path": "settings.xml", "manifest:media-type": "text/xml" });
    for (const [id, a] of Object.entries(doc.assets ?? {})) {
      const ext = a.mediaType.split("/")[1]!.replace("svg+xml", "svg");
      w.selfClose("manifest:file-entry", { "manifest:full-path": `Pictures/${id}.${ext}`, "manifest:media-type": a.mediaType });
    }
    w.close();
    return w.toString();
  }

  private buildContent(doc: PortableDocument): string {
    const w = new XmlWriter().declaration();
    w.open("office:document-content", {
      "xmlns:office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
      "xmlns:text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
      "xmlns:draw": "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
      "xmlns:fo": "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
      "xmlns:style": "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
      "xmlns:svg": "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0",
      "xmlns:xlink": "http://www.w3.org/1999/xlink",
      "office:version": "1.3",
    });
    w.open("office:body").open("office:text");
    for (const block of doc.root.children) this.writeBlock(w, block as unknown as Record<string, unknown>, doc);
    w.close().close().close();
    return w.toString();
  }

  private writeBlock(w: XmlWriter, block: Record<string, unknown>, doc: PortableDocument): void {
    switch (block.type as string) {
      case "paragraph": {
        w.open("text:p", { "text:style-name": "Standard" });
        for (const inl of (block.children as Array<Record<string, unknown>>) ?? []) this.writeInline(w, inl, doc);
        w.close();
        break;
      }
      case "heading": {
        const level = (block.level as number) ?? 1;
        w.open("text:h", { "text:style-name": `Heading_${level}`, "text:outline-level": String(level) });
        for (const inl of (block.children as Array<Record<string, unknown>>) ?? []) this.writeInline(w, inl, doc);
        w.close();
        break;
      }
      case "quote": {
        w.open("text:p", { "text:style-name": "Quotations" });
        for (const inl of (block.children as Array<Record<string, unknown>>) ?? []) this.writeInline(w, inl, doc);
        w.close();
        break;
      }
      case "list": {
        const kind = (block.kind as string) === "ordered" ? "Numbered" : "Bulleted";
        w.open("text:list", { "text:style-name": kind });
        for (const item of (block.items as Array<Record<string, unknown>>) ?? []) {
          w.open("text:list-item").open("text:p", { "text:style-name": "Standard" });
          for (const c of (item.content as Array<Record<string, unknown>>) ?? []) this.writeInline(w, c, doc);
          w.close().close();
          if (item.nested) this.writeBlock(w, item.nested as Record<string, unknown>, doc);
        }
        w.close();
        break;
      }
      case "table": {
        w.open("table:table", { "table:name": block.id as string, "table:style-name": "Table1" });
        for (const _col of (block.columns as unknown[]) ?? []) w.selfClose("table:table-column", { "table:style-name": "TableColumn" });
        for (const row of (block.rows as Array<Record<string, unknown>>) ?? []) {
          w.open("table:table-row");
          for (const cell of (row.cells as Array<Record<string, unknown>>) ?? []) {
            w.open("table:table-cell", {
              "table:style-name": "TableCell",
              "table:number-columns-spanned": String((cell.colSpan as number) ?? 1),
              "table:number-rows-spanned": String((cell.rowSpan as number) ?? 1),
            });
            for (const b of (cell.blocks as Array<Record<string, unknown>>) ?? []) this.writeBlock(w, b, doc);
            w.close();
          }
          w.close();
        }
        w.close();
        break;
      }
      case "columns": {
        w.open("table:table", { "table:name": block.id as string, "table:style-name": "Table1" });
        for (const _col of (block.columns as unknown[]) ?? []) w.selfClose("table:table-column", { "table:style-name": "TableColumn" });
        w.open("table:table-row");
        for (const col of (block.columns as Array<Record<string, unknown>>) ?? []) {
          w.open("table:table-cell", { "table:style-name": "TableCell" });
          for (const b of (col.blocks as Array<Record<string, unknown>>) ?? []) this.writeBlock(w, b, doc);
          w.close();
        }
        w.close();
        w.close();
        break;
      }
      case "image": {
        const asset = doc.assets[block.assetId as string];
        if (!asset) {
          w.open("text:p").text(`[missing image ${block.assetId as string}]`).close();
          break;
        }
        const ext = asset.mediaType.split("/")[1]!.replace("svg+xml", "svg");
        const align = block.align === "center" || block.align === "right" ? (block.align as string) : "left";
        const para = align === "left" ? "Standard" : `Align_${align}`;
        const wCm = (((block.widthUm as number) ?? 150000) / 10_000).toFixed(2);
        const hCm = (((block.heightUm as number) ?? 90000) / 10_000).toFixed(2);
        w.open("text:p", { "text:style-name": para })
          .open("draw:frame", { "draw:name": block.id as string, "draw:style-name": "Graphics", "svg:width": `${wCm}cm`, "svg:height": `${hCm}cm` });
        w.selfClose("draw:image", {
          "xlink:href": `Pictures/${block.assetId as string}.${ext}`,
          "xlink:type": "simple",
          "xlink:show": "embed",
          "xlink:actuate": "onLoad",
        });
        w.close().close();
        break;
      }
      case "page-break":
        w.selfClose("text:page-break");
        break;
      case "horizontal-rule":
        w.open("text:p", { "text:style-name": "Horizontal_20_Line" }).text("---").close();
        break;
      case "equation-block": {
        // ODT does not have native LaTeX; use a styled paragraph with the raw LaTeX as fallback
        // Future: embed MathML if an ODT consumer requires it
        w.open("text:p", { "text:style-name": "Equation" });
        w.open("text:span", { "text:style-name": "Equation" }).text(`$${block.latex as string}$`).close();
        w.close();
        break;
      }
      default:
        w.open("text:p").text(`[${block.type as string}]`).close();
    }
  }

  private writeInline(w: XmlWriter, inl: Record<string, unknown>, doc: PortableDocument): void {
    if (inl.type === "text") {
      const txt = inl.text as string;
      const marks = inl.marks as Record<string, unknown> | undefined;
      const hasMarks = marks && Object.keys(marks).length > 0;
      if (hasMarks) {
        w.open("text:span", { "text:style-name": "Strong" });
        w.text(txt);
        w.close();
      } else w.text(txt);
    } else if (inl.type === "variable") {
      w.text(inl.source as string);
    } else if (inl.type === "link") {
      w.open("text:a", { "xlink:href": inl.href as string });
      for (const c of (inl.children as Array<Record<string, unknown>>) ?? []) this.writeInline(w, c, doc);
      w.close();
    } else if (inl.type === "hard-break") {
      w.selfClose("text:line-break");
    } else if (inl.type === "inline-image") {
      const a = doc.assets[inl.assetId as string];
      const ext = a ? a.mediaType.split("/")[1]! : "png";
      w.open("draw:frame", { "draw:name": inl.id as string })
        .selfClose("draw:image", { "xlink:href": `Pictures/${inl.assetId as string}.${ext}` })
        .close();
    } else if (inl.type === "equation") {
      // Inline equation — render as styled span with LaTeX fallback
      w.open("text:span", { "text:style-name": "Equation" }).text(`$${inl.latex as string}$`).close();
    } else w.text(`[${inl.type as string}]`);
  }

  private buildStyles(_doc: PortableDocument): string {
    const w = new XmlWriter().declaration();
    w.open("office:document-styles", {
      "xmlns:office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
      "xmlns:style": "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
      "xmlns:fo": "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
      "office:version": "1.3",
    });
    w.open("office:styles");
    w.open("style:default-style", { "style:family": "paragraph" }).selfClose("style:paragraph-properties").close();
    w.open("style:style", { "style:name": "Standard", "style:family": "paragraph" }).close();
    w.open("style:style", { "style:name": "Heading_1", "style:family": "paragraph", "style:parent-style-name": "Standard" }).close();
    for (const a of ["center", "right"] as const) {
      w.open("style:style", { "style:name": `Align_${a}`, "style:family": "paragraph", "style:parent-style-name": "Standard" });
      w.selfClose("style:paragraph-properties", { "fo:text-align": a });
      w.close();
    }
    w.close().close();
    return w.toString();
  }

  private buildMeta(doc: PortableDocument): string {
    const w = new XmlWriter().declaration();
    w.open("office:document-meta", { "xmlns:office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0", "office:version": "1.3" });
    w.open("office:meta");
    w.open("meta:creation-date").text(doc.createdAt).close();
    w.open("dc:title", { "xmlns:dc": "http://purl.org/dc/elements/1.1/" }).text((doc.metadata?.title as string) ?? "Untitled").close();
    w.close().close();
    return w.toString();
  }

  private buildSettings(): string {
    const w = new XmlWriter().declaration();
    w.open("office:document-settings", { "xmlns:office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0", "office:version": "1.3" });
    w.open("office:settings").close().close();
    return w.toString();
  }
}
