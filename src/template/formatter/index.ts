export type FormatterName = "currency" | "number" | "percent" | "date" | "upper" | "lower" | "text" | "boolean";
export interface FormatterContext {
  locale: string;
  timezone: string;
}
export type FormatterFn = (value: unknown, arg: string | undefined, ctx: FormatterContext) => string;

export const formatters: Record<FormatterName, FormatterFn> = {
  text: (v) => String(v ?? ""),
  number: (v, _a, ctx) => new Intl.NumberFormat(ctx.locale).format(Number(v)),
  currency: (v, arg, ctx) => new Intl.NumberFormat(ctx.locale, { style: "currency", currency: arg ?? "ARS" }).format(Number(v)),
  percent: (v, _a, ctx) => new Intl.NumberFormat(ctx.locale, { style: "percent" }).format(Number(v)),
  date: (v, arg, ctx) => {
    const d = v instanceof Date ? v : new Date(v as string);
    if (Number.isNaN(d.getTime())) return String(v);
    if (arg === "dd/MM/yyyy") {
      const dd = String(d.getDate()).padStart(2, "0");
      const MM = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = String(d.getFullYear());
      return `${dd}/${MM}/${yyyy}`;
    }
    return new Intl.DateTimeFormat(ctx.locale, { timeZone: ctx.timezone }).format(d);
  },
  upper: (v) => String(v).toUpperCase(),
  lower: (v) => String(v).toLowerCase(),
  boolean: (v) => (v ? "true" : "false"),
};

export function registerFormatter(name: string, _fn: FormatterFn): void {
  // registro dinámico futuro; por ahora no-op tipado
  void name; void _fn;
}
