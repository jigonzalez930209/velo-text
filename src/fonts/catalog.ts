/** Four document typefaces (Liberation OFL): same TTF bytes in editor @font-face and PDF FontFile2. */

export type DocumentFontId = "sans" | "serif" | "mono" | "display";
export type DocumentFontWeight = "regular" | "bold" | "italic" | "boldItalic";
export type OflFontKey =
  | "sans-regular" | "sans-bold" | "sans-italic" | "sans-boldItalic"
  | "serif-regular" | "serif-bold" | "serif-italic" | "serif-boldItalic"
  | "mono-regular" | "mono-bold" | "mono-italic" | "mono-boldItalic"
  | "display-regular" | "display-bold" | "display-italic" | "display-boldItalic";

/** PDF resource names Fa–Fp (regular+bold+italic+boldItalic × 4 families). */
export type PdfDocFace =
  | "Fa" | "Fb" | "Fi" | "Fj"
  | "Fc" | "Fd" | "Fk" | "Fl"
  | "Fe" | "Ff" | "Fm" | "Fn"
  | "Fg" | "Fh" | "Fo" | "Fp";

export interface DocumentFont {
  id: DocumentFontId;
  cssName: string;
  pdfFaceRegular: PdfDocFace;
  pdfFaceBold: PdfDocFace;
  pdfFaceItalic: PdfDocFace;
  pdfFaceBoldItalic: PdfDocFace;
  pdfBaseFontRegular: string;
  pdfBaseFontBold: string;
  pdfBaseFontItalic: string;
  pdfBaseFontBoldItalic: string;
  oflRegular: OflFontKey;
  oflBold: OflFontKey;
  oflItalic: OflFontKey;
  oflBoldItalic: OflFontKey;
  aliases: string[];
}

export const DEFAULT_DOCUMENT_FONT_ID: DocumentFontId = "sans";

export const DOCUMENT_FONTS: readonly DocumentFont[] = [
  {
    id: "sans", cssName: "Velo Sans",
    pdfFaceRegular: "Fa", pdfFaceBold: "Fb", pdfFaceItalic: "Fi", pdfFaceBoldItalic: "Fj",
    pdfBaseFontRegular: "LiberationSans", pdfBaseFontBold: "LiberationSans-Bold",
    pdfBaseFontItalic: "LiberationSans-Italic", pdfBaseFontBoldItalic: "LiberationSans-BoldItalic",
    oflRegular: "sans-regular", oflBold: "sans-bold", oflItalic: "sans-italic", oflBoldItalic: "sans-boldItalic",
    aliases: ["sans-serif", "sans", "system-ui"],
  },
  {
    id: "serif", cssName: "Velo Serif",
    pdfFaceRegular: "Fc", pdfFaceBold: "Fd", pdfFaceItalic: "Fk", pdfFaceBoldItalic: "Fl",
    pdfBaseFontRegular: "LiberationSerif", pdfBaseFontBold: "LiberationSerif-Bold",
    pdfBaseFontItalic: "LiberationSerif-Italic", pdfBaseFontBoldItalic: "LiberationSerif-BoldItalic",
    oflRegular: "serif-regular", oflBold: "serif-bold", oflItalic: "serif-italic", oflBoldItalic: "serif-boldItalic",
    aliases: ["serif"],
  },
  {
    id: "mono", cssName: "Velo Mono",
    pdfFaceRegular: "Fe", pdfFaceBold: "Ff", pdfFaceItalic: "Fm", pdfFaceBoldItalic: "Fn",
    pdfBaseFontRegular: "LiberationMono", pdfBaseFontBold: "LiberationMono-Bold",
    pdfBaseFontItalic: "LiberationMono-Italic", pdfBaseFontBoldItalic: "LiberationMono-BoldItalic",
    oflRegular: "mono-regular", oflBold: "mono-bold", oflItalic: "mono-italic", oflBoldItalic: "mono-boldItalic",
    aliases: ["monospace", "ui-monospace"],
  },
  {
    id: "display", cssName: "Velo Display",
    pdfFaceRegular: "Fg", pdfFaceBold: "Fh", pdfFaceItalic: "Fo", pdfFaceBoldItalic: "Fp",
    pdfBaseFontRegular: "LiberationSansNarrow", pdfBaseFontBold: "LiberationSansNarrow-Bold",
    pdfBaseFontItalic: "LiberationSansNarrow-Italic", pdfBaseFontBoldItalic: "LiberationSansNarrow-BoldItalic",
    oflRegular: "display-regular", oflBold: "display-bold", oflItalic: "display-italic", oflBoldItalic: "display-boldItalic",
    aliases: ["cursive", "fantasy"],
  },
];

const byAlias = new Map<string, DocumentFont>();
for (const f of DOCUMENT_FONTS) {
  byAlias.set(f.cssName.toLowerCase(), f);
  byAlias.set(f.id, f);
  for (const name of [
    f.pdfBaseFontRegular, f.pdfBaseFontBold, f.pdfBaseFontItalic, f.pdfBaseFontBoldItalic,
  ]) {
    byAlias.set(name.toLowerCase(), f);
  }
  for (const a of f.aliases) byAlias.set(a.toLowerCase(), f);
}

export function resolveDocumentFont(family?: string | null): DocumentFont | undefined {
  if (!family) return undefined;
  const key = family.replace(/['"]/g, "").split(",")[0]?.trim().toLowerCase();
  if (!key) return undefined;
  return byAlias.get(key);
}

export function defaultDocumentFont(): DocumentFont {
  return DOCUMENT_FONTS[0]!;
}

const FACE_FIELDS: Array<keyof Pick<DocumentFont,
  "pdfFaceRegular" | "pdfFaceBold" | "pdfFaceItalic" | "pdfFaceBoldItalic"
>> = ["pdfFaceRegular", "pdfFaceBold", "pdfFaceItalic", "pdfFaceBoldItalic"];

export function documentFontByFace(face: PdfDocFace): DocumentFont | undefined {
  return DOCUMENT_FONTS.find((f) => FACE_FIELDS.some((k) => f[k] === face));
}

export function isDocumentPdfFace(face: string): face is PdfDocFace {
  return /^F[a-p]$/.test(face);
}

export function oflKeyForFace(face: PdfDocFace): OflFontKey | undefined {
  for (const f of DOCUMENT_FONTS) {
    if (f.pdfFaceRegular === face) return f.oflRegular;
    if (f.pdfFaceBold === face) return f.oflBold;
    if (f.pdfFaceItalic === face) return f.oflItalic;
    if (f.pdfFaceBoldItalic === face) return f.oflBoldItalic;
  }
  return undefined;
}

export function weightForFace(face: PdfDocFace): DocumentFontWeight {
  for (const f of DOCUMENT_FONTS) {
    if (f.pdfFaceRegular === face) return "regular";
    if (f.pdfFaceBold === face) return "bold";
    if (f.pdfFaceItalic === face) return "italic";
    if (f.pdfFaceBoldItalic === face) return "boldItalic";
  }
  return "regular";
}

export function pdfBaseFontForFace(face: PdfDocFace): string | undefined {
  for (const f of DOCUMENT_FONTS) {
    if (f.pdfFaceRegular === face) return f.pdfBaseFontRegular;
    if (f.pdfFaceBold === face) return f.pdfBaseFontBold;
    if (f.pdfFaceItalic === face) return f.pdfBaseFontItalic;
    if (f.pdfFaceBoldItalic === face) return f.pdfBaseFontBoldItalic;
  }
  return undefined;
}

export function pdfDocFaceForMarks(bold?: boolean, italic?: boolean, family?: string): PdfDocFace | null {
  const resolved = resolveDocumentFont(family);
  const pick = (f: DocumentFont): PdfDocFace => {
    if (bold && italic) return f.pdfFaceBoldItalic;
    if (bold) return f.pdfFaceBold;
    if (italic) return f.pdfFaceItalic;
    return f.pdfFaceRegular;
  };
  if (resolved) return pick(resolved);
  if (family) return null;
  return pick(defaultDocumentFont());
}
