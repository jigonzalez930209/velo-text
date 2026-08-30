import {
  DOCUMENT_FONTS,
  type DocumentFontId,
  type DocumentFontWeight,
  type OflFontKey,
} from "./catalog.js";
import { OFL_FONT_BYTES } from "./ofl-bytes.js";
import { parseTtfMetrics, ttfCharWidth, ttfTextWidth } from "./ttf-metrics.js";

export { parseTtfMetrics, pdfWidths1000, ttfCharWidth, ttfTextWidth } from "./ttf-metrics.js";

const cache = new Map<OflFontKey, Uint8Array>();

function oflKeyForWeight(meta: (typeof DOCUMENT_FONTS)[number], weight: DocumentFontWeight): OflFontKey {
  switch (weight) {
    case "bold": return meta.oflBold;
    case "italic": return meta.oflItalic;
    case "boldItalic": return meta.oflBoldItalic;
    default: return meta.oflRegular;
  }
}

export function documentFontBytes(id: DocumentFontId, weight: DocumentFontWeight = "regular"): Uint8Array {
  const meta = DOCUMENT_FONTS.find((f) => f.id === id)!;
  const key = oflKeyForWeight(meta, weight);
  let b = cache.get(key);
  if (!b) {
    b = OFL_FONT_BYTES[key];
    if (!b) throw new Error(`missing OFL font: ${key}`);
    cache.set(key, b);
  }
  return b;
}

export function documentFontWidths(id: DocumentFontId, weight: DocumentFontWeight = "regular"): number[] {
  return parseTtfMetrics(documentFontBytes(id, weight)).widths;
}

function b64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

export function documentFontsCss(): string {
  const rules: string[] = [];
  for (const f of DOCUMENT_FONTS) {
    for (const [style, weight, w] of [
      ["normal", 400, "regular"],
      ["normal", 700, "bold"],
      ["italic", 400, "italic"],
      ["italic", 700, "boldItalic"],
    ] as const) {
      const data = b64(documentFontBytes(f.id, w));
      rules.push(
        `@font-face{font-family:"${f.cssName}";font-style:${style};font-weight:${weight};src:url(data:font/ttf;base64,${data}) format("truetype");font-display:swap;}`,
      );
    }
  }
  return rules.join("");
}

const STYLE_ID = "velo-document-fonts";

export function ensureDocumentFonts(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement("style");
  el.id = STYLE_ID;
  el.textContent = documentFontsCss();
  (doc.head ?? doc.documentElement).appendChild(el);
}
