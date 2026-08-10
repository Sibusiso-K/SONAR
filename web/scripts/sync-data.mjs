/**
 * Copy the canonical board out of the repo root into the app.
 *
 * The repo IS the database. `data/opportunities.json` at the root is written
 * by the verification pipeline and reviewed in PRs; this just makes it
 * importable by Next at build time. Runs before dev and before build.
 *
 * Keeping the copy explicit (rather than importing across the project root)
 * means Vercel's Root Directory can be `web/` with no path trickery.
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const repoRoot = join(webRoot, "..");

const files = [
  ["data", "opportunities.json"],
  ["data", "updates.json"],
];
const destDir = join(webRoot, "data");
mkdirSync(destDir, { recursive: true });

let copied = 0;
for (const parts of files) {
  const src = join(repoRoot, ...parts);
  const dest = join(destDir, parts[parts.length - 1]);
  if (!existsSync(src)) {
    console.error(
      `[sync-data] missing ${src}\n` +
        `            run: python3 scripts/migrate_to_opportunities.py`
    );
    process.exit(1);
  }
  copyFileSync(src, dest);
  copied++;
}
console.log(`[sync-data] ${copied} file(s) → web/data/`);
