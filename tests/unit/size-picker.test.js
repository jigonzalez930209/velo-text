/**
 * Word-style table grid and mosaic picker.
 */
import { JSDOM } from "jsdom";
import { clampTableSize, openSizePicker, openMosaicPicker } from "../../dist/editor-web/controller/size-picker.js";

test("size-picker: clampTableSize enforces 4×10 max", () => {
  assert.deepEqual(clampTableSize(9, 99), { cols: 4, rows: 10 });
  assert.deepEqual(clampTableSize(0, 0), { cols: 1, rows: 1 });
});

test("size-picker: hover grid picks cols×rows", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><button id="a">t</button></body>`);
  globalThis.document = dom.window.document;
  const btn = dom.window.document.getElementById("a");
  let picked = null;
  openSizePicker(btn, {
    cols: 4,
    rows: 10,
    label: (c, r) => `Table ${c}×${r}`,
    onPick: (c, r) => { picked = [c, r]; },
  });
  const grid = dom.window.document.querySelector(".pde-size-picker-grid");
  assert(grid);
  const cell = [...grid.querySelectorAll("button")].find((b) => b.dataset.c === "3" && b.dataset.r === "5");
  cell.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: true }));
  assert(dom.window.document.querySelector(".pde-size-picker-label").textContent === "Table 3×5");
  cell.click();
  assert.deepEqual(picked, [3, 5]);
  assert(!dom.window.document.querySelector(".pde-size-picker"));
});

test("size-picker: mosaic insert uses per-row counts", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><button id="a">c</button></body>`);
  globalThis.document = dom.window.document;
  const btn = dom.window.document.getElementById("a");
  let mosaic = null;
  openMosaicPicker(btn, {
    presets: [{ label: "50/50", pcts: [50, 50] }],
    onPreset: () => {},
    onMosaic: (counts) => { mosaic = counts; },
  });
  const rows = [...dom.window.document.querySelectorAll(".pde-mosaic-row")];
  rows[0].querySelectorAll("button")[2].click();
  rows[1].querySelectorAll("button")[1].click();
  rows[2].querySelectorAll("button")[3].click();
  const insert = [...dom.window.document.querySelectorAll(".pde-size-picker-foot")].find((b) => b.textContent.includes("Insert mosaic"));
  insert.click();
  assert.deepEqual(mosaic, [3, 2, 4]);
});
