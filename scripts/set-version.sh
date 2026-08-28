#!/usr/bin/env bash
# Set the library version (package.json + current-version docs).
# Usage:
#   ./scripts/set-version.sh 1.0.0-beta.1
#   ./scripts/set-version.sh 1.0.0-beta.1 --tag    # also create local git tag v…
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NEW="${1:-}"
MAKE_TAG="${2:-}"

if [[ -z "$NEW" || "$NEW" == "-h" || "$NEW" == "--help" ]]; then
  echo "Usage: $0 <version> [--tag]"
  echo "  version  semver, e.g. 1.0.0-beta.1 or 1.0.0"
  echo "  --tag    create local git tag v<version> (does not push)"
  exit 1
fi

if ! [[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid version: $NEW"
  echo "Expected like 1.0.0 or 1.0.0-beta.0"
  exit 1
fi

OLD="$(node -p "require('./package.json').version")"
if [[ "$OLD" == "$NEW" ]]; then
  echo "Already at $NEW"
  exit 0
fi

export OLD NEW
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const oldV = process.env.OLD;
const newV = process.env.NEW;
const root = process.cwd();
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.version = newV;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

function swap(file, from, to) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return;
  const src = fs.readFileSync(p, "utf8");
  if (!src.includes(from)) return;
  fs.writeFileSync(p, src.split(from).join(to));
}

// Live "current version" copy only — do not rewrite CHANGELOG history.
const live = [
  "README.md",
  "docs/index.md",
  "docs/guide/introduction.md",
  "docs/guide/publish.md",
  "docs/release-checklist.md",
];
for (const f of live) swap(f, oldV, newV);

const cl = path.join(root, "CHANGELOG.md");
let changelog = fs.readFileSync(cl, "utf8");
if (!changelog.includes(`## [${newV}]`)) {
  const today = new Date().toISOString().slice(0, 10);
  const block = `## [${newV}] - ${today}\n\n### Added\n- \n\n`;
  const u = changelog.indexOf("## [Unreleased]");
  const next = u === -1 ? -1 : changelog.indexOf("\n## [", u + 1);
  if (next !== -1) {
    changelog = changelog.slice(0, next + 1) + "\n" + block + changelog.slice(next + 1);
  } else {
    changelog = changelog.replace("# Changelog\n", `# Changelog\n\n${block}`);
  }
  const link = `[${newV}]: https://github.com/velo-text/velo-text/releases/tag/v${newV}\n`;
  if (!changelog.includes(`[${newV}]:`)) changelog += link;
  fs.writeFileSync(cl, changelog);
}
console.log(`version ${oldV} → ${newV}`);
NODE

echo "Review CHANGELOG.md, then:"
echo "  git add -A && git commit -m \"release: $NEW\""
echo "  git tag v$NEW && git push origin HEAD && git push origin v$NEW"

if [[ "$MAKE_TAG" == "--tag" ]]; then
  if git rev-parse "v$NEW" >/dev/null 2>&1; then
    echo "Tag v$NEW already exists"
    exit 1
  fi
  git tag "v$NEW"
  echo "Created local tag v$NEW (push with: git push origin v$NEW)"
fi
