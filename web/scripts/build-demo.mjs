/**
 * Builds the static demo: the entrance, the hall and the three games, with no API
 * routes and no database. Output lands in web/out and can be served by anything.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

rmSync(join(root, "out"), { recursive: true, force: true });
rmSync(join(root, ".next"), { recursive: true, force: true });

const result = spawnSync("npx", ["next", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DEMO_STATIC: "1", NEXT_PUBLIC_DEMO: "1" },
});

process.exit(result.status ?? 1);
