/**
 * Sandboxed Zero-Dependency Expression Evaluator for Template Conditionals.
 * Pure recursive descent parser — zero dynamic code execution (no eval, no Function).
 */
import { safeResolve } from "../resolver/format.js";

export type TokenType =
  | "NUMBER"
  | "STRING"
  | "BOOLEAN"
  | "NULL"
  | "IDENTIFIER"
  | "OP_LOGICAL"
  | "OP_COMPARE"
  | "OP_NOT"
  | "LPAREN"
  | "RPAREN"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
}

/** Tokenize expression into a list of safe tokens. */
export function tokenizeExpression(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = expr.length;

  while (i < len) {
    const ch = expr[i]!;

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Two or three char operators: ===, !==, ==, !=, <=, >=, &&, ||
    if (expr.startsWith("===", i)) {
      tokens.push({ type: "OP_COMPARE", value: "===" });
      i += 3;
      continue;
    }
    if (expr.startsWith("!==", i)) {
      tokens.push({ type: "OP_COMPARE", value: "!==" });
      i += 3;
      continue;
    }
    if (expr.startsWith("==", i)) {
      tokens.push({ type: "OP_COMPARE", value: "==" });
      i += 2;
      continue;
    }
    if (expr.startsWith("!=", i)) {
      tokens.push({ type: "OP_COMPARE", value: "!=" });
      i += 2;
      continue;
    }
    if (expr.startsWith("<=", i)) {
      tokens.push({ type: "OP_COMPARE", value: "<=" });
      i += 2;
      continue;
    }
    if (expr.startsWith(">=", i)) {
      tokens.push({ type: "OP_COMPARE", value: ">=" });
      i += 2;
      continue;
    }
    if (expr.startsWith("&&", i)) {
      tokens.push({ type: "OP_LOGICAL", value: "&&" });
      i += 2;
      continue;
    }
    if (expr.startsWith("||", i)) {
      tokens.push({ type: "OP_LOGICAL", value: "||" });
      i += 2;
      continue;
    }

    // Single char operators & punctuation
    if (ch === "<" || ch === ">") {
      tokens.push({ type: "OP_COMPARE", value: ch });
      i++;
      continue;
    }
    if (ch === "!") {
      tokens.push({ type: "OP_NOT", value: "!" });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }

    // String literals: "..." or '...'
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = "";
      i++;
      while (i < len && expr[i] !== quote) {
        if (expr[i] === "\\" && i + 1 < len) {
          i++;
          str += expr[i];
        } else {
          str += expr[i];
        }
        i++;
      }
      if (i < len && expr[i] === quote) {
        i++; // skip closing quote
      }
      tokens.push({ type: "STRING", value: str });
      continue;
    }

    // Number literals: 123, 45.67
    if (/[0-9]/.test(ch)) {
      let numStr = "";
      while (i < len && /[0-9.]/.test(expr[i]!)) {
        numStr += expr[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: numStr });
      continue;
    }

    // Identifiers & keywords: booleans, null, variable paths (e.g. customer.isVip)
    if (/[a-zA-Z_$]/.test(ch)) {
      let idStr = "";
      while (i < len && /[a-zA-Z0-9_$.\[\]]/.test(expr[i]!)) {
        idStr += expr[i];
        i++;
      }
      if (idStr === "true" || idStr === "false") {
        tokens.push({ type: "BOOLEAN", value: idStr });
      } else if (idStr === "null") {
        tokens.push({ type: "NULL", value: idStr });
      } else {
        tokens.push({ type: "IDENTIFIER", value: idStr });
      }
      continue;
    }

    // Any unrecognized char: advance
    i++;
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

/**
 * Recursive Descent Expression Evaluator
 */
class ExpressionEvaluator {
  private tokens: Token[];
  private cursor = 0;
  private data: Record<string, unknown>;

  constructor(tokens: Token[], data: Record<string, unknown>) {
    this.tokens = tokens;
    this.data = data;
  }

  private peek(): Token {
    return this.tokens[this.cursor] ?? { type: "EOF", value: "" };
  }

  private consume(): Token {
    const tok = this.peek();
    this.cursor++;
    return tok;
  }

  public parse(): unknown {
    if (this.peek().type === "EOF") return false;
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): unknown {
    let left = this.parseLogicalAnd();

    while (this.peek().type === "OP_LOGICAL" && this.peek().value === "||") {
      this.consume();
      const right = this.parseLogicalAnd();
      left = left || right;
    }
    return left;
  }

  private parseLogicalAnd(): unknown {
    let left = this.parseEquality();

    while (this.peek().type === "OP_LOGICAL" && this.peek().value === "&&") {
      this.consume();
      const right = this.parseEquality();
      left = left && right;
    }
    return left;
  }

  private parseEquality(): unknown {
    let left = this.parseRelational();

    while (this.peek().type === "OP_COMPARE" && (this.peek().value === "==" || this.peek().value === "!=" || this.peek().value === "===" || this.peek().value === "!==")) {
      const op = this.consume().value;
      const right = this.parseRelational();
      if (op === "==" || op === "===") {
        left = left == right; // eslint-disable-line eqeqeq
      } else {
        left = left != right; // eslint-disable-line eqeqeq
      }
    }
    return left;
  }

  private parseRelational(): unknown {
    let left = this.parseUnary();

    while (this.peek().type === "OP_COMPARE" && (this.peek().value === "<" || this.peek().value === "<=" || this.peek().value === ">" || this.peek().value === ">=")) {
      const op = this.consume().value;
      const right = this.parseUnary();
      const numLeft = Number(left);
      const numRight = Number(right);

      if (op === "<") left = numLeft < numRight;
      else if (op === "<=") left = numLeft <= numRight;
      else if (op === ">") left = numLeft > numRight;
      else if (op === ">=") left = numLeft >= numRight;
    }
    return left;
  }

  private parseUnary(): unknown {
    if (this.peek().type === "OP_NOT") {
      this.consume();
      const val = this.parseUnary();
      return !val;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    const tok = this.peek();

    if (tok.type === "LPAREN") {
      this.consume();
      const val = this.parseLogicalOr();
      if (this.peek().type === "RPAREN") {
        this.consume();
      }
      return val;
    }

    if (tok.type === "STRING") {
      this.consume();
      return tok.value;
    }

    if (tok.type === "NUMBER") {
      this.consume();
      return Number(tok.value);
    }

    if (tok.type === "BOOLEAN") {
      this.consume();
      return tok.value === "true";
    }

    if (tok.type === "NULL") {
      this.consume();
      return null;
    }

    if (tok.type === "IDENTIFIER") {
      this.consume();
      // Neutralize prototype pollution/dangerous names
      if (tok.value.includes("__proto__") || tok.value.includes("constructor") || tok.value.includes("prototype")) {
        return undefined;
      }
      const res = safeResolve(this.data, tok.value);
      return res.found ? res.value : undefined;
    }

    return undefined;
  }
}

/**
 * Safely evaluates a boolean condition expression against payload data.
 * @param expr e.g. "customer.isVip", "score >= 80", "tier == 'gold' && active"
 * @param data context payload dictionary
 * @returns boolean truthiness result
 */
export function evaluateExpression(expr: string, data: Record<string, unknown>): boolean {
  if (!expr || typeof expr !== "string") return false;
  const trimmed = expr.trim();
  if (!trimmed) return false;

  try {
    const tokens = tokenizeExpression(trimmed);
    const evaluator = new ExpressionEvaluator(tokens, data);
    const result = evaluator.parse();
    return Boolean(result);
  } catch {
    return false;
  }
}
