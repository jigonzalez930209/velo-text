# Publish with GitHub Actions

Releases go out **only from GitHub CI**. Do not publish from your laptop.

Current version: **`1.0.4`** (npm dist-tag `beta`).

```bash
pnpm add velo-text@beta
```

## 1. One-time: npm token in GitHub

1. [npm Access Tokens](https://www.npmjs.com/settings/~/) → **Generate New Token** (Granular or Automation) with **publish**.
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
3. Name: **`NPM_TOKEN`**
4. Value: the npm token.

Nothing else. No `.npmrc` in the repo.

## 2. Ship a version (this is the release)

On `main`, bump version then push the matching tag (that starts **Publish npm**):

```bash
pnpm version:set 1.0.4
# edit CHANGELOG.md if needed
git add -A && git commit -m "release: 1.0.4"
git tag v1.0.4
git push origin HEAD
git push origin v1.0.4
```

`scripts/set-version.sh` writes `package.json` and the current-version docs. The git tag must equal `package.json` `version` (`v` + version).

1. Runs checks (types, lint, unit, integration, security, PDF smoke).
2. Publishes to [npmjs.com/package/velo-text](https://www.npmjs.com/package/velo-text) with tag `beta` (any `package.json` version that contains `-` uses `beta`; a clean `1.0.4` uses `latest`).
3. Creates a **GitHub Release** for that tag.

Watch it: **Actions → Publish npm**.

## Docs on GitHub Pages

CI (`verify`) builds VitePress with `DOCS_BASE=/velo-text/` and uploads the static site. On push to `main`/`master`, the `deploy-docs` job publishes it to GitHub Pages.

One-time: repo **Settings → Pages → Source: GitHub Actions**. Site URL: `https://<owner>.github.io/velo-text/`.

The git tag must equal `package.json` `version` (`v` + version).

## 3. Manual run (no new tag)

**Actions → Publish npm → Run workflow** publishes whatever version is on the branch you pick. Use this only if the package is not on npm yet and you already bumped `package.json`. Prefer a git tag.

## After it is green

- Install: `pnpm add velo-text@beta`
- Next beta: bump to `1.0.4`, commit, tag `v1.0.4`, push the tag.
- Stable 1.0: set version `1.0.4` (no `-beta`), tag `v1.0.4` → CI publishes `latest`.
