/**
 * XmlWriter — Phase 8.1.1 / 9.1 centralizado
 * Centralized escaping, namespaces, stable names
 */
export class XmlWriter {
  private parts: string[] = [];
  private stack: string[] = [];

  static escape(str: string): string {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  static escapeAttr(str: string): string {
    return XmlWriter.escape(str);
  }

  declaration(): this {
    this.parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    return this;
  }

  open(tag: string, attrs: Record<string, string | number | undefined> = {}): this {
    const attrStr = Object.entries(attrs)
      .filter(([, v]) => v != null)
      .map(([k, v]) => ` ${k}="${XmlWriter.escapeAttr(String(v))}"`)
      .join("");
    this.parts.push(`<${tag}${attrStr}>`);
    this.stack.push(tag);
    return this;
  }

  selfClose(tag: string, attrs: Record<string, string | number | undefined> = {}): this {
    const attrStr = Object.entries(attrs)
      .filter(([, v]) => v != null)
      .map(([k, v]) => ` ${k}="${XmlWriter.escapeAttr(String(v))}"`)
      .join("");
    this.parts.push(`<${tag}${attrStr}/>`);
    return this;
  }

  close(): this {
    const tag = this.stack.pop();
    if (!tag) throw new Error("unbalanced close");
    this.parts.push(`</${tag}>`);
    return this;
  }

  text(str: string): this {
    this.parts.push(XmlWriter.escape(str));
    return this;
  }

  raw(str: string): this {
    this.parts.push(str);
    return this;
  }

  toString(): string {
    return this.parts.join("");
  }

  toBytes(): Uint8Array {
    return new TextEncoder().encode(this.toString());
  }
}
