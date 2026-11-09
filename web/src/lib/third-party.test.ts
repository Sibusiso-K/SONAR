import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regression guard. The page must not load fonts, images or scripts from a
 * third-party host at runtime. Google Fonts and Google's favicon service were
 * removed because they told Google which opportunities each visitor opened,
 * and unpkg was an unpinned floating dependency. Source links to other sites
 * (playbook references, organiser pages) are fine: they are not loaded.
 */
const SRC = fileURLToPath(new URL("..", import.meta.url));
const FORBIDDEN =
  /fonts\.googleapis\.com|fonts\.gstatic\.com|google\.com\/s2|unpkg\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("runtime resources", () => {
  it("are not loaded from third-party hosts", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});
