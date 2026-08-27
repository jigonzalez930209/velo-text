/**
 * DocxWriter — Phase 9
 * Open XML package: [Content_Types].xml, _rels/.rels, word/document.xml, styles, settings, rels, media, docProps.
 */
import { ZipWriter } from "../zip/zipWriter.js";
import type { PortableDocument, BinarySink, Clock } from "../../core/model/types.js";
import { buildDocument } from "./document-xml.js";
import {
  buildAppProps,
  buildContentTypes,
  buildCoreProps,
  buildDocRels,
  buildRels,
  buildSettings,
  buildStyles,
} from "./package-parts.js";

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

  async write(
    document: PortableDocument,
    assets: Record<string, ResolvedAssetStub> | null,
    sink: BinarySink,
  ): Promise<{ byteLength: number }> {
    void this.clock;
    const zip = new ZipWriter();
    zip.add("[Content_Types].xml", buildContentTypes(document));
    zip.add("_rels/.rels", buildRels());
    zip.add("word/document.xml", buildDocument(document));
    zip.add("word/styles.xml", buildStyles());
    zip.add("word/settings.xml", buildSettings());
    zip.add("word/_rels/document.xml.rels", buildDocRels(document));
    zip.add("docProps/core.xml", buildCoreProps(document));
    zip.add("docProps/app.xml", buildAppProps());

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
}
