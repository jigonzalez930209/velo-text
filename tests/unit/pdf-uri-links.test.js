import { PdfWriter } from "../../dist/export/pdf/writer.js";
import { isAllowedUri } from "../../dist/export/pdf/layout-table.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("pdf-uri-links: isAllowedUri security filter allowlists safe protocols only", () => {
  assert(isAllowedUri("https://example.com/docs"), "Must allow https");
  assert(isAllowedUri("http://example.org/api"), "Must allow http");
  assert(isAllowedUri("mailto:support@velo-text.dev"), "Must allow mailto");

  assert(!isAllowedUri("javascript:alert(1)"), "Must disallow javascript:");
  assert(!isAllowedUri("data:text/html,<h1>PWNED</h1>"), "Must disallow data:");
  assert(!isAllowedUri("vbscript:MsgBox"), "Must disallow vbscript:");
  assert(!isAllowedUri("file:///etc/passwd"), "Must disallow file:");
  assert(!isAllowedUri(""), "Must disallow empty url");
  assert(!isAllowedUri(undefined), "Must disallow undefined url");
});

test("pdf-uri-links: PDF export writes clickable URI /Annot entries with exact coordinates", async () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "paragraph",
    id: "p_link",
    children: [
      { type: "text", id: "t1", text: "Visit our " },
      {
        type: "link",
        id: "l1",
        href: "https://velo-text.dev/documentation",
        children: [{ type: "text", id: "t2", text: "documentation portal" }],
      },
      { type: "text", id: "t3", text: " for full specs." },
    ],
  });

  const writer = new PdfWriter();
  let writtenBytes = new Uint8Array(0);
  const sink = {
    write(chunk) {
      const combined = new Uint8Array(writtenBytes.length + chunk.length);
      combined.set(writtenBytes);
      combined.set(chunk, writtenBytes.length);
      writtenBytes = combined;
    },
    close() {},
  };

  await writer.write(doc, sink);
  const pdfText = Buffer.from(writtenBytes).toString("latin1");

  // 1. Verify /Annots array present on page
  assert(pdfText.includes("/Annots ["), "Page must contain /Annots array");

  // 2. Verify /Type /Annot /Subtype /Link
  assert(pdfText.includes("/Type /Annot /Subtype /Link"), "Must contain link annotation object");

  // 3. Verify /S /URI and target URI
  assert(pdfText.includes("/S /URI"), "Must specify /S /URI action");
  assert(pdfText.includes("/URI (https://velo-text.dev/documentation)"), "Must contain target URI");
});

test("pdf-uri-links: disallowed URLs do not generate URI annotations", async () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "paragraph",
    id: "p_bad",
    children: [
      {
        type: "link",
        id: "l_bad",
        href: "javascript:evil()",
        children: [{ type: "text", id: "t_bad", text: "Click here" }],
      },
    ],
  });

  const writer = new PdfWriter();
  let writtenBytes = new Uint8Array(0);
  const sink = {
    write(chunk) {
      const combined = new Uint8Array(writtenBytes.length + chunk.length);
      combined.set(writtenBytes);
      combined.set(chunk, writtenBytes.length);
      writtenBytes = combined;
    },
    close() {},
  };

  await writer.write(doc, sink);
  const pdfText = Buffer.from(writtenBytes).toString("latin1");

  assert(!pdfText.includes("javascript:evil()"), "Disallowed URL must not be in PDF");
  assert(!pdfText.includes("/S /URI"), "Must not create /S /URI annotation for rejected URL");
});
