/**
 * Response headers applied to every response from the server entry.
 *
 * The CSP here is deliberately partial. It covers the directives that are
 * safe to enforce without changing how the page runs (who may frame it, which
 * base URL and form targets are allowed, no plugins). It does NOT set
 * script-src: server-rendered hydration injects inline scripts, so a strict
 * script policy needs a per-request nonce wired through the router first.
 * Shipping a half-working strict policy would break the site; this does not.
 *
 * frame-ancestors still permits Lovable's preview iframe, because the project
 * is edited there; production on Vercel is unaffected by that allowance.
 */
const CSP = [
  "frame-ancestors 'self' https://lovable.dev https://*.lovable.dev https://*.lovable.app",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

/**
 * Returns the response with security headers added. Headers a route set
 * itself win, so a route can loosen one deliberately. Builds a new Response
 * because the headers of a fetched or streamed Response may be immutable.
 */
export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
