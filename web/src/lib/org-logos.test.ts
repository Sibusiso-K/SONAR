import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOGO_FILES, logoSrc } from "./org-logos";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "org-logos");

describe("organiser logos", () => {
  it("has a file on disk for every mapped logo", () => {
    for (const { file } of LOGO_FILES) {
      expect(existsSync(join(DIR, file)), file).toBe(true);
    }
  });

  it("serves only PNGs, so no logo can carry a script", () => {
    const images = readdirSync(DIR).filter((f) => !f.endsWith(".md"));
    expect(images.every((f) => f.endsWith(".png"))).toBe(true);
  });

  it("matches organiser text as the board shows it", () => {
    expect(logoSrc("Entelect")).toBe("/org-logos/entelect.png");
    expect(logoSrc("IBM (via BeMyApp): TechXchange 2026 pre-conference")).toBe(
      "/org-logos/ibm.png",
    );
    expect(logoSrc("Zindi, for the Reclaiming Our Atlantic Destiny programme")).toBe(
      "/org-logos/zindi.png",
    );
  });

  it("leaves organisers without a checked logo on initials", () => {
    expect(logoSrc("Huawei ICT Academy")).toBeNull();
    expect(logoSrc("Wits Entrepreneurship Hub (E-Hub), Wits University")).toBeNull();
  });
});
