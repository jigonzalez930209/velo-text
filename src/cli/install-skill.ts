import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type SkillInstallTargets = {
  cursor: boolean;
  agents: boolean;
};

export type SkillInstallResult = {
  packageRoot: string;
  written: string[];
};

export function listSkillFiles(src: string): string[] {
  if (!fs.existsSync(src)) throw new Error(`missing skill dir: ${src}`);
  const names = fs.readdirSync(src).filter((n) => n.endsWith(".md")).sort();
  if (!names.includes("SKILL.md")) throw new Error(`missing SKILL.md in ${src}`);
  return names;
}

export function packageRootFromCliModule(cliFileUrl: string): string {
  const cliDir = path.dirname(fileURLToPath(cliFileUrl));
  return path.resolve(cliDir, "..", "..");
}

export function skillSourceDir(pkgRoot: string): string {
  return path.join(pkgRoot, "skill");
}

export function destDirs(projectRoot: string, targets: SkillInstallTargets): string[] {
  const out: string[] = [];
  if (targets.cursor) out.push(path.join(projectRoot, ".cursor", "skills", "velo-text"));
  if (targets.agents) out.push(path.join(projectRoot, ".agents", "skills", "velo-text"));
  return out;
}

export function installSkill(
  projectRoot: string,
  targets: SkillInstallTargets,
  pkgRoot = packageRootFromCliModule(import.meta.url),
): SkillInstallResult {
  const src = skillSourceDir(pkgRoot);
  const files = listSkillFiles(src);
  const written: string[] = [];
  for (const dest of destDirs(projectRoot, targets)) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of files) {
      const to = path.join(dest, name);
      fs.copyFileSync(path.join(src, name), to);
      written.push(to);
    }
  }
  if (written.length === 0) throw new Error("no install targets (use --cursor and/or --agents)");
  return { packageRoot: pkgRoot, written };
}
