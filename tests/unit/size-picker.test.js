/**
 * Word-style table grid and mosaic picker.
 */
import { JSDOM } from "jsdom";
import { clampTableSize, openSizePicker, openMosaicPicker } from "../../dist/editor-web/controller/size-picker.js";
import { placeOverlay } from "../../dist/editor-web/controller/place-overlay.js";

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

test("placeOverlay: right-edge menus shift left so they stay on screen", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body></body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  Object.defineProperty(dom.window, "innerWidth", { value: 400, configurable: true });
  Object.defineProperty(dom.window, "innerHeight", { value: 600, configurable: true });
  const btn = dom.window.document.createElement("button");
  const menu = dom.window.document.createElement("div");
  menu.style.width = "220px";
  menu.style.height = "160px";
  dom.window.document.body.append(btn, menu);
  btn.getBoundingClientRect = () => ({ left: 370, right: 396, top: 8, bottom: 36, width: 26, height: 28, x: 370, y: 8, toJSON() {} });
  let measure = 0;
  menu.getBoundingClientRect = () => {
    measure += 1;
    if (measure === 1) return { left: 8, right: 228, top: 8, bottom: 168, width: 220, height: 160, x: 8, y: 8, toJSON() {} };
    const left = Number.parseFloat(menu.style.left) || 0;
    return { left, right: left + 220, top: 40, bottom: 200, width: 220, height: 160, x: left, y: 40, toJSON() {} };
  };
  Object.defineProperty(menu, "scrollWidth", { value: 220 });
  Object.defineProperty(menu, "offsetWidth", { value: 220 });
  Object.defineProperty(menu, "scrollHeight", { value: 160 });
  Object.defineProperty(menu, "offsetHeight", { value: 160 });
  placeOverlay(btn, menu);
  const left = Number.parseFloat(menu.style.left);
  assert(left + 220 <= 400, `menu overflows: left=${left}`);
  assert(left <= 370, "menu should align toward the left of a right-side icon");
  assert(menu.parentElement === dom.window.document.body);
});
