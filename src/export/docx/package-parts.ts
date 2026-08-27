import { XmlWriter } from "../xml/writer.js";
import type { PortableDocument } from "../../core/model/types.js";

export function buildContentTypes(doc: PortableDocument): string {
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

export function buildRels(): string {
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

export function buildDocRels(doc: PortableDocument): string {
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

export function buildStyles(): string {
    const w = new XmlWriter().declaration();
    w.open("w:styles", { "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main" });
    for (const name of ["Normal", "Heading1", "Heading2", "Quote"]) {
      w.open("w:style", { "w:type": "paragraph", "w:styleId": name }).open("w:name", { "w:val": name }).close().close();
    }
    w.close();
    return w.toString();
  }

export function buildSettings(): string {
    const w = new XmlWriter().declaration();
    w.open("w:settings", { "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main" }).close();
    return w.toString();
  }

export function buildCoreProps(doc: PortableDocument): string {
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

export function buildAppProps(): string {
    const w = new XmlWriter().declaration();
    w.open("Properties", { xmlns: "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" });
    w.open("Application").text("portable-doc-editor").close().close();
    return w.toString();
  }
