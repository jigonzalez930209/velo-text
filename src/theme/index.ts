/**
 * Theming — Phase 11
 * CSS tokens, four presets, .pde- scope
 */

export type ThemeName = "light-neutral" | "light-warm" | "dark-slate" | "dark-contrast";

export interface ThemeTokens {
  "--pde-color-bg": string;
  "--pde-color-surface": string;
  "--pde-color-text": string;
  "--pde-color-muted": string;
  "--pde-color-border": string;
  "--pde-color-primary": string;
  "--pde-color-primary-contrast": string;
  "--pde-color-selection": string;
  "--pde-color-variable-bg": string;
  "--pde-color-variable-text": string;
  "--pde-color-danger": string;
  "--pde-shadow-panel": string;
  "--pde-radius-sm": string;
  "--pde-radius-md": string;
  "--pde-font-ui": string;
}

export const themes: Record<ThemeName, ThemeTokens> = {
  "light-neutral": {
    "--pde-color-bg": "#ffffff",
    "--pde-color-surface": "#f7f8fa",
    "--pde-color-text": "#17191c",
    "--pde-color-muted": "#667085",
    "--pde-color-border": "#d8dce3",
    "--pde-color-primary": "#3659e3",
    "--pde-color-primary-contrast": "#ffffff",
    "--pde-color-selection": "#cbd7ff",
    "--pde-color-variable-bg": "#e8efff",
    "--pde-color-variable-text": "#1939a3",
    "--pde-color-danger": "#b42318",
    "--pde-shadow-panel": "0 8px 24px rgb(0 0 0 / 12%)",
    "--pde-radius-sm": "4px",
    "--pde-radius-md": "8px",
    "--pde-font-ui": "system-ui, sans-serif",
  },
  "light-warm": {
    "--pde-color-bg": "#fffaf3",
    "--pde-color-surface": "#fef3e2",
    "--pde-color-text": "#2b2111",
    "--pde-color-muted": "#8a7a65",
    "--pde-color-border": "#e8ddd0",
    "--pde-color-primary": "#b54708",
    "--pde-color-primary-contrast": "#ffffff",
    "--pde-color-selection": "#ffdfb0",
    "--pde-color-variable-bg": "#fff0d6",
    "--pde-color-variable-text": "#8a3d00",
    "--pde-color-danger": "#b42318",
    "--pde-shadow-panel": "0 8px 24px rgb(0 0 0 / 12%)",
    "--pde-radius-sm": "4px",
    "--pde-radius-md": "8px",
    "--pde-font-ui": "system-ui, sans-serif",
  },
  "dark-slate": {
    "--pde-color-bg": "#0f172a",
    "--pde-color-surface": "#1e293b",
    "--pde-color-text": "#e2e8f0",
    "--pde-color-muted": "#94a3b8",
    "--pde-color-border": "#334155",
    "--pde-color-primary": "#60a5fa",
    "--pde-color-primary-contrast": "#0f172a",
    "--pde-color-selection": "#1d4ed8",
    "--pde-color-variable-bg": "#1e3a5f",
    "--pde-color-variable-text": "#93c5fd",
    "--pde-color-danger": "#f87171",
    "--pde-shadow-panel": "0 8px 24px rgb(0 0 0 / 40%)",
    "--pde-radius-sm": "4px",
    "--pde-radius-md": "8px",
    "--pde-font-ui": "system-ui, sans-serif",
  },
  "dark-contrast": {
    "--pde-color-bg": "#000000",
    "--pde-color-surface": "#1a1a1a",
    "--pde-color-text": "#ffffff",
    "--pde-color-muted": "#a3a3a3",
    "--pde-color-border": "#404040",
    "--pde-color-primary": "#ffffff",
    "--pde-color-primary-contrast": "#000000",
    "--pde-color-selection": "#3b82f6",
    "--pde-color-variable-bg": "#262626",
    "--pde-color-variable-text": "#ffffff",
    "--pde-color-danger": "#ff4444",
    "--pde-shadow-panel": "0 8px 24px rgb(255 255 255 / 12%)",
    "--pde-radius-sm": "4px",
    "--pde-radius-md": "8px",
    "--pde-font-ui": "system-ui, sans-serif",
  },
};

export function themeCss(name: ThemeName): string {
  const tokens = themes[name];
  const vars = Object.entries(tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `.pde-root[data-pde-theme="${name}"] {\n${vars}\n}`;
}

export function allThemesCss(): string {
  return (Object.keys(themes) as ThemeName[]).map(themeCss).join("\n\n");
}
