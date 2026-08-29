import path from "node:path";
import { installSkill, type SkillInstallTargets } from "./install-skill.js";

const HELP = `velo-text — portable document editor CLI

Install the agent skill into a project (Cursor + Claude Code / agents):

  npx velo-text@beta skill
  pnpx velo-text@beta skill

Options:
  skill              Copy SKILL.md into the project (default command)
  --dir <path>       Project root (default: cwd)
  --cursor           Write .cursor/skills/velo-text (default: on)
  --agents           Write .agents/skills/velo-text (default: on)
  --no-cursor        Skip Cursor skill
  --no-agents        Skip .agents skill
  -h, --help         Show this help

Library (separate from the skill):

  pnpm add velo-text@beta
`;

export function parseArgs(argv: string[]): {
  help: boolean;
  command: "skill" | "help";
  dir: string;
  targets: SkillInstallTargets;
} {
  const targets: SkillInstallTargets = { cursor: true, agents: true };
  let dir = process.cwd();
  let command: "skill" | "help" = "skill";
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help" || a === "help") {
      help = true;
      command = "help";
    } else if (a === "skill") {
      command = "skill";
    } else if (a === "--dir") {
      const next = argv[++i];
      if (!next) throw new Error("--dir requires a path");
      dir = path.resolve(next);
    } else if (a === "--cursor") targets.cursor = true;
    else if (a === "--agents") targets.agents = true;
    else if (a === "--no-cursor") targets.cursor = false;
    else if (a === "--no-agents") targets.agents = false;
    else throw new Error(`unknown argument: ${a}`);
  }
  return { help, command, dir, targets };
}

export async function runCli(argv: string[]): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    if (parsed.help || parsed.command === "help") {
      process.stdout.write(HELP);
      return 0;
    }
    const result = installSkill(parsed.dir, parsed.targets);
    for (const f of result.written) process.stdout.write(`wrote ${f}\n`);
    process.stdout.write(
      "skill installed. Add the library with: pnpm add velo-text@beta\n",
    );
    return 0;
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}
