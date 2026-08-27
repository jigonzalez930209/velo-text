const FORBIDDEN = new Set<string>(["__proto__", "prototype", "constructor"]);
const MAX_DEPTH = 10;
export const MAX_VALUE_LENGTH = 10_000;

export type ResolveResult = { found: true; value: unknown } | { found: false; error?: string };

export function safeResolve(data: unknown, path: string): ResolveResult {
  if (typeof path !== "string") return { found: false };
  const parts: Array<string | number> = [];
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    if (m[1]) parts.push(m[1]);
    else if (m[2]) parts.push(Number(m[2]));
  }
  if (parts.length > MAX_DEPTH) return { found: false, error: "depth-exceeded" };
  if (parts.some((p) => typeof p === "string" && FORBIDDEN.has(p))) return { found: false, error: "forbidden" };
  let cur: unknown = data;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return { found: false };
    if (!Object.prototype.hasOwnProperty.call(cur as Record<string, unknown>, String(p))) return { found: false };
    cur = (cur as Record<string, unknown>)[String(p)];
  }
  return { found: true, value: cur };
}

export function formatValue(value: unknown, format: string | undefined, locale = "es-AR", timezone = "America/Argentina/Buenos_Aires"): string {
  if (!format) {
    if (value == null) return "";
    const str = String(value);
    return str.length > MAX_VALUE_LENGTH ? str.slice(0, MAX_VALUE_LENGTH) : str;
  }
  const [name, arg] = format.split(":");
  try {
    switch (name) {
      case "currency": {
        const cur = arg ?? "ARS";
        const nf = new Intl.NumberFormat(locale, { style: "currency", currency: cur });
        return nf.format(Number(value));
      }
      case "number": {
        const nf = new Intl.NumberFormat(locale);
        return nf.format(Number(value));
      }
      case "percent": {
        const nf = new Intl.NumberFormat(locale, { style: "percent" });
        return nf.format(Number(value));
      }
      case "date": {
        const d = value instanceof Date ? value : new Date(value as string);
        if (Number.isNaN(d.getTime())) return String(value);
        if (arg) {
          const dd = String(d.getDate()).padStart(2, "0");
          const MM = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = String(d.getFullYear());
          if (arg === "dd/MM/yyyy") return `${dd}/${MM}/${yyyy}`;
          if (arg === "yyyy-MM-dd") return `${yyyy}-${MM}-${dd}`;
        }
        return new Intl.DateTimeFormat(locale, { timeZone: timezone }).format(d);
      }
      case "upper":
        return String(value).toUpperCase();
      case "lower":
        return String(value).toLowerCase();
      default:
        return String(value);
    }
  } catch {
    return String(value);
  }
}
