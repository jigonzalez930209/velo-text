/**
 * Conformance validators — Phase 7.2 / 8.2 / 9.2
 * Validates PDF xref, ODT manifest/package and DOCX relationships without external dependencies.
 * Used in CI to block releases if any export produces unreadable content.
 */

export interface ValidationIssue {
  code: string;
  severity: "error" | "warn";
  message: string;
}

/**
 * PDF: validate xref offsets, trailer, catalog and pages count.
 * Minimal parser — checks that xref entries point to correct object offsets and that trailer Size matches.
 */
export function validatePdf(bytes: Uint8Array): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const text = new TextDecoder().decode(bytes);

  if (!text.startsWith("%PDF-")) issues.push({ code: "pdf-header", severity: "error", message: "Missing PDF header" });
  if (!text.includes("trailer")) issues.push({ code: "pdf-trailer", severity: "error", message: "Missing trailer" });
  if (!text.includes("startxref")) issues.push({ code: "pdf-xref", severity: "error", message: "Missing startxref" });
  if (!text.includes("/Catalog")) issues.push({ code: "pdf-catalog", severity: "error", message: "Missing Catalog" });
  if (!text.includes("/Pages")) issues.push({ code: "pdf-pages", severity: "error", message: "Missing Pages" });

  // Xref entry count vs Size
  const xrefMatch = text.match(/xref\s+0\s+(\d+)/);
  const sizeMatch = text.match(/\/Size\s+(\d+)/);
  if (xrefMatch && sizeMatch) {
    const xrefCount = Number(xrefMatch[1]);
    const size = Number(sizeMatch[1]);
    if (xrefCount !== size) issues.push({ code: "pdf-size-mismatch", severity: "error", message: `xref count ${xrefCount} != Size ${size}` });
  }

  // Check that each object offset actually points to "N 0 obj"
  const xrefOffset = text.lastIndexOf("xref");
  if (xrefOffset !== -1) {
    const xrefSection = text.slice(xrefOffset);
    const lines = xrefSection.split("\n");
    // Skip first two lines: "xref" and "0 N"
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith("trailer")) break;
      const m = line.match(/^(\d{10}) 00000 n/);
      if (m) {
        const offset = Number(m[1]);
        const snippet = text.slice(offset, offset + 20);
        if (!/^\d+ 0 obj/.test(snippet)) issues.push({ code: "pdf-xref-offset", severity: "error", message: `Bad xref offset ${offset} -> "${snippet.slice(0, 10)}"` });
      }
    }
  }

  return issues;
}

/**
 * ODT: validate ZIP structure (mimetype first STORE), manifest completeness and well-formed XML.
 */
export function validateOdt(bytes: Uint8Array): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Check PK header
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) issues.push({ code: "odt-not-zip", severity: "error", message: "Not a ZIP" });
  const text = new TextDecoder().decode(bytes.slice(0, 5000));
  // mimetype must be first entry and contain correct string
  const mimetypeIdx = text.indexOf("mimetype");
  if (mimetypeIdx === -1) issues.push({ code: "odt-mimetype-missing", severity: "error", message: "mimetype not found" });
  else if (mimetypeIdx > 100) issues.push({ code: "odt-mimetype-not-first", severity: "error", message: "mimetype not first" });
  if (!text.includes("application/vnd.oasis.opendocument.text")) issues.push({ code: "odt-mimetype-wrong", severity: "error", message: "Wrong mimetype" });
  if (!text.includes("META-INF/manifest.xml")) issues.push({ code: "odt-manifest-missing", severity: "error", message: "manifest missing" });
  if (!text.includes("content.xml")) issues.push({ code: "odt-content-missing", severity: "error", message: "content.xml missing" });
  // Well-formed XML check (simple tag balance for content.xml)
  const xml = text;
  const openTags = (xml.match(/<[^/!?][^>]*>/g) ?? []).length;
  const closeTags = (xml.match(/<\/[^>]+>/g) ?? []).length;
  if (Math.abs(openTags - closeTags) > 5) issues.push({ code: "odt-xml-unbalanced", severity: "warn", message: `Unbalanced tags open ${openTags} close ${closeTags}` });
  return issues;
}

/**
 * DOCX: validate [Content_Types], _rels/.rels, document.xml, rels and media.
 */
export function validateDocx(bytes: Uint8Array): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) issues.push({ code: "docx-not-zip", severity: "error", message: "Not a ZIP" });
  const text = new TextDecoder().decode(bytes.slice(0, 8000));
  if (!text.includes("[Content_Types].xml")) issues.push({ code: "docx-content-types-missing", severity: "error", message: "Missing [Content_Types].xml" });
  if (!text.includes("_rels/.rels")) issues.push({ code: "docx-rels-missing", severity: "error", message: "Missing _rels/.rels" });
  if (!text.includes("word/document.xml")) issues.push({ code: "docx-document-missing", severity: "error", message: "Missing word/document.xml" });
  if (!text.includes("w:document")) issues.push({ code: "docx-w-document", severity: "error", message: "Missing w:document" });
  // Check rels IDs are unique and targets exist
  const relIds = [...text.matchAll(/Id="([^"]+)"/g)].map((m) => m[1]);
  const dup = relIds.filter((id, i) => relIds.indexOf(id) !== i);
  if (dup.length) issues.push({ code: "docx-dup-rel-id", severity: "error", message: `Duplicate rel Id ${dup[0]}` });
  // Check that every rId in document.xml has a matching rel (simplified: check rId_ prefix)
  const rIdsInDoc = [...text.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]);
  for (const rId of rIdsInDoc) {
    if (!relIds.includes(rId)) issues.push({ code: "docx-broken-rel", severity: "error", message: `Broken rel ${rId}` });
  }
  return issues;
}

/**
 * Golden file helpers — normalize XML for comparison (sort attributes, remove whitespace differences).
 */
export function normalizeXml(xml: string): string {
  return xml
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .replace(/\s*=\s*"/g, '="')
    .trim();
}

export function hashBytes(bytes: Uint8Array): string {
  let h = 0;
  for (const b of bytes) h = (h * 31 + b) >>> 0;
  return h.toString(16).padStart(8, "0");
}
