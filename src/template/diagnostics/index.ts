export interface Diagnostic {
  code: string;
  severity: "error" | "warn" | "info";
  message: string;
  path?: string;
}

export function createDiagnostic(code: string, severity: Diagnostic["severity"], message: string, path?: string): Diagnostic {
  return { code, severity, message, path };
}
