import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const run = (args) => {
  const result = spawnSync(pnpm, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes("placeholder")
) {
  run(["exec", "node", "scripts/ensure_ogtt_table.mjs"]);
} else {
  console.warn("DATABASE_URL is not configured; skipping database migrations.");
}

run(["--filter", "@workspace/cms", "build"]);
run(["--filter", "web", "build"]);
