import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { installSkill, destDirs, listSkillFiles, skillSourceDir } from "../../dist/cli/install-skill.js";
import { parseArgs, runCli } from "../../dist/cli/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "velo-skill-"));
}

test("parseArgs defaults to skill with cursor and agents", () => {
  const p = parseArgs([]);
  assert.equal(p.command, "skill");
  assert.equal(p.targets.cursor, true);
  assert.equal(p.targets.agents, true);
});

test("parseArgs --help", () => {
  const p = parseArgs(["--help"]);
  assert.equal(p.help, true);
});

test("parseArgs unknown throws", () => {
  assert.throws(() => parseArgs(["--wat"]));
});

test("installSkill writes cursor and agents copies", () => {
  const dir = tmpProject();
  const n = listSkillFiles(skillSourceDir(repoRoot)).length;
  const r = installSkill(dir, { cursor: true, agents: true }, repoRoot);
  assert.equal(r.written.length, n * 2);
  const skill = fs.readFileSync(path.join(dir, ".cursor", "skills", "velo-text", "SKILL.md"), "utf8");
  assert(skill.includes("PortableDocument"));
  assert(fs.existsSync(path.join(dir, ".agents", "skills", "velo-text", "model.md")));
  assert(fs.existsSync(path.join(dir, ".cursor", "skills", "velo-text", "export.md")));
});

test("installSkill --no-agents only cursor", () => {
  const dir = tmpProject();
  installSkill(dir, { cursor: true, agents: false }, repoRoot);
  assert.equal(destDirs(dir, { cursor: true, agents: false }).length, 1);
  assert(fs.existsSync(path.join(dir, ".cursor", "skills", "velo-text", "SKILL.md")));
  assert(!fs.existsSync(path.join(dir, ".agents")));
});

test("installSkill no targets throws", () => {
  const dir = tmpProject();
  assert.throws(() => installSkill(dir, { cursor: false, agents: false }, repoRoot));
});

test("runCli help exits 0", async () => {
  const code = await runCli(["--help"]);
  assert.equal(code, 0);
});

test("runCli unknown exits 1", async () => {
  const code = await runCli(["--nope"]);
  assert.equal(code, 1);
});

test("bin velo-text skill --dir", () => {
  const dir = tmpProject();
  const bin = path.join(repoRoot, "bin", "velo-text.js");
  const r = spawnSync(process.execPath, [bin, "skill", "--dir", dir, "--no-agents"], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  assert.equal(r.status, 0, r.stderr);
  assert(fs.existsSync(path.join(dir, ".cursor", "skills", "velo-text", "SKILL.md")));
});
