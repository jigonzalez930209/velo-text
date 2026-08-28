import { JSDOM } from "jsdom";
import { keepBlocksOnPage } from "../../dist/editor-web/ux/page-preview.js";

test("page-keep: image that would split is pushed to the next page", () => {
  const dom = new JSDOM("<!DOCTYPE html><body><div id='ed'></div></body>");
  const ed = dom.window.document.getElementById("ed");
  const para = dom.window.document.createElement("p");
  const img = dom.window.document.createElement("figure");
  ed.append(para, img);
  Object.defineProperty(para, "offsetTop", { value: 40 });
  Object.defineProperty(para, "offsetHeight", { value: 40 });
  Object.defineProperty(img, "offsetTop", { value: 90 });
  Object.defineProperty(img, "offsetHeight", { value: 80 });
  keepBlocksOnPage(ed, 120, 20, 20, 24);
  assert(img.dataset.pdeKeep === "1");
  assert(Number.parseFloat(img.style.marginTop) > 20);
});
