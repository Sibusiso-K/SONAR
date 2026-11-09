import { describe, expect, it } from "vitest";
import { applySecurityHeaders, SECURITY_HEADERS } from "./security-headers";

describe("applySecurityHeaders", () => {
  it("adds every security header", async () => {
    const res = applySecurityHeaders(new Response("ok"));
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });

  it("preserves status, body and existing headers", async () => {
    const original = new Response("teapot", {
      status: 418,
      statusText: "I'm a teapot",
      headers: { "content-type": "text/plain", "x-custom": "1" },
    });
    const res = applySecurityHeaders(original);
    expect(res.status).toBe(418);
    expect(res.statusText).toBe("I'm a teapot");
    expect(await res.text()).toBe("teapot");
    expect(res.headers.get("x-custom")).toBe("1");
    expect(res.headers.get("content-type")).toBe("text/plain");
  });

  it("lets a route override a header it set deliberately", () => {
    const res = applySecurityHeaders(
      new Response("x", { headers: { "Referrer-Policy": "no-referrer" } }),
    );
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("works on a response whose headers are immutable", () => {
    expect(() =>
      applySecurityHeaders(Response.redirect("https://example.com/", 302)),
    ).not.toThrow();
  });

  it("forbids framing by other origins and plugins", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"]!;
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("does not set a script-src that would break hydration", () => {
    expect(SECURITY_HEADERS["Content-Security-Policy"]).not.toMatch(/script-src/);
  });
});
