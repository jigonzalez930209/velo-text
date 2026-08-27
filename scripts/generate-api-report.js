#!/usr/bin/env node
/**
 * Generate public API report — Phase 11.2.2
 * Extracts exports from dist/public-api and validates semver surface.
 */
import fs from "node:fs";
import path from "node:path";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const apiPath = "dist/public-api/index.d.ts";

if (!fs.existsSync(apiPath)) {
  console.error(`Missing ${apiPath} — run pnpm run build first`);
  process.exit(1);
}

const dts = fs.readFileSync(apiPath, "utf8");
const exports = [...dts.matchAll(/export\s+(?:declare\s+)?(?:function|class|const|interface|type)\s+(\w+)/g)].map((m) => m[1]);
const unique = [...new Set(exports)].sort();

const report = `# Public API Report — ${pkg.name} v${pkg.version}
Generated: ${new Date().toISOString()}

## Exports from \`src/public-api\`
${unique.map((e) => `- \`${e}\``).join("\n")}

## Entry points (package.json exports)
${Object.entries(pkg.exports ?? {}).map(([k, v]) => `- \`${k}\`: ${JSON.stringify(v)}`).join("\n")}

## Zero runtime dependencies
${Object.keys(pkg.dependencies ?? {}).length === 0 ? "PASS — no runtime deps" : "FAIL"}

## Types
- Main types: \`${pkg.types}\`
- Declarations: \`${apiPath}\`

## Changelog guidance
- Follow semver: breaking changes require major bump
- Document deprecations in CHANGELOG.md before removal
`;

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/api-report.md", report);
console.log("Generated docs/api-report.md");
console.log(report);
