import type { SupportedCodeLanguage } from "../model/block.js";

export type TokenKind =
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "operator"
  | "function"
  | "punctuation"
  | "plain";

export interface CodeToken {
  kind: TokenKind;
  text: string;
  colorHex: string;
}

export const THEME_COLORS: Record<TokenKind, string> = {
  keyword: "#9333ea",
  string: "#0f766e",
  number: "#d97706",
  comment: "#64748b",
  operator: "#e11d48",
  function: "#2563eb",
  punctuation: "#475569",
  plain: "#1e293b",
};

interface PatternRule {
  kind: TokenKind;
  regex: RegExp;
}

const JS_TS_KEYWORDS =
  /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|default|break|continue|import|export|from|as|class|extends|super|this|new|typeof|instanceof|void|delete|in|of|try|catch|finally|throw|async|await|yield|null|undefined|true|false|type|interface|enum|implements|public|private|protected|readonly|static|declare|namespace|abstract)\b/;

const PYTHON_KEYWORDS =
  /\b(?:def|return|if|elif|else|for|while|try|except|finally|with|as|import|from|class|lambda|pass|break|continue|yield|raise|in|is|not|and|or|None|True|False|global|nonlocal|assert|async|await)\b/;

const SQL_KEYWORDS =
  /\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|UNION|ALL|AS|AND|OR|NOT|IN|IS|NULL|LIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END|DISTINCT|COUNT|SUM|AVG|MIN|MAX|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT)\b/i;

const BASH_KEYWORDS =
  /\b(?:if|then|else|elif|fi|case|esac|for|while|until|do|done|in|function|select|time|echo|exit|export|local|read|return|set|unset)\b/;

function getRules(lang: SupportedCodeLanguage): PatternRule[] {
  switch (lang) {
    case "typescript":
    case "javascript":
      return [
        { kind: "comment", regex: /^(?:\/\/.*|\/\*[\s\S]*?\*\/)/ },
        { kind: "string", regex: /^(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/ },
        { kind: "number", regex: /^(?:0[xXbBoO][0-9a-fA-F]+|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/ },
        { kind: "keyword", regex: new RegExp(`^${JS_TS_KEYWORDS.source}`) },
        { kind: "function", regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/ },
        { kind: "operator", regex: /^[+\-*/%=!<>&|^~?:]+/ },
        { kind: "punctuation", regex: /^[{}()[\];,.]/ },
      ];
    case "python":
      return [
        { kind: "comment", regex: /^#.*/ },
        { kind: "string", regex: /^(?:"""[\s\S]*?"""|'''[\s\S]*?'''|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/ },
        { kind: "number", regex: /^\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/ },
        { kind: "keyword", regex: new RegExp(`^${PYTHON_KEYWORDS.source}`) },
        { kind: "function", regex: /^[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/ },
        { kind: "operator", regex: /^[+\-*/%=!<>&|^~:]+/ },
        { kind: "punctuation", regex: /^[{}()[\];,.]/ },
      ];
    case "json":
      return [
        { kind: "string", regex: /^"(?:[^"\\]|\\.)*"/ },
        { kind: "number", regex: /^-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/ },
        { kind: "keyword", regex: /^\b(?:true|false|null)\b/ },
        { kind: "punctuation", regex: /^[{}[\],:]/ },
      ];
    case "sql":
      return [
        { kind: "comment", regex: /^(?:--.*|\/\*[\s\S]*?\*\/)/ },
        { kind: "string", regex: /^'(?:[^'\\]|\\.)*'/ },
        { kind: "number", regex: /^\b\d+(?:\.\d+)?\b/ },
        { kind: "keyword", regex: new RegExp(`^${SQL_KEYWORDS.source}`, "i") },
        { kind: "function", regex: /^[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/ },
        { kind: "operator", regex: /^[=<>!+\-*/%]+/ },
        { kind: "punctuation", regex: /^[(),;.]/ },
      ];
    case "html":
      return [
        { kind: "comment", regex: /^<!--[\s\S]*?-->/ },
        { kind: "string", regex: /^(?:"[^"]*"|'[^']*')/ },
        { kind: "keyword", regex: /^<\/?(?:[a-zA-Z0-9:-]+)?/ },
        { kind: "function", regex: /^[a-zA-Z0-9:-]+(?==)/ },
        { kind: "operator", regex: /^[<>/=]/ },
      ];
    case "css":
      return [
        { kind: "comment", regex: /^\/\*[\s\S]*?\*\// },
        { kind: "string", regex: /^(?:"[^"]*"|'[^']*')/ },
        { kind: "number", regex: /^(?:#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|pt|s|ms)?\b)/ },
        { kind: "keyword", regex: /^[a-zA-Z-]+(?=\s*:)/ },
        { kind: "punctuation", regex: /^[:;{}()]/ },
      ];
    case "bash":
      return [
        { kind: "comment", regex: /^#.*/ },
        { kind: "string", regex: /^(?:"(?:[^"\\]|\\.)*"|'[^']*')/ },
        { kind: "function", regex: /^\$(?:[a-zA-Z_][a-zA-Z0-9_]*|\{[^}]+\})/ },
        { kind: "keyword", regex: new RegExp(`^${BASH_KEYWORDS.source}`) },
        { kind: "operator", regex: /^[|&;<>+=!-]+/ },
      ];
    case "plain":
    default:
      return [];
  }
}

/**
 * High-speed single-pass regex micro-tokenizer.
 * Operates in O(N) complexity with zero external dependencies.
 */
export function tokenizeLine(line: string, language: SupportedCodeLanguage): CodeToken[] {
  if (!line) return [];
  const rules = getRules(language);
  if (rules.length === 0) {
    return [{ kind: "plain", text: line, colorHex: THEME_COLORS.plain }];
  }

  const tokens: CodeToken[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // 1. Whitespace run
    const wsMatch = remaining.match(/^\s+/);
    if (wsMatch) {
      const ws = wsMatch[0];
      tokens.push({ kind: "plain", text: ws, colorHex: THEME_COLORS.plain });
      remaining = remaining.slice(ws.length);
      if (!remaining.length) break;
    }

    // 2. Try match rules
    let matched = false;
    for (const rule of rules) {
      const m = remaining.match(rule.regex);
      if (m && m[0].length > 0) {
        const text = m[0];
        tokens.push({ kind: rule.kind, text, colorHex: THEME_COLORS[rule.kind] });
        remaining = remaining.slice(text.length);
        matched = true;
        break;
      }
    }

    // 3. Fallback single char if no rule matched
    if (!matched) {
      // Consume consecutive plain identifier/chars until space or special char
      const plainMatch = remaining.match(/^[a-zA-Z0-9_$]+/) ?? remaining.match(/^./);
      const plainText = plainMatch ? plainMatch[0] : remaining[0]!;
      tokens.push({ kind: "plain", text: plainText, colorHex: THEME_COLORS.plain });
      remaining = remaining.slice(plainText.length);
    }
  }

  return tokens;
}

/**
 * Tokenize a multi-line code string into lines of tokens.
 */
export function tokenizeCode(code: string, language: SupportedCodeLanguage): CodeToken[][] {
  const lines = code.split("\n");
  return lines.map((line) => tokenizeLine(line, language));
}

/**
 * Convert code to HTML markup with syntax highlighting spans.
 */
export function highlightCodeToHtml(code: string, language: SupportedCodeLanguage, showLineNumbers = true, lineStart = 1): string {
  const tokenLines = tokenizeCode(code, language);
  let html = `<pre class="velo-code-block" data-language="${language}"><code>`;

  tokenLines.forEach((tokens, idx) => {
    const lineNum = lineStart + idx;
    html += `<span class="velo-code-line">`;
    if (showLineNumbers) {
      html += `<span class="velo-code-linenum" style="color:#94a3b8;user-select:none;margin-right:12px;">${lineNum}</span>`;
    }
    for (const token of tokens) {
      const esc = token.text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      html += `<span style="color:${token.colorHex}">${esc}</span>`;
    }
    html += `\n</span>`;
  });

  html += `</code></pre>`;
  return html;
}
