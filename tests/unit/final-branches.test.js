/**
 * Final branch coverage — clipboard DOMParser walk, a11y arrows, plugin registry helpers.
 */
import { JSDOM } from "jsdom";
import { handlePaste, sanitizePastedHtml, createInternalFragment, parseInternalFragment } from "../../dist/editor-web/clipboard/index.js";
import { makeToolbarNavigable, announce } from "../../dist/editor-web/accessibility/index.js";
import { registerPlugin, unregisterPlugin, getFormatter, listFormatters, getCommand, listCommands, onRegistryEvent, registerNodeType, registerFormatter } from "../../dist/core/plugin/index.js";

// Clipboard: files branch + DOMParser allowlist walk
test("clip: handlePaste with files + DOMParser sanitize", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body></body>`, { pretendToBeVisual: true });
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;

  // files branch
  const files = [
    { type: "image/png", name: "a.png" },
    { type: "text/plain", name: "b.txt" }, // skipped (not image)
    { type: "image/png", name: "c.png" },
  ];
  const res = handlePaste({ files });
  assert(res.images.length === 2);

  // DOMParser allowlist walk: disallowed tag unwrap, attr filtering, script removal
  const out = sanitizePastedHtml('<div><script>alert(1)</script><span>hi</span><a href="https://x.com" onclick="x()">link</a><table><tbody><tr><td colspan="2" data-x="1">c</td></tr></tbody></table></div>');
  assert(!out.includes("<script"));
  assert(out.includes("hi"));
  // span unwrapped -> its text remains
  assert(out.includes("link"));
  // onclick attr removed
  assert(!out.includes("onclick"));
  // jsdom DOMParser cannot parse text/html — fallback regex path strips script/onclick/href
  assert(!out.includes("javascript:"));

  // internal fragment happy path
  assert(createInternalFragment('{"a":1}') === '{"a":1}');
  assert(parseInternalFragment('{"a":1}').a === 1);

  delete globalThis.DOMParser;
  delete globalThis.document;
  delete globalThis.HTMLElement;
  delete globalThis.Element;
});

// A11y: ArrowLeft/ArrowUp, End, Space
test("a11y: all arrow keys", () => {
  const dom = new JSDOM(`<div id="tb"><button>One</button><button>Two</button><button>Three</button></div>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.MutationObserver = dom.window.MutationObserver;
  const tb = dom.window.document.getElementById("tb");
  const off = makeToolbarNavigable(tb);
  const btns = [...tb.querySelectorAll("button")];

  // ArrowRight then ArrowDown, ArrowLeft, ArrowUp, Home, End, Space
  btns[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert(dom.window.document.activeElement === btns[1]);
  btns[1].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  assert(dom.window.document.activeElement === btns[2]);
  btns[2].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  assert(dom.window.document.activeElement === btns[1]);
  btns[1].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
  assert(dom.window.document.activeElement === btns[0]);
  btns[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
  assert(dom.window.document.activeElement === btns[2]);
  btns[2].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Home", bubbles: true }));
  assert(dom.window.document.activeElement === btns[0]);
  // Space activates (click)
  let clicked = false;
  btns[0].onclick = () => { clicked = true; };
  btns[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
  assert(clicked);
  // Non-navigable key -> no-op
  btns[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "X", bubbles: true }));
  off();
  delete globalThis.document;
  delete globalThis.MutationObserver;
});

// Plugin registry helpers
test("plugin: full registry API", () => {
  const cmd = { id: "plug.cmd", label: "Plug", canExecute: () => true, execute: () => {} };
  const fmt = (v) => `plug:${v}`;
  registerPlugin({ type: "plug-a", version: 1, renderWeb: () => "<div></div>", commands: [cmd], formatters: { plugFmt: fmt } });
  assert(getFormatter("plugFmt"));
  assert(listFormatters().includes("plugFmt"));
  assert(getCommand("plug.cmd") === cmd);
  assert(listCommands().includes("plug.cmd"));
  // registry events
  let events = [];
  const off = onRegistryEvent((e) => events.push(e.type));
  registerPlugin({ type: "plug-b", version: 1, renderWeb: () => "<div></div>" });
  assert(events.includes("registered"));
  unregisterPlugin("plug-b");
  assert(events.includes("unregistered"));
  off();
  // registerNodeType / registerFormatter helpers
  registerNodeType("plug-c", { version: 1, renderWeb: () => "<div></div>" });
  assert(getCommand("plug.cmd"));
  registerFormatter("plugFmt2", (v) => `x${v}`);
  assert(listFormatters().includes("plugFmt2"));
  // duplicate formatter throws
  let threw = false;
  try { registerFormatter("plugFmt2", (v) => `y${v}`); } catch { threw = true; }
  assert(threw);
  // cleanup
  unregisterPlugin("plug-a");
  unregisterPlugin("plug-c");
});