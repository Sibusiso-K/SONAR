import { execFileSync } from "node:child_process";
import path from "node:path";

/** Builds the fixture from the repo's real board data before any test runs. */
export default function globalSetup() {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  execFileSync(
    "python3",
    [
      path.join(repoRoot, "scripts", "export_radar_fixture.py"),
      path.join(import.meta.dirname, ".generated", "board.json"),
    ],
    { stdio: "inherit" },
  );
}
