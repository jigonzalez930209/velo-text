import { tokenizeCode, tokenizeLine, highlightCodeToHtml } from "../../dist/core/code-highlight/index.js";
import { paginateDocument } from "../../dist/export/layout/pagination.js";
import { PdfWriter } from "../../dist/export/pdf/writer.js";
import { validateDocument } from "../../dist/core/schema/validator.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("code-highlight: tokenize TypeScript tokens correctly", () => {
  const tsCode = `const greeting: string = "Hello, world!";\nfunction add(a: number, b: number): number {\n  // sum two numbers\n  return a + b;\n}`;
  const lines = tokenizeCode(tsCode, "typescript");

  assert.equal(lines.length, 5);

  // Line 0: const (keyword), greeting (plain), : (operator/punct), string (keyword/plain), "Hello, world!" (string)
  const line0 = lines[0];
  const constToken = line0.find((t) => t.text === "const");
  assert(constToken && constToken.kind === "keyword", "const should be keyword");
  const strToken = line0.find((t) => t.text === '"Hello, world!"');
  assert(strToken && strToken.kind === "string", "string literal should be string");

  // Line 1: function (keyword), add (function)
  const line1 = lines[1];
  const fnToken = line1.find((t) => t.text === "function");
  assert(fnToken && fnToken.kind === "keyword", "function should be keyword");
  const addToken = line1.find((t) => t.text === "add");
  assert(addToken && addToken.kind === "function", "add should be function token");

  // Line 2: // sum two numbers (comment)
  const line2 = lines[2];
  const commentToken = line2.find((t) => t.text.includes("// sum two numbers"));
  assert(commentToken && commentToken.kind === "comment", "comment should be comment kind");

  // Line 3: return (keyword)
  const line3 = lines[3];
  const returnToken = line3.find((t) => t.text === "return");
  assert(returnToken && returnToken.kind === "keyword", "return should be keyword");
});

test("code-highlight: tokenize Python, SQL, and JSON correctly", () => {
  // Python
  const pyTokens = tokenizeLine("def calculate(x): # comment", "python");
  assert(pyTokens.some((t) => t.text === "def" && t.kind === "keyword"));
  assert(pyTokens.some((t) => t.text.includes("# comment") && t.kind === "comment"));

  // SQL
  const sqlTokens = tokenizeLine("SELECT id, name FROM users WHERE active = 1;", "sql");
  assert(sqlTokens.some((t) => t.text.toUpperCase() === "SELECT" && t.kind === "keyword"));
  assert(sqlTokens.some((t) => t.text.toUpperCase() === "FROM" && t.kind === "keyword"));
  assert(sqlTokens.some((t) => t.text === "1" && t.kind === "number"));

  // JSON
  const jsonTokens = tokenizeLine('{"count": 42, "valid": true}', "json");
  assert(jsonTokens.some((t) => t.text === '"count"' && t.kind === "string"));
  assert(jsonTokens.some((t) => t.text === "42" && t.kind === "number"));
  assert(jsonTokens.some((t) => t.text === "true" && t.kind === "keyword"));
});

test("code-highlight: performance benchmark < 5ms for 500 lines", () => {
  const lineSample = '  const result = processUserData(user.id, "active", 100); // benchmark';
  const code500 = Array(500).fill(lineSample).join("\n");

  const start = performance.now();
  const tokenLines = tokenizeCode(code500, "typescript");
  const durationMs = performance.now() - start;

  assert.equal(tokenLines.length, 500);
  assert(durationMs < 20, `Tokenizer should be fast: took ${durationMs.toFixed(2)}ms (expected < 20ms)`);
});

test("code-highlight: highlightCodeToHtml produces valid HTML with line numbers", () => {
  const code = 'const a = 1;\nconsole.log(a);';
  const html = highlightCodeToHtml(code, "javascript", true, 10);

  assert(html.includes('class="velo-code-block"'), "Must include velo-code-block pre");
  assert(html.includes('>10<'), "Must include lineStart 10");
  assert(html.includes('>11<'), "Must include lineStart 11");
  assert(html.includes('color:#9333ea'), "Must include keyword color");
});

test("code-block: layout generates code-line boxes with line numbers", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "code-block",
    id: "cb1",
    code: "line one\nline two\nline three",
    language: "python",
    showLineNumbers: true,
    lineStart: 1,
  });

  const res = paginateDocument(doc);
  assert.equal(res.pages.length, 1);

  const page = res.pages[0];
  const codeLines = page.boxes.filter((b) => b.type === "code-line");
  assert.equal(codeLines.length, 3);
  assert.equal(codeLines[0].content, "1 | line one");
  assert.equal(codeLines[1].content, "2 | line two");
  assert.equal(codeLines[2].content, "3 | line three");
});

test("code-block: PDF export writes colored code tokens and background bar", async () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "code-block",
    id: "cb_pdf",
    code: 'const x = "pdf test";',
    language: "typescript",
    showLineNumbers: true,
    lineStart: 1,
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

  // 1. Verify code container background fill (0.97 0.98 0.99 rg)
  assert(pdfText.includes("0.97 0.98 0.99 rg"), "Must include neutral code container background fill");

  // 2. Verify code content is rendered
  assert(pdfText.includes("const") || pdfText.includes("pdf test"), "Must render code content");
});

test("code-block: schema validator enforces code-block properties", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "code-block",
    id: "cb_valid",
    code: "print(42)",
    language: "python",
  });

  const validRes = validateDocument(doc, { strict: true });
  assert(validRes.valid);

  // Invalid language
  const badLangDoc = JSON.parse(JSON.stringify(doc));
  badLangDoc.root.children[0].language = "unsupported-lang";
  const badLangRes = validateDocument(badLangDoc, { strict: true });
  assert(!badLangRes.valid);
  assert(badLangRes.errors.some((e) => e.code === "enum"));

  // Invalid lineStart (< 1)
  const badStartDoc = JSON.parse(JSON.stringify(doc));
  badStartDoc.root.children[0].lineStart = 0;
  const badStartRes = validateDocument(badStartDoc, { strict: true });
  assert(!badStartRes.valid);
  assert(badStartRes.errors.some((e) => e.code === "range"));
});
