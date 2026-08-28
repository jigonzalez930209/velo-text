import {
  createColumns,
  createDocument,
  createEquation,
  createEquationBlock,
  createHeading,
  createIdGenerator,
  createImageBlock,
  createParagraph,
  createTable,
  createText,
  createVariable,
  type IdGenerator,
  type PortableDocument,
} from "velo-text";
import { samplePngBytes, sampleSvgBytes } from "./seed-assets.ts";

export const PLAYGROUND_LS = "pde-playground-doc-v4";
const PNG_ID = "asset_png_demo";
const SVG_ID = "asset_svg_demo";

function tx(g: IdGenerator, text: string, marks?: Parameters<typeof createText>[2]) {
  return createText(g, text, marks);
}

function fillTable(g: IdGenerator, rows: string[][]): ReturnType<typeof createTable> {
  const t = createTable(g, rows[0]?.length ?? 2, rows.length);
  t.rows.forEach((row, ri) => {
    row.header = ri === 0;
    row.cells.forEach((cell, ci) => {
      const p = cell.blocks[0];
      if (p && p.type === "paragraph" && p.children[0]?.type === "text") p.children[0].text = rows[ri]?.[ci] ?? "";
    });
  });
  return t;
}

export function buildSampleDocument(): { doc: PortableDocument; bytes: Record<string, Uint8Array> } {
  const g = createIdGenerator("play");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => new Date().toISOString() } });
  doc.metadata.title = "Playground kitchen sink";
  doc.variableSchema = { name: "string", total: "number", date: "date" };

  const png = samplePngBytes();
  const svg = sampleSvgBytes("SVG mark", "#0f766e");
  doc.assets[PNG_ID] = {
    id: PNG_ID, kind: "image", mediaType: "image/png",
    storageKey: "playground/png", sha256: "0".repeat(64), byteLength: png.length, alt: "PNG banner",
  };
  doc.assets[SVG_ID] = {
    id: SVG_ID, kind: "image", mediaType: "image/svg+xml",
    storageKey: "playground/svg", sha256: "1".repeat(64), byteLength: svg.length, alt: "SVG logo",
  };

  const cols = createColumns(g, [40, 60]);
  cols.columns[0]!.blocks = [createParagraph(g, [tx(g, "Narrow column — 40%. Lists, quotes and variables sit beside a wider pane.")])];
  cols.columns[1]!.blocks = [
    createParagraph(g, [tx(g, "Wide column — 60%. "), createVariable(g, "customer.name", "{{customer.name}}", { valueType: "string" })]),
    createParagraph(g, [tx(g, "Nested note with indent.", { italic: true })], { indentLevel: 1 }),
  ];

  doc.root.children = [
    createHeading(g, 1, [tx(g, "Kitchen sink")]),
    createParagraph(g, [
      tx(g, "Every block and mark the editor ships: headings, "),
      tx(g, "bold", { bold: true }), tx(g, ", "),
      tx(g, "italic", { italic: true }), tx(g, ", "),
      tx(g, "underline", { underline: true }), tx(g, ", "),
      tx(g, "strike", { strike: true }), tx(g, ", "),
      tx(g, "code", { code: true }), tx(g, ", color, size, fonts, lists, table, columns, images, SVG, equations, link, break, HR."),
    ]),
    createHeading(g, 2, [tx(g, "Headings")]),
    createHeading(g, 3, [tx(g, "Heading 3")]),
    createHeading(g, 4, [tx(g, "Heading 4")]),
    createParagraph(g, [tx(g, "Body 12pt default. Next runs change size and color.")]),
    createParagraph(g, [
      tx(g, "11pt muted ", { fontSizePt: 11, color: "#667085" }),
      tx(g, "14pt primary ", { fontSizePt: 14, color: "#3659e3", bold: true }),
      tx(g, "18pt serif", { fontSizePt: 18, fontFamily: "serif" }),
    ]),
    createParagraph(g, [tx(g, "Highlight + link: "), { type: "link", id: g.next(), href: "https://example.com", children: [tx(g, "example.com")] }], { align: "left" }),
    createParagraph(g, [tx(g, "Centered caption")], { align: "center" }),
    createParagraph(g, [tx(g, "Right-aligned line")], { align: "right" }),
    createParagraph(g, [tx(g, "Justified: a longer sentence so wrapping shows even edges across the measure of the page.")], { align: "justify" }),
    createHeading(g, 2, [tx(g, "Code sample")]),
    createParagraph(g, [tx(g, "const n = {{total}}; // inline code + variable", { code: true, fontFamily: "monospace", fontSizePt: 12, background: "#f7f8fa" })]),
    createHeading(g, 2, [tx(g, "Quote and lists")]),
    { type: "quote", id: g.next(), children: [tx(g, "Quotes keep a left bar and extra padding so they do not sit flush with the paper.") ] },
    {
      type: "list", id: g.next(), kind: "unordered",
      items: [
        { id: g.next(), content: [tx(g, "Unordered item")] },
        { id: g.next(), content: [tx(g, "Nested parent")], nested: {
          type: "list", id: g.next(), kind: "ordered",
          items: [{ id: g.next(), content: [tx(g, "Nested ordered")] }],
        } },
      ],
    },
    createHeading(g, 2, [tx(g, "Variables")]),
    createParagraph(g, [
      tx(g, "Hello "), createVariable(g, "name", "{{name}}", { valueType: "string" }),
      tx(g, ", total "), createVariable(g, "total", "{{total | currency:ARS}}", { valueType: "number", format: "currency:ARS" }),
      tx(g, ", date "), createVariable(g, "date", "{{date | date:dd/MM/yyyy}}", { valueType: "date", format: "date:dd/MM/yyyy" }),
      tx(g, "."),
    ]),
    createHeading(g, 2, [tx(g, "Table")]),
    (() => {
      const t = fillTable(g, [["Item", "Qty", "Mark"], ["Widget", "2", "ok"], ["Gadget", "5", "hold"]]);
      t.style = { density: "normal", preset: "grid-banded", look: { headerRow: true, bandedRows: true } };
      t.rows[1]!.cells[2]!.blocks = [
        createImageBlock(g, SVG_ID, { alt: "SVG in cell", widthUm: 50000, heightUm: 20000 }),
      ];
      t.rows[2]!.cells[0]!.style = { background: "#fde68a" };
      return t;
    })(),
    createHeading(g, 2, [tx(g, "Custom layout")]),
    cols,
    createHeading(g, 2, [tx(g, "Images")]),
    createImageBlock(g, PNG_ID, { alt: "PNG banner", widthUm: 120000, heightUm: 40000, align: "left", title: "Raster PNG" }),
    createImageBlock(g, SVG_ID, { alt: "SVG logo", widthUm: 100000, heightUm: 40000, align: "center", title: "Vector SVG" }),
    createParagraph(g, [
      tx(g, "Inline image "),
      { type: "inline-image", id: g.next(), assetId: SVG_ID, widthUm: 12000, heightUm: 8000 },
      tx(g, " next to text."),
    ]),
    createHeading(g, 2, [tx(g, "Equations")]),
    createParagraph(g, [
      tx(g, "Inline: "), createEquation(g, "a^2 + b^2 = c^2"),
      tx(g, " and "), createEquation(g, "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"),
    ]),
    createEquationBlock(g, "\\sum \\frac{1}{n^2} = \\frac{\\pi^2}{6}", "Basel"),
    createHeading(g, 2, [tx(g, "Breaks")]),
    { type: "horizontal-rule", id: g.next() },
    createParagraph(g, [tx(g, "Line"), { type: "hard-break", id: g.next() }, tx(g, "after a hard break.")]),
    { type: "page-break", id: g.next() },
    createHeading(g, 1, [tx(g, "After page break")]),
    createParagraph(g, [tx(g, "Use Ctrl+Shift+P, slash menu, or the Insert panel for the same actions as this sample.")]),
  ];

  return { doc, bytes: { [PNG_ID]: png, [SVG_ID]: svg } };
}
