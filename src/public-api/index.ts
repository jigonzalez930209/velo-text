/**
 * API pública — Fase 12.1
 * Superficie mínima exportada
 */
export { createDocument, createIdGenerator, createSystemClock, createParagraph, createHeading, createText, createVariable, createImageBlock, createTable } from "../core/model/factories.js";
export { validateDocument, assertValid } from "../core/schema/validator.js";
export { canonicalStringify, canonicalBytes, contentHashHex } from "../core/schema/canonical.js";
export { normalizeDocument, isIdempotent } from "../core/normalize/normalize.js";
export { createTransaction } from "../core/operations/operations.js";
export { createCollapsedSelection, createRangeSelection, isCollapsed, mapSelectionThroughOps } from "../core/selection/selection.js";
export { History } from "../core/history/history.js";
export { parseVariableSource, tokenizeVariablesInText } from "../template/parser/parser.js";
export { safeResolve, formatValue, renderTemplate, inspectVariables } from "../template/resolver/resolver.js";
export { XmlWriter } from "../export/xml/writer.js";
export { crc32 } from "../export/zip/crc32.js";
export { ZipWriter } from "../export/zip/zipWriter.js";
export { PdfWriter } from "../export/pdf/writer.js";
export { OdtWriter } from "../export/odt/writer.js";
export { DocxWriter } from "../export/docx/writer.js";
export { exportDocument } from "../export/index.js";
export { sniffImage, isAllowedMediaType } from "../assets/sniff/index.js";
export { getDimensions } from "../assets/dimensions/index.js";
export { sanitizeSvg } from "../assets/svg/index.js";
export { themes, themeCss, allThemesCss } from "../theme/index.js";
export { renderDocumentToHtml } from "../editor-web/view/index.js";
export { registerCommand, getCommand, listCommands } from "../editor-web/toolbar/index.js";

export type { PortableDocument, BlockNode, InlineNode, TextNode, VariableNode, AssetRef, PageSettings, Selection, RangeSelection, BinarySink, AssetResolver, Clock, IdGenerator } from "../core/model/types.js";
export type { ExportFormat, ExportRequest, ExportResult } from "../export/index.js";
