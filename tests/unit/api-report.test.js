import {
  createDocument,
  createIdGenerator,
  createParagraph,
  createText,
  createVariable,
  createTable,
  createImageBlock,
} from "../../dist/public-api/index.js";
import { reportSlots, dataFromSlotValues, assetsFromSlotValues } from "../../dist/api-report/index.js";

function docWithBits() {
  const g = createIdGenerator("sl");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-28T12:00:00.000Z" } });
  const table = createTable(g, 2, 1);
  table.repeat = { path: "items", alias: "item", templateRowId: table.rows[0].id };
  table.rows[0].cells[0].blocks = [
    createParagraph(g, [createVariable(g, "item.name", "{{item.name}}", { valueType: "string" })]),
  ];
  doc.root.children = [
    createParagraph(g, [
      createText(g, "Hi "),
      createVariable(g, "customer.name", "{{customer.name}}", { valueType: "string" }),
    ]),
    table,
    createImageBlock(g, "logo"),
  ];
  return doc;
}

test("reportSlots lists variables, repeat tables, and images by tag", () => {
  const slots = reportSlots(docWithBits());
  const kinds = slots.map((s) => s.kind);
  assert(kinds.includes("variable"), "variable");
  assert(kinds.includes("table"), "table");
  assert(kinds.includes("table-repeat"), "repeat");
  assert(kinds.includes("image"), "image");
  const name = slots.find((s) => s.path === "customer.name");
  assert(name?.tag === "customer.name");
  const img = slots.find((s) => s.kind === "image");
  assert(img?.tag === "logo" && img.assetId === "logo");
  const rep = slots.find((s) => s.kind === "table-repeat");
  assert(rep?.tag === "items" && rep.repeat?.alias === "item");
});

test("dataFromSlotValues nests dotted tags", () => {
  const data = dataFromSlotValues({ "customer.name": "Ada", total: 9 });
  assert(data.total === 9);
  assert(data.customer && data.customer.name === "Ada");
});

test("assetsFromSlotValues keys bytes by asset id", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const assets = assetsFromSlotValues({ logo: { mediaType: "image/png", data: bytes } });
  assert(assets.logo.id === "logo");
  assert(assets.logo.data.length === 3);
});
