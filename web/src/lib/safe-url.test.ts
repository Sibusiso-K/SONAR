import { describe, expect, it } from "vitest";
import { safeHref } from "./safe-url";

describe("safeHref", () => {
  it("passes ordinary http and https URLs through", () => {
    expect(safeHref("https://example.com/path?q=1#x")).toBe("https://example.com/path?q=1#x");
    expect(safeHref("http://example.com/")).toBe("http://example.com/");
  });

  it("trims surrounding whitespace", () => {
    expect(safeHref("  https://example.com  ")).toBe("https://example.com/");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "mailto:someone@example.com",
    "ftp://example.com/file",
  ])("rejects %s", (bad) => {
    expect(safeHref(bad)).toBeUndefined();
  });

  it("rejects relative and protocol-relative URLs", () => {
    expect(safeHref("/admin")).toBeUndefined();
    expect(safeHref("//evil.example/x")).toBeUndefined();
    expect(safeHref("example.com")).toBeUndefined();
  });

  it("rejects empty and non-string input", () => {
    expect(safeHref("")).toBeUndefined();
    expect(safeHref("   ")).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref(42 as unknown as string)).toBeUndefined();
  });
});
